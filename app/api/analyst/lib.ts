import { promises as fs } from "fs";
import path from "path";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";
import { citedChunks } from "@/lib/desk/corpus";

// Grounding corpus for the AI Analyst (spec Section 8). Priority order:
// user uploads, then the preloaded sample documents, then the Shell fixture
// context, then AIE dataset facts. Scripted sample mode (no ANTHROPIC_API_KEY)
// answers extractively from these chunks and never generates a figure.

export interface Chunk {
  source: string;
  sourceKind:
    | "upload"
    | "document"
    | "shell-fixture"
    | "aie-dataset"
    | "cited";
  text: string;
}

export interface UploadRecord {
  name: string;
  text: string | null; // null when the format was accepted but not parsed
  size: number;
}

// In-memory, per-session upload store (uploads live for the session only).
const uploadStore = new Map<string, UploadRecord[]>();

export function getUploads(sid: string): UploadRecord[] {
  return uploadStore.get(sid) ?? [];
}

export function setUploads(sid: string, uploads: UploadRecord[]) {
  uploadStore.set(sid, uploads);
}

const PRELOADED = [
  { file: "vendor-assessment-brief.md", label: "Shell AI vendor assessment brief (sample)" },
  { file: "eu-ai-act-readiness-note.md", label: "EU AI Act readiness note (sample)" },
  { file: "integrator-shortlist-memo.md", label: "Integrator shortlist memo (sample)" },
];

export async function preloadedDocs(): Promise<{ label: string; text: string }[]> {
  const dir = path.join(process.cwd(), "fixtures", "analyst-docs");
  return Promise.all(
    PRELOADED.map(async (d) => ({
      label: d.label,
      text: await fs.readFile(path.join(dir, d.file), "utf8"),
    }))
  );
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40);
}

export async function buildCorpus(sid: string): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for (const u of getUploads(sid)) {
    if (u.text) {
      for (const p of paragraphs(u.text)) {
        chunks.push({ source: u.name, sourceKind: "upload", text: p });
      }
    }
  }
  for (const d of await preloadedDocs()) {
    for (const p of paragraphs(d.text)) {
      chunks.push({ source: d.label, sourceKind: "document", text: p });
    }
  }
  // The Shell fixture used to be injected here, so a cited finding could rest
  // on one exemplar company's invented figures while the reader was asking
  // about their own. It left with the fixture from Company View: a citation
  // reading "Shell company fixture (SAMPLE)" under a decision someone has to
  // defend is worse than one fewer source.
  //
  // What a reader's own documents contribute is above, and is the right way
  // for company-specific fact to enter this corpus: they uploaded it.
  // The cited material: vendor terms quoted from their own documents, the
  // sovereignty read derived from them, dated model retirements, and the
  // encroachment receipts. Added 6 August 2026.
  //
  // This is the strongest evidence in the product and it was not reachable by
  // the analyst at all. Without it, a question like "can OpenAI train on our
  // data" retrieved a one-line vendor description and the model answered from
  // memory, which is exactly the failure the figure and vendor-name guards
  // cannot catch: the sentence is fluent, names a real vendor, contains no
  // number, and may still be wrong about a contract somebody is about to sign.
  for (const c of citedChunks()) {
    chunks.push({ source: c.source, sourceKind: "cited", text: c.text });
  }
  // AIE dataset facts (real dataset content, qualitative only)
  for (const v of TRACKED_VENDORS) {
    chunks.push({
      source: "AIE dataset (ranking-engine)",
      sourceKind: "aie-dataset",
      text: `${v.name} is tracked in the AIE dataset as a ${v.layer} layer vendor${v.isPublic ? ", publicly listed" : ", privately held"}${v.brTicker ? `, with live BoardRadar coverage under ${v.brTicker}` : ""}.`,
    });
  }
  return chunks;
}

const STOPWORDS = new Set(
  "a an and are as at be by for from has have how in is it its of on or our that the this to was we what when where which who will with your you".split(" ")
);

/**
 * Crude suffix stripping, so a question and a chunk that use different forms
 * of the same word still meet.
 *
 * Plain substring matching is asymmetric and silently loses the reverse case.
 * A question containing "train" matches a chunk saying "trains", because the
 * chunk contains the shorter string. A question containing "retired" does NOT
 * match a chunk saying "retiring", because neither contains the other. That
 * one cost real recall: "which models are being retired and when do our calls
 * start failing" retrieved no deprecation chunk at all, so the most actionable
 * evidence in the corpus, dated model retirements, was unreachable by the
 * plainest way of asking for it.
 *
 * Deliberately not a real stemmer. It runs on both sides and is paired with a
 * prefix test, so over-stripping costs a little precision and never silently
 * drops a match. For a keyword retriever feeding a model that must cite what
 * it was given, recall is the side to err on.
 */
function stem(word: string): string {
  const s = word.replace(/(ations|ation|ements|ement|ings|ing|ers|er|ed|es|s)$/, "");
  return s.length >= 3 ? s : word;
}

export function retrieve(corpus: Chunk[], question: string, k = 4): { chunk: Chunk; score: number }[] {
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const stems = terms.map(stem);
  const scored = corpus.map((chunk) => {
    const hay = chunk.text.toLowerCase();
    // Tokenised once per chunk so the stem test is a prefix test against whole
    // words, not a substring scan that would match inside unrelated ones.
    const words = hay.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const wordStems = new Set(words.map(stem));
    let score = 0;
    for (let i = 0; i < terms.length; i += 1) {
      // The original substring test first, so nothing that matched before
      // stops matching now. The stem test only ever adds recall.
      if (hay.includes(terms[i]) || wordStems.has(stems[i])) score += 1;
    }
    // At equal keyword score: the reader's own documents first, then material
    // quoted from a vendor's published terms, then the sample documents, then
    // fixtures. Cited sits above `document` because a sentence lifted out of
    // the contract that governs the reader beats a sample memo about contracts
    // in general, and below `upload` because the reader's own agreement beats
    // the public one every time.
    const kindBoost =
      chunk.sourceKind === "upload"
        ? 0.3
        : chunk.sourceKind === "cited"
          ? 0.25
          : chunk.sourceKind === "document"
            ? 0.2
            : chunk.sourceKind === "shell-fixture"
              ? 0.1
              : 0;
    return { chunk, score: score + (score > 0 ? kindBoost : 0) };
  });
  return scored
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function approxTokens(text: string): number {
  return Math.round(text.split(/\s+/).length * 1.3);
}

// The spec says the analyst key comes from ANTHROPIC_API_KEY in .env.local,
// supplied by Michael. The shell environment on a developer machine can
// carry its own key, and Next.js lets shell values win, so reading
// process.env there could silently spend on a key nobody supplied to this
// app. So on a machine that has a .env.local, that file is the only source:
// if it exists and carries no key, the answer is no key, and the shell is
// never consulted.
//
// Deployed there is no such file. .env.local is gitignored and never ships,
// so the read throws and the platform's own environment is the only place a
// key can come from. That branch is what makes the key settable on Vercel at
// all; without it the analyst and Interrogate are permanently scripted in
// production however the project is configured.
let cachedKey: string | null | undefined;
export async function analystApiKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    const match = raw.match(/^ANTHROPIC_API_KEY=(.*)$/m);
    const value = match?.[1]?.trim() ?? "";
    cachedKey = value.length > 0 ? value : null;
  } catch {
    const fromPlatform = (process.env.ANTHROPIC_API_KEY ?? "").trim();
    cachedKey = fromPlatform.length > 0 ? fromPlatform : null;
  }
  return cachedKey;
}

/**
 * Whether a live analyst key is configured, as a boolean and nothing more.
 *
 * The two panels that run on this key each carried a hardcoded "Scripted
 * sample mode (no API key)" badge. It was a literal, not a reading: it said
 * "no API key" on production where the key was set, and it said it before any
 * request had been made, which is the same mistake the lane badges exist to
 * prevent, never assert a mode before you know it.
 *
 * Returns only whether a key exists. The value never leaves the server.
 */
export async function analystKeyConfigured(): Promise<boolean> {
  return (await analystApiKey()) !== null;
}

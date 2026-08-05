import { promises as fs } from "fs";
import path from "path";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";

// Grounding corpus for the AI Analyst (spec Section 8). Priority order:
// user uploads, then the preloaded sample documents, then the Shell fixture
// context, then AIE dataset facts. Scripted sample mode (no ANTHROPIC_API_KEY)
// answers extractively from these chunks and never generates a figure.

export interface Chunk {
  source: string;
  sourceKind: "upload" | "document" | "shell-fixture" | "aie-dataset";
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

export function retrieve(corpus: Chunk[], question: string, k = 4): { chunk: Chunk; score: number }[] {
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  const scored = corpus.map((chunk) => {
    const hay = chunk.text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 1;
    }
    // uploads outrank documents outrank fixtures at equal keyword score
    const kindBoost =
      chunk.sourceKind === "upload" ? 0.3 : chunk.sourceKind === "document" ? 0.2 : chunk.sourceKind === "shell-fixture" ? 0.1 : 0;
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

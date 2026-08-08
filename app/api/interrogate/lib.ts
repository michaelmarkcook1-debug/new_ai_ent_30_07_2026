import { promises as fs } from "fs";
import path from "path";
import { buildCorpus, retrieve, type Chunk } from "../analyst/lib";

// Interrogate engine (hero piece, mirroring the deployed AIE app's
// Interrogate pattern): the user states their situation, we ask a small
// number of sharp questions shaped by what is still unknown, then write a
// tailored finding grounded only in cited sources. Scripted sample mode
// asks from a curated bank and assembles an extractive finding; live mode
// (ANTHROPIC_API_KEY in .env.local) generates with the tiered models.

export interface InterrogateState {
  situation: string;
  answers: string[];
  depth: "quick" | "comprehensive";
  /**
   * A company the reader already researched in Your AI Position, when their
   * situation names it. Null is the normal case and the engine works exactly as
   * it did before when it is.
   *
   * Statements here came from retrieved web pages and were cited on that page.
   * They are the reader's own prior research, not grounding this engine
   * retrieved, and live.ts keeps that distinction in the prompt so the finding
   * cannot pass them off as its own sourced claims.
   */
  position: {
    name: string;
    industry: string;
    what: string;
    aiFindings: string[];
    findings: string[];
  } | null;
}

interface Facets {
  industry: string | null;
  scale: boolean;
  constraint: string | null;
  stack: string[];
}

const INDUSTRIES: Record<string, string> = {
  energy: "Energy",
  oil: "Energy",
  utility: "Energy",
  bank: "Financial services",
  financ: "Financial services",
  insur: "Financial services",
  health: "Healthcare",
  pharma: "Healthcare",
  retail: "Retail and consumer",
  manufactur: "Manufacturing",
  industrial: "Manufacturing",
  public: "Public sector",
  government: "Public sector",
  legal: "Legal",
  telecom: "Telecoms",
  tech: "Technology",
  software: "Technology",
  education: "Education",
  media: "Media",
};

const CONSTRAINTS: Record<string, string> = {
  regulat: "regulatory compliance",
  governance: "governance",
  compliance: "regulatory compliance",
  sovereign: "data sovereignty",
  residency: "data sovereignty",
  privacy: "privacy",
  cost: "cost",
  budget: "cost",
  cheap: "cost",
  speed: "speed to value",
  fast: "speed to value",
  security: "security",
  lock: "vendor lock-in",
};

const VENDOR_WORDS = [
  "openai", "anthropic", "claude", "gpt", "microsoft", "copilot", "azure",
  "google", "gemini", "vertex", "aws", "bedrock", "meta", "llama", "mistral",
  "cohere", "ibm", "watsonx", "salesforce", "servicenow", "sap", "oracle",
  "databricks", "snowflake", "glean", "moveworks", "nvidia",
];

export function detectFacets(text: string): Facets {
  const t = text.toLowerCase();
  let industry: string | null = null;
  for (const [k, v] of Object.entries(INDUSTRIES)) {
    if (t.includes(k)) {
      industry = v;
      break;
    }
  }
  let constraint: string | null = null;
  for (const [k, v] of Object.entries(CONSTRAINTS)) {
    if (t.includes(k)) {
      constraint = v;
      break;
    }
  }
  const scale =
    /\b\d{2,}[,.]?\d*\s*(k|thousand|hundred|staff|people|employees|users|seats)\b/.test(t) ||
    /\b(enterprise|global|group-wide|company-wide)\b/.test(t);
  const stack = VENDOR_WORDS.filter((v) => t.includes(v));
  return { industry, scale, constraint, stack };
}

// Question bank, asked only for facets still missing. Order matters.
export function nextQuestion(state: InterrogateState): string | null {
  const combined = [state.situation, ...state.answers].join("\n");
  const facets = detectFacets(combined);
  const maxQuestions = state.depth === "quick" ? 1 : 3;
  if (state.answers.length >= maxQuestions) return null;

  // A saved position already establishes the sector, so asking for it would
  // make a reader who just researched their own company answer a question the
  // product could see the answer to. detectFacets works by string matching and
  // will not find "Online grocery retail and technology" in a sentence that
  // does not contain it, which is why this is checked separately rather than
  // by appending the position to `combined`.
  const industryKnown = Boolean(facets.industry || state.position?.industry);

  if (!industryKnown) {
    return "Which industry and regulatory context does your organisation operate in? That decides which regimes and reference deployments matter.";
  }
  if (!facets.scale) {
    return "Roughly what scale are we planning for: how many people would touch this in year one, and is it one function or group-wide?";
  }
  if (!facets.constraint) {
    return "What is the binding constraint: governance and compliance, cost, speed to value, security, or avoiding vendor lock-in?";
  }
  if (facets.stack.length === 0 && state.depth === "comprehensive") {
    return "What is already in the estate: which cloud agreements and AI tools do you have today?";
  }
  return null;
}

// AIE live grounding: vendor summaries and pillars from the deployed app,
// fetched server-side with a fixture fallback so Interrogate always grounds.
let aieGroundCache: { chunks: Chunk[]; at: number } | null = null;

async function aieUpstreamOrFixture(name: string): Promise<unknown | null> {
  if (process.env.MOCK_MODE !== "true") {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://ranking-engine-red.vercel.app/api/${name}`,
        { signal: controller.signal, cache: "no-store" }
      );
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch {
      // fall through to fixture
    }
  }
  try {
    return JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "fixtures", "aie-live", `${name}.json`),
        "utf8"
      )
    );
  } catch {
    return null;
  }
}

export async function aieGroundingChunks(): Promise<Chunk[]> {
  if (aieGroundCache && Date.now() - aieGroundCache.at < 300_000) {
    return aieGroundCache.chunks;
  }
  const chunks: Chunk[] = [];
  const meta = (await aieUpstreamOrFixture("metadata")) as {
    vendors?: { id: string; name: string; category: string; summary: string }[];
    pillars?: { id: string; label: string; defaultWeight: number }[];
  } | null;
  if (meta?.vendors) {
    for (const v of meta.vendors) {
      if (v.summary) {
        chunks.push({
          source: "AIE live (ranking-engine)",
          sourceKind: "aie-dataset",
          text: `${v.name} (${v.category}): ${v.summary}`,
        });
      }
    }
  }
  if (meta?.pillars) {
    chunks.push({
      source: "AIE live (ranking-engine)",
      sourceKind: "aie-dataset",
      text: `The AIE assessment engine scores vendors across six pillars with default weights: ${meta.pillars
        .map((p) => `${p.label} ${Math.round(p.defaultWeight * 100)} per cent`)
        .join(", ")}. Weights shift dynamically with industry, data sensitivity, risk tolerance, autonomy appetite and budget sensitivity.`,
    });
  }
  aieGroundCache = { chunks, at: Date.now() };
  return chunks;
}

export async function interrogateCorpus(sid: string): Promise<Chunk[]> {
  const base = await buildCorpus(sid);
  const aie = await aieGroundingChunks();
  return [...base, ...aie];
}

// Scripted finding: assembled entirely from grounded extracts, cited.
export function scriptedFinding(
  state: InterrogateState,
  corpus: Chunk[]
): { finding: string; citations: { source: string; kind: string }[] } {
  const combined = [state.situation, ...state.answers].join("\n");
  const facets = detectFacets(combined);
  const hits = retrieve(corpus, combined, 6);

  const parts: string[] = [];
  parts.push(
    `Reading of your situation: ${[
      facets.industry ? `${facets.industry} context` : "industry not stated",
      facets.scale ? "enterprise scale" : "scale not stated",
      facets.constraint ? `binding constraint ${facets.constraint}` : "constraint not stated",
      facets.stack.length > 0 ? `existing stack signals: ${facets.stack.join(", ")}` : "no stack named",
    ].join("; ")}.`
  );

  if (hits.length === 0) {
    parts.push(
      "The grounded sources do not cover this situation. Rather than guess, that is stated plainly: try naming the industry, the workflow, or the vendors under consideration."
    );
  } else {
    parts.push("What the grounded, cited sources support:");
    hits.forEach((h, i) => {
      parts.push(`${i + 1}. "${h.chunk.text}" (${h.chunk.source})`);
    });
  }

  parts.push(
    "Where to go next in this workspace: the vendor rankings for the evidence table, Trust Rank for the regulatory grid, and Assess and Decide for the weighted decision with its derivation."
  );

  return {
    finding: parts.join("\n\n"),
    citations: hits.map((h) => ({ source: h.chunk.source, kind: h.chunk.sourceKind })),
  };
}

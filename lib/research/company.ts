import { webSearch, groundingBlock, searchAvailable, type SearchHit } from "./search";
import { authored, llmAvailable } from "@/lib/analyst/llm";

// Research a company the product does not already track.
//
// Company View was a single fixture for one company. This replaces the fixture
// with retrieval: filings and web results for whatever name the reader types,
// and an analyst reading written over those and nothing else.
//
// The rule that governs the rest of the product governs this too, and it is
// the reason this is retrieval rather than recall. The model is never asked
// what it knows about a company. It is handed passages that were fetched
// seconds earlier, each with the URL it came from, and every figure it writes
// is checked back against that text. A number that was not in a retrieved
// passage cannot reach the page, so "researched by AI" here means the sources
// were found automatically, not that the answer was remembered.
//
// What this cannot do is worth stating plainly, because the alternative is a
// reader assuming otherwise. It cannot audit. A figure from a press release is
// reported as a figure from a press release. Where nothing is retrieved, the
// section says so rather than thinning out a guess to fill it.

export interface CompanyFinding {
  /** The claim, in the words of the analyst model. */
  statement: string;
  /** Index into `sources`, so every claim opens the page it came from. */
  sourceIndex: number;
}

export interface CompanyResearch {
  query: string;
  /** Null when nothing was retrieved and no profile could be established. */
  profile: {
    name: string;
    what: string;
    industry: string;
  } | null;
  findings: CompanyFinding[];
  /** AI-specific findings, kept apart because that is what this product is for. */
  aiFindings: CompanyFinding[];
  sources: SearchHit[];
  /** Why the result is thin or empty, in the product's own language. */
  absence: string | null;
  /** True when a model wrote the statements; false when nothing was written. */
  written: boolean;
}

const empty = (query: string, absence: string): CompanyResearch => ({
  query,
  profile: null,
  findings: [],
  aiFindings: [],
  sources: [],
  absence,
  written: false,
});

interface Draft {
  name?: string;
  what?: string;
  industry?: string;
  findings?: { statement?: string; source?: number }[];
  aiFindings?: { statement?: string; source?: number }[];
}

/** Keeps only claims that point at a source we actually retrieved. */
function cited(
  raw: { statement?: string; source?: number }[] | undefined,
  sourceCount: number
): CompanyFinding[] {
  return (raw ?? [])
    .filter(
      (f): f is { statement: string; source: number } =>
        typeof f?.statement === "string" &&
        f.statement.trim().length > 0 &&
        typeof f.source === "number" &&
        f.source >= 1 &&
        f.source <= sourceCount
    )
    .map((f) => ({ statement: f.statement.trim(), sourceIndex: f.source - 1 }));
}

export async function researchCompany(
  query: string
): Promise<CompanyResearch> {
  const name = query.trim();
  if (name.length < 2) return empty(name, "Enter a company name to research.");

  if (!searchAvailable()) {
    return empty(
      name,
      "No web search provider is configured, so this company cannot be researched. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY to switch it on."
    );
  }

  // Two passes: what the company is, and what it is doing with AI. Asked
  // separately because a single blended query returns a homepage summary and
  // buries the AI evidence this product exists to surface.
  const [general, ai] = await Promise.all([
    webSearch(`${name} company overview revenue employees industry`, 6),
    webSearch(`${name} artificial intelligence strategy adoption deployment`, 6),
  ]);

  const sources = [...general.hits, ...ai.hits];
  if (sources.length === 0) {
    return empty(
      name,
      general.unavailable ??
        ai.unavailable ??
        "Nothing was retrieved for this company, so no profile is shown rather than an assumed one."
    );
  }

  if (!llmAvailable()) {
    return {
      ...empty(name, null as unknown as string),
      sources,
      absence:
        "Sources were retrieved but no analyst model is configured to read them, so the links are shown without a written reading.",
    };
  }

  const grounding = groundingBlock(sources);

  const draft = await authored<Draft>(
    `company:${name.toLowerCase()}`,
    grounding,
    `Read these retrieved passages about ${name} and report what they support.

Return JSON:
{"name": string, "what": string, "industry": string,
 "findings": [{"statement": string, "source": number}],
 "aiFindings": [{"statement": string, "source": number}]}

- name: the company's name as the sources give it.
- what: one sentence on what the company does.
- industry: the sector, in two or three words.
- findings: up to 5. What a buyer should know about the company's size, position and direction. Each cites the passage number it came from.
- aiFindings: up to 5. What the sources say about this company's use of, or exposure to, AI. Each cites its passage number. If the passages say nothing about AI, return an empty array rather than inferring.

Every statement must be supported by the passage it cites. Do not carry in anything you know about this company that the passages do not contain, and do not smooth over a disagreement between two sources: say they disagree.`,
    1600
  );

  if (!draft?.name) {
    return {
      ...empty(name, ""),
      sources,
      absence:
        "The retrieved sources did not support a reading that passed our checks, so the links are shown without one.",
    };
  }

  return {
    query: name,
    profile: {
      name: draft.name,
      what: draft.what ?? "",
      industry: draft.industry ?? "not stated",
    },
    findings: cited(draft.findings, sources.length),
    aiFindings: cited(draft.aiFindings, sources.length),
    sources,
    absence: null,
    written: true,
  };
}

// ---------------------------------------------------------- topic research

export type ResearchTopic = "exposure" | "talent" | "governance";

const TOPIC_QUERY: Record<ResearchTopic, (c: string) => string> = {
  exposure: (c) => `${c} automation AI impact on operations and workforce`,
  talent: (c) => `${c} employees headcount hiring skills workforce`,
  governance: (c) => `${c} regulation compliance data protection governance risk`,
};

const TOPIC_BRIEF: Record<ResearchTopic, string> = {
  exposure:
    "where AI helps or threatens this company's operations, and which functions are exposed",
  talent:
    "this company's workforce: size, composition, hiring direction and skills",
  governance:
    "the regulatory and compliance obligations this company operates under",
};

/**
 * One sub-page's worth of research.
 *
 * The company sub-pages carried the Shell fixture's function exposure, talent
 * pyramid and governance posture: figures invented for one exemplar and shown
 * for whoever was reading. None of that is retrievable per company, so these
 * pages now report what the open sources actually say on the topic and leave
 * the rest empty rather than shaped like data.
 */
export async function researchTopic(
  company: string,
  topic: ResearchTopic
): Promise<CompanyResearch> {
  const name = company.trim();
  if (name.length < 2) return empty(name, "Name a company to research.");
  if (!searchAvailable()) {
    return empty(
      name,
      "No web search provider is configured, so this company cannot be researched. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY to switch it on."
    );
  }

  const found = await webSearch(TOPIC_QUERY[topic](name), 6);
  if (found.hits.length === 0) {
    return empty(
      name,
      found.unavailable ??
        `Nothing was retrieved about ${name} on this topic, so nothing is shown.`
    );
  }
  if (!llmAvailable()) {
    return {
      ...empty(name, ""),
      sources: found.hits,
      absence:
        "Sources were retrieved but no analyst model is configured to read them, so the links are shown without a written reading.",
    };
  }

  const draft = await authored<Draft>(
    `topic:${topic}:${name.toLowerCase()}`,
    groundingBlock(found.hits),
    `Read these retrieved passages about ${name} and report only what they say about ${TOPIC_BRIEF[topic]}.

Return JSON:
{"name": string, "what": string, "industry": string,
 "findings": [{"statement": string, "source": number}]}

- name: the company as the sources give it.
- what: one sentence on what these passages establish about this topic. If they establish nothing, say so plainly.
- industry: the sector in two or three words.
- findings: up to 5, each citing the passage number behind it. Return an empty array rather than inferring from silence.

Do not carry in anything you know about this company that the passages do not contain. Where two sources disagree, say they disagree.`,
    1400
  );

  if (!draft?.name) {
    return {
      ...empty(name, ""),
      sources: found.hits,
      absence:
        "The retrieved sources did not support a reading that passed our checks, so the links are shown without one.",
    };
  }

  return {
    query: name,
    profile: {
      name: draft.name,
      what: draft.what ?? "",
      industry: draft.industry ?? "not stated",
    },
    findings: cited(draft.findings, found.hits.length),
    aiFindings: [],
    sources: found.hits,
    absence: null,
    written: true,
  };
}

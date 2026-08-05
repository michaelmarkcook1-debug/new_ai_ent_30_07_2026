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

/** A figure a source actually states, for the headline row of cards. */
export interface CompanyMetric {
  label: string;
  value: string;
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
  /** Stated figures, rendered as cards. Never a score we computed. */
  metrics: CompanyMetric[];
  findings: CompanyFinding[];
  /** AI-specific findings, kept apart because that is what this product is for. */
  aiFindings: CompanyFinding[];
  /** What a buyer should do, drawn from what was found. */
  recommendations: string[];
  sources: SearchHit[];
  /** Why the result is thin or empty, in the product's own language. */
  absence: string | null;
  /** True when a model wrote the statements; false when nothing was written. */
  written: boolean;
}

const empty = (query: string, absence: string): CompanyResearch => ({
  query,
  profile: null,
  metrics: [],
  findings: [],
  aiFindings: [],
  recommendations: [],
  sources: [],
  absence,
  written: false,
});

interface Draft {
  name?: string;
  what?: string;
  industry?: string;
  metrics?: { label?: string; value?: string; source?: number }[];
  findings?: { statement?: string; source?: number }[];
  aiFindings?: { statement?: string; source?: number }[];
  recommendations?: string[];
}

/** Figures kept only where they cite a passage we retrieved. */
function citedMetrics(
  raw: { label?: string; value?: string; source?: number }[] | undefined,
  sourceCount: number
): CompanyMetric[] {
  return (raw ?? [])
    .filter(
      (m): m is { label: string; value: string; source: number } =>
        typeof m?.label === "string" &&
        typeof m?.value === "string" &&
        m.label.trim().length > 0 &&
        m.value.trim().length > 0 &&
        typeof m.source === "number" &&
        m.source >= 1 &&
        m.source <= sourceCount
    )
    .map((m) => ({
      label: m.label.trim(),
      value: m.value.trim(),
      sourceIndex: m.source - 1,
    }));
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

export type ResearchStage =
  | "searching-business"
  | "searching-ai"
  | "reading"
  | "reading-retry";

export async function researchCompany(
  query: string,
  /** Called as each stage begins, so a caller can show real progress. */
  onStage: (stage: ResearchStage) => void = () => {}
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
  // Four each rather than six. Twelve advanced passages made a grounding block
  // large enough that the answer ran past its token budget and came back as
  // truncated JSON, which is why the topic pages read fine while this one fell
  // back. It also widens the number-space the guard checks against, so a single
  // stray figure discarded ten findings rather than five.
  onStage("searching-business");
  const general = await webSearch(
    `${name} company overview revenue employees industry`,
    4
  );
  onStage("searching-ai");
  const ai = await webSearch(
    `${name} artificial intelligence strategy adoption deployment`,
    4
  );

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

  // Two attempts at decreasing scope rather than one at full scope.
  //
  // A single ask is all-or-nothing: any figure the guard rejects, or any
  // answer that runs long, costs the reader the entire reading even though
  // eight good passages were sitting there. So a failure narrows the ask
  // instead of ending it. Fewer passages means a smaller number-space for the
  // guard to reject on and a shorter answer to produce, and a reading of four
  // sources is worth incomparably more than an apology about eight.
  const attempts: { hits: SearchHit[]; findings: number; tokens: number }[] = [
    { hits: sources, findings: 4, tokens: 2400 },
    { hits: sources.slice(0, 4), findings: 3, tokens: 1800 },
  ];

  for (const [i, attempt] of attempts.entries()) {
    onStage(i === 0 ? "reading" : "reading-retry");
    const draft = await authored<Draft>(
      `company:${name.toLowerCase()}:${i}`,
      groundingBlock(attempt.hits),
      `Read these retrieved passages about ${name} and report what they support.

Return JSON:
{"name": string, "what": string, "industry": string,
 "metrics": [{"label": string, "value": string, "source": number}],
 "findings": [{"statement": string, "source": number}],
 "aiFindings": [{"statement": string, "source": number}],
 "recommendations": [string]}

- name: the company's name as the sources give it.
- what: one sentence on what the company does.
- industry: the sector, in two or three words.
- metrics: up to 6 figures the passages actually state, as cards. Label is two or three words ("Revenue", "Employees", "Listed as", "Founded"). Value is the figure exactly as the source gives it, currency and all. Only include a figure a passage states outright; never convert, never compute, never estimate. Each cites its passage.
- recommendations: up to 3. What a buyer evaluating AI for this company should do next, following from what was found. No figures needed. If the sources are too thin to justify advice, return an empty array.
- findings: up to ${attempt.findings}. What a buyer should know about the company's size, position and direction. Each cites the passage number it came from.
- aiFindings: up to ${attempt.findings}. What the sources say about this company's use of, or exposure to, AI. Each cites its passage number. If the passages say nothing about AI, return an empty array rather than inferring.

Every statement must be supported by the passage it cites. Do not carry in anything you know about this company that the passages do not contain, and do not smooth over a disagreement between two sources: say they disagree.

Before you say two sources disagree, check whether they are the same quantity expressed differently. A figure in pounds and a figure in dollars, or a group total against a subsidiary's, or a headcount at two different dates, are not conflicts. Convert or align them first, and where they reconcile say so, because a reconciliation is a stronger finding than a contradiction. Reserve "they disagree" for figures that genuinely cannot both be true, and say which quantity the disagreement is about rather than lumping several into one sentence.

Keep every statement to one sentence. A long answer that runs past its limit arrives as broken JSON and is discarded whole.`,
      attempt.tokens
    );

    if (draft?.name) {
      return {
        query: name,
        profile: {
          name: draft.name,
          what: draft.what ?? "",
          industry: draft.industry ?? "not stated",
        },
        metrics: citedMetrics(draft.metrics, attempt.hits.length),
        findings: cited(draft.findings, attempt.hits.length),
        aiFindings: cited(draft.aiFindings, attempt.hits.length),
        recommendations: (draft.recommendations ?? [])
          .filter((r) => typeof r === "string" && r.trim().length > 0)
          .slice(0, 3),
        sources: attempt.hits,
        absence: null,
        written: true,
      };
    }
    console.warn(
      `[research] ${name}: attempt ${i + 1} of ${attempts.length} produced no usable reading`
    );
  }

  // Both attempts failed. The sources are still real and still worth the
  // reader's time, so they are shown with the reason rather than withheld.
  return {
    ...empty(name, ""),
    sources,
    absence:
      "The retrieved sources did not support a reading that passed our checks, on two attempts. The sources themselves are below and are worth reading directly.",
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

Do not carry in anything you know about this company that the passages do not contain. Where two sources disagree, say they disagree.

Before you say two sources disagree, check whether they are the same quantity expressed differently. A figure in pounds and a figure in dollars, or a group total against a subsidiary's, or a headcount at two different dates, are not conflicts. Convert or align them first, and where they reconcile say so, because a reconciliation is a stronger finding than a contradiction. Reserve "they disagree" for figures that genuinely cannot both be true, and say which quantity the disagreement is about rather than lumping several into one sentence.`,
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
    metrics: citedMetrics(draft.metrics, found.hits.length),
    findings: cited(draft.findings, found.hits.length),
    aiFindings: [],
    recommendations: [],
    sources: found.hits,
    absence: null,
    written: true,
  };
}

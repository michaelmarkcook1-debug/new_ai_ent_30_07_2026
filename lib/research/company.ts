import { webSearch, groundingBlock, searchAvailable, type SearchHit } from "./search";
import {
  authored,
  authoredResult,
  llmAvailable,
  type AuthorFailure,
} from "@/lib/analyst/llm";
import { TAG_LABEL } from "@/lib/exposure/vertical";
import { factsFrom, reconcileFacts, type ReconciledMetric } from "./ingest";

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
  /**
   * What an AI finding is actually claiming, structured.
   *
   * WHY THE MODEL IS ASKED AND NOT TRUSTED. The model has the passage in front
   * of it and knows whether the sentence is about this company or a competitor,
   * and whether the thing is running or planned. Reconstructing either from the
   * finished sentence afterwards is guesswork, and guessing it lexically is how
   * "a large back-office population exposed to automation" became evidence of
   * back-office automation.
   *
   * So the model reports it, and `lib/position/opportunities.ts` then checks
   * every field against the statement itself before anything is classified. A
   * model that says DEPLOYED over a sentence reading "plans to" is overruled,
   * and a subject the statement does not support is refused. Present only on
   * `aiFindings`, absent where the model gave nothing usable.
   */
  claim?: AiClaim;
}

/** Who a sentence about AI is actually about. */
export type ClaimSubject =
  /** This company. The only one that can evidence anything about it. */
  | "company"
  /** A named competitor or peer. */
  | "competitor"
  /** A supplier, and what a supplier sells is not what a buyer runs. */
  | "vendor"
  /** The industry in general. */
  | "sector"
  | "unknown";

/** How far along the thing is. Only the first two are current practice. */
export type ClaimStatus =
  | "DEPLOYED"
  | "PILOT"
  | "PLANNED"
  | "EXPLORING"
  | "NEGATED"
  | "UNKNOWN";

export interface AiClaim {
  subject: ClaimSubject;
  status: ClaimStatus;
  /**
   * The AI capability in the passage's own terms, e.g. "detecting fraudulent
   * card transactions". A free-text description, never a catalogue id: the
   * mapping to a workflow is made deterministically in the position layer, so
   * the model is never the thing that decides what was evidenced.
   */
  capability: string;
}

/** A figure a source actually states, for the headline row of cards. */
export interface CompanyMetric {
  label: string;
  value: string;
  sourceIndex: number;
  /**
   * What the model classified, carried through unvalidated.
   *
   * `factsFrom()` is what decides whether any of it is usable. Kept on the
   * metric so the card can still render the figure exactly as the source wrote
   * it even where the classification was too thin to reconcile on.
   */
  metric?: string;
  period?: string;
  scope?: string;
  basis?: string;
}

export interface CompanyResearch {
  query: string;
  /** Null when nothing was retrieved and no profile could be established. */
  profile: {
    name: string;
    what: string;
    /** The sector in the sources' own words. */
    industry: string;
    /**
     * The company placed in the sector taxonomy the workflow catalogue carries
     * assurance data for, so the exposure panel can say what this vertical is
     * permitted to deploy rather than only what models can reach.
     *
     * Classified by the model against the fixed list rather than string-matched
     * from the free text above, because "Online grocery retail and technology"
     * matches nothing by substring and places by judgement. Null when nothing
     * fits, which is a real answer.
     */
    sector: { tag: string | null };
  } | null;
  /** Stated figures, rendered as cards. Never a score we computed. */
  metrics: CompanyMetric[];
  /**
   * The same figures as structured facts, and what the product concluded when
   * two sources spoke to the same measure.
   *
   * THIS IS THE CANONICAL LAYER. Downstream intelligence reads `financials`
   * rather than the metric strings, so a figure the product could not settle
   * cannot quietly become the basis of a recommendation. The cards keep
   * rendering from `metrics` because a reader should still see what each
   * source said, including the ones that disagree.
   */
  financials: ReconciledMetric[];
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

/**
 * How long a run may already have spent before the narrowing retry is skipped.
 *
 * Chosen against the platform rather than the model, and it is the arithmetic
 * that keeps the whole request inside Vercel's five-minute function limit:
 *
 *   one call            up to 75s   (TIMEOUT_MS, no SDK retry underneath)
 *   one attempt         up to 150s  (generate() makes at most two calls)
 *   the narrowed retry  starts only if 90s have not already gone
 *   worst case          90 + 150 + searches, comfortably under 300s
 *
 * Past the budget we stop and say what we have, which is the same outcome the
 * retry was going to reach anyway, minus the timeout.
 */
const RETRY_BUDGET_MS = 90_000;

const empty = (query: string, absence: string): CompanyResearch => ({
  query,
  profile: null,
  metrics: [],
  financials: [],
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
  sectorTag?: string;
  metrics?: {
    label?: string;
    value?: string;
    source?: number;
    /** Normalised name, so two sources' "Group sales" and "Revenue" can meet. */
    metric?: string;
    /** As the source writes it: "FY2025", "Q3 2026". Absent is a real answer. */
    period?: string;
    /** group, segment, region, product_line. Absent is a real answer. */
    scope?: string;
    /** reported or estimated. Absent is a real answer. */
    basis?: string;
  }[];
  findings?: { statement?: string; source?: number }[];
  aiFindings?: {
    statement?: string;
    source?: number;
    /** company, competitor, vendor, sector. Absent is a real answer. */
    subject?: string;
    /** DEPLOYED, PILOT, PLANNED, EXPLORING, NEGATED. Absent is a real answer. */
    status?: string;
    /** The capability in the passage's own words. Never a catalogue id. */
    capability?: string;
  }[];
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
      // Passed through as reported. Nothing here is trusted: readScope(),
      // readBasis() and parsePeriod() in ingest.ts decide what survives, and
      // anything they cannot classify becomes unknown rather than a default.
      metric: (m as { metric?: string }).metric,
      period: (m as { period?: string }).period,
      scope: (m as { scope?: string }).scope,
      basis: (m as { basis?: string }).basis,
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

const SUBJECTS: ClaimSubject[] = ["company", "competitor", "vendor", "sector"];
const STATUSES: ClaimStatus[] = [
  "DEPLOYED",
  "PILOT",
  "PLANNED",
  "EXPLORING",
  "NEGATED",
];

/**
 * The structured claim, kept only where the model actually classified it.
 *
 * Anything it could not place becomes `unknown` rather than a default, on the
 * same rule the metric ingest follows: a field a model can fill in plausibly
 * when the passage never said is a field that has to be able to say nothing.
 * An `unknown` subject or status cannot evidence a workflow, so a claim the
 * model declined to classify costs a classification rather than inventing one.
 */
function citedAi(
  raw: NonNullable<Draft["aiFindings"]>,
  sourceCount: number
): CompanyFinding[] {
  return cited(raw, sourceCount).map((f, i) => {
    // cited() filters, so re-find the source row by statement rather than by
    // index: the two arrays are not the same length.
    const row = raw.find((r) => r?.statement?.trim() === f.statement) ?? raw[i];
    const subject = (row?.subject ?? "").trim().toLowerCase();
    const status = (row?.status ?? "").trim().toUpperCase();
    const capability = (row?.capability ?? "").trim();
    return {
      ...f,
      claim: {
        subject: (SUBJECTS as string[]).includes(subject)
          ? (subject as ClaimSubject)
          : "unknown",
        status: (STATUSES as string[]).includes(status)
          ? (status as ClaimStatus)
          : "UNKNOWN",
        capability: capability.slice(0, 200),
      },
    };
  });
}

// The sectors the workflow catalogue carries assurance data for. Classifying
// into these rather than into the 36-industry list, because these are the ones
// that change what the panel can say: each carries its own risk tier,
// reliability bar and safe autonomy default.
const SECTOR_LIST = Object.entries(TAG_LABEL)
  .map(([tag, label]) => `${tag} (${label})`)
  .join(", ");
const KNOWN_TAGS = new Set(Object.keys(TAG_LABEL));

/** Only a classification into a sector we hold assurance data for. */
function placeSector(d: Draft): { tag: string | null } {
  const tag =
    typeof d.sectorTag === "string" && KNOWN_TAGS.has(d.sectorTag.trim())
      ? d.sectorTag.trim()
      : null;
  return { tag };
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
  const startedAt = Date.now();

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
    return {
      ...empty(
        name,
        general.unavailable ??
          ai.unavailable ??
          "Nothing was retrieved for this company, so no profile is shown rather than an assumed one."
      ),
    };
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
  //
  // THE TOKEN BUDGETS ARE MEASURED. On 30 August 2026 the Woolworths South
  // Africa call was run directly and came back `stop_reason: max_tokens` having
  // used all 2,400 of them, so the JSON was cut off mid-object and arrived as
  // "response was not valid JSON" twice in a row. The reading was not rejected
  // for anything it said; it never finished saying it. Raised to the point
  // where the answer the prompt asks for actually fits.
  const attempts: { hits: SearchHit[]; findings: number; tokens: number }[] = [
    { hits: sources, findings: 4, tokens: 3200 },
    { hits: sources.slice(0, 4), findings: 3, tokens: 2200 },
  ];

  // Why the last attempt produced nothing, so the absence below can say the
  // true thing instead of the convenient one.
  let lastFailure: AuthorFailure | null = null;

  for (const [i, attempt] of attempts.entries()) {
    // The narrowing retry is worth having and is not worth dying for.
    //
    // Measured on 30 August 2026: a Woolworths South Africa run took ten
    // minutes, which on Vercel means the function is killed at five and the
    // reader gets a broken stream rather than either a reading or an honest
    // absence. Removing the SDK's own retry layer took most of that out; this
    // makes the ceiling structural rather than arithmetic, so a slow provider
    // day cannot put us back over it.
    if (i > 0 && Date.now() - startedAt > RETRY_BUDGET_MS) {
      console.warn(
        `[research] ${name}: ${Date.now() - startedAt}ms spent, skipping the narrowed retry`
      );
      break;
    }
    onStage(i === 0 ? "reading" : "reading-retry");
    const drafted = await authoredResult<Draft>(
      `company:${name.toLowerCase()}:${i}`,
      groundingBlock(attempt.hits),
      `Read these retrieved passages about ${name} and report what they support.

Return JSON:
{"name": string, "what": string, "industry": string,
 "sectorTag": string,
 "metrics": [{"label": string, "value": string, "source": number}],
 "findings": [{"statement": string, "source": number}],
 "aiFindings": [{"statement": string, "source": number, "subject": string, "status": string, "capability": string}],
 "recommendations": [string]}

- name: the company's name as the sources give it.
- what: one sentence on what the company does.
- industry: the sector in the sources' own words, two or three words.
- sectorTag: place this company in one of the sectors below, copying the identifier EXACTLY (the part before the bracket). Leave it as an empty string when none fits. An empty string is a real answer and better than a wrong placement, which would read this company against another sector's assurance bar.

SECTORS: ${SECTOR_LIST}
- metrics: up to 6 figures the passages actually state, as cards. Each carries:
  - label: two or three words as a heading ("Revenue", "Employees", "Founded").
  - value: the figure EXACTLY as the source gives it, currency symbol and all. Never convert, never compute, never estimate, never round.
  - source: the passage number.
  - metric: a normalised name for what is being measured, lower case with underscores, so two sources describing the same quantity can be compared. Use "revenue" for turnover, group sales and net sales alike; "employees", "market_cap", "stores", "founded" and so on. This is the only field where you may rename: it is a label for the quantity, not a change to the figure.
  - period: the period the figure covers, as the source states it ("FY2025", "Q3 2026", "2024"). OMIT IT ENTIRELY if the passage does not say. Do not infer the year from the publication date, from context, or from what would be most likely.
  - scope: "group" where the figure is the whole company, "segment" where it is one division or brand, "region" where it is one geography, "product_line" where it is one product. OMIT IT ENTIRELY if the passage does not make this clear. A figure that simply says "revenue" without saying whose is not group by default.
  - basis: "reported" where the company or a filing states the figure, "estimated" where the source presents it as its own estimate, model or approximation. Data aggregators and company-profile sites are estimating unless they cite the company. OMIT IT ENTIRELY if you cannot tell.

  An omitted field is a correct answer and is treated as unknown. A guessed one is treated as fact by everything downstream, so guessing a period, a scope or a reported status is worse than leaving it out.
- recommendations: up to 3. What a buyer evaluating AI for this company should do next, following from what was found. No figures needed. If the sources are too thin to justify advice, return an empty array.
- findings: up to ${attempt.findings}. What a buyer should know about the company's size, position and direction. Each cites the passage number it came from.
- aiFindings: up to ${attempt.findings}. What the sources say about this company's use of, or exposure to, AI. Each cites its passage number. If the passages say nothing about AI, return an empty array rather than inferring.

  Each aiFinding also carries three classifications of what the passage is actually claiming. Omit any field the passage does not settle; an omission is a real answer and is treated as one.

  - subject: WHO the sentence is about. "company" only where it is this company doing the thing. "competitor" where it is a named rival or peer. "vendor" where it is a supplier describing what its product does, because what a supplier sells is not what a buyer runs. "sector" where it is the industry in general.
  - status: HOW FAR ALONG it is. "DEPLOYED" for something running now. "PILOT" for something running now at limited scope. "PLANNED" for a stated intention. "EXPLORING" for evaluating, considering or in talks. "NEGATED" where the passage says it is not happening. A partnership, an agreement or a hiring is not DEPLOYED unless the passage says the capability itself is in use.
  - capability: WHAT AI capability, in the passage's own terms, e.g. "detecting fraudulent card transactions" or "summarising support calls". Describe the work, not the vendor and not the technology. Leave it out where the passage says only that the company uses AI without saying what for, because "uses AI" is not a capability.

Every statement must be supported by the passage it cites. Do not carry in anything you know about this company that the passages do not contain, and do not smooth over a disagreement between two sources: say they disagree.

Before you say two sources disagree, check whether they are the same quantity expressed differently. A figure in pounds and a figure in dollars, or a group total against a subsidiary's, or a headcount at two different dates, are not conflicts. Convert or align them first, and where they reconcile say so, because a reconciliation is a stronger finding than a contradiction. Reserve "they disagree" for figures that genuinely cannot both be true, and say which quantity the disagreement is about rather than lumping several into one sentence.

Keep every statement to one sentence. A long answer that runs past its limit arrives as broken JSON and is discarded whole.`,
      attempt.tokens
    );
    const draft = drafted.value;
    lastFailure = drafted.failure;

    // A call that never reached the API will not reach it on the retry either,
    // and a second attempt only doubles the wait before the same answer.
    if (drafted.failure === "unreachable" || drafted.failure === "no-key" || drafted.failure === "build") break;

    if (draft?.name) {
      const metricsA = citedMetrics(draft.metrics, attempt.hits.length);
      return {
        query: name,
        profile: {
          name: draft.name,
          what: draft.what ?? "",
          industry: draft.industry ?? "not stated",
          sector: placeSector(draft),
        },
        metrics: metricsA,
        // Reconciled at the point the research lands, once, so every surface
        // downstream reads one conclusion rather than re-deriving its own.
        financials: reconcileFacts(factsFrom(metricsA, attempt.hits)),
        findings: cited(draft.findings, attempt.hits.length),
        aiFindings: citedAi(draft.aiFindings ?? [], attempt.hits.length),
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

  // No reading. The sources are still real and still worth the reader's time,
  // so they are shown with the reason rather than withheld.
  //
  // The reason has to be the true one. This used to blame the sources whatever
  // had happened, so when the API credit ran out on 8 August 2026 every company
  // on the product read as one the public record could not support. That is a
  // fabrication of exactly the kind this product exists not to commit: an
  // assertion about evidence, made when no evidence was ever examined.
  return {
    ...empty(name, ""),
    sources,
    absence:
      lastFailure === "unreachable" || lastFailure === "no-key"
        ? "The analysis could not be run just now, so these sources have not been read. This is a fault on our side and says nothing about the company or its coverage. The sources retrieved are below and are worth reading directly."
        : "The retrieved sources did not support a reading that passed our checks, on two attempts. The sources themselves are below and are worth reading directly.",
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
 "sectorTag": string,
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

  const metricsB = citedMetrics(draft.metrics, found.hits.length);
  return {
    query: name,
    profile: {
      name: draft.name,
      what: draft.what ?? "",
      industry: draft.industry ?? "not stated",
      sector: placeSector(draft),
    },
    metrics: metricsB,
    financials: reconcileFacts(factsFrom(metricsB, found.hits)),
    findings: cited(draft.findings, found.hits.length),
    aiFindings: [],
    recommendations: [],
    sources: found.hits,
    absence: null,
    written: true,
  };
}

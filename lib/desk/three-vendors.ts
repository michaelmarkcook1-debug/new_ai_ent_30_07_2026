// The three vendors a cited finding recommends.
//
// WHY THIS IS COMPUTED AND NOT WRITTEN. The finding is model-authored prose,
// and asking a model to also pick the vendors would make the recommendation
// the least reliable thing on the page: it would come from whichever chunks
// the retriever happened to surface. An audit of that path on 17 August 2026
// (scripts/audit-cited-findings.ts) found the cited corpus surfaces zero to
// two distinct vendors for a realistic buyer situation, and the ones it does
// surface are whichever share words with the question rather than whichever
// fit. Cohere and DeepSeek came back for a European bank asking about agentic
// onboarding, purely on word overlap.
//
// So the three are chosen here, from the weighted assessment, before the model
// writes a word. The model's job is to justify them from the cited evidence,
// not to select them. That is also the rating Michael asked the product to
// stand on: the 0 to 5 weighted composite with its variables, not the 0 to 100
// global score.
//
// SERVER ONLY. Reads category-rankings, which reads the filesystem.

import { categoryRanking, rankingsCapturedAt } from "@/lib/aie/category-rankings";
import type { AssessmentDomain } from "@/lib/aie/category-rankings";
import { MARKET_CATEGORY_LIST } from "@/lib/comparability";
import { vendorName } from "@/lib/aie/vendor-directory";
import { SHIELD } from "@/lib/shield/data";
import { vendorIdForSlug } from "@/lib/shield/vendor-map";
import { opportunitiesFor } from "@/lib/position/opportunities";

export interface RecommendedVendor {
  rank: number;
  vendorId: string;
  name: string;
  /** The weighted composite, 0 to 5. */
  composite: number;
  /** v1's own band, where it publishes one. */
  position: string | null;
  /** How many domains carried enough evidence to score, out of the total. */
  evidenced: number;
  domainsTotal: number;
  /** The three strongest scored domains, which is why this vendor is here. */
  strongest: { domain: string; score: number }[];
  /** Weakest evidence grade behind any scored domain. */
  weakestGrade: string | null;
  /** Which market this vendor leads. Set on every vendor, because the three
      may now come from three different markets. */
  marketId: string;
  marketLabel: string;
  /**
   * Security and data handling, always, whether or not it is this vendor's
   * strength.
   *
   * `strongest` shows what a vendor is best at, so a vendor weak on data
   * handling simply never mentioned it and the reader had to notice an
   * absence. Michael asked for this to be weighed every time, and the
   * assessment already scores four domains for it, so they are carried
   * explicitly rather than left to chance.
   */
  security: { domain: string; score: number | null }[];
  /** This vendor's own profile. A real route, not a filter that does nothing. */
  profileHref: string;
  /**
   * Whether the Privacy and IP Shield grades this vendor's published terms.
   *
   * The two datasets cover different populations on purpose. The Shield reads
   * the published terms of model providers, fourteen of them. The assessment
   * ranks every market, including application vendors, clouds and silicon. So
   * in six of the thirteen markets none of the three has Shield evidence, and
   * without this the finding wrote "no evidence in this workspace on X" three
   * times running without ever saying why.
   */
  contractEvidence: boolean;
}

export interface ThreeVendors {
  marketId: string;
  /** Always the human label. The raw id must never reach prose. */
  marketLabel: string;
  /** How the market was chosen, so the finding can say. */
  basis:
    | "named in the situation"
    | "inferred from the situation"
    | "from the AI areas on your position";
  /**
   * Whether the three come from one market or from several.
   *
   * "across your strategy" is the case where a saved position supplied the
   * company's own AI areas: the three then lead three DIFFERENT markets, and
   * their scores must never be read against each other. One market is the
   * fallback when nothing is carried.
   */
  spread: "one market" | "across your strategy";
  vendors: RecommendedVendor[];
  /** Ranked in this market but not recommended, for the honest total. */
  alsoRanked: number;
  held: number;
  capturedAt: string;
}

/**
 * Words that place a buyer in a market.
 *
 * Hand-written rather than derived from the category labels, because the
 * labels are the product's names for these markets and not the words a buyer
 * types. Nobody writes "neocloud"; they write "inference" and "GPU hours".
 *
 * Order matters only for scoring ties, which are broken by the number of
 * distinct terms matched, so a situation naming both "coding" and "agent"
 * lands on the coding agent market rather than the broader agent platform.
 */
const MARKET_WORDS: Record<string, string[]> = {
  frontier_model_api: ["frontier", "foundation model", "llm", "model api", "gpt", "claude", "gemini", "raw api"],
  enterprise_assistant: ["assistant", "copilot", "chatbot", "knowledge worker", "productivity", "citizen assistant"],
  developer_coding_agent: ["coding", "developer", "code", "engineering team", "software delivery", "pull request", "ide"],
  agent_platform: ["agentic", "agent platform", "orchestration", "multi agent", "autonomous", "tool use", "onboarding"],
  rag_enterprise_search: ["rag", "retrieval", "enterprise search", "knowledge base", "document search", "intranet"],
  workflow_automation_ai: ["workflow", "automation", "process", "back office", "approvals", "straight through"],
  crm_customer_ai: ["crm", "customer service", "contact centre", "contact center", "sales", "service desk", "call centre"],
  itsm_hr_service_ai: ["itsm", "service management", "hr", "payroll", "helpdesk", "ticket", "employee service"],
  cloud_ai_platform: ["data platform", "lakehouse", "ml platform", "data science", "feature store", "warehouse"],
  regulated_industry_ai: ["regulated", "legal", "compliance", "insurance", "banking", "clinical", "audit", "eu ai act"],
  ai_silicon: ["chip", "silicon", "accelerator", "gpu", "tpu", "wafer", "semiconductor"],
  ai_cloud_compute: ["hyperscaler", "cloud provider", "capacity", "training run", "data centre", "data center"],
  neocloud_inference: ["inference", "gpu hours", "serving", "tokens per second", "latency", "throughput"],
};

/**
 * Whole-word phrase match, never a raw substring.
 *
 * These were matched with `String.includes`, and short keywords then fired
 * inside ordinary words. Measured on one innocent retail sentence:
 *
 *   "ide"      matched inside provide, decide, wider, outside
 *   "rag"      matched inside average
 *   "code"     matched inside barcode, postcode
 *   "process"  matched inside processing
 *
 * "provide", "decide" and "outside" are unavoidable in a sentence about a
 * decision, so almost any Decision Desk situation scored a hit for the coding
 * agent market. A luxury food retailer asking about discount approval was
 * placed in Developer/coding agent, and the finding then recommended vendors
 * for a market the reader had never mentioned.
 */
function hasPhrase(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A trailing plural is allowed, because a buyer writes "GPUs" and "chips".
  // It cannot reopen the substring hole: "provide" still fails the leading
  // boundary before the optional s is ever considered.
  return new RegExp(`(^|[^a-z0-9])${escaped}s?([^a-z0-9]|$)`, "i").test(haystack);
}

const LABEL_BY_ID = new Map(MARKET_CATEGORY_LIST.map((c) => [c.id, c.name]));

/** Vendor ids whose published terms the Shield actually grades. */
const SHIELDED = new Set(
  SHIELD.map((v) => vendorIdForSlug(v.slug)).filter((id): id is string => Boolean(id))
);

/**
 * Which market this situation is about.
 *
 * Returns null rather than guessing. A finding that recommends three vendors
 * from the wrong market is worse than one that asks which market, because it
 * is confidently wrong and the reader has no way to see it.
 */
export function detectMarket(
  text: string
): { id: string; label: string; basis: ThreeVendors["basis"] } | null {
  const t = text.toLowerCase();

  // A market named outright wins over anything inferred.
  for (const c of MARKET_CATEGORY_LIST) {
    if (hasPhrase(t, c.name.toLowerCase())) {
      return { id: c.id, label: c.name, basis: "named in the situation" };
    }
  }

  let best: { id: string; hits: number } | null = null;
  for (const [id, words] of Object.entries(MARKET_WORDS)) {
    const hits = words.filter((w) => hasPhrase(t, w)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { id, hits };
  }
  if (!best) return null;
  return {
    id: best.id,
    label: LABEL_BY_ID.get(best.id) ?? best.id,
    basis: "inferred from the situation",
  };
}

/**
 * The domains that speak to security and data handling.
 *
 * Read from the assessment rather than inferred: these are four of the
 * fourteen domains the composite already weighs.
 */
const SECURITY_DOMAINS = [
  "data_security_privacy",
  "security_threat",
  "governance_compliance",
  "identity_access",
];

function securityRead(domains: AssessmentDomain[]): { domain: string; score: number | null }[] {
  return SECURITY_DOMAINS.filter((d) => domains.some((x) => x.domain === d)).map((d) => {
    const hit = domains.find((x) => x.domain === d);
    return {
      domain: d.replace(/_/g, " "),
      score: hit && hit.state === "scored" ? hit.score : null,
    };
  });
}

/** The strongest scored domains, which is the reason this vendor ranks. */
function strongest(domains: AssessmentDomain[]): { domain: string; score: number }[] {
  return domains
    .filter((d) => d.state === "scored" && d.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .map((d) => ({ domain: d.domain.replace(/_/g, " "), score: d.score as number }));
}

/** Worst evidence grade behind anything that scored. E5 is the weakest. */
function weakestGrade(domains: AssessmentDomain[]): string | null {
  const grades = domains
    .filter((d) => d.state === "scored" && d.bestGrade)
    .map((d) => d.bestGrade as string)
    .sort();
  return grades.length ? grades[grades.length - 1] : null;
}

/**
 * The three, and nothing about where they go next.
 *
 * The handoff is deliberately NOT a per-vendor query string. ModelEngine,
 * Trust Rank and Integrators do not read a `?vendor=` param: they read the
 * shortlist, which is mirrored into a cookie the server can see. So a link
 * like `/trust-rank?vendor=anthropic` would navigate and filter nothing, which
 * is worse than no link, because it looks like it worked.
 *
 * The page therefore carries all three onto the shortlist in one action and
 * then links to those pages, where they now filter for real. That is also the
 * product's existing idiom rather than a second one invented here.
 */
/**
 * The markets a carried position's AI areas point at.
 *
 * Takes the wire shape rather than a SavedPosition, because the server only
 * ever receives the sanitised subset. Returns null when no sector was
 * established, which sends the finding back to detecting one market from the
 * words the reader typed.
 */
export function strategyMarkets(position: {
  sectorTag: string | null;
  aiFindings: string[];
  findings: string[];
} | null): { sectorLabel: string; marketIds: string[] } | null {
  if (!position?.sectorTag) return null;
  const opp = opportunitiesFor({
    key: "", query: "", name: "", what: "", industry: "",
    sectorTag: position.sectorTag,
    aiFindings: position.aiFindings,
    findings: position.findings,
    recommendations: [],
    savedAt: "",
  });
  if (!opp || opp.marketIds.length === 0) return null;
  return { sectorLabel: opp.sectorLabel, marketIds: opp.marketIds };
}

/** One ranked vendor, shaped for the finding. */
function toRecommended(
  r: { rank: number; vendorId: string; composite: number; position: string | null; domains: AssessmentDomain[] },
  marketId: string,
  rank: number
): RecommendedVendor {
  return {
    rank,
    vendorId: r.vendorId,
    name: vendorName(r.vendorId),
    composite: r.composite,
    position: r.position,
    evidenced: r.domains.filter((d) => d.state === "scored").length,
    domainsTotal: r.domains.length,
    strongest: strongest(r.domains),
    weakestGrade: weakestGrade(r.domains),
    marketId,
    marketLabel: LABEL_BY_ID.get(marketId) ?? marketId,
    security: securityRead(r.domains),
    profileHref: `/vendor-view/${encodeURIComponent(r.vendorId)}`,
    contractEvidence: SHIELDED.has(r.vendorId),
  };
}

/**
 * The three, and nothing about where they go next.
 *
 * TWO SHAPES, AND THE FIRST IS THE ONE THAT MATTERS.
 *
 * When the reader has a saved position, the three are drawn ACROSS the markets
 * their own AI areas point at: one leader per market, up to three markets. That
 * is the answer to "the engine only focuses on one role": a company's AI
 * strategy is several things at once, and a food retailer weighing fraud
 * detection, discount pricing and supplier risk is not shopping in one market.
 * It is also why the three are no longer all frontier labs, since those markets
 * are usually a mix of application vendors, clouds and labs.
 *
 * COMPARABILITY IS NOT BROKEN BY THIS. Each vendor is number one in ITS OWN
 * market and is never ranked against the others: 3.05 leading cloud AI platform
 * and 2.82 leading workflow automation are two separate statements, not a
 * league table. `spread` says which shape this is so the prompt and the page
 * can say so too.
 *
 * With no position, it falls back to the single detected market, unchanged.
 *
 * The handoff is deliberately NOT a per-vendor query string. ModelEngine,
 * Trust Rank and Integrators do not read a `?vendor=` param: they read the
 * shortlist, which is mirrored into a cookie the server can see.
 */
export function threeVendorsFor(
  text: string,
  /** The company's own AI areas, when Your AI Position established them. */
  opp?: { sectorLabel: string; marketIds: string[] } | null
): ThreeVendors | null {
  // Across the reader's own strategy, when we have one.
  if (opp && opp.marketIds.length > 0) {
    const vendors: RecommendedVendor[] = [];
    const seen = new Set<string>();
    let alsoRanked = 0;
    let held = 0;
    const usedMarkets: string[] = [];

    for (const marketId of opp.marketIds) {
      if (vendors.length >= 3) break;
      const ranking = categoryRanking(marketId);
      if (!ranking || ranking.ranked.length === 0) continue;
      // The leader of this market that is not already recommended, so one
      // vendor competing in several of the reader's markets does not take two
      // of the three slots and leave a market unrepresented.
      const pick = ranking.ranked.find((r) => !seen.has(r.vendorId));
      if (!pick) continue;
      seen.add(pick.vendorId);
      usedMarkets.push(marketId);
      vendors.push(toRecommended(pick, marketId, vendors.length + 1));
      alsoRanked += Math.max(0, ranking.ranked.length - 1);
      held += ranking.held;
    }

    if (vendors.length > 0) {
      return {
        marketId: usedMarkets[0],
        marketLabel: usedMarkets
          .map((m) => LABEL_BY_ID.get(m) ?? m)
          .join(", "),
        basis: "from the AI areas on your position",
        spread: "across your strategy",
        vendors,
        alsoRanked,
        held,
        capturedAt: rankingsCapturedAt(),
      };
    }
  }

  // Fallback: one market, detected from what the reader wrote.
  const market = detectMarket(text);
  if (!market) return null;
  const ranking = categoryRanking(market.id);
  if (!ranking || ranking.ranked.length === 0) return null;

  return {
    marketId: market.id,
    marketLabel: market.label,
    basis: market.basis,
    spread: "one market",
    vendors: ranking.ranked
      .slice(0, 3)
      .map((r, i) => toRecommended(r, market.id, i + 1)),
    alsoRanked: Math.max(0, ranking.ranked.length - 3),
    held: ranking.held,
    capturedAt: rankingsCapturedAt(),
  };
}

/**
 * The same three, rendered for the finding prompt.
 *
 * Handed to the model as settled fact it must present, never as candidates to
 * choose between. The wording is deliberate: "these three are the
 * recommendation" rather than "here are some vendors".
 */
export function threeVendorsBlock(three: ThreeVendors): string {
  const strategy = three.spread === "across your strategy";
  const sec = (v: RecommendedVendor) =>
    v.security.length === 0
      ? "no security domains scored"
      : v.security
          .map((x) => `${x.domain} ${x.score === null ? "not scored" : x.score.toFixed(1)}`)
          .join(", ");

  const lines = [
    ``,
    ``,
    `THE THREE VENDORS THIS FINDING RECOMMENDS`,
    `Chosen by the weighted assessment before you wrote anything, not by you. Present these three, in this order, as the recommendation. Do not substitute, add a fourth, or reorder them. Do not describe them as options to consider: they are the answer.`,
    strategy
      ? `These three come from the AI areas established for this company, and each one LEADS A DIFFERENT MARKET. Write about the buyer's AI strategy across those markets, not about a single role or a single tool. Their scores are NOT comparable with each other: each is number one in its own market, so never say one outscores another.`
      : `Market: ${three.marketLabel} (${three.basis}).`,
    `Scores are the weighted composite, 0 to 5, read on ${three.capturedAt.slice(0, 10)}.`,
    ...three.vendors.map(
      (v) =>
        `  ${v.rank}. ${v.name}, ${v.composite.toFixed(2)} of 5${v.position ? ` (${v.position})` : ""}` +
        `${strategy ? `, leading ${v.marketLabel}` : ""}. ` +
        `Evidenced on ${v.evidenced} of ${v.domainsTotal} domains${v.weakestGrade ? `, weakest evidence ${v.weakestGrade}` : ""}. ` +
        `Strongest: ${v.strongest.map((x) => `${x.domain} ${x.score.toFixed(1)}`).join(", ") || "none scored"}. ` +
        `Security and data: ${sec(v)}.`
    ),
    // Security is not optional and not conditional on it being a strength.
    // Michael asked for it to be weighed every time, and a vendor that is weak
    // on data handling will never volunteer it through `strongest`.
    `SECURITY AND DATA ARE NOT OPTIONAL HERE. Every vendor above carries its scores for data security and privacy, security threat, governance compliance and identity access, whether or not those are its strengths. Say something about them for each vendor, and where a vendor's security or data score is materially below its own composite, say that plainly: it is the thing a buyer is least likely to discover on their own.`,
    three.alsoRanked > 0
      ? `${three.alsoRanked} further vendors are ranked in these markets below these three${three.held > 0 ? `, and ${three.held} were held for thin evidence` : ""}.`
      : three.held > 0
        ? `${three.held} vendors were held for thin evidence.`
        : ``,
    `Say why each one suits THIS buyer, using the cited chunks.`,
    (() => {
      const withEv = three.vendors.filter((v) => v.contractEvidence).map((v) => v.name);
      const without = three.vendors.filter((v) => !v.contractEvidence).map((v) => v.name);
      if (without.length === 0) {
        return `The cited contract evidence covers all three of these vendors, so use it.`;
      }
      if (withEv.length === 0) {
        return `IMPORTANT: the cited contract evidence in this workspace grades the published terms of model providers only, and none of these three is one. Do NOT write "no evidence on X" once per vendor. Say ONCE, in the risk line, that this workspace holds no published-terms evidence for these vendors and that residency, retention and indemnity terms have to be requested from them directly. Then use the chunks for what they do cover.`;
      }
      return `The cited contract evidence covers ${withEv.join(" and ")} but not ${without.join(" or ")}, because it grades model providers' published terms and those are not model providers. Note that once, in the risk line, rather than repeating "no evidence" per vendor.`;
    })(),
  ].filter((l) => l !== ``);
  return lines.join("\n");
}

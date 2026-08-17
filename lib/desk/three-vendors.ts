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
  /** This vendor's own profile. A real route, not a filter that does nothing. */
  profileHref: string;
}

export interface ThreeVendors {
  marketId: string;
  /** Always the human label. The raw id must never reach prose. */
  marketLabel: string;
  /** How the market was chosen, so the finding can say. */
  basis: "named in the situation" | "inferred from the situation";
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

const LABEL_BY_ID = new Map(MARKET_CATEGORY_LIST.map((c) => [c.id, c.name]));

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
    if (t.includes(c.name.toLowerCase())) {
      return { id: c.id, label: c.name, basis: "named in the situation" };
    }
  }

  let best: { id: string; hits: number } | null = null;
  for (const [id, words] of Object.entries(MARKET_WORDS)) {
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { id, hits };
  }
  if (!best) return null;
  return {
    id: best.id,
    label: LABEL_BY_ID.get(best.id) ?? best.id,
    basis: "inferred from the situation",
  };
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
export function threeVendorsFor(text: string): ThreeVendors | null {
  const market = detectMarket(text);
  if (!market) return null;

  const ranking = categoryRanking(market.id);
  if (!ranking || ranking.ranked.length === 0) return null;

  const vendors: RecommendedVendor[] = ranking.ranked.slice(0, 3).map((r) => {
    const name = vendorName(r.vendorId);
    return {
      rank: r.rank,
      vendorId: r.vendorId,
      name,
      composite: r.composite,
      position: r.position,
      evidenced: r.domains.filter((d) => d.state === "scored").length,
      domainsTotal: r.domains.length,
      strongest: strongest(r.domains),
      weakestGrade: weakestGrade(r.domains),
      profileHref: `/vendor-view/${encodeURIComponent(r.vendorId)}`,
    };
  });

  return {
    marketId: market.id,
    marketLabel: market.label,
    basis: market.basis,
    vendors,
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
  const lines = [
    ``,
    ``,
    `THE THREE VENDORS THIS FINDING RECOMMENDS`,
    `Chosen by the weighted assessment before you wrote anything, not by you. Present these three, in this order, as the recommendation. Do not substitute, add a fourth, or reorder them. Do not describe them as options to consider: they are the answer.`,
    `Market: ${three.marketLabel} (${three.basis}). Scores are the weighted composite, 0 to 5, read on ${three.capturedAt.slice(0, 10)}.`,
    ...three.vendors.map(
      (v) =>
        `  ${v.rank}. ${v.name}, ${v.composite.toFixed(2)} of 5${v.position ? ` (${v.position})` : ""}. ` +
        `Evidenced on ${v.evidenced} of ${v.domainsTotal} domains${v.weakestGrade ? `, weakest evidence ${v.weakestGrade}` : ""}. ` +
        `Strongest: ${v.strongest.map((s) => `${s.domain} ${s.score.toFixed(1)}`).join(", ") || "none scored"}.`
    ),
    three.alsoRanked > 0
      ? `${three.alsoRanked} further vendors are ranked in this market below these three${three.held > 0 ? `, and ${three.held} were held for thin evidence` : ""}.`
      : three.held > 0
        ? `${three.held} vendors were held in this market for thin evidence.`
        : ``,
    `Say why each one suits THIS buyer, using the cited chunks. Where the chunks say nothing about a vendor, say that rather than filling the gap.`,
  ].filter((l) => l !== ``);
  return lines.join("\n");
}

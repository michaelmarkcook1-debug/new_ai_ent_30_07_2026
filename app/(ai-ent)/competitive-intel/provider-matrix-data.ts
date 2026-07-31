import { aieServerFetch, type AieLane } from "@/lib/aie-server";
import {
  MARKET_CATEGORY_LIST,
  vendorIdsInCategory,
} from "@/lib/comparability";

// Competitive dynamics across the model providers themselves.
//
// The BoardRadar competitive-intelligence endpoint covers public companies,
// so its peer groups are cloud units and systems integrators. It structurally
// cannot reach OpenAI, Anthropic, Mistral or Cohere, which are private. That
// makes it the wrong instrument for an AI vendor competitive read, and it is
// why this matrix exists instead.
//
// Rows are the providers in one market category, columns are the ten assessed
// capabilities, and every cell is a real evidence-graded maturity score. The
// category boundary is the comparability rule: providers are compared inside
// a category, never across one.

export interface MatrixCell {
  capabilityId: string;
  maturity: number | null;
  status: string | null;
  evidenceGrade: string | null;
  note: string | null;
  lastVerified: string | null;
}

export interface MatrixRow {
  vendorId: string;
  name: string;
  marketPosition: string | null;
  cells: Record<string, MatrixCell>;
  /** Mean across the capabilities this vendor is assessed on. */
  mean: number | null;
  assessed: number;
  /** Weakest evidence grade in the row: the ceiling on the mean. */
  weakestGrade: string | null;
}

export interface ProviderMatrix {
  categories: { id: string; name: string; description: string }[];
  categoryId: string;
  categoryName: string;
  capabilities: { id: string; name: string; description: string }[];
  rows: MatrixRow[];
  /** Category members the capability dataset does not assess. */
  unassessed: string[];
  lane: AieLane;
}

interface RawCap {
  vendorId: string;
  capabilityId: string;
  status: string | null;
  maturityScore: number | null;
  evidenceGrade: string | null;
  lastVerified: string | null;
  notes: string | null;
}
interface RawVendor {
  id: string;
  name: string;
  marketPosition: string | null;
}

// Only categories whose members are actually model and platform providers.
// The taxonomy also carries silicon, compute and services categories, which
// the capability rubric does not describe.
const PROVIDER_CATEGORIES = new Set([
  "frontier_model_api",
  "enterprise_assistant",
  "developer_coding_agent",
  "agent_platform",
  "rag_enterprise_search",
  "cloud_ai_platform",
  "regulated_industry_ai",
]);

export async function loadProviderMatrix(
  categoryId?: string
): Promise<ProviderMatrix> {
  const [capsRes, vendorsRes] = await Promise.all([
    aieServerFetch<{
      capabilities: { id: string; name: string; description: string }[];
      vendorCapabilities: RawCap[];
    }>("capabilities"),
    aieServerFetch<{ vendors: RawVendor[] }>("vendors"),
  ]);

  const categories = MARKET_CATEGORY_LIST.filter((c) =>
    PROVIDER_CATEGORIES.has(c.id)
  );
  const active =
    categories.find((c) => c.id === categoryId) ?? categories[0] ?? null;

  const capabilities = capsRes.data?.capabilities ?? [];
  const vendors = new Map(
    (vendorsRes.data?.vendors ?? []).map((v) => [v.id, v])
  );

  const byVendor = new Map<string, Map<string, RawCap>>();
  for (const r of capsRes.data?.vendorCapabilities ?? []) {
    const m = byVendor.get(r.vendorId) ?? new Map<string, RawCap>();
    m.set(r.capabilityId, r);
    byVendor.set(r.vendorId, m);
  }

  const memberIds = active ? vendorIdsInCategory(active.id) : [];
  const unassessed: string[] = [];

  const rows: MatrixRow[] = [];
  for (const id of memberIds) {
    const assessed = byVendor.get(id);
    const vendor = vendors.get(id);
    if (!assessed || assessed.size === 0) {
      unassessed.push(vendor?.name ?? id);
      continue;
    }
    const cells: Record<string, MatrixCell> = {};
    const scores: number[] = [];
    const grades: string[] = [];
    for (const cap of capabilities) {
      const r = assessed.get(cap.id);
      const maturity =
        typeof r?.maturityScore === "number"
          ? Math.round(r.maturityScore * 10) / 10
          : null;
      cells[cap.id] = {
        capabilityId: cap.id,
        maturity,
        status: r?.status ?? null,
        evidenceGrade: r?.evidenceGrade ?? null,
        note: r?.notes?.trim() || null,
        lastVerified: r?.lastVerified ?? null,
      };
      if (maturity !== null) scores.push(maturity);
      if (r?.evidenceGrade) grades.push(r.evidenceGrade);
    }
    rows.push({
      vendorId: id,
      name: vendor?.name ?? id,
      marketPosition: vendor?.marketPosition ?? null,
      cells,
      mean: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
          10
        : null,
      assessed: scores.length,
      // Grades sort E1 to E5, so the last one is the weakest.
      weakestGrade: grades.length ? grades.slice().sort().pop()! : null,
    });
  }

  rows.sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1));

  return {
    categories,
    categoryId: active?.id ?? "",
    categoryName: active?.name ?? "",
    capabilities,
    rows,
    unassessed,
    lane:
      capsRes.lane === "aie" || vendorsRes.lane === "aie" ? "aie" : "aie-live",
  };
}

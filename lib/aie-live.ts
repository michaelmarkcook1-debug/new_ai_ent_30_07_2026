// Client-side access to the deployed AI Enterprise app's public APIs, always
// through our own proxy (/api/aie/*). The x-eai-source header distinguishes
// live pulls from recorded fixtures so the UI can swap the AIE live badge
// for "Cached sample". Types cover the fields the demo renders; payloads
// pass through untouched.

export type AieSource = "live" | "mock" | "error";

export interface AieResult<T> {
  ok: boolean;
  source: AieSource;
  status: number;
  data: T | null;
  errorMessage?: string;
}

export async function aieFetch<T>(
  path: string,
  params?: Record<string, string>
): Promise<AieResult<T>> {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  try {
    const res = await fetch(`/api/aie/${path}${qs}`);
    const source = (res.headers.get("x-eai-source") ?? "error") as AieSource;
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false || body?.error) {
      return {
        ok: false,
        source,
        status: res.status,
        data: null,
        errorMessage: body?.error ?? "Request failed",
      };
    }
    return { ok: true, source, status: res.status, data: body as T };
  } catch {
    return {
      ok: false,
      source: "error",
      status: 0,
      data: null,
      errorMessage: "Network error",
    };
  }
}

// Shapes observed from the live API on 30 July 2026 (fields the demo uses).

export interface AieNewsItem {
  id: string;
  title: string;
  summary: string;
  whyItMatters?: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceKind: string;
  publishedAt: string;
  vendors: string[];
  categories: string[];
  impactScore: number | null;
  confidenceScore: number | null;
  sentiment?: string | null;
}

export interface AieMarketShareEstimate {
  vendorId: string;
  categoryId: string;
  estimatedShare: number;
  confidence: number;
  source: string;
  sourceDate: string;
  methodology: string;
  previousEstimate: number | null;
  changePct: number | null;
}

export interface AiePricingRow {
  id: string;
  vendorId: string;
  vendorName: string;
  modelName: string;
  inputPerM: number | null;
  outputPerM: number | null;
  cachedInputPerM: number | null;
  note: string | null;
  sourceUrl: string | null;
}

export interface AieReputationRow {
  vendorId: string;
  customer: Record<string, unknown> | null;
  developer: Record<string, unknown> | null;
  employee: Record<string, unknown> | null;
}

export interface AieUptakeRow {
  vendor: string;
  share: number;
  contributingCells: number;
  confidence: string;
}

export interface AiePillar {
  id: string;
  label: string;
  defaultWeight: number;
}

export interface AieDashboardVendorRef {
  vendor: { id: string; name: string; category: string };
  reason: string;
  confidence: number;
}

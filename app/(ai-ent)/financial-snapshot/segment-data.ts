import segmentRevenue from "@/fixtures/sec/segment-revenue.json";
import aiDisclosures from "@/fixtures/sec/ai-revenue-disclosures.json";

// Where AI revenue actually sits, on two separate footings that must never be
// merged into one number.
//
//  1. SEGMENT REVENUE: audited, XBRL-tagged, extracted from each filer's own
//     10-K. This is a ceiling, not an AI figure. AWS is overwhelmingly
//     non-AI cloud.
//  2. DISCLOSED AI REVENUE: the figure the company itself states in prose,
//     quoted verbatim with its filing URL. Only three filers state one.
//
// Nothing here estimates AI revenue. A vendor that discloses nothing shows
// nothing, and that silence is the finding.

export interface SegmentRow {
  segment: string;
  revenueUsd: number;
  sharePct: number | null;
}

export interface AiStatement {
  statement: string;
  form: string | null;
  filedAt: string | null;
  url: string;
}

export interface CompanyRevenueView {
  ticker: string;
  name: string;
  vendorId: string | null;
  category: string | null;
  /** Null when the filer publishes no segment breakout. */
  segments: SegmentRow[] | null;
  segmentTotalUsd: number | null;
  form: string | null;
  periodEnd: string | null;
  filingUrl: string | null;
  /** True when the company reports as one segment: its own disclosure. */
  singleSegment: boolean;
  segmentNote: string | null;
  /** Verbatim AI revenue statements from the company's own filings. */
  aiStatements: AiStatement[];
}

export interface RevenueView {
  companies: CompanyRevenueView[];
  segmentCapturedAt: string;
  disclosureCapturedAt: string;
  disclosingCount: number;
  totalCount: number;
}

interface RawSegmentCompany {
  ticker: string;
  name: string;
  vendorId?: string;
  category?: string;
  form?: string;
  periodEnd?: string;
  filingUrl?: string;
  segments?: SegmentRow[];
  segmentTotalUsd?: number;
  singleSegment?: boolean;
  error?: string;
}
interface RawDisclosureVendor {
  ticker: string;
  discloses: boolean;
  statements: AiStatement[];
}

export function loadRevenueView(): RevenueView {
  const seg = segmentRevenue as {
    capturedAt: string;
    companies: RawSegmentCompany[];
  };
  const dis = aiDisclosures as {
    capturedAt: string;
    vendors: RawDisclosureVendor[];
  };

  const byTicker = new Map(dis.vendors.map((v) => [v.ticker, v]));

  const companies: CompanyRevenueView[] = seg.companies.map((c) => {
    const d = byTicker.get(c.ticker);
    return {
      ticker: c.ticker,
      name: c.name,
      vendorId: c.vendorId ?? null,
      category: c.category ?? null,
      segments: c.segments ?? null,
      segmentTotalUsd: c.segmentTotalUsd ?? null,
      form: c.form ?? null,
      periodEnd: c.periodEnd ?? null,
      filingUrl: c.filingUrl ?? null,
      singleSegment: Boolean(c.singleSegment),
      segmentNote: c.error ?? null,
      aiStatements: d?.statements ?? [],
    };
  });

  // Companies that state an AI figure lead: they are the only ones where the
  // question has a published answer.
  companies.sort((a, b) => {
    const da = a.aiStatements.length > 0 ? 1 : 0;
    const db = b.aiStatements.length > 0 ? 1 : 0;
    if (da !== db) return db - da;
    return (b.segmentTotalUsd ?? 0) - (a.segmentTotalUsd ?? 0);
  });

  return {
    companies,
    segmentCapturedAt: seg.capturedAt,
    disclosureCapturedAt: dis.capturedAt,
    disclosingCount: companies.filter((c) => c.aiStatements.length > 0).length,
    totalCount: companies.length,
  };
}

export function formatUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString("en-GB")}`;
}

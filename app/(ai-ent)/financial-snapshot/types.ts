import type { SourceCategory } from "@/lib/aie/sourcing/manifest";

// Response shapes observed from the BoardRadar financial-snapshot endpoints
// (recorded in fixtures/br/financial-snapshot_overview_MSFT.json and
// fixtures/br/financial-snapshot_quick-metrics_MSFT.json).
export interface OverviewResponse {
  success: boolean;
  ticker: string;
  companyName: string;
  isPrivate: boolean;
  industry: string;
  sector: string;
  summary: string;
  timestamp: string;
}

export interface QuickMetric {
  name: string;
  current: string;
  previous: string;
  change: string;
  period: string;
}

export interface QuickMetricsResponse {
  success: boolean;
  ticker: string;
  isPrivate: boolean;
  metrics: QuickMetric[];
  timestamp: string;
}

export interface ProbedTicker {
  ticker: string;
  name: string;
  // META and NVDA resolve for financials only (see DATA_COVERAGE.md).
  financialsOnly: boolean;
}

export interface PrivateSourceLink {
  label: string;
  url: string;
  category: SourceCategory;
}

export interface PrivateVendorCard {
  id: string;
  name: string;
  tagline: string | null;
  sources: PrivateSourceLink[];
}

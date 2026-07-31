// The BoardRadar competitive-intelligence heatmap response, consumed live.
// Optional fields mark what the endpoint does not always return, so the UI
// can render a dash rather than substituting a zero (zero is a real score on
// the 0 to 5 scale and would misread as weakest).

export interface HeatmapCompanyRow {
  company: string;
  ticker: string;
  displayName: string;
  website: string;
  domain: string;
  relationshipType: string;
  isDisruptor: boolean;
  metrics: Record<string, number>;
  categoryAverage?: number;
}

export interface HeatmapRanking {
  rank: number;
  company: string;
  ticker: string;
  displayName: string;
  website: string;
  competitiveMomentumIndex?: number;
  trend?: number;
}

export interface HeatmapCategoryMeta {
  id: string;
  label: string;
  description: string;
  methodology?: { summary: string; details: string };
}

export interface CompetitiveIntelFixture {
  success: boolean;
  primaryTicker: string;
  isPrivate: boolean;
  heatMap: Record<string, HeatmapCompanyRow[]>;
  metrics?: Record<string, string[]>;
  rankings?: HeatmapRanking[];
  categories?: Record<string, HeatmapCategoryMeta>;
  metricDescriptions?: Record<string, string>;
}

export interface AieRankingRow {
  id: string;
  name: string;
  category: string;
  overallScore: number;
  confidenceScore: number;
  marketPosition: string;
}

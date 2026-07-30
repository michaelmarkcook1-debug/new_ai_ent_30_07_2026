import type { ProvenanceEnvelope } from "@/lib/provenance";

// Mirrors the BoardRadar competitive-intelligence heatmap response schema
// (recorded in fixtures/br/competitive-intelligence_heatmap_ACN.json), with
// provenance envelopes added because every value in the sample fixture is
// authored for the demo (sourceBasis "sample").

export interface HeatmapCompanyRow {
  company: string;
  ticker: string;
  displayName: string;
  website: string;
  domain: string;
  relationshipType: string;
  isDisruptor: boolean;
  metrics: Record<string, number>;
  categoryAverage: number;
  provenance: ProvenanceEnvelope;
}

export interface HeatmapRanking {
  rank: number;
  company: string;
  ticker: string;
  displayName: string;
  website: string;
  competitiveMomentumIndex: number;
  trend: number;
  provenance: ProvenanceEnvelope;
}

export interface HeatmapCategoryMeta {
  id: string;
  label: string;
  description: string;
  methodology: { summary: string; details: string };
}

export interface CompetitiveIntelFixture {
  success: boolean;
  primaryTicker: string;
  isPrivate: boolean;
  provenance: ProvenanceEnvelope;
  heatMap: Record<string, HeatmapCompanyRow[]>;
  metrics: Record<string, string[]>;
  rankings: HeatmapRanking[];
  categories: Record<string, HeatmapCategoryMeta>;
  metricDescriptions: Record<string, string>;
}

export interface AieRankingRow {
  id: string;
  name: string;
  category: string;
  overallScore: number;
  confidenceScore: number;
  marketPosition: string;
}

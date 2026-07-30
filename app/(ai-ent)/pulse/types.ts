import type { ProvenanceEnvelope } from "@/lib/provenance";
import type { Insight } from "@/lib/ui/cards";
import type { NewsItem } from "@/lib/ui/news";

export interface SpotlightDimension {
  name: string;
  narrative: number;
  reality: number;
  caption: string;
}

export interface Spotlight {
  headlineScore: number;
  divergence: string;
  generated: string;
  sourceCounts: { narrative: number; reality: number };
  dimensions: SpotlightDimension[];
}

export interface PulseKpi {
  label: string;
  tooltip: string;
  score: number;
  delta: number;
  definition: string;
  provenance: ProvenanceEnvelope;
}

export interface ComparisonRow {
  id: string;
  name: string;
  composite: number;
  momentum: number;
  adoption: number;
  trust: number;
  delivery: number;
  estimated: boolean;
}

export interface PulseFixture {
  provenance: ProvenanceEnvelope;
  editorial: { title: string; date: string; body: string };
  questions: string[];
  kpis: PulseKpi[];
  spotlights: Record<string, Spotlight>;
  comparison: { metrics: string[]; rows: ComparisonRow[] };
  insights: {
    strategic: Insight[];
    threats: Insight[];
    opportunities: Insight[];
  };
  marketNews: NewsItem[];
  vendorNews: Record<string, NewsItem[]>;
}

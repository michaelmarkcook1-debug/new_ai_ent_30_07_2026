import { promises as fs } from "fs";
import path from "path";
import type { ProvenanceEnvelope } from "@/lib/provenance";
import type { Insight } from "@/lib/ui/cards";
import type { RegulatoryRow, VendorRuling } from "@/lib/regulatory";

// Company View (Shell, exemplar buyer). Everything here is SAMPLE lane:
// Shell is not in the BoardRadar universe, so the fixture mirrors the real
// response shapes exactly and carries sample provenance (spec Section 5).

export interface ShellKpi {
  label: string;
  score: number;
  delta: number;
  definition: string;
  tooltip: string;
}

export interface ShellFixture {
  provenance: ProvenanceEnvelope;
  profile: { name: string; label: string; industry: string; note: string };
  overview: {
    insight: { title: string; date: string; body: string };
    kpis: ShellKpi[];
    questions: string[];
  };
  aiExposure: {
    riskScore: number;
    opportunityScore: number;
    aiReadinessScore: number;
    summary: string;
    comparisonTable: {
      ticker: string;
      name: string;
      isMainCompany: boolean;
      deliveryEfficiencyScore: number;
      aiStrategyBenchmark: number;
    }[];
    functionExposure: {
      function: string;
      helps: number;
      threatens: number;
      note: string;
    }[];
    keyFindings: string[];
    recommendations: string[];
  };
  talent: {
    insight: string;
    kpis: {
      headcount: number;
      headcountYoY: number;
      attritionPct: number;
      attritionWindow: string;
      aiTrainedLabel: string;
      aiTrainedSub: string;
      aiSpecialistsLabel: string;
      aiSpecialistsSub: string;
      avgTenureYears: number;
      avgTenureSource: string;
    };
    pyramid: {
      level: string;
      previous24m: number;
      previous: number;
      previous6m: number;
      current: number;
    }[];
    pyramidMetric: string;
    functional: { name: string; pct: number }[];
    leadership: {
      speaker: string;
      role: string;
      signal: string;
      quote: string;
      source: string;
      date: string;
    }[];
    aiTalentExposure: {
      workforce: number;
      avgAiExposurePct: number;
      avgAiExposureBasis: string;
      highExposureThresholdPct: number;
      highExposureRoleCount: number;
      highRiskRoleCount: number;
      growthRoleCount: number;
      roleCoveragePct: number;
      summary: string;
      roles: { role: string; exposurePct: number; direction: string }[];
    };
  };
  trustRank: {
    governance: {
      riskScore: number;
      summary: string;
      confidence: string;
      keyFindings: string[];
      recommendations: string[];
    };
    regulatoryGrid: RegulatoryRow[];
    vendorRulings: VendorRuling[];
  };
  assess: {
    assessment: {
      subject: string;
      weightedTotal: number;
      generated: string;
      dimensions: {
        id: string;
        label: string;
        weight: number;
        score: number;
        rationale: string;
        subcriteria: { label: string; score: number; note: string }[];
      }[];
      derivation: {
        method: string;
        formula: string;
        confidenceNote: string;
        schemaNote: string;
      };
    };
  };
}

export async function loadShellFixture(): Promise<ShellFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "shell.json"),
    "utf8"
  );
  return JSON.parse(file) as ShellFixture;
}

export function exposureInsights(f: ShellFixture): Insight[] {
  return f.aiExposure.keyFindings.slice(0, 3).map((k) => ({
    severity: "MEDIUM" as const,
    category: "Market",
    title: k,
    horizon: "near-term",
  }));
}

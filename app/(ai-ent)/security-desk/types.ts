import type { ProvenanceEnvelope } from "@/lib/provenance";

// Response shape of the BoardRadar /cyber-risk endpoint. See
// fixtures/br/cyber-risk_MSFT.json for a populated example and
// fixtures/br/cyber-risk_META.json for the hasAnalysis:false null case.
export interface CyberRiskComparisonRow {
  ticker: string;
  name: string;
  isMainCompany: boolean;
  cyberRiskScore: number | null;
  hasAnalysis: boolean;
}

export interface CyberRiskResponse {
  success: boolean;
  ticker: string;
  companyName: string;
  isPrivate: boolean;
  hasAnalysis: boolean;
  comparisonTable: CyberRiskComparisonRow[];
  riskScore: number | null;
  summary: string | null;
  vulnerabilities: string[];
  recentIncidents: string[];
  keyFindings: string[];
  recommendations: string[];
  evidenceSources: string[];
  threatLandscape: string | null;
  securityPosture: string | null;
  complianceStatus: string | null;
  timestamp: string;
}

// Sample-lane posture card for a private AI lab, mirroring the /cyber-risk
// schema shape. All values carry sourceBasis "sample" and no lab is scored:
// riskScore stays null because no independent analysis exists.
export interface LabPostureCard {
  id: string;
  name: string;
  hasAnalysis: boolean;
  riskScore: null;
  summary: string;
  threatLandscape: string;
  securityPosture: string;
  complianceStatus: string;
  vulnerabilities: string[];
  recentIncidents: string[];
  keyFindings: string[];
  recommendations: string[];
  evidenceSources: string[];
  provenance: ProvenanceEnvelope;
}

export interface SecurityDeskFixture {
  provenance: ProvenanceEnvelope;
  labs: LabPostureCard[];
}

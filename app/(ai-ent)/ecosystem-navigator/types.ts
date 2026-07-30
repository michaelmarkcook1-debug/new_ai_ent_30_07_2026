import type { ProvenanceEnvelope } from "@/lib/provenance";

// Response shapes observed against the live BoardRadar API (see
// fixtures/br/providers.json and fixtures/br/ai-platform_integration_ACN.json).

export interface BrProvider {
  name: string;
  level: string;
  domain?: string;
  sector?: string;
  ticker: string;
  segment: string;
  tagline?: string;
  isPublic: boolean;
  isForeign?: boolean;
  displayName: string;
  headquarters?: string;
  employeeCount?: number;
  assessmentScore: number | null;
  aiReadinessScore: number | null;
}

export interface BrProvidersResponse {
  success: boolean;
  count: number;
  providers: BrProvider[];
  timestamp?: string;
}

export interface IntegrationPlatform {
  name: string;
  vendor: string | null;
  sourceUrl: string | null;
  description: string;
  integrationDepth: string;
  provenance: ProvenanceEnvelope;
}

export interface IntegrationCategory {
  id: string;
  label: string;
  platforms: IntegrationPlatform[];
  highDisplacementRoles: string[];
  partialDisplacementRoles: string[];
}

export interface IntegrationResponse {
  success: boolean;
  ticker: string;
  providerName: string;
  displayName: string;
  intro: string;
  highDisplacementLabel: string;
  partialDisplacementLabel: string;
  categories: IntegrationCategory[];
  platformCounts: { total: number; proprietary: number; partner: number };
  generatedAt: string;
  updatedAt: string;
}

import type { ProvenanceEnvelope } from "@/lib/provenance";

// Types for the /ai-platform/integration BoardRadar response, matching the
// recorded shape in fixtures/br/ai-platform_integration_ACN.json.

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

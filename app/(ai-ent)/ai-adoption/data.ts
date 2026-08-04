import type { Industry } from "@/lib/aie";

// Module data adapter for Market View. Everything here is pure mapping over
// the AIE dataset (no fixtures, no fs), so both the server page and the
// client explorer can import it.

// The uptake seed facets on its own nine industry segments; the eight AIE
// industry archetypes are mapped onto them so one Industry filter drives
// both the archetype adoption profile and the uptake slice. The mapping is
// a UI convenience and is disclosed in the derivation drawer.
// The live uptake API filters on a single industry display name and rejects
// unknown values. Its valid list matches the ported segment names exactly,
// so archetypes that map to ONE segment can filter upstream; archetypes
// spanning several segments send no filter and the panel says so.
export const ARCHETYPE_TO_LIVE_INDUSTRY: Record<string, string | undefined> = {
  regulated_financial: "Financial services",
  health_life_sciences: "Healthcare / life sciences",
  legal_professional: undefined,
  public_sector_education: undefined,
  critical_infrastructure_defence: undefined,
  enterprise_software: "Technology / software",
  industrial_physical_ops: "Manufacturing / industrials",
  commercial_enterprise: undefined,
};

export const ARCHETYPE_TO_UPTAKE: Record<string, Industry[]> = {
  regulated_financial: ["Financial services"],
  health_life_sciences: ["Healthcare / life sciences"],
  legal_professional: ["Legal", "Professional services / consulting"],
  public_sector_education: [
    "Public sector / government",
    "Education / research / media",
  ],
  critical_infrastructure_defence: [
    "Public sector / government",
    "Manufacturing / industrials",
  ],
  enterprise_software: ["Technology / software"],
  industrial_physical_ops: ["Manufacturing / industrials"],
  commercial_enterprise: [
    "Retail / consumer / ecommerce",
    "Professional services / consulting",
  ],
};

// Moved here from FitEngine with the peer adoption explorer, 4 August 2026.
// Uptake vendor display names mapped to the intelligence-seed vendor ids so
// result rows can link into /vendor-view/<id>.
export const UPTAKE_VENDOR_ID: Record<string, string> = {
  Anthropic: "anthropic",
  Cohere: "cohere",
  "Google DeepMind": "google",
  Harvey: "harvey",
  "IBM watsonx": "ibm",
  Meta: "meta",
  "Mistral AI": "mistral",
  Moveworks: "moveworks",
  OpenAI: "openai",
  Perplexity: "perplexity",
  Rogo: "rogo",
  Writer: "writer",
  xAI: "xai",
};

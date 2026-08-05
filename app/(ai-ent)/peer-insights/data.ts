// Peer adoption filter vocabulary, 4 August 2026.
//
// This replaces the old archetype indirection. The explorer used to offer the
// eight AIE industry archetypes and map them onto the uptake engine's own nine
// segments; five of the eight mapped to more than one segment, so they could
// not filter upstream at all and silently showed an unfiltered slice under a
// label that named an industry. That produced the label a reader could not
// parse — "Commercial Enterprise (mapped to Retail / consumer / ecommerce and
// Professional services / consulting)" — and quietly broke the live path for
// most of the menu.
//
// The engine's nine segments are now offered directly, with display names
// tidied for reading. Every one of them filters upstream, so every selection
// is a genuine live pull rather than a local aggregation.

export interface AdoptionSegment {
  /** Exactly the string the uptake API expects. Do not tidy this one. */
  apiValue: string;
  /** What the reader sees. */
  label: string;
}

export const ADOPTION_SEGMENTS: AdoptionSegment[] = [
  { apiValue: "Technology / software", label: "Technology & Software" },
  { apiValue: "Financial services", label: "Financial Services" },
  { apiValue: "Legal", label: "Legal Services" },
  { apiValue: "Professional services / consulting", label: "Professional Services & Consulting" },
  { apiValue: "Healthcare / life sciences", label: "Healthcare & Life Sciences" },
  { apiValue: "Manufacturing / industrials", label: "Manufacturing & Industrials" },
  { apiValue: "Retail / consumer / ecommerce", label: "Retail, Consumer & E-commerce" },
  { apiValue: "Public sector / government", label: "Public Sector & Government" },
  { apiValue: "Education / research / media", label: "Education, Research & Media" },
];

/**
 * Regions the uptake API accepts.
 *
 * There is no "Global" value upstream: passing region=Global is rejected
 * outright. Global is the absence of a region filter, so it is offered as the
 * default option and simply omits the parameter — which is what the API means
 * by its own scope of "all".
 */
export const ADOPTION_REGIONS: string[] = [
  "North America",
  "Europe & UK",
  "APAC",
  "Latin America",
  "Middle East & Africa",
];

export const GLOBAL_REGION = "Global (all regions)";

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

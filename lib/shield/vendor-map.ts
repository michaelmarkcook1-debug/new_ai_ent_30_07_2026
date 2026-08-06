// Reconciling Shield slugs with AI Enterprise vendor ids.
//
// The Shield grades a model provider's published terms and keys on its own
// slug ("openai-api"); this app keys on the vendor directory's id ("openai").
// This is the one place the two are joined, so a reader's shortlist can be
// marked on the Shield without either dataset having to know about the other.
//
// A missing mapping is a real absence, stated rather than guessed. Reka is on
// the Shield and is not in the 47-vendor directory, so it never carries an
// "on your list" mark. Inventing an id for it would put a vendor on somebody's
// shortlist that they never shortlisted.

import { SHIELD } from "./data";

/** Shield slug to AI Enterprise vendor id. Absent means the directory has no
 *  entry for that provider. */
const SLUG_TO_VENDOR_ID: Record<string, string> = {
  "openai-api": "openai",
  "anthropic-api": "anthropic",
  "google-gemini": "google",
  "mistral-la-plateforme": "mistral",
  "meta-llama": "meta",
  deepseek: "deepseek",
  cohere: "cohere",
  "xai-grok": "xai",
  "ai21-jamba": "ai21",
  "ibm-granite": "ibm",
  "alibaba-qwen": "alibaba",
  "zai-glm": "zai",
  "moonshot-kimi": "moonshot",
  // reka: no vendor-directory entry.
};

export function vendorIdForSlug(slug: string): string | null {
  return SLUG_TO_VENDOR_ID[slug] ?? null;
}

/** Shield slugs the reader has shortlisted, as a set for cheap lookup. */
export function shieldSlugsOnList(watchedVendorIds: string[]): Set<string> {
  const watched = new Set(watchedVendorIds);
  const out = new Set<string>();
  for (const v of SHIELD) {
    const id = vendorIdForSlug(v.slug);
    if (id && watched.has(id)) out.add(v.slug);
  }
  return out;
}

/** Providers on the Shield that the directory does not carry. Rendered as a
 *  stated limit rather than left for a reader to notice. */
export function unmappedShieldSlugs(): string[] {
  return SHIELD.filter((v) => !vendorIdForSlug(v.slug)).map((v) => v.slug);
}

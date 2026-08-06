// Naming the same company across four datasets.
//
// The brief pulls from sources that each name vendors their own way: a status
// page says "Google Cloud", a deprecation page says "OpenAI", an encroachment
// receipt says "Anthropic", and the shortlist holds directory ids like
// "google". This is the single place those are reconciled, so "is this one
// mine" is answered once rather than by four slightly different string
// comparisons that drift apart.
//
// A name absent from this table resolves to null and is simply never marked as
// the reader's. That is the safe direction: failing to flag a vendor somebody
// runs is a missed prompt, while flagging one they do not run is a false
// alarm on their own portfolio.

/** Display name as it appears in a status page, deprecation page or receipt,
 *  lowercased, to the AI Enterprise vendor directory id. */
const NAME_TO_VENDOR_ID: Record<string, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  "google cloud": "google",
  cohere: "cohere",
  groq: "groq",
  deepseek: "deepseek",
  microsoft: "microsoft",
  // The directory carries the cloud as "aws"; receipts say AWS or Amazon
  // depending on which newsroom published them.
  aws: "aws",
  amazon: "aws",
  nvidia: "nvidia",
  meta: "meta",
  mistral: "mistral",
  xai: "xai",
  ibm: "ibm",
  alibaba: "alibaba",
  ai21: "ai21",
  moonshot: "moonshot",
};

export function vendorIdForName(name: string): string | null {
  return NAME_TO_VENDOR_ID[name.trim().toLowerCase()] ?? null;
}

/** Is this named party one the reader shortlisted? */
export function isWatched(name: string, watchedVendorIds: Set<string>): boolean {
  const id = vendorIdForName(name);
  return id !== null && watchedVendorIds.has(id);
}

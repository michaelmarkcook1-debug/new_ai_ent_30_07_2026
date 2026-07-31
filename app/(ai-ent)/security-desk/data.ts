import { loadVendorPostures, type PostureView } from "@/lib/vendor-posture";

// Module data adapter. The live half (BoardRadar cyber-risk for the public
// platform vendors) is fetched client-side via the proxy. This adapter loads
// the real security capability assessment for the private labs, which the
// BoardRadar universe does not cover.
const PRIVATE_LABS = ["anthropic", "openai", "xai", "mistral", "cohere"];

export async function loadLabPostures(): Promise<PostureView> {
  return loadVendorPostures("security", PRIVATE_LABS);
}

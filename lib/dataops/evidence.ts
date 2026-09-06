import { createHash } from "node:crypto";
import { CANONICAL_FILES, SCRIPT_CAPTURED, meaningfulHash } from "./sources";
import type { CanonicalStore } from "./store";

// The evidence version: a fingerprint of what the canonical payloads SAY.
//
// Built from the meaningful hash of every canonical file, so it moves when a
// value moves and stays put when only a timestamp did. It is the number the
// audit trail records before and after an ingestion, and the honest answer to
// "did the evidence change". The Analyst Insight cache does not read it: that
// cache is keyed on the facts a page derives from these files (8.34), so a
// value that moves here changes those facts and the key with them, and a
// timestamp that moves here changes nothing there either. The two agree by
// construction rather than by wiring.

export async function evidenceVersion(store: CanonicalStore): Promise<string> {
  const h = createHash("sha256");
  for (const file of [...CANONICAL_FILES, ...Object.keys(SCRIPT_CAPTURED)]) {
    const text = await store.read(file);
    h.update(file).update(":").update(text ? meaningfulHash(JSON.parse(text)) : "absent").update("\n");
  }
  return h.digest("hex").slice(0, 16);
}

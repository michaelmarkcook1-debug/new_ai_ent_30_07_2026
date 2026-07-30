import { promises as fs } from "fs";
import path from "path";
import type { ReputationFixture } from "./types";

// Module data adapter: the AIE three-pillar reputation seed is imported
// directly by the client components from lib/aie; this adapter only loads
// the SAMPLE fixture for the third-party signals divider section.
export async function loadReputationFixture(): Promise<ReputationFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "reputation-tracker.json"),
    "utf8"
  );
  return JSON.parse(file) as ReputationFixture;
}

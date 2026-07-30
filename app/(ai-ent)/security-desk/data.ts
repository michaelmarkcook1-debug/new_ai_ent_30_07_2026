import { promises as fs } from "fs";
import path from "path";
import type { SecurityDeskFixture } from "./types";

// Module data adapter: The Security Desk is SCHEMA lane with probed LIVE
// coverage. The live half is fetched client-side via the proxy
// (/api/br/cyber-risk); this adapter only loads the sample fixture for the
// private-lab posture cards.
export async function loadSecurityDeskFixture(): Promise<SecurityDeskFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "security-desk.json"),
    "utf8"
  );
  return JSON.parse(file) as SecurityDeskFixture;
}

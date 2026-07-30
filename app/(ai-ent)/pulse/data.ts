import { promises as fs } from "fs";
import path from "path";
import type { PulseFixture } from "./types";

// Module data adapter: The Pulse is SCHEMA lane (sample fixture) with one
// LIVE card (delivery channel watch, fetched client-side via the proxy).
export async function loadPulseFixture(): Promise<PulseFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "pulse.json"),
    "utf8"
  );
  return JSON.parse(file) as PulseFixture;
}

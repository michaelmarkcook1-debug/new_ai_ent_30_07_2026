import { promises as fs } from "fs";
import path from "path";
import { loadMarketMetrics, type MarketMetrics } from "@/lib/market-metrics";
import type { PulseFixture } from "./types";

// Module data adapter.
//
// The market figures on this page are real: they come from the AI Enterprise
// datasets through lib/market-metrics, which maps one metric to one named
// upstream field and returns null wherever the data does not reach. The
// sample fixture is still loaded, but only for the parts that are genuinely
// editorial (the analyst banner, the suggested questions and the narrative
// versus reality spotlight), which no dataset publishes.
export async function loadPulseFixture(): Promise<PulseFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "pulse.json"),
    "utf8"
  );
  return JSON.parse(file) as PulseFixture;
}

export async function loadPulseMetrics(): Promise<MarketMetrics> {
  return loadMarketMetrics();
}

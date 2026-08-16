import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { WARM_PAGES } from "@/lib/analyst/warm-list";

// The list of pages that author a reading exists twice, and must not diverge.
//
// lib/analyst/warm-list.ts is the source, read by the cron at /api/warm.
// scripts/warm-insights.mjs is plain JS run after a deploy and cannot import a
// TypeScript module, so it holds its own copy.
//
// If the two drift, the symptom is invisible: a page drops off one list, still
// gets warmed by the other, and only goes cold in the specific window that list
// covers. Nobody would trace a single slow tab back to a missing array entry.

function scriptPages(): string[] {
  const src = readFileSync(
    path.join(process.cwd(), "scripts", "warm-insights.mjs"),
    "utf8"
  );
  const block = src.slice(src.indexOf("const PAGES = ["));
  const arr = block.slice(0, block.indexOf("]") + 1);
  return [...arr.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("the warm list", () => {
  it("names every page that authors a reading", () => {
    expect(WARM_PAGES.length).toBe(11);
  });

  it("matches the post-deploy script exactly, in the same order", () => {
    // Order matters only for reproducibility of the logs, but a diff here is
    // the cheapest possible signal that somebody edited one and not the other.
    expect(scriptPages()).toEqual([...WARM_PAGES]);
  });

  it("holds real routes, each rooted", () => {
    for (const p of WARM_PAGES) {
      expect(p.startsWith("/"), p).toBe(true);
      expect(p).not.toContain("//");
    }
  });

  it("has no duplicates", () => {
    expect(new Set(WARM_PAGES).size).toBe(WARM_PAGES.length);
  });
});

describe("the cron is scheduled to beat the cache", () => {
  const vercel = JSON.parse(
    readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
  ) as { crons?: { path: string; schedule: string }[] };

  it("registers the warm endpoint", () => {
    const cron = vercel.crons?.find((c) => c.path === "/api/warm");
    expect(cron, "no cron registered for /api/warm").toBeTruthy();
  });

  it("runs at least twice a day, against a 24 hour cache", () => {
    // The reading is cached for 24 hours (TTL_MS in lib/analyst/llm.ts). One
    // run a day would mean a missed run leaves a cold page for a full day, so
    // the schedule is deliberately half the TTL.
    const cron = vercel.crons!.find((c) => c.path === "/api/warm")!;
    const hours = cron.schedule.split(" ")[1];
    expect(hours.split(",").length).toBeGreaterThanOrEqual(2);
  });
});

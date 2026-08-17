import { describe, it, expect } from "vitest";
import { citedChunks } from "@/lib/desk/corpus";
import { DEPRECATIONS, upcomingDeprecations } from "@/lib/desk/deprecations";
import { retrieve, type Chunk } from "@/app/api/analyst/lib";

// The cited corpus, and the retriever that reads it.
//
// Both defects pinned here were found by scripts/audit-cited-findings.ts on
// 17 August 2026. Neither was visible from the output: a cited finding is
// fluent, names a real vendor and carries a source whether or not the evidence
// behind it is sound, which is why the evidence needs its own tests.

const asChunks = (): Chunk[] =>
  citedChunks().map((c) => ({ source: c.source, sourceKind: "cited", text: c.text }));

describe("the cited corpus", () => {
  it("never states an already-retired model as a future event", () => {
    // The defect: this file iterated the raw DEPRECATIONS array while the
    // module exported upcomingDeprecations() to filter it, so three models
    // already dead were described as "is retiring ... after that date, calls
    // to it fail". Three sentences in the future tense about the past.
    const chunks = citedChunks();
    const live = new Set(upcomingDeprecations(new Date()).map((d) => d.model));
    for (const d of DEPRECATIONS) {
      if (live.has(d.model)) continue;
      const about = chunks.filter((c) => c.text.includes(d.model));
      for (const c of about) {
        expect(c.text).not.toMatch(/\bis retiring\b|\bwill retire\b/);
        expect(c.text).not.toContain("After that date, calls to it fail");
      }
    }
  });

  it("keeps past retirements rather than dropping them", () => {
    // Dropping the row would make the corpus silent on exactly the question it
    // was ported to answer. A buyer still calling a dead model needs to hear
    // that more urgently than one facing a deadline.
    const chunks = citedChunks();
    for (const d of DEPRECATIONS) {
      expect(chunks.some((c) => c.text.includes(d.model))).toBe(true);
    }
  });

  it("carries a source on every chunk", () => {
    for (const c of citedChunks()) {
      expect(c.source.trim().length).toBeGreaterThan(0);
      expect(c.text.trim().length).toBeGreaterThan(20);
    }
  });

  it("carries no em-dash", () => {
    for (const c of citedChunks()) expect(c.text).not.toContain("—");
  });
});

describe("retrieval", () => {
  it("matches across word forms, not just substrings", () => {
    // The defect: substring matching is asymmetric. "train" finds "trains"
    // because the chunk contains the shorter string, but "retired" does not
    // find "retiring" because neither contains the other. That made the most
    // actionable evidence in the corpus unreachable by the plainest way of
    // asking for it.
    const hits = retrieve(
      asChunks(),
      "Which models are being retired and when do our calls start failing?",
      8
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => /retir/i.test(h.chunk.text))).toBe(true);
  });

  it("still finds what plain substring matching found", () => {
    // The stem test only ever adds recall. Anything that matched before must
    // still match, or this traded one silent failure for another.
    const chunks = asChunks();
    for (const q of [
      "Can OpenAI train on our data?",
      "Who indemnifies us if the output infringes copyright?",
      "data residency",
    ]) {
      expect(retrieve(chunks, q, 8).length).toBeGreaterThan(0);
    }
  });

  it("returns nothing rather than everything for an unmatched question", () => {
    // A retriever that answers every question is not grounding anything.
    expect(retrieve(asChunks(), "zzzz qqqq xxxx", 8)).toHaveLength(0);
  });
});

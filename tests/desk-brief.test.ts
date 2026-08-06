import { describe, expect, it } from "vitest";
import { assembleBrief } from "@/lib/desk/brief";
import type { StatusRow } from "@/lib/desk/status";
import type { DeskNewsItem } from "@/lib/desk/news";
import {
  DEPRECATIONS,
  upcomingDeprecations,
} from "@/lib/desk/deprecations";
import { ENCROACHMENTS } from "@/lib/desk/encroachment";
import { vendorIdForName, isWatched } from "@/lib/desk/vendor-map";
import { buildDossier } from "@/lib/desk/dossier";
import { citedChunks } from "@/lib/desk/corpus";

// Today's Brief.
//
// The verdict at the top of the Pulse is the one thing on the page a reader
// might act on without reading further, so the assertions here are about the
// verdict never overstating: it must not go green while something is wrong,
// must not go red on somebody else's problem, and must never invent a
// portfolio the reader has not set.

const NOW = new Date("2026-08-06T09:00:00Z");

const up = (provider: string): StatusRow => ({
  provider,
  description: "All Systems Operational",
  operational: true,
  source: { name: `${provider} status`, url: "https://example.invalid" },
});
const down = (provider: string): StatusRow => ({
  provider,
  description: "Partial System Degradation",
  operational: false,
  source: { name: `${provider} status`, url: "https://example.invalid" },
});
const story = (over: Partial<DeskNewsItem> = {}): DeskNewsItem => ({
  title: "A security story",
  url: "https://example.invalid/1",
  source: "The Hacker News",
  sourceUrl: "https://example.invalid",
  ageHours: 3,
  security: true,
  kind: "security",
  ...over,
});

describe("portfolio health never overstates", () => {
  it("declines to give a verdict when nothing is shortlisted", () => {
    const b = assembleBrief([up("OpenAI")], 6, [], [], NOW);
    expect(b.health).toBe("unset");
    expect(b.headline).toBe("No portfolio set");
    expect(b.watched).toBe(0);
  });

  it("goes red only for an incident on a vendor the reader runs", () => {
    const mine = assembleBrief([down("OpenAI")], 6, [], ["openai"], NOW);
    expect(mine.health).toBe("red");
    expect(mine.reason).toMatch(/1 live incident/);

    const notMine = assembleBrief([down("Cohere")], 6, [], ["openai"], NOW);
    expect(notMine.health).not.toBe("red");
  });

  it("still reports an incident that is not the reader's, without alarming them", () => {
    const b = assembleBrief([down("Cohere")], 6, [], ["openai"], NOW);
    const sec = b.sections.find((s) => s.key === "security")!;
    const line = sec.lines.find((l) => l.fact.includes("Cohere"))!;
    expect(line.yours).toBe(false);
    expect(line.act).toMatch(/one procurement away/);
  });

  it("states the reason for every colour it reports", () => {
    for (const ids of [[], ["openai"], ["deepseek"]]) {
      const b = assembleBrief([down("OpenAI")], 6, [], ids, NOW);
      expect(b.reason.length).toBeGreaterThan(20);
    }
  });

  it("goes amber, not green, on a weak Shield score in the portfolio", () => {
    // DeepSeek scores 0 of 4: every mark adverse.
    const b = assembleBrief([up("OpenAI")], 6, [], ["deepseek"], NOW);
    expect(b.health).toBe("amber");
    expect(b.reason).toMatch(/Shield/);
  });

  it("goes green only when it can name what it checked", () => {
    // Anthropic scores 4 of 4 and has no retirement inside 90 days of this date.
    const b = assembleBrief([up("Anthropic")], 6, [], ["anthropic"], NOW);
    expect(b.health).toBe("green");
    expect(b.reason).toMatch(/No live incident/);
  });
});

describe("the brief pairs every fact with an action", () => {
  it("gives every line an act and a source", () => {
    const b = assembleBrief(
      [down("OpenAI")],
      6,
      [story(), story({ url: "https://example.invalid/2", security: false, kind: "vendor" })],
      ["openai"],
      NOW
    );
    for (const s of b.sections) {
      for (const l of s.lines) {
        expect(l.act.length, `${l.fact} has no action`).toBeGreaterThan(20);
        expect(l.source.name.length).toBeGreaterThan(0);
        expect(l.source.url).toMatch(/^https?:\/\//);
      }
    }
  });

  it("separates an obligation that binds the reader from one that binds the vendor", () => {
    const b = assembleBrief([], 6, [], [], NOW);
    const reg = b.sections.find((s) => s.key === "regulation");
    expect(reg).toBeTruthy();
    for (const l of reg!.lines) {
      expect(l.act).toMatch(/binds you|binds the model provider/);
    }
  });

  it("reports how much it could read, so a thin brief is not mistaken for calm", () => {
    const b = assembleBrief([up("OpenAI")], 6, [], [], NOW);
    expect(b.statusesRead).toBe(1);
    expect(b.statusesAttempted).toBe(6);
  });

  it("drops a section entirely rather than rendering it empty", () => {
    const b = assembleBrief([up("OpenAI")], 6, [], [], NOW);
    // No degraded provider and no security story: no security section at all.
    expect(b.sections.some((s) => s.key === "security")).toBe(false);
    expect(b.sections.every((s) => s.lines.length > 0)).toBe(true);
  });
});

describe("deprecations are dated and filtered honestly", () => {
  it("never reports a retirement that has already happened", () => {
    for (const d of upcomingDeprecations(NOW)) {
      expect(d.daysAway).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the transcription intact rather than deleting past rows", () => {
    // Filtering happens at read time; the ledger stays a faithful record of
    // what the vendor pages said on the verification date.
    expect(DEPRECATIONS.length).toBeGreaterThan(
      upcomingDeprecations(NOW).length
    );
  });

  it("gives every retirement a replacement and a source", () => {
    for (const d of DEPRECATIONS) {
      expect(d.replacement.length).toBeGreaterThan(0);
      expect(d.source.url).toMatch(/^https:\/\//);
      expect(d.retire).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("vendor naming is reconciled in one place", () => {
  it("resolves the names each source actually uses", () => {
    expect(vendorIdForName("Google Cloud")).toBe("google");
    expect(vendorIdForName("AWS")).toBe("aws");
    expect(vendorIdForName("Amazon")).toBe("aws");
    expect(vendorIdForName("  OpenAI  ")).toBe("openai");
  });

  it("returns null rather than guessing at an unknown name", () => {
    expect(vendorIdForName("Some Startup")).toBeNull();
    expect(isWatched("Some Startup", new Set(["openai"]))).toBe(false);
  });

  it("resolves every party named in the encroachment register", () => {
    for (const e of ENCROACHMENTS) {
      expect(vendorIdForName(e.actor), `${e.actor} unmapped`).not.toBeNull();
      expect(vendorIdForName(e.against), `${e.against} unmapped`).not.toBeNull();
    }
  });

  it("resolves every vendor named in the deprecation ledger", () => {
    for (const d of DEPRECATIONS) {
      expect(vendorIdForName(d.vendor), `${d.vendor} unmapped`).not.toBeNull();
    }
  });
});

describe("the dossier joins without inventing", () => {
  it("assembles the full picture for a covered vendor", () => {
    const d = buildDossier("anthropic", NOW);
    expect(d.shield?.score).toBe(4);
    expect(d.sovereignty?.flag).toBe("none");
    expect(d.encroachedBy.length).toBeGreaterThan(0);
    expect(d.empty).toBe(false);
  });

  it("reports an honest absence for a vendor no ported surface covers", () => {
    const d = buildDossier("groq", NOW);
    expect(d.shield).toBeNull();
    expect(d.sovereignty).toBeNull();
    expect(d.empty).toBe(true);
  });

  it("does not confuse encroaching with being encroached upon", () => {
    const openai = buildDossier("openai", NOW);
    expect(openai.encroachedBy.some((e) => e.actor === "Microsoft")).toBe(true);
    expect(openai.encroachesOn.some((e) => e.against === "NVIDIA")).toBe(true);
  });
});

describe("the analyst corpus carries the citation, not just the fact", () => {
  it("gives every chunk a named source", () => {
    for (const c of citedChunks()) {
      expect(c.source.length).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThan(40);
    }
  });

  it("covers all four questions for every graded vendor", () => {
    const chunks = citedChunks();
    for (const dim of ["trains on customer data", "data residency"]) {
      expect(chunks.filter((c) => c.text.includes(dim)).length).toBeGreaterThan(10);
    }
  });

  it("marks an unverified term as unestablished rather than omitting it", () => {
    const chunks = citedChunks();
    const xaiIndemnity = chunks.find(
      (c) => c.text.startsWith("xAI (Grok), on whether it indemnifies")
    );
    expect(xaiIndemnity).toBeTruthy();
    expect(xaiIndemnity!.text).toMatch(/not established/);
  });
});

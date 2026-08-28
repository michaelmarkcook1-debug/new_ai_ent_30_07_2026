import { describe, it, expect } from "vitest";
import {
  canCreateUrgency,
  evidenceDate,
  freshnessOf,
  speaksToNow,
  type DateProvenance,
} from "@/lib/analyst/freshness";
import { signal, type Signal } from "@/lib/analyst/signals";
import { signalsFromMetrics, priceSignal } from "@/lib/analyst/cross";
import { synthesise } from "@/lib/analyst/synthesis";
import { DATE_PROVENANCE, type MarketMetrics } from "@/lib/market-metrics";

// A request time is not an observation time.
//
// `freshnessOf()` asks how old a reading is. That is only a meaningful question
// when the date it is handed is the date the reading was TAKEN. Eight of the
// nine signals feeding decision intelligence were being handed the timestamp
// their upstream stamped on the response, so they classified `current` by
// construction and could never reach `aging` or `stale`. The shelf-life table,
// the urgency gate and everything P2B built on top of them were inert for those
// sources.
//
// MEASURED, 28 August 2026. A call at 18:38:16.140 returned `generatedAt` of
// 18:38:16.140, `reputationAsOf` of 18:38:16.242 and `shareAsOf` of
// 18:38:16.261: each is the clock at the moment that leg of the fetch returned.
// `compositesCapturedAt` came back 2026-08-17, eleven days old and stable,
// because a sync script writes it when it freezes the snapshot to disk.
//
// The fix is not a threshold and not a substitution. It is a declaration of
// what each date means, and a refusal to age a reading against a date that was
// never about the reading.

const NOW = Date.parse("2026-08-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const sig = (source: string, observedAt: string | null): Signal =>
  signal({
    id: "s",
    subject: "the tracked set",
    dimension: "capability",
    state: "narrow",
    observedAt,
    lane: "aie",
    evidence: {
      claim: "a reading",
      source,
      basis: "measured",
      lane: "aie",
      asOf: observedAt,
    },
  });

// ------------------------------------------------------- the contract itself

describe("what a date is allowed to mean", () => {
  it("passes a capture date through", () => {
    expect(evidenceDate(iso(11), "capture")).toBe(iso(11));
  });

  it("passes a publication date through", () => {
    expect(evidenceDate(iso(30), "publication")).toBe(iso(30));
  });

  it("passes a filing date through", () => {
    expect(evidenceDate(iso(90), "filing")).toBe(iso(90));
  });

  it("refuses a response stamp, however recent", () => {
    // The whole defect in one assertion. A stamp made this instant is the
    // freshest possible value and says nothing about the evidence.
    expect(evidenceDate(iso(0), "response")).toBeNull();
    expect(evidenceDate(new Date(NOW).toISOString(), "response")).toBeNull();
  });

  it("refuses a date nobody has classified", () => {
    expect(evidenceDate(iso(1), "unknown")).toBeNull();
  });

  it("returns null for an absent date whatever the provenance", () => {
    for (const p of ["capture", "publication", "filing", "response", "unknown"] as DateProvenance[]) {
      expect(evidenceDate(null, p)).toBeNull();
      expect(evidenceDate(undefined, p)).toBeNull();
      expect(evidenceDate("", p)).toBeNull();
    }
  });
});

// ------------------------------------------------- generatedAt is not evidence

describe("a generated or fetch timestamp does not establish current evidence", () => {
  it("does not make a reading current, even stamped this second", () => {
    const stamped = evidenceDate(new Date(NOW).toISOString(), "response");
    const s = sig("AIE capability matrix", stamped);
    expect(freshnessOf(s, NOW)).toBe("unknown");
    expect(freshnessOf(s, NOW)).not.toBe("current");
  });

  it("would have been current had the stamp been trusted", () => {
    // The counterfactual, so the test says what it is preventing rather than
    // only that it prevents something.
    const trusted = sig("AIE capability matrix", new Date(NOW).toISOString());
    expect(freshnessOf(trusted, NOW)).toBe("current");
    expect(canCreateUrgency(freshnessOf(trusted, NOW))).toBe(true);
  });

  it("cannot create urgency and cannot claim the present", () => {
    const s = sig("AIE capability matrix", evidenceDate(iso(0), "response"));
    const f = freshnessOf(s, NOW);
    expect(canCreateUrgency(f)).toBe(false);
    expect(speaksToNow(f)).toBe(false);
  });
});

// ------------------------------------------------ a real capture still works

describe("a genuine observation date still works", () => {
  it("classifies a recent capture as current and lets it create urgency", () => {
    const s = sig("AIE vendor rankings", evidenceDate(iso(11), "capture"));
    expect(freshnessOf(s, NOW)).toBe("current");
    expect(canCreateUrgency(freshnessOf(s, NOW))).toBe(true);
  });

  it("ages a capture on its own source policy", () => {
    // AIE vendor rankings: current 30, stale 90.
    expect(freshnessOf(sig("AIE vendor rankings", evidenceDate(iso(45), "capture")), NOW)).toBe("aging");
    expect(freshnessOf(sig("AIE vendor rankings", evidenceDate(iso(120), "capture")), NOW)).toBe("stale");
  });

  it("keeps the Artificial Analysis benchmark classified as it was", () => {
    // The one signal that always carried a real capture date. Its behaviour
    // must not have moved: aging at 35 days, usable, barred from urgency.
    const s = sig("Artificial Analysis benchmark", evidenceDate(iso(35), "capture"));
    expect(freshnessOf(s, NOW)).toBe("aging");
    expect(speaksToNow(freshnessOf(s, NOW))).toBe(true);
    expect(canCreateUrgency(freshnessOf(s, NOW))).toBe(false);
    // And the boundaries either side of it.
    expect(freshnessOf(sig("Artificial Analysis benchmark", iso(21)), NOW)).toBe("current");
    expect(freshnessOf(sig("Artificial Analysis benchmark", iso(61)), NOW)).toBe("stale");
  });

  it("runs a filing on the filing cadence rather than the news cadence", () => {
    const filing = evidenceDate(iso(100), "filing");
    expect(freshnessOf(sig("SEC filings, full-text search", filing), NOW)).toBe("current");
    expect(freshnessOf(sig("AIE news feed", filing), NOW)).toBe("stale");
  });
});

// -------------------------------------- the declaration these signals rest on

describe("the provenance declared for the AIE payloads", () => {
  it("calls the three envelope stamps response stamps", () => {
    expect(DATE_PROVENANCE.generatedAt).toBe("response");
    expect(DATE_PROVENANCE.reputationAsOf).toBe("response");
    expect(DATE_PROVENANCE.shareAsOf).toBe("response");
  });

  it("calls the frozen ranking snapshot a capture", () => {
    // scripts/sync-category-rankings.mjs stamps this when it writes the file,
    // and the file is then frozen, so it dates the reading it accompanies.
    expect(DATE_PROVENANCE.compositesCapturedAt).toBe("capture");
  });
});

// ------------------------------------------------- end to end over the metrics

describe("signals built from a response-stamped payload", () => {
  const metrics = (over: Partial<MarketMetrics> = {}): MarketMetrics =>
    ({
      vendors: [
        { id: "openai", name: "OpenAI", category: "Frontier model/API", maturity: 70, reputation: 80 },
        { id: "anthropic", name: "Anthropic", category: "Frontier model/API", maturity: 60, reputation: 79 },
        { id: "google", name: "Google", category: "Cloud AI platform", maturity: 63, reputation: 81 },
        { id: "meta", name: "Meta", category: "Frontier model/API", maturity: 55, reputation: 77 },
        { id: "cohere", name: "Cohere", category: "Frontier model/API", maturity: 58, reputation: 76 },
        { id: "sap", name: "SAP", category: "Enterprise applications", maturity: 50, reputation: 70 },
      ],
      shares: [],
      kpis: [],
      risks: [{ vendorId: "openai", vendorName: "OpenAI", severity: "high" }],
      gaining: [],
      slipping: [],
      lane: "aie",
      // Every one of these is the moment of the call.
      generatedAt: new Date(NOW).toISOString(),
      reputationAsOf: new Date(NOW).toISOString(),
      shareAsOf: new Date(NOW).toISOString(),
      shareMovementPublished: false,
      categoryComposites: {
        frontier_model_api: {
          openai: { rank: 1, composite: 3.7 },
          anthropic: { rank: 2, composite: 3.6 },
          meta: { rank: 3, composite: 3.4 },
          cohere: { rank: 4, composite: 3.3 },
          google: { rank: 5, composite: 3.2 },
        },
      },
      categoryHeld: {},
      // A real capture, eleven days old.
      compositesCapturedAt: iso(11),
      ...over,
    }) as unknown as MarketMetrics;

  it("dates nothing off the response stamp", () => {
    const stamp = new Date(NOW).toISOString();
    for (const s of signalsFromMetrics(metrics())) {
      expect(s.observedAt, `${s.id} was dated with the response stamp`).not.toBe(stamp);
    }
  });

  it("leaves every response-stamped reading at unknown freshness", () => {
    const byId = new Map(signalsFromMetrics(metrics()).map((s) => [s.id, s]));
    for (const id of [
      "capability-spread",
      "capability-spread-frontier",
      "risk-open",
      "reputation-spread",
      "reputation-spread-frontier",
    ]) {
      const s = byId.get(id);
      if (!s) continue;
      expect(s.observedAt, id).toBeNull();
      expect(freshnessOf(s, NOW), id).toBe("unknown");
      expect(canCreateUrgency(freshnessOf(s, NOW)), id).toBe(false);
    }
  });

  it("keeps the one genuine capture date and classifies it current", () => {
    const pos = signalsFromMetrics(metrics()).find((s) => s.id === "position-lead");
    expect(pos).toBeDefined();
    expect(pos!.observedAt).toBe(iso(11));
    expect(freshnessOf(pos!, NOW)).toBe("current");
    expect(canCreateUrgency(freshnessOf(pos!, NOW))).toBe(true);
  });

  it("still emits every signal it emitted before", () => {
    // The fix withholds dates, not readings. Suppressing evidence to make a
    // gate pass would be the opposite of the point.
    const ids = signalsFromMetrics(metrics()).map((s) => s.id).sort();
    expect(ids).toContain("capability-spread");
    expect(ids).toContain("capability-spread-frontier");
    expect(ids).toContain("position-lead");
    expect(ids).toContain("risk-open");
    expect(ids).toContain("reputation-spread");
  });
});

// ------------------------------------- synthesis degrades rather than lying

describe("synthesis over an unknown-dated input", () => {
  const cap = (observedAt: string | null): Signal =>
    signal({
      id: "cap",
      subject: "the frontier model cohort",
      population: "frontier-model-providers",
      dimension: "capability",
      state: "narrow",
      observedAt,
      lane: "aie",
      evidence: {
        claim: "capability across frontier model providers is narrow",
        source: "AIE capability matrix",
        basis: "measured",
        lane: "aie",
        asOf: observedAt,
      },
    });
  const price = priceSignal(25, 29, iso(35))!;

  it("fires where both halves carry a real date", () => {
    const hit = synthesise([cap(iso(5)), price], NOW).find(
      (s) => s.id === "capability-price-divergence"
    );
    expect(hit).toBeDefined();
    // The price half is aging, so the finding stands and cannot hurry anyone.
    expect(hit!.freshness).toBe("aging");
    expect(canCreateUrgency(hit!.freshness)).toBe(false);
  });

  it("suppresses a currency-dependent rule when one half has no date", () => {
    // Degrading honestly: the rule claims something about the market NOW, and
    // half of it cannot be dated, so it does not fire at all rather than
    // firing at reduced confidence.
    const found = synthesise([cap(null), price], NOW);
    expect(found.find((s) => s.id === "capability-price-divergence")).toBeUndefined();
  });

  it("still lets a structural rule use the undated reading", () => {
    // The other half of the policy. `requiresCurrency: false` rules say the
    // same thing whether the register was read last week or last quarter, so
    // an unknown date does not silence them and the evidence is not wasted.
    const pos = signal({
      id: "pos",
      subject: "NVIDIA",
      population: "tracked-vendor-set",
      members: ["NVIDIA"],
      dimension: "position",
      state: "clear, and leads its market",
      observedAt: null,
      lane: "aie",
      evidence: { claim: "leads", source: "AIE vendor rankings", basis: "measured", lane: "aie", asOf: null },
    });
    const risk = signal({
      id: "risk",
      subject: "the tracked set",
      population: "tracked-vendor-set",
      members: ["NVIDIA"],
      dimension: "risk",
      state: "carrying 2 open high-severity findings across 1 vendor",
      observedAt: null,
      lane: "aie",
      evidence: { claim: "findings", source: "AIE risk register", basis: "measured", lane: "aie", asOf: null },
    });
    const hit = synthesise([pos, risk], NOW).find((s) => s.id === "strength-risk-divergence");
    expect(hit).toBeDefined();
    expect(hit!.freshness).toBe("unknown");
    expect(hit!.currency).toBe("contextual");
    // Contextual, and therefore barred from creating urgency.
    expect(canCreateUrgency(hit!.freshness)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { pulseJudgement, type PulseJudgementInput } from "@/lib/pulse/judgement";
import type { MarketKpi, MarketSignal } from "@/lib/market-metrics";

const sig = (name: string, severity: string | null = null): MarketSignal => ({
  vendorId: name.toLowerCase(),
  vendorName: name,
  headline: `${name} moved`,
  severity,
  confidence: null,
});

const kpi = (
  label: string,
  score: number | null,
  delta: number | null,
  extra: Partial<MarketKpi> = {}
): MarketKpi => ({
  label,
  tooltip: "",
  score,
  delta,
  definition: "",
  sourceField: "f",
  sampleSize: 47,
  ...extra,
});

const base: PulseJudgementInput = {
  gaining: [],
  slipping: [],
  risks: [],
  kpis: [],
  shareMovementPublished: true,
};

describe("pulseJudgement", () => {
  it("names the count in both directions", () => {
    const r = pulseJudgement({
      ...base,
      gaining: [sig("Anthropic"), sig("Mistral")],
      slipping: [sig("Cohere")],
    });
    expect(r.headline).toBe("2 vendors gaining, 1 slipping");
  });

  it("says so rather than implying balance when only one side moved", () => {
    expect(
      pulseJudgement({ ...base, gaining: [sig("Anthropic")] }).headline
    ).toBe("1 vendor is gaining position, none slipping");
    expect(
      pulseJudgement({ ...base, slipping: [sig("Cohere")] }).headline
    ).toBe("1 vendor is slipping, none gaining");
  });

  // The failure this guards against: rendering a confident "nothing moved"
  // when the truth is that the source never published a prior to compare to.
  it("distinguishes no movement from no published movement", () => {
    expect(pulseJudgement(base).headline).toBe(
      "No vendor changed position in the tracked set"
    );
    expect(
      pulseJudgement({ ...base, shareMovementPublished: false }).headline
    ).toBe("Positions steady: no movement published this period");
  });

  it("quotes the average that moved furthest, with its real numbers", () => {
    const r = pulseJudgement({
      ...base,
      kpis: [kpi("Capability", 71.2, 0.4), kpi("Trust", 63.5, -2.8)],
    });
    expect(r.judgement).toContain("Trust averages 63.5 across 47 vendors");
    expect(r.judgement).toContain("down 2.8");
  });

  // An inverted KPI going up is bad news; the sentence must not congratulate.
  it("reads direction against the metric's polarity", () => {
    const good = pulseJudgement({ ...base, kpis: [kpi("Capability", 70, 3)] });
    expect(good.judgement).toContain("buyer's favour");
    const bad = pulseJudgement({
      ...base,
      kpis: [kpi("Concentration", 70, 3, { invert: true })],
    });
    expect(bad.judgement).toContain("wrong direction for buyers");
  });

  it("claims no direction when nothing has a prior", () => {
    const r = pulseJudgement({ ...base, kpis: [kpi("Capability", 70, null)] });
    expect(r.judgement).toContain("no prior reading");
    expect(r.judgement).not.toContain("up ");
  });

  it("counts high-severity risks separately", () => {
    const r = pulseJudgement({
      ...base,
      risks: [sig("A", "high"), sig("B", "medium"), sig("C", "high")],
    });
    expect(r.judgement).toContain("3 risks are published against the set, 2 rated high");
  });

  it("states an empty risk list rather than omitting it", () => {
    expect(pulseJudgement(base).judgement).toContain(
      "No open risks are published"
    );
  });

  it("returns null movement rather than a filler string", () => {
    expect(pulseJudgement(base).movement).toBeNull();
    expect(
      pulseJudgement({ ...base, gaining: [sig("Anthropic")] }).movement
    ).toBe("Anthropic (gaining)");
  });
});

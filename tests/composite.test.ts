import { describe, it, expect } from "vitest";
import {
  composite,
  compositeCaveat,
  verdictFor,
  verdicts,
  terciles,
  DEFAULT_WEIGHTS,
  INPUT_KEYS,
  UNKNOWN_COPY,
  type CompositeInputs,
  type Thresholds,
} from "@/lib/vendor/composite";

const CUTS: Thresholds = {
  winning: { low: 55, high: 65 },
  trust: { low: 73, high: 78 },
  durability: { low: 40, high: 70 },
};

const inputs = (
  winning: number | null,
  trust: number | null,
  durability: number | null
): CompositeInputs => ({ winning, trust, durability });

describe("the composite always carries its input count", () => {
  // The acceptance line for this whole task: nothing anywhere shows a
  // composite number without the count of inputs behind it.
  it("reports the count on every result, full or partial", () => {
    expect(composite(inputs(70, 80, 60)).inputsPresent).toBe(3);
    expect(composite(inputs(70, 80, null)).inputsPresent).toBe(2);
    expect(composite(inputs(70, null, null)).inputsPresent).toBe(1);
    expect(composite(inputs(null, null, null)).inputsPresent).toBe(0);
    for (const r of [
      composite(inputs(70, 80, 60)),
      composite(inputs(70, 80, null)),
      composite(inputs(null, null, null)),
    ]) {
      expect(r.inputsTotal).toBe(3);
      expect(r.present.length + r.missing.length).toBe(3);
    }
  });

  it("returns no score at all rather than a zero when nothing is known", () => {
    const r = composite(inputs(null, null, null));
    expect(r.score).toBeNull();
    expect(compositeCaveat(r)).toContain("No score");
  });

  it("names what is missing in the caveat", () => {
    const r = composite(inputs(70, 80, null));
    expect(compositeCaveat(r)).toBe(
      "from 2 of 3 inputs. Not published: will it still exist in 3 years?"
    );
    expect(compositeCaveat(composite(inputs(70, 80, 60)))).toBe(
      "from 3 of 3 inputs. All three published."
    );
  });
});

describe("missing inputs do not penalise a vendor", () => {
  // Scoring an absence as zero would turn a gap in our data into a verdict
  // about the vendor's business. Weights renormalise over what is present.
  it("does not drag the score down for an unmeasured input", () => {
    const partial = composite(inputs(80, 80, null));
    expect(partial.score).toBe(80);
    const zeroed = (80 * 0.4 + 80 * 0.3 + 0 * 0.3) / 1;
    expect(partial.score).toBeGreaterThan(zeroed);
  });

  it("renormalises the applied weights to sum to one", () => {
    const r = composite(inputs(60, 90, null));
    const sum = Object.values(r.applied).reduce((a, w) => a + w, 0);
    expect(sum).toBeCloseTo(1, 10);
    // 0.4 and 0.3 rescale to 4/7 and 3/7.
    expect(r.applied.winning).toBeCloseTo(4 / 7, 10);
    expect(r.applied.trust).toBeCloseTo(3 / 7, 10);
    expect(r.applied.durability).toBeUndefined();
  });

  it("returns the single input's own value when only one is present", () => {
    expect(composite(inputs(null, 76.4, null)).score).toBe(76.4);
  });

  it("weights the full case as specified", () => {
    const r = composite(inputs(50, 100, 0));
    expect(r.score).toBe(Math.round((50 * 0.4 + 100 * 0.3 + 0 * 0.3) * 10) / 10);
  });

  it("accepts custom weights", () => {
    const only = { winning: 1, trust: 0, durability: 0 };
    expect(composite(inputs(42, 99, 99), only).score).toBe(42);
  });
});

describe("verdicts are cut against the measure's own spread", () => {
  it("treats a genuine absence as Unknown, never as No", () => {
    expect(verdictFor(null, CUTS.trust)).toBe("unknown");
    const v = verdicts(inputs(70, null, null), CUTS);
    expect(v.trust).toBe("unknown");
    expect(v.durability).toBe("unknown");
    expect(v.winning).toBe("yes");
  });

  it("splits at the tercile boundaries", () => {
    expect(verdictFor(65, CUTS.winning)).toBe("yes");
    expect(verdictFor(64.9, CUTS.winning)).toBe("mixed");
    expect(verdictFor(55, CUTS.winning)).toBe("mixed");
    expect(verdictFor(54.9, CUTS.winning)).toBe("no");
  });

  // Why relative cuts exist at all: reputation and capability sit on
  // different scales, so one fixed threshold misreads both.
  it("reads the same raw number differently on different measures", () => {
    expect(verdictFor(70, CUTS.winning)).toBe("yes");
    expect(verdictFor(70, CUTS.trust)).toBe("no");
  });

  it("computes terciles over present values only", () => {
    const t = terciles([10, null, 20, 30, null, 40]);
    expect(t.low).toBeCloseTo(20, 10);
    expect(t.high).toBeCloseTo(30, 10);
  });

  it("survives a measure with no values at all", () => {
    expect(terciles([null, null])).toEqual({ low: 0, high: 0 });
    expect(verdictFor(null, terciles([null]))).toBe("unknown");
  });
});

describe("unknown copy", () => {
  it("says what is missing for each input rather than a generic blank", () => {
    for (const k of INPUT_KEYS) {
      expect(UNKNOWN_COPY[k].length).toBeGreaterThan(10);
    }
    expect(UNKNOWN_COPY.durability).toBe("No AI revenue disclosed");
  });

  it("keeps the default weights summing to one", () => {
    const sum = INPUT_KEYS.reduce((a, k) => a + DEFAULT_WEIGHTS[k], 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

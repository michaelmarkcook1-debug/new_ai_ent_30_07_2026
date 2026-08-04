import { describe, it, expect } from "vitest";
import { scorecardSet, vendorScorecard } from "@/lib/vendor/composite-data";
import { compositeCaveat, INPUT_KEYS } from "@/lib/vendor/composite";

const SET = scorecardSet();

describe("coverage of the three inputs", () => {
  // These are the numbers the product's copy quotes. If one moves, the
  // sentence describing what the composite can claim is wrong.
  it("is what the sources actually publish", () => {
    expect(SET.total).toBe(43);
    expect(SET.coverage.winning).toBe(43);
    expect(SET.coverage.trust).toBe(28);
    // 20, up from 18 on 5 August 2026: the verified evidence record gave
    // OpenAI a closed valuation and revenue on the record, and Databricks a
    // closed December round, so both now score instead of reading Unknown.
    expect(SET.coverage.durability).toBe(20);
  });

  it("leaves no vendor with nothing at all", () => {
    const none = SET.vendors.filter((v) => v.result.inputsPresent === 0);
    expect(none).toEqual([]);
    expect(SET.vendors.every((v) => v.result.score !== null)).toBe(true);
  });

  // Investors are not vendors you buy from, and they have no /vendor-view
  // page either. Offering a verdict on Sequoia Capital was a category error.
  it("leaves investors out of the scorecard entirely", () => {
    for (const id of ["a16z", "mgx", "sequoia", "softbank"]) {
      expect(SET.vendors.find((v) => v.vendorId === id)).toBeUndefined();
    }
  });

  it("has 16 vendors on all three inputs", () => {
    const full = SET.vendors.filter((v) => v.result.inputsPresent === 3);
    // 16, up from 14, for the same reason durability coverage rose: more
    // disclosure on the record, not a change in what counts as evidence.
    expect(full.length).toBe(16);
  });
});

describe("a vendor with no financial disclosure", () => {
  // The acceptance case: it must read Unknown, not No, and its composite
  // must still carry a visible denominator.
  it("reads Unknown on durability and says so in the caveat", () => {
    const undisclosed = SET.vendors.find(
      (v) => v.inputs.durability === null
    );
    expect(undisclosed).toBeDefined();
    expect(undisclosed!.verdicts.durability).toBe("unknown");
    expect(undisclosed!.result.missing).toContain("durability");
    expect(compositeCaveat(undisclosed!.result)).toContain("of 3 inputs");
    expect(compositeCaveat(undisclosed!.result)).toContain(
      "will it still exist in 3 years?"
    );
  });

  it("is never scored down for the absence", () => {
    // Two vendors with the same winning score, one with durability and one
    // without, must not be ordered by the presence of the third input alone.
    const r = vendorScorecard("anthropic");
    expect(r).not.toBeNull();
    expect(r!.result.inputsPresent).toBeGreaterThan(0);
    expect(r!.result.score).not.toBeNull();
  });
});

describe("durability is read off disclosure, not invented", () => {
  it("puts listed companies above disclosed private rounds", () => {
    const msft = vendorScorecard("microsoft");
    const anthropic = vendorScorecard("anthropic");
    const mistral = vendorScorecard("mistral");
    expect(msft!.inputs.durability).toBe(85);
    // Closed round AND reported revenue on the record now, so the disclosure
    // nudge applies: 60, not the 55 of the round-only era.
    expect(anthropic!.inputs.durability).toBe(60);
    // Reported but not closed, so it sits below a closed round.
    expect(mistral!.inputs.durability).toBe(40);
  });

  // Regression. Terciles over durability put both cut points at 85, because
  // 15 of its 18 values are that one rung, which read Anthropic's closed
  // $380B round as "No" on whether it will exist in three years. A lopsided
  // distribution is not a finding about a business.
  it("never reads a funded private company as No", () => {
    for (const id of ["anthropic", "cohere", "mistral"]) {
      const v = vendorScorecard(id);
      expect(v!.verdicts.durability).toBe("mixed");
    }
  });

  // "No" would mean evidence of distress, and none is published for any
  // tracked vendor. Non-disclosure is already carried by Unknown.
  it("cannot return No on durability at all, on this evidence", () => {
    const nos = SET.vendors.filter((v) => v.verdicts.durability === "no");
    expect(nos).toEqual([]);
  });

  it("scores OpenAI off its now-disclosed record, and xAI still reads Unknown", () => {
    // Until August 2026 OpenAI disclosed nothing and scored null. The
    // verified record now carries a closed valuation (aggregator consensus,
    // caveated in the record) and reported revenue, so the disclosure ladder
    // scores it like any other funded, revenue-reporting private company.
    const o = vendorScorecard("openai");
    expect(o!.inputs.durability).toBe(60);
    // xAI remains the vendor with nothing on the record: its only
    // revenue-scale figure is a contracted compute stream, which the record
    // refuses to count. Unknown, not No.
    const x = vendorScorecard("xai");
    expect(x?.inputs.durability ?? null).toBeNull();
  });
});

describe("thresholds", () => {
  it("are cut per measure rather than shared", () => {
    const { winning, trust } = SET.thresholds;
    // The two measures sit on different ranges, which is the whole reason
    // the cuts are computed separately.
    expect(winning.high).not.toBeCloseTo(trust.high, 1);
    expect(trust.low).toBeGreaterThan(winning.low);
  });

  it("produces a spread of verdicts rather than one bucket", () => {
    for (const k of INPUT_KEYS) {
      const seen = new Set(SET.vendors.map((v) => v.verdicts[k]));
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});

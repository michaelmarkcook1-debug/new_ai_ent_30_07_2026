import { describe, it, expect } from "vitest";
import { guard, invented, numbersIn } from "@/lib/analyst/llm";

// The guard is the reason a model may write this product's prose at all.
// A prompt asking a model not to fabricate is a request; this is a check.

describe("numbersIn", () => {
  it("normalises formatting so the same figure compares equal", () => {
    expect(numbersIn("58.7 and 58.70 and 58.7%")).toEqual(new Set(["58.7"]));
    expect(numbersIn("$1,250M")).toEqual(new Set(["1250"]));
  });

  it("ignores small integers, which are counts rather than measurements", () => {
    // "three things", "2 of 3 inputs", a list index. Blocking these would
    // reject sound prose without protecting anything.
    expect(numbersIn("do these 3 things, 2 of 3 inputs")).toEqual(new Set());
  });

  it("catches a figure that looks like prose", () => {
    expect(numbersIn("roughly 40 per cent")).toEqual(new Set(["40"]));
  });
});

describe("guard", () => {
  const facts = "capability 58.7, reputation 76.3, 47 vendors tracked, 14.8%";

  it("passes text that only reuses the figures it was given", () => {
    expect(
      guard("Capability averages 58.7 across 47 vendors.", facts)
    ).toBe(true);
  });

  it("passes text carrying no figures at all", () => {
    expect(guard("Positions are steady and nothing is moving.", facts)).toBe(
      true
    );
  });

  // The failure this exists to catch.
  it("rejects an invented figure", () => {
    expect(guard("Capability averages 61.2 across the set.", facts)).toBe(
      false
    );
  });

  // Deliberately strict. On a page promising exact, sourced figures, a
  // silently rounded number is where the problem starts.
  it("rejects a rounded version of a real figure", () => {
    expect(guard("Capability is about 59.", facts)).toBe(false);
    expect(guard("Roughly 15% of staff.", facts)).toBe(false);
  });

  it("rejects a plausible-sounding market statistic", () => {
    expect(
      guard("Enterprise AI spend reached $12.4B last year.", facts)
    ).toBe(false);
  });

  it("checks every figure, not just the first", () => {
    expect(guard("58.7 then 76.3 then 99.9", facts)).toBe(false);
  });

  it("allows small counts through even when absent from the data", () => {
    expect(guard("There are 3 things to do.", facts)).toBe(true);
  });
});

describe("invented", () => {
  const facts = "capability 58.7, 47 vendors, 14.8%";

  // Returned rather than merely counted, so a rejection can be handed back to
  // the model as a correction instead of costing the page its analyst voice.
  it("names the figures that were not in the data", () => {
    expect(invented("58.7 rose to 61.2 across 47", facts)).toEqual(["61.2"]);
  });

  it("returns every offender, not just the first", () => {
    expect(invented("61.2 then 99.9", facts).sort()).toEqual(["61.2", "99.9"]);
  });

  it("is empty when the output is clean, which is what guard reads", () => {
    expect(invented("58.7 across 47 vendors", facts)).toEqual([]);
    expect(guard("58.7 across 47 vendors", facts)).toBe(true);
  });
});

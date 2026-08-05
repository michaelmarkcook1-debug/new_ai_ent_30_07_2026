import { describe, expect, it } from "vitest";
import { invented, guard, numbersIn } from "@/lib/analyst/llm";

// The guard that stops the analyst voice inventing figures.
//
// It shipped a hole. The input to the reputation insight said "2 real captures
// are now held" and carried an ISO date, so 2026 was in the permitted set; the
// model wrote "Only 2026 captures are held so far" and the guard passed it,
// because it only ever asked whether a number appeared somewhere in the input.
//
// A reader was told a nonsense figure on a page whose entire promise is that
// figures are exact and sourced. The rule the product needs is narrower than
// "these digits appeared": a year may be used as a year, and not as a count.

const FACTS =
  "2 real captures are now held. Generated 2026-08-04. Mean 75.8 across 28 vendors, spread 13.7.";

describe("figure guard", () => {
  it("rejects a year from a date being reused as a quantity", () => {
    expect(invented("Only 2026 captures are held so far", FACTS)).toContain(
      "2026"
    );
    expect(guard("Only 2026 captures are held so far", FACTS)).toBe(false);
  });

  it("still allows the date itself to be quoted", () => {
    expect(guard("Captured 2026-08-04, and the mean is 75.8.", FACTS)).toBe(
      true
    );
  });

  it("rejects a date the facts never carried", () => {
    expect(invented("Captured 2026-08-05.", FACTS)).toContain("2026-08-05");
  });

  it("still passes figures that are genuinely in the facts", () => {
    expect(
      guard("The mean is 75.8 across 28 vendors, a spread of 13.7.", FACTS)
    ).toBe(true);
  });

  it("still catches an ordinary invented figure", () => {
    expect(invented("The mean is 81.4.", FACTS)).toContain("81.4");
  });

  it("still catches a silently rounded figure", () => {
    // 75.8 rounded to 76 is a different number on a page that promises exact
    // ones, and was already the guard's stated position.
    expect(invented("The mean is about 76.", FACTS)).toContain("76");
  });

  it("leaves small counts alone, which are prose rather than measurements", () => {
    expect(numbersIn("three of the 5 vendors").has("5")).toBe(false);
  });
});

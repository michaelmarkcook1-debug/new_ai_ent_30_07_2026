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

// ------------------------------------------------- the sign is part of the figure
//
// Found on live Woolworths South Africa research, 30 August 2026. The retrieved
// GlobalData profile publishes the net income and net profit margin VALUES as
// "XYZ", withheld behind a paywall, and publishes only their changes: -5.8% and
// -9.4% year on year. The model restated both without their minus signs, and
// the guard discarded the whole reading.
//
// It was right to. "Net income 5.8%" and "net income -5.8%" are different
// claims and only one of them is in the data. These pin that the guard keeps
// refusing it, because the fix that followed was to the prompt and the
// grounding, and a prompt is a request where this is a check.

describe("a dropped minus sign is a different figure", () => {
  it("refuses a magnitude where the data carries a decline", () => {
    const facts = "Net Income (2024) XYZ, -5.8% (2024 vs 2023). Net Profit Margin (2024) XYZ, -9.4% (2024 vs 2023).";
    expect(invented("Net income rose 5.8% and margin 9.4%.", facts)).toEqual(
      expect.arrayContaining(["5.8", "9.4"])
    );
    expect(guard("Net income rose 5.8% and margin 9.4%.", facts)).toBe(false);
  });

  it("accepts the figure written as the data states it", () => {
    const facts = "Net Income (2024) XYZ, -5.8% (2024 vs 2023).";
    expect(guard("Net income moved -5.8% year on year.", facts)).toBe(true);
  });

  it("still accepts the point made without the figure at all", () => {
    const facts = "Net Income (2024) XYZ, -5.8% (2024 vs 2023).";
    expect(guard("Net income fell year on year, and the value itself is not published.", facts)).toBe(true);
  });

  it("still refuses a figure that is simply not there", () => {
    // The third rejection on that run: the model wrote 34,967 employees where
    // the retrieved profile says 37,499. Nothing about the grounding fix makes
    // this acceptable, and nothing should.
    const facts = "No of Employees 37,499. Revenue (2024) $4.3B.";
    expect(invented("It employs 34,967 people.", facts)).toContain("34967");
    expect(guard("It employs 34,967 people.", facts)).toBe(false);
    expect(guard("It employs 37,499 people.", facts)).toBe(true);
  });
});

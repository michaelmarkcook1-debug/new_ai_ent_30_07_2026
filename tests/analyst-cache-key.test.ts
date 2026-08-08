import { describe, it, expect } from "vitest";
import { dayPrecision } from "@/lib/analyst/llm";

// The cache key, and the one thing that must never get back into it.
//
// Every page that authors a reading was slow, and the cause was not the model,
// the cache tier or the TTL. It was that the AIE upstream stamps a fresh `asOf`
// on every response: three calls two seconds apart on 8 August 2026 returned
// 08:11:58.585, 08:12:00.823 and 08:12:03.065 over identical data. That stamp
// reached the facts, the facts were hashed into the key, and so every fresh
// fetch asked the cache a question nobody had ever stored the answer to.
//
// The failure is invisible from outside. Nothing errors, the cache reports no
// miss, and back-to-back requests look fine because our AIE proxy replays one
// timestamp for five minutes. It only shows as a reader waiting 38 seconds.
// That is exactly the kind of regression that comes back, so it gets a test.

describe("a fetch timestamp cannot reach the cache key", () => {
  it("reduces an instant to the day it happened", () => {
    expect(dayPrecision("last updated 2026-08-08T08:11:58.585Z")).toBe(
      "last updated 2026-08-08"
    );
  });

  it("makes two fetches of identical data agree", () => {
    // The three real responses that started this.
    const facts = (t: string) =>
      `Evidence: 72 records from AIE market share, last updated ${t}`;
    const a = dayPrecision(facts("2026-08-08T08:11:58.585Z"));
    const b = dayPrecision(facts("2026-08-08T08:12:00.823Z"));
    const c = dayPrecision(facts("2026-08-08T08:12:03.065Z"));
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("handles every timestamp shape the feeds actually use", () => {
    expect(dayPrecision("2026-08-08T08:11:58Z")).toBe("2026-08-08");
    expect(dayPrecision("2026-08-08T08:11:58.585Z")).toBe("2026-08-08");
    expect(dayPrecision("2026-08-04T23:44:19.395888+00:00")).toBe("2026-08-04");
    expect(dayPrecision("2026-08-08T08:11:58.585-05:00")).toBe("2026-08-08");
  });

  it("normalises every instant in a fact block, not just the first", () => {
    const out = dayPrecision(
      "a 2026-08-01T01:02:03Z b 2026-08-02T04:05:06.700Z c 2026-08-03T07:08:09Z"
    );
    expect(out).toBe("a 2026-08-01 b 2026-08-02 c 2026-08-03");
  });
});

describe("it still tells genuinely different data apart", () => {
  it("keeps two different days distinct", () => {
    // The TTL is 24 hours, so the day is the finest distinction worth drawing.
    // Any coarser and a real overnight change would reuse yesterday's reading.
    expect(dayPrecision("as of 2026-08-07T23:59:59Z")).not.toBe(
      dayPrecision("as of 2026-08-08T00:00:01Z")
    );
  });

  it("leaves a plain date exactly as it was", () => {
    // pricing.json carries capturedAt as a bare date and it is the real
    // vintage, not a fetch time. It must survive untouched.
    expect(dayPrecision("captured 2026-06-02")).toBe("captured 2026-06-02");
  });

  it("does not touch the figures the reading is about", () => {
    const facts =
      "Anthropic 20.8 per cent, OpenAI 20.7 per cent, 72 estimates, score 74.9";
    expect(dayPrecision(facts)).toBe(facts);
  });

  it("changes the key when a number changes", () => {
    expect(dayPrecision("share 20.8 at 2026-08-08T08:00:00Z")).not.toBe(
      dayPrecision("share 20.9 at 2026-08-08T08:00:00Z")
    );
  });

  it("leaves a version or an identifier alone", () => {
    // Nothing that merely looks date-shaped should move.
    expect(dayPrecision("v2026.08.08 build 12345")).toBe(
      "v2026.08.08 build 12345"
    );
  });
});

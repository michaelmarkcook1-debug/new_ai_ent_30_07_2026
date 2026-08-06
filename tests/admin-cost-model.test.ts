import { describe, expect, it } from "vitest";
import {
  allRunCosts,
  costOfRun,
  formatUsd,
  monthlyUsd,
  RUN_PROFILES,
  UNIT_PRICES,
} from "@/lib/admin/cost-model";

// The admin page publishes prices, so the tests hold the arithmetic to the
// measured profiles and the cited unit prices: a cost figure that cannot be
// recomputed from its inputs would be a vibe wearing a currency symbol.

describe("the cost model", () => {
  it("prices every run as exactly the sum of its parts", () => {
    for (const c of allRunCosts()) {
      expect(c.totalUsd).toBeCloseTo(
        c.invocationUsd + c.cpuUsd + c.memoryUsd + c.upstreamUsd,
        12
      );
    }
  });

  it("charges nothing for upstreams, because the sources charge nothing", () => {
    for (const c of allRunCosts()) {
      expect(c.upstreamUsd).toBe(0);
    }
  });

  it("derives each component from the profile and the cited unit prices", () => {
    const vendor = RUN_PROFILES.find((p) => p.series === "vendor")!;
    const c = costOfRun(vendor);
    expect(c.cpuUsd).toBeCloseTo(
      vendor.activeCpuSeconds * UNIT_PRICES.vercelActiveCpuUsdPerSecond,
      12
    );
    expect(c.memoryUsd).toBeCloseTo(
      vendor.wallSeconds *
        UNIT_PRICES.vercelMemoryGb *
        UNIT_PRICES.vercelMemoryUsdPerGbSecond,
      12
    );
    expect(c.invocationUsd).toBeCloseTo(0.6 / 1_000_000, 12);
  });

  it("stays under a cent per run, which is the whole point of the page", () => {
    for (const c of allRunCosts()) {
      expect(c.totalUsd).toBeLessThan(0.01);
    }
  });

  it("keeps even a daily-everything cadence under a dollar a month", () => {
    expect(monthlyUsd(1)).toBeLessThan(1);
    expect(monthlyUsd(1)).toBeGreaterThan(0);
  });

  it("documents how every profile figure was measured", () => {
    for (const p of RUN_PROFILES) {
      expect(p.measured.length).toBeGreaterThan(30);
      expect(p.wallSeconds).toBeGreaterThan(0);
      expect(p.activeCpuSeconds).toBeLessThanOrEqual(p.wallSeconds);
    }
  });

  it("formats sub-cent amounts without rounding them into lies", () => {
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(0.02)).toBe("$0.02");
    // A hundredth of a cent must not render as $0.00.
    expect(formatUsd(0.0000107)).toMatch(/\$0\.00001/);
  });
});

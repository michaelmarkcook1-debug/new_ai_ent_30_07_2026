import { describe, expect, it } from "vitest";
import {
  appendChanges,
  buildSnapshot,
  changesSince,
  diffSnapshots,
  type Snapshot,
} from "@/lib/changes/snapshot";
import { buildSinceView } from "@/lib/changes/watchlist";

const snap = (capturedAt: string, vendors: { id: string; overallScore: number }[]) =>
  buildSnapshot(capturedAt, { vendors });

describe("buildSnapshot", () => {
  it("flattens every watched family into addressable keys", () => {
    const s = buildSnapshot("2026-08-04", {
      vendors: [{ id: "anthropic", overallScore: 80 }],
      vendorCapabilities: [
        { vendorId: "anthropic", capabilityId: "security", maturityScore: 70 },
      ],
      shares: [
        { vendorId: "anthropic", categoryId: "ai_silicon", estimatedShare: 12 },
      ],
      gaps: [{ vendorId: "anthropic", gap: -5 }],
    });
    expect(Object.keys(s.signals).sort()).toEqual([
      "capability_score:anthropic:security",
      "market_share:anthropic:ai_silicon",
      "narrative_gap:anthropic",
      "vendor_score:anthropic",
    ]);
  });

  it("drops non-numeric values rather than snapshotting a null", () => {
    const s = buildSnapshot("2026-08-04", {
      vendors: [
        { id: "a", overallScore: 50 },
        { id: "b", overallScore: undefined },
        { id: "c", overallScore: Number.NaN },
      ],
    });
    expect(Object.keys(s.signals)).toEqual(["vendor_score:a"]);
  });
});

describe("diffSnapshots", () => {
  it("reports a move with both ends and a signed delta", () => {
    const a = snap("2026-08-02", [{ id: "mgx", overallScore: 53.3 }]);
    const b = snap("2026-08-04", [{ id: "mgx", overallScore: 50.4 }]);
    const [c] = diffSnapshots(a, b);
    expect(c.from).toBe(53.3);
    expect(c.to).toBe(50.4);
    expect(c.delta).toBe(-2.9);
    expect(c.direction).toBe("down");
    expect(c.detectedAt).toBe("2026-08-04");
  });

  it("ignores movement below the rounding floor", () => {
    const a = snap("2026-08-02", [{ id: "x", overallScore: 50.0 }]);
    const b = snap("2026-08-04", [{ id: "x", overallScore: 50.02 }]);
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it("does not report an arrival as a change", () => {
    // A new vendor has nothing to have moved from. Calling that a change
    // would put noise into the one surface that has to stay trustworthy.
    const a = snap("2026-08-02", []);
    const b = snap("2026-08-04", [{ id: "new", overallScore: 60 }]);
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it("does not report a departure as a change", () => {
    const a = snap("2026-08-02", [{ id: "gone", overallScore: 60 }]);
    const b = snap("2026-08-04", []);
    expect(diffSnapshots(a, b)).toEqual([]);
  });

  it("orders by size of move, not by key", () => {
    const a = snap("2026-08-02", [
      { id: "small", overallScore: 50 },
      { id: "big", overallScore: 50 },
    ]);
    const b = snap("2026-08-04", [
      { id: "small", overallScore: 51 },
      { id: "big", overallScore: 70 },
    ]);
    expect(diffSnapshots(a, b).map((c) => c.vendorId)).toEqual(["big", "small"]);
  });
});

describe("changesSince", () => {
  const log = {
    changes: [
      { key: "k1", kind: "vendor_score", vendorId: "anthropic", label: "l", from: 1, to: 2, delta: 1, direction: "up", detectedAt: "2026-08-04" },
      { key: "k2", kind: "vendor_score", vendorId: "openai", label: "l", from: 1, to: 2, delta: 1, direction: "up", detectedAt: "2026-08-04" },
      { key: "k3", kind: "vendor_score", vendorId: "anthropic", label: "l", from: 1, to: 2, delta: 1, direction: "up", detectedAt: "2026-07-01" },
    ],
  } as const;

  it("narrows to the watchlist", () => {
    const out = changesSince(log as never, null, ["anthropic"]);
    expect(out.map((c) => c.key)).toEqual(["k1", "k3"]);
  });

  it("includes a change stamped on the day of the visit", () => {
    // Someone who looked yesterday and returns this morning must still see a
    // change detected today, so the comparison is on the date, not the moment.
    const out = changesSince(log as never, "2026-08-04", null);
    expect(out.map((c) => c.key)).toEqual(["k1", "k2"]);
  });

  it("returns everything on a first visit", () => {
    expect(changesSince(log as never, null, null)).toHaveLength(3);
  });
});

describe("appendChanges", () => {
  it("puts the newest first and caps the log", () => {
    const older = { changes: [{ detectedAt: "2026-01-01" }] } as never;
    const out = appendChanges(older, [{ detectedAt: "2026-08-04" }] as never, 2);
    expect(out.changes[0].detectedAt).toBe("2026-08-04");
    expect(out.changes).toHaveLength(2);
  });
});

describe("buildSinceView", () => {
  // Both entities here are suppliers on purpose. This fixture used to name MGX
  // as its generic second vendor, which stopped meaning anything once investors
  // were excluded from the movement feed: the test is about falling back to the
  // market when nothing is watched, and it needs two rows that survive to test
  // that. Investor exclusion has its own tests in investors-excluded.test.ts.
  const log = {
    changes: [
      { key: "a", kind: "vendor_score", vendorId: "anthropic", label: "l", from: 1, to: 2, delta: 1, direction: "up", detectedAt: "2026-08-04" },
      { key: "b", kind: "vendor_score", vendorId: "openai", label: "l", from: 1, to: 2, delta: 9, direction: "up", detectedAt: "2026-08-04" },
    ],
  } as never;

  it("shows the watchlist when there is one", () => {
    const v = buildSinceView(log, { vendorIds: ["anthropic"], lastSeen: null });
    expect(v.watched.map((c) => c.key)).toEqual(["a"]);
    expect(v.watchedCount).toBe(1);
  });

  it("falls back to the whole market when nothing is watched", () => {
    // An empty panel on a first visit teaches the reader the feature is
    // broken rather than unfilled, so there has to be something to show.
    const v = buildSinceView(log, { vendorIds: [], lastSeen: null });
    expect(v.watched).toEqual([]);
    expect(v.everything.length).toBe(2);
  });
});

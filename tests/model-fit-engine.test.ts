import { describe, it, expect } from "vitest";
import {
  Engine,
  DataError,
  shortName,
  burnOf,
  BANDS,
  loadEngine,
  MODELS,
  ROLES,
  CALIBRATION,
  CAPABILITY_NAMES,
} from "@/lib/model-fit";
import type { CalibrationTable, ModelRecord, Profile, Role } from "@/lib/model-fit";

// The integration package's own regression suite, 02_engine/test_engine.py,
// ported check for check. Same names, same order, same intent: data integrity,
// health, bad input, bad config, engine invariants, helpers, full library.
//
// The reference suite is the definition of "the port works". Behaviour identical
// to the reference is proved separately by tests/model-fit-parity.test.ts; this
// file proves the properties the package says must hold whatever the data does.

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const base = () => clone(Object.values(ROLES)[0]);

/** Uniform profile helper, as `P` in the reference suite. */
function P(scores: number[]): Profile {
  const p: Profile = {};
  scores.forEach((v, i) => {
    p[`CAP-${String(i + 1).padStart(2, "0")}`] = {
      score: v,
      critical: v >= 70 ? "Mandatory" : "Desirable",
      evidence_class: "D",
    };
  });
  return p;
}

function engineWith(
  models: ModelRecord[],
  calibration: CalibrationTable = CALIBRATION,
  opts = {}
): Engine {
  return new Engine(clone(models), clone(calibration), CAPABILITY_NAMES, opts);
}

function raises(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof DataError;
  }
}

const eng = loadEngine();

describe("data", () => {
  it("roles load", () => {
    // 258 researched profiles plus 36 authored for the seven industries the
    // package left uncovered. See scripts/author-missing-industries.py.
    expect(Object.keys(ROLES).length).toBe(294);
  });

  it("every profile is complete", () => {
    expect(
      Object.values(ROLES).every((r) => Object.keys(r.profile).length === 18)
    ).toBe(true);
  });

  it("every score is a rubric band", () => {
    const bands = BANDS as readonly number[];
    expect(
      Object.values(ROLES).every((r) =>
        Object.values(r.profile).every((v) => bands.includes(v.score))
      )
    ).toBe(true);
  });

  it("no duplicate profiles", () => {
    // Two roles returning identical output is the failure that broke the
    // previous build (join specification section 10).
    const seen = new Set(
      Object.values(ROLES).map((r) =>
        Object.values(r.profile)
          .map((v) => v.score)
          .join(",")
      )
    );
    expect(seen.size).toBe(Object.keys(ROLES).length);
  });

  it("models load and are priced", () => {
    expect(MODELS.length).toBe(330);
    expect(MODELS.every((m) => Boolean(m.cost_input_per_1m))).toBe(true);
  });
});

describe("health", () => {
  const h = eng.health();

  it("health verdict is ok", () => {
    expect(h.warnings).toEqual([]);
    expect(h.verdict).toBe("ok");
  });

  it("at least one axis covers the catalogue", () => {
    expect(Object.values(h.axes).some((a) => a.coverage_pct >= 60)).toBe(true);
  });

  it("reports coverage and elimination power per axis", () => {
    // Coverage below 60 per cent quietly disables an axis's ability to
    // eliminate on absence. Health is the only thing that catches it.
    expect(h.axes["CAP-01"]).toMatchObject({
      field: "intelligence",
      coverage_pct: 100,
      can_eliminate_on_absence: true,
    });
    expect(h.axes["CAP-05"].can_eliminate_on_absence).toBe(false);
  });
});

describe("refuses bad input", () => {
  it("no profile", () => {
    expect(raises(() => eng.assess({ role_id: "X" } as unknown as Role))).toBe(true);
  });

  it("empty profile", () => {
    expect(raises(() => eng.assess({ role_id: "X", profile: {} }))).toBe(true);
  });

  it("unknown requirement", () => {
    expect(
      raises(() =>
        eng.assess({
          role_id: "X",
          profile: { "CAP-99": { score: 50, critical: "Mandatory", evidence_class: "D" } },
        })
      )
    ).toBe(true);
  });

  it("off-band score", () => {
    expect(
      raises(() =>
        eng.assess({
          role_id: "X",
          profile: { "CAP-01": { score: 73, critical: "Mandatory", evidence_class: "D" } },
        })
      )
    ).toBe(true);
  });

  it("malformed duty", () => {
    expect(
      raises(() =>
        eng.assess({ ...base(), duties: [{ duty: "x" }] as unknown as Role["duties"] })
      )
    ).toBe(true);
  });

  it("negative headcount coerced, never negative cost", () => {
    const r = eng.assess({ ...base(), headcount: -5 });
    expect(r.answer.cost_for_role_year_usd ?? 0).toBeGreaterThanOrEqual(0);
    expect(r.answer.warnings?.length).toBeGreaterThan(0);
  });

  it("strict=false returns a typed error instead of raising", () => {
    const r = eng.assess({ role_id: "X", profile: {} }, null, false);
    expect(r.answer.outcome).toBe("cannot assess");
  });

  it("repairing one caller's role never alters the library", () => {
    // Not in the reference suite: the reference coerces in place, which is safe
    // for a script and not safe for a module every screen imports.
    const before = clone(ROLES["ROLE-0207"]);
    eng.assess({ ...ROLES["ROLE-0207"], headcount: -5 });
    expect(ROLES["ROLE-0207"]).toEqual(before);
  });
});

describe("tolerates bad config", () => {
  it("unknown usage tier warns", () => {
    expect(
      engineWith(MODELS, CALIBRATION, { usage: "colossal" }).warnings.some((w) =>
        w.includes("usage")
      )
    ).toBe(true);
  });

  it("absurd offset clamped", () => {
    expect(
      engineWith(MODELS, CALIBRATION, { offset_pct: 9999 }).warnings.some((w) =>
        w.includes("out of range")
      )
    ).toBe(true);
  });

  it("non-monotonic thresholds warn", () => {
    const bad = clone(CALIBRATION);
    bad["CAP-01"].thresholds = { "10": 90, "30": 10, "50": 50, "70": 20, "90": 5 };
    expect(engineWith(MODELS, bad).warnings.some((w) => w.includes("monotonic"))).toBe(true);
  });

  it("calibration on a missing field warns", () => {
    const bad = clone(CALIBRATION);
    bad["CAP-01"].model_field = "nope";
    expect(
      engineWith(MODELS, bad).warnings.some((w) => w.includes("no model carries"))
    ).toBe(true);
  });

  it("unpriced model does not crash and is not costed", () => {
    const e = engineWith([{ model_id: "x", vendor: "V" }], CALIBRATION, {
      exclude_cn: false,
    });
    expect(e.assess(base()).answer.cost_per_person_year_usd).toBeNull();
  });

  it("empty catalogue is handled", () => {
    const outcome = engineWith([]).assess(base()).answer.outcome;
    expect(["not supported", "partially supported"]).toContain(outcome);
  });
});

describe("engine invariants", () => {
  const easy = eng.recommend(P(Array(18).fill(10)));
  const mid = eng.recommend(P(Array(18).fill(50)));
  const hard = eng.recommend(P(Array(18).fill(90)));

  it("raising requirements never widens the survivor set", () => {
    expect(easy.live.length).toBeGreaterThanOrEqual(mid.live.length);
    expect(mid.live.length).toBeGreaterThanOrEqual(hard.live.length);
  });

  it("the pick always survives its own filters", () => {
    expect(!mid.pick || mid.live.includes(mid.pick)).toBe(true);
  });

  it("survivors are ranked by shortfalls then cost", () => {
    const key = (m: (typeof mid.live)[number]): [number, number] => [
      m._miss,
      eng.costPerMillion(m) ?? Infinity,
    ];
    for (let i = 1; i < mid.live.length; i += 1) {
      const [am, ac] = key(mid.live[i - 1]);
      const [bm, bc] = key(mid.live[i]);
      expect(am < bm || (am === bm && ac <= bc)).toBe(true);
    }
  });

  it("no threshold exceeds the best achievable score", () => {
    for (const [cap, c] of Object.entries(CALIBRATION)) {
      if (!c.model_field || c.status === "unavailable") continue;
      const cal = eng.cal(cap)!;
      expect(cal.thresholds["90"]!).toBeLessThanOrEqual(
        eng.axisMax(cal.model_field!) + 1e-6
      );
    }
  });

  it("unassessed requirements never count as deciding", () => {
    expect(mid.unassessed.every((c) => !mid.deciding.includes(c))).toBe(true);
  });

  it("breadth shifts only when broad", () => {
    expect(eng.recommend(P([90, ...Array(17).fill(10)])).breadth_shift).toBe(0);
    expect(
      eng.recommend(P([...Array(8).fill(70), ...Array(10).fill(10)])).breadth_shift
    ).toBe(1);
  });

  it("every elimination names the requirement that did it", () => {
    expect(hard.eliminated.every((e) => Boolean(e.requirement && e.reason))).toBe(true);
  });

  it("the consequence tier is the higher of accuracy and assurance", () => {
    // Read from the rubric, not invented (join specification section 6a).
    const p = P(Array(18).fill(10));
    p["CAP-11"].score = 90;
    expect(eng.recommend(p).tier).toBe(90);
    expect(eng.recommend(p).consequence_shift).toBe(1);
  });
});

describe("helpers", () => {
  it("variant tags preserved in names", () => {
    expect(shortName("Claude Opus 5 (Adaptive Reasoning, Max Effort)")).not.toBe(
      shortName("Claude Opus 5 (Adaptive Reasoning, Medium Effort)")
    );
  });

  it("unknown burn returns null, never a guess", () => {
    expect(burnOf("Grok 4")).toBeNull();
  });
});

describe("full library", () => {
  const counts: Record<string, number> = {};
  for (const [id, role] of Object.entries(ROLES)) {
    const o = eng.assess({ ...role, role_id: id }).answer.outcome;
    counts[o] = (counts[o] ?? 0) + 1;
  }

  it("every role produces an outcome", () => {
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(Object.keys(ROLES).length);
  });

  it("no role reports 'cannot assess'", () => {
    expect(counts["cannot assess"] ?? 0).toBe(0);
  });

  it("matches the reference run's outcome distribution", () => {
    // The reference prints these counts when engine.py is run directly.
    expect(counts).toEqual({
      qualified: 231,
      supported: 4,
      "partially supported": 6,
      "not supported": 43,
      "best available": 10,
    });
  });
});

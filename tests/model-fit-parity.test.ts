import { describe, it, expect } from "vitest";
import { Engine, MODELS, CALIBRATION, CAPABILITY_NAMES, ROLES } from "@/lib/model-fit";
import type { EngineOptions, Profile, Recommendation } from "@/lib/model-fit";
import baseline from "./fixtures/model-fit-python-baseline.json";

// Differential test: the TypeScript port against the integration package's
// reference implementation, 02_engine/engine.py.
//
// The reference is the specification in executable form, so "does the port
// behave identically" is the only question worth asking of it. The baseline is
// every one of the 258 roles assessed under four control configurations, plus
// six synthetic profiles that reach shift and overflow combinations no real
// role happens to hit. Regenerate with:
//
//     python3 scripts/model-fit-baseline.py
//
// Money is compared to the cent. Everything else is compared exactly: the
// chosen model, the survivor ordering, the eliminations and their wording, the
// consequence tier, the breadth shift, the confidence and its limiting
// requirement.
//
// ONE DELIBERATE DIFFERENCE, and it is the reference that is wrong. The
// reference collects thinly-covered requirements in a Python set and appends
// them with `for c in thin`, so the tail of `unassessed` comes out in a
// different order on each run: Python randomises string hashing per process.
// Two identical assessments of ROLE-0005 minutes apart list the same six
// requirements in two different orders. The port keeps insertion order, which
// is stable, so `unassessed` is compared as a set here and its stability is
// asserted separately below. Nothing else is order-insensitive.

interface RecSummary {
  pick: string | null;
  live: number;
  live_head: string[];
  live_miss_head: number[];
  eliminated: number;
  elim_head: { model: string; requirement: string; reason: string }[];
  unassessed: string[];
  deciding: string[];
  tier: number;
  breadth: number;
  shift: number;
  consequence_shift: number;
  breadth_shift: number;
  confidence: string;
  limited_by: string | null;
}

interface BaselineRow {
  answer: Record<string, unknown>;
  detail: RecSummary;
  duties: { duty: string; supported: boolean; model: string | null; blocked_by: string[] }[] | null;
}

interface BaselineConfig {
  name: string;
  kw: EngineOptions;
  constraints: { excluded_vendors?: string[] } | null;
  warnings: string[];
  rows: Record<string, BaselineRow>;
}

const fixture = baseline as unknown as {
  roles: number;
  models: number;
  configs: BaselineConfig[];
  synthetic: { name: string; scores: number[]; recommend: RecSummary }[];
  health: {
    models_total: number;
    models_allowed: number;
    models_unpriced: number;
    verdict: string;
    axes: Record<string, { field: string; coverage_pct: number; can_eliminate_on_absence: boolean }>;
  };
};

function summarise(r: Recommendation): RecSummary {
  return {
    pick: r.pick ? r.pick.model_id : null,
    live: r.live.length,
    live_head: r.live.slice(0, 8).map((m) => m.model_id),
    live_miss_head: r.live.slice(0, 8).map((m) => m._miss),
    eliminated: r.eliminated.length,
    elim_head: r.eliminated.slice(0, 5).map((e) => ({
      model: e.model,
      requirement: e.requirement,
      reason: e.reason,
    })),
    unassessed: r.unassessed,
    deciding: r.deciding,
    tier: r.tier,
    breadth: r.breadth,
    shift: r.shift,
    consequence_shift: r.consequence_shift,
    breadth_shift: r.breadth_shift,
    confidence: r.confidence,
    limited_by: r.limited_by,
  };
}

function synth(scores: number[]): Profile {
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

const MONEY_FIELDS = [
  "cost_per_million_usd",
  "cost_per_person_year_usd",
  "cost_for_role_year_usd",
] as const;

/**
 * Canonical form for comparison: keys sorted (the baseline is dumped with
 * sort_keys), undefined dropped (the reference simply omits those keys), and
 * `unassessed` sorted for the reason given at the top of this file.
 */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      if (o[k] === undefined) continue;
      out[k] =
        k === "unassessed" && Array.isArray(o[k])
          ? [...(o[k] as string[])].sort()
          : canon(o[k]);
    }
    return out;
  }
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}

describe("the port matches the reference implementation", () => {
  it("replays the same snapshot the reference was run against", () => {
    expect(Object.keys(ROLES).length).toBe(fixture.roles);
    expect(MODELS.length).toBe(fixture.models);
  });

  for (const cfg of fixture.configs) {
    describe(`config: ${cfg.name}`, () => {
      const engine = new Engine(
        JSON.parse(JSON.stringify(MODELS)),
        JSON.parse(JSON.stringify(CALIBRATION)),
        CAPABILITY_NAMES,
        cfg.kw
      );

      it("produces the same engine warnings", () => {
        expect(engine.warnings).toEqual(cfg.warnings);
      });

      it("assesses all 258 roles identically", () => {
        const answerFaults: string[] = [];
        const detailFaults: string[] = [];
        for (const [roleId, want] of Object.entries(cfg.rows)) {
          const got = engine.assess(
            { ...ROLES[roleId], role_id: roleId },
            cfg.constraints
          );
          const gotAnswer = got.answer as unknown as Record<string, unknown>;

          for (const field of MONEY_FIELDS) {
            const a = want.answer[field] as number | null | undefined;
            const b = gotAnswer[field] as number | null | undefined;
            if (a === null || a === undefined || b === null || b === undefined) {
              if ((a ?? null) !== (b ?? null)) answerFaults.push(`${roleId}.${field}`);
            } else if (Math.abs(a - b) > 0.011) {
              answerFaults.push(`${roleId}.${field} ${a} vs ${b}`);
            }
          }
          const strip = (o: Record<string, unknown>) => {
            const c = { ...o };
            for (const f of MONEY_FIELDS) delete c[f];
            return c;
          };
          const wantRest = strip(want.answer);
          const gotRest = strip(gotAnswer);
          if (!same(wantRest, gotRest)) {
            answerFaults.push(
              `${roleId} answer ${JSON.stringify(canon(wantRest))} vs ${JSON.stringify(canon(gotRest))}`
            );
          }

          const gotDetail = summarise(got.detail as Recommendation);
          if (!same(want.detail, gotDetail)) {
            detailFaults.push(
              `${roleId} detail ${JSON.stringify(canon(want.detail))} vs ${JSON.stringify(canon(gotDetail))}`
            );
          }
          const gotDuties = (got.detail as Recommendation & { duties?: unknown }).duties ?? null;
          if (!same(want.duties ?? null, gotDuties)) {
            detailFaults.push(`${roleId} duties`);
          }
        }
        expect(answerFaults.slice(0, 5)).toEqual([]);
        expect(detailFaults.slice(0, 5)).toEqual([]);
      });
    });
  }

  it("matches the reference on synthetic profiles", () => {
    const engine = new Engine(
      JSON.parse(JSON.stringify(MODELS)),
      JSON.parse(JSON.stringify(CALIBRATION)),
      CAPABILITY_NAMES
    );
    for (const s of fixture.synthetic) {
      expect(canon({ name: s.name, ...summarise(engine.recommend(synth(s.scores))) })).toEqual(
        canon({ name: s.name, ...s.recommend })
      );
    }
  });

  // The one place the port deliberately improves on the reference. Repeating an
  // assessment must give the same list in the same order, so the interface can
  // render it without shuffling under the reader.
  it("orders unassessed requirements deterministically, unlike the reference", () => {
    const engine = new Engine(
      JSON.parse(JSON.stringify(MODELS)),
      JSON.parse(JSON.stringify(CALIBRATION)),
      CAPABILITY_NAMES
    );
    for (const roleId of ["ROLE-0005", "ROLE-0137", "ROLE-0207"]) {
      const runs = Array.from({ length: 3 }, () =>
        engine.assess({ ...ROLES[roleId], role_id: roleId }).answer.unassessed
      );
      expect(runs[1]).toEqual(runs[0]);
      expect(runs[2]).toEqual(runs[0]);
    }
  });

  it("reports the same health as the reference", () => {
    const engine = new Engine(
      JSON.parse(JSON.stringify(MODELS)),
      JSON.parse(JSON.stringify(CALIBRATION)),
      CAPABILITY_NAMES
    );
    const h = engine.health();
    expect(h.models_total).toBe(fixture.health.models_total);
    expect(h.models_allowed).toBe(fixture.health.models_allowed);
    expect(h.models_unpriced).toBe(fixture.health.models_unpriced);
    expect(h.verdict).toBe(fixture.health.verdict);
    for (const [cap, want] of Object.entries(fixture.health.axes)) {
      expect(h.axes[cap].field).toBe(want.field);
      expect(h.axes[cap].coverage_pct).toBeCloseTo(want.coverage_pct, 6);
      expect(h.axes[cap].can_eliminate_on_absence).toBe(want.can_eliminate_on_absence);
    }
  });
});

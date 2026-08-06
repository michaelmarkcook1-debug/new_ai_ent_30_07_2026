import { MODELS } from "@/lib/model-fit";
import { allRoleExposure, reachForBand, BANDS } from "./role-exposure";

// The server-computed payload, so the browser never receives the role library.
//
// This is the third instance of the pattern ARCHITECTURE section 5 describes:
// roles.json is 684 KB and importing it into a client component ships all of
// it to every reader. The exposure panel needs four fields per role plus two
// five-entry lookups, which is about 30 KB, so the flattening happens on the
// server and the component receives only what it draws.
//
// Reach depends on the band alone, not on the role, so it travels as one small
// table rather than being repeated 294 times.

export interface ExposureRole {
  /** Role name. */
  n: string;
  /** Industry, as the library records it. */
  i: string;
  /** Function. */
  f: string;
  /** CAP-01 band the work demands. */
  b: number;
}

export interface ExposurePayload {
  roles: ExposureRole[];
  /** Band to the share of the scored catalogue reaching it. */
  reachByBand: Record<number, number>;
  /** Band to the minimum Intelligence Index it requires. */
  indexByBand: Record<number, number>;
  /** Models carrying a measured index: the denominator behind every figure. */
  modelsScored: number;
  /** Industries the library carries, for matching without shipping the roles. */
  industries: string[];
}

const MODELS_SCORED = MODELS.filter(
  (m) => typeof m.benchmarks?.intelligence === "number"
).length;

export function exposurePayload(): ExposurePayload {
  const all = allRoleExposure();
  const reachByBand: Record<number, number> = {};
  const indexByBand: Record<number, number> = {};
  for (const b of BANDS) {
    reachByBand[b] = reachForBand(b);
    indexByBand[b] = all.find((r) => r.band === b)?.indexNeeded ?? 0;
  }
  return {
    roles: all.map((r) => ({ n: r.name, i: r.industry, f: r.function, b: r.band })),
    reachByBand,
    indexByBand,
    modelsScored: MODELS_SCORED,
    industries: [...new Set(all.map((r) => r.industry))].filter(Boolean).sort(),
  };
}

/**
 * Match a researched company's stated industry to one the library carries.
 *
 * Duplicated from role-exposure rather than imported, because this half runs
 * in the browser against the payload's industry list and that half reads the
 * role library. Returns null rather than guessing: a wrong industry puts a
 * reader's functions against another sector's role mix, which is worse than
 * the labelled cross-industry view.
 */
export function matchIndustryIn(
  stated: string | null | undefined,
  known: string[]
): string | null {
  if (!stated) return null;
  const s = stated.toLowerCase();
  const exact = known.find((k) => k.toLowerCase() === s);
  if (exact) return exact;
  const partial = known
    .filter((k) => s.includes(k.toLowerCase()) || k.toLowerCase().includes(s))
    .sort((a, b) => b.length - a.length);
  return partial[0] ?? null;
}

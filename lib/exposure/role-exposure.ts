import {
  ROLES,
  MODELS,
  INDUSTRY_GROUPS,
  CROSS_INDUSTRY,
  type Role,
} from "@/lib/model-fit";
import { CAP01_THRESHOLDS } from "@/lib/model-fit/workforce-curve";

// Role-level AI exposure, derived rather than asserted.
//
// The question a buyer arrives with is which of their functions AI has already
// reached. The tempting way to answer it is a percentage per role, and the
// tempting way to get that percentage is to make it up. This does not.
//
// EXPOSURE IS DEFINED AS: the share of the tracked model catalogue that already
// reaches the capability level a role's work demands.
//
// Both halves are real and already in the product. The role library records
// what each role's work requires on the CAP-01 band (10 to 90). The threshold
// table converts a band to a minimum Intelligence Index, and is pinned by
// tests/workforce-curve.test.ts. The catalogue holds a measured index for 330
// models. So "78 per cent of tracked models can already work at the level this
// role demands" is a computed fact about published benchmarks, not an opinion
// about anybody's staff.
//
// WHAT THIS IS NOT, and the distinction the UI has to keep making:
//
// It is not a measurement of any company's workforce. The library holds role
// archetypes by industry, not an employer's actual headcount, and no public
// source publishes a role-by-role split for an arbitrary company. Where a
// company's own numbers are wanted they have to be retrieved from its
// disclosures or supplied by the reader, and they are kept in a separate lane
// from this derivation so the two can never be mistaken for each other.
//
// It is also capability reach, not displacement. A model reaching the level a
// role works at is a precondition for automating it, not proof that it will be
// automated: cost, integration, regulation and appetite all sit in between.
// The copy says reach, and never says jobs.

/** The CAP-01 bands the library actually uses. */
export const BANDS = [10, 30, 50, 70, 90] as const;

export interface RoleExposure {
  roleId: string;
  name: string;
  industry: string;
  function: string;
  /** The CAP-01 band this role's work demands, 10 to 90. */
  band: number;
  /** The minimum Intelligence Index that band requires. */
  indexNeeded: number;
  /** Share of scored models reaching it. The exposure figure. */
  reachPct: number;
  /** How many distinct capabilities the role requires at all. */
  breadth: number;
}

/** Every model carrying a measured Intelligence Index. */
function scoredIndexes(): number[] {
  return MODELS.map((m) => m.benchmarks?.intelligence).filter(
    (n): n is number => typeof n === "number"
  );
}

/**
 * Share of the scored catalogue reaching a band, as a whole percentage.
 *
 * Band 10 returns 100 because its threshold is zero: every scored model clears
 * it. That is the correct reading and not a bug. Work that demands nothing of
 * a model is work every model can already do.
 */
export function reachForBand(band: number, indexes = scoredIndexes()): number {
  const need = CAP01_THRESHOLDS[band];
  if (need === undefined || indexes.length === 0) return 0;
  return Math.round((indexes.filter((s) => s >= need).length / indexes.length) * 100);
}

function exposureOf(roleId: string, role: Role, indexes: number[]): RoleExposure | null {
  const entry = role.profile?.["CAP-01"];
  if (!entry || typeof entry.score !== "number") return null;
  const band = entry.score;
  const need = CAP01_THRESHOLDS[band];
  if (need === undefined) return null;
  return {
    roleId,
    name: role.name ?? roleId,
    industry: role.industry ?? "",
    function: role.function ?? "",
    band,
    indexNeeded: need,
    reachPct: reachForBand(band, indexes),
    breadth: Object.keys(role.profile ?? {}).length,
  };
}

/** Every role in the library that carries a readable CAP-01 requirement. */
export function allRoleExposure(): RoleExposure[] {
  const indexes = scoredIndexes();
  const out: RoleExposure[] = [];
  for (const [id, role] of Object.entries(ROLES)) {
    const e = exposureOf(id, role as Role, indexes);
    if (e) out.push(e);
  }
  return out;
}

/** A function, and how far the catalogue has reached into its roles. */
export interface FunctionExposure {
  function: string;
  roles: RoleExposure[];
  /** Mean reach across the roles in it. */
  meanReach: number;
  /** The most reached role in the function, which is where a buyer looks first. */
  leader: RoleExposure;
}

export interface ExposureView {
  /** Roles, most reachable first. */
  roles: RoleExposure[];
  /** The same roles grouped the way an organisation is actually arranged. */
  functions: FunctionExposure[];
  meanReach: number;
  /** Roles the majority of the catalogue already reaches. */
  highExposure: number;
  /** Roles only the frontier reaches, where capability still binds. */
  frontierOnly: number;
  total: number;
  modelsScored: number;
}

/**
 * Where AI has reached the work every employer has.
 *
 * Built from the 99 multi-industry roles alone, and this is the whole design
 * rather than a limitation of it.
 *
 * The library carries 294 roles, of which 99 are marked `*`: one profile that
 * serves every sector, covering 18 functions from finance and legal to
 * cybersecurity and executive leadership. The other 195 are sector
 * specialists, five to seven per industry.
 *
 * Reading a company against its sector meant three things that all went wrong.
 * It needed the company placed in a taxonomy, which can be got wrong and then
 * silently reads a grocer against banking. It rested a mean on five to seven
 * roles. And once the multi-industry roles were correctly included alongside
 * them, ninety-nine swamped six and every sector returned about the same
 * number anyway.
 *
 * The multi-industry roles need none of that. They apply to a bank, a grocer
 * and a shipyard equally, because every employer has finance, legal, HR, IT
 * support and a leadership team. They span all five capability bands, reach
 * from 2 per cent to 100 per cent, and rest on ninety-nine observations rather
 * than six. Nothing has to be guessed about the company for the reading to be
 * true of it.
 */
export function exposureView(): ExposureView {
  const roles = allRoleExposure()
    .filter((r) => r.industry === CROSS_INDUSTRY)
    .sort((a, b) => b.reachPct - a.reachPct || a.name.localeCompare(b.name));

  const meanOf = (xs: RoleExposure[]) =>
    xs.length === 0
      ? 0
      : Math.round(xs.reduce((a, r) => a + r.reachPct, 0) / xs.length);

  const byFunction = new Map<string, RoleExposure[]>();
  for (const r of roles) {
    const key = r.function || "Other";
    byFunction.set(key, [...(byFunction.get(key) ?? []), r]);
  }

  const functions: FunctionExposure[] = [...byFunction.entries()]
    .map(([fn, rs]) => ({
      function: fn,
      roles: rs,
      meanReach: meanOf(rs),
      leader: rs[0],
    }))
    .sort((a, b) => b.meanReach - a.meanReach || a.function.localeCompare(b.function));

  return {
    roles,
    functions,
    meanReach: meanOf(roles),
    highExposure: roles.filter((r) => r.reachPct >= 50).length,
    frontierOnly: roles.filter((r) => r.reachPct <= 11).length,
    total: roles.length,
    modelsScored: scoredIndexes().length,
  };
}

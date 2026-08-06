import { ROLES, MODELS, type Role } from "@/lib/model-fit";
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

export interface ExposureView {
  /** Roles, most reachable first: the ones AI has already got to. */
  roles: RoleExposure[];
  /** Mean reach across the roles shown. */
  meanReach: number;
  /** Roles whose demand the majority of the catalogue already meets. */
  highExposure: number;
  /** Roles only the frontier reaches, where capability is still the constraint. */
  frontierOnly: number;
  /** The industry this view was built for, or null for the whole library. */
  industry: string | null;
  /** How many roles the library holds for that industry. */
  total: number;
  /** Scored models behind every figure here. */
  modelsScored: number;
}

/**
 * The exposure picture for one industry, or for the whole library when the
 * industry is unknown or not carried.
 *
 * Returns the whole library rather than an empty view when an industry has no
 * roles, because a reader who named a sector we do not carry is better served
 * by the cross-industry picture, clearly labelled, than by a blank panel.
 */
export function exposureFor(industry: string | null): ExposureView {
  const all = allRoleExposure();
  const matched = industry
    ? all.filter((r) => r.industry.toLowerCase() === industry.toLowerCase())
    : [];
  const roles = matched.length > 0 ? matched : all;
  const meanReach =
    roles.length === 0
      ? 0
      : Math.round(roles.reduce((a, r) => a + r.reachPct, 0) / roles.length);

  return {
    roles: [...roles].sort(
      (a, b) => b.reachPct - a.reachPct || a.name.localeCompare(b.name)
    ),
    meanReach,
    // Over half the catalogue can work at this level, so capability is no
    // longer what is holding the work in place.
    highExposure: roles.filter((r) => r.reachPct >= 50).length,
    // Only the top of the catalogue reaches it, which is where capability
    // genuinely still constrains what can be attempted.
    frontierOnly: roles.filter((r) => r.reachPct <= 11).length,
    industry: matched.length > 0 ? industry : null,
    total: roles.length,
    modelsScored: scoredIndexes().length,
  };
}

/** The industries the library carries, for matching a researched company to one. */
export function industriesWithRoles(): string[] {
  return [...new Set(allRoleExposure().map((r) => r.industry))]
    .filter(Boolean)
    .sort();
}

/**
 * Best-effort match from a researched company's stated industry to one the
 * library carries. Returns null rather than guessing when nothing matches:
 * a wrong industry would put a reader's functions against another sector's
 * role mix, which is worse than showing the cross-industry picture and
 * saying so.
 */
export function matchIndustry(stated: string | null | undefined): string | null {
  if (!stated) return null;
  const s = stated.toLowerCase();
  const known = industriesWithRoles();
  const exact = known.find((k) => k.toLowerCase() === s);
  if (exact) return exact;
  // Contained either way, longest first, so "Software" does not beat
  // "Software & SaaS" on a company that stated the longer name.
  const partial = known
    .filter((k) => s.includes(k.toLowerCase()) || k.toLowerCase().includes(s))
    .sort((a, b) => b.length - a.length);
  return partial[0] ?? null;
}

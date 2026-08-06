import type { ExposurePayload, ExposureRole } from "./payload";

// Placing a company in the role library, over the payload alone.
//
// Pure and free of heavy imports on purpose. role-exposure.ts does the same
// work against the library itself, which is 684 KB and server-only; this half
// runs in the browser against the 27 KB the server sent, and the two agree
// because a test asserts they do.

/** Roles that carry `*` serve every sector: one profile for all of them. */
export const CROSS = "*";

export type MatchBasis = "industry" | "macro" | "cross-industry";

export interface Pooled {
  roles: (ExposureRole & { reach: number; need: number })[];
  meanReach: number;
  widely: number;
  frontier: number;
  industry: string | null;
  macro: string | null;
  basis: MatchBasis;
  specific: number;
  common: number;
  /**
   * The two means, kept apart.
   *
   * Blending them destroys the only sector signal there is. Specialist means
   * run from about 19 per cent to about 55 per cent across the library, while
   * the 99 common roles sit at one figure for everybody, so folding five or
   * six specialists into ninety-nine common roles returns roughly the same
   * number for every sector on earth. Reported separately, a reader sees both
   * what is distinctive about their sector and what they share with everyone.
   */
  specificMean: number;
  commonMean: number;
}

/**
 * The roles that describe an employer in this sector.
 *
 * Sector specialists plus the cross-industry roles, always. A bank is six
 * banking specialists and a hundred people doing finance, legal, HR and IT
 * support, and a view that drops the second group describes a bank with no
 * back office. It also understates reach, because the common functions are
 * exactly the ones models have got furthest into.
 */
export function poolFor(
  payload: ExposurePayload,
  industry: string | null,
  macro: string | null
): Pooled {
  const common = payload.roles.filter((r) => r.i === CROSS);
  const sectorOnly = payload.roles.filter((r) => r.i !== CROSS);

  const exact = industry
    ? sectorOnly.filter((r) => r.i.toLowerCase() === industry.toLowerCase())
    : [];

  let specific = exact;
  let basis: MatchBasis = "industry";
  let matchedIndustry = exact.length > 0 ? industry : null;
  let matchedMacro: string | null = null;

  if (specific.length === 0 && macro) {
    const peers = (payload.macroGroups.find(
      (g) => g.macro.toLowerCase() === macro.toLowerCase()
    )?.industries ?? []).map((s) => s.toLowerCase());
    if (peers.length > 0) {
      specific = sectorOnly.filter((r) => peers.includes(r.i.toLowerCase()));
      if (specific.length > 0) {
        basis = "macro";
        matchedMacro = macro;
      }
    }
  }

  if (specific.length === 0) {
    specific = sectorOnly;
    basis = "cross-industry";
    matchedIndustry = null;
    matchedMacro = null;
  }

  const roles = [...specific, ...common]
    .map((r) => ({
      ...r,
      reach: payload.reachByBand[r.b] ?? 0,
      need: payload.indexByBand[r.b] ?? 0,
    }))
    .sort((a, b) => b.reach - a.reach || a.n.localeCompare(b.n));

  const meanOf = (xs: { reach: number }[]) =>
    xs.length ? Math.round(xs.reduce((a, r) => a + r.reach, 0) / xs.length) : 0;

  return {
    roles,
    meanReach: meanOf(roles),
    specificMean: meanOf(roles.filter((r) => r.i !== CROSS)),
    commonMean: meanOf(roles.filter((r) => r.i === CROSS)),
    widely: roles.filter((r) => r.reach >= 50).length,
    frontier: roles.filter((r) => r.reach <= 11).length,
    industry: matchedIndustry,
    macro: matchedMacro,
    basis,
    specific: specific.length,
    common: common.length,
  };
}

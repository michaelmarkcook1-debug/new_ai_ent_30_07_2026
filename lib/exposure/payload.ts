import { MODELS } from "@/lib/model-fit";
import { exposureView, reachForBand, BANDS } from "./role-exposure";
import {
  verticalLens,
  taggedIndustries,
  TAG_LABEL,
  AUTONOMY_LABEL,
  type VerticalLens,
} from "./vertical";
import { lensRole, verticalsCovered, pilotRoleIds } from "./role-vertical";

// The server-computed payload, so the browser never receives the source data.
//
// The pattern ARCHITECTURE section 5 describes. roles.json is 684 KB and the
// workflow catalogue is another module again; this panel renders inside a
// client component and needs a few fields per role plus a small lookup, so the
// flattening happens here.
//
// Smaller than it was, because the panel now reads the 99 multi-industry roles
// rather than all 294.

export interface ExposureRole {
  /** Role name. */
  n: string;
  /** Function, which is how the panel groups them. */
  f: string;
  /** CAP-01 band the work demands. */
  b: number;
}

export interface ExposureFunction {
  /** Function name. */
  f: string;
  /** Mean reach across its roles. */
  mean: number;
  roles: ExposureRole[];
}

export interface ExposurePayload {
  roles: ExposureRole[];
  functions: ExposureFunction[];
  /** Band to the share of the scored catalogue reaching it. */
  reachByBand: Record<number, number>;
  /** Band to the minimum Intelligence Index it requires. */
  indexByBand: Record<number, number>;
  meanReach: number;
  widelyReached: number;
  frontierOnly: number;
  /** Models carrying a measured index: the denominator behind every figure. */
  modelsScored: number;
  /**
   * The assurance profile of each vertical the workflow catalogue carries, so
   * the same role can be read differently in banking and in retail without
   * inventing a capability difference the library does not record.
   */
  verticals: Record<string, VerticalLens>;
  tagLabels: Record<string, string>;
  autonomyLabels: Record<string, string>;
  /**
   * The Customer Operations & Service pilot: what a named sector demonstrably
   * changes about the same job, requirement by requirement, each with the rule
   * behind it.
   *
   * This is a different KIND of claim from `verticals` above and the two should
   * not be conflated. That one reads the assurance profile of the workflows a
   * sector runs, which says nothing about any particular role. This one says a
   * front-line advisor in a bank is held to a different standard than one in a
   * shop, and names the rule that makes it so.
   *
   * Keyed by sector tag and carrying every sector the pilot reached, because
   * the payload is built before the company is classified. Nine of the fifteen
   * tags the classifier can emit are absent, and a missing key means the sector
   * has not been researched rather than that it has no regime.
   */
  rolePilots: Record<string, RolePilotPayload>;
  /** Sectors the pilot has and has not reached, so the gap is stated. */
  pilotCoverage: { researched: number; total: number };
}

export interface RolePilotRole {
  roleId: string;
  name: string;
  /** Requirements the sector speaks to, base and lensed. */
  moved: {
    cap: string;
    name: string;
    base: number;
    lensed: number;
    class: string;
    why: string;
    sourceTitle: string | null;
    sourceUrl: string | null;
  }[];
  confidence: string | null;
}

export interface RolePilotPayload {
  vertical: string;
  label: string;
  regime: string;
  scopeNote: string | null;
  roles: RolePilotRole[];
}

const MODELS_SCORED = MODELS.filter(
  (m) => typeof m.benchmarks?.intelligence === "number"
).length;

export function exposurePayload(): ExposurePayload {
  const view = exposureView();
  const reachByBand: Record<number, number> = {};
  const indexByBand: Record<number, number> = {};
  for (const b of BANDS) {
    reachByBand[b] = reachForBand(b);
    indexByBand[b] = view.roles.find((r) => r.band === b)?.indexNeeded ?? 0;
  }

  const verticals: Record<string, VerticalLens> = {};
  for (const tag of taggedIndustries()) {
    const lens = verticalLens(tag);
    if (lens) verticals[tag] = lens;
  }

  return {
    roles: view.roles.map((r) => ({ n: r.name, f: r.function, b: r.band })),
    functions: view.functions.map((fn) => ({
      f: fn.function,
      mean: fn.meanReach,
      roles: fn.roles.map((r) => ({ n: r.name, f: r.function, b: r.band })),
    })),
    reachByBand,
    indexByBand,
    meanReach: view.meanReach,
    widelyReached: view.highExposure,
    frontierOnly: view.frontierOnly,
    modelsScored: MODELS_SCORED,
    verticals,
    tagLabels: TAG_LABEL,
    autonomyLabels: AUTONOMY_LABEL,
    rolePilots: rolePilotPayload(),
    pilotCoverage: {
      researched: verticalsCovered().length,
      total: Object.keys(TAG_LABEL).length,
    },
  };
}

/**
 * The pilot, flattened for the browser.
 *
 * Only the requirements a sector speaks to travel. Sending all eighteen per
 * role would quadruple the payload to carry the fourteen the sector leaves
 * alone, which the base panel already shows.
 */
function rolePilotPayload(): Record<string, RolePilotPayload> {
  const out: Record<string, RolePilotPayload> = {};
  for (const tag of verticalsCovered()) {
    const roles: RolePilotRole[] = [];
    for (const roleId of pilotRoleIds()) {
      const lens = lensRole(roleId, tag);
      if (!lens || lens.movedRequirements.length === 0) continue;
      roles.push({
        roleId: lens.roleId,
        name: lens.name,
        confidence: lens.confidence,
        moved: lens.movedRequirements.map((r) => ({
          cap: r.cap,
          name: r.name,
          base: r.base,
          lensed: r.lensed,
          class: r.class,
          why: r.why,
          sourceTitle: r.source?.title ?? null,
          sourceUrl: r.source?.url ?? null,
        })),
      });
    }
    // A sector with nothing to say about any of the six roles is still a
    // result, and retail is exactly that: the baseline the others are read
    // against. It carries an empty role list rather than being dropped.
    const first = lensRole(pilotRoleIds()[0], tag)!;
    out[tag] = {
      vertical: tag,
      label: first.verticalLabel,
      regime: first.regime,
      scopeNote: first.scopeNote,
      roles,
    };
  }
  return out;
}

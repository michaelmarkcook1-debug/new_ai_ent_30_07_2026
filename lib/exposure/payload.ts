import { MODELS } from "@/lib/model-fit";
import { exposureView, reachForBand, BANDS } from "./role-exposure";
import {
  verticalLens,
  taggedIndustries,
  TAG_LABEL,
  AUTONOMY_LABEL,
  type VerticalLens,
} from "./vertical";

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
  };
}

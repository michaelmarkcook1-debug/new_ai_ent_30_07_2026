import rolesJson from "./data/roles.json";
import modelsJson from "./data/models.json";
import {
  measuredTiers,
  priceStaircase,
  topTierRoles,
  industries,
  filterRoles,
  TOP_TIER_INDEX,
  type MeasuredTier,
  type PriceStep,
  type ExceptionRole,
} from "./workforce-curve";
import type { Role, ModelRecord } from "./engine";

// What the workforce chart ships to the browser.
//
// roles.json is 697KB. The chart needs five numbers per industry, because
// densityCurve() smooths from the measured tiers alone, so the whole bundle
// would be shipped to redraw a curve that five figures already determine.
// This flattens it server-side: 37 industries x 5 tiers, the staircase, and
// the exception lists. A few KB instead of 697.
//
// Same reasoning as lib/aie/vendor-directory.ts, for the same reason: the
// browser gets the derived figures, never the corpus behind them.

const ROLES = Object.values(rolesJson as Record<string, unknown>) as Role[];
const MODELS = (
  Array.isArray(modelsJson) ? modelsJson : Object.values(modelsJson)
) as ModelRecord[];

export interface IndustrySlice {
  industry: string;
  measured: MeasuredTier[];
  totalHeadcount: number;
  roleCount: number;
  topTierShare: number;
  peakTierShare: number;
  exceptions: ExceptionRole[];
}

export interface WorkforcePayload {
  /** The whole reference workforce, and each industry cut of it. */
  all: IndustrySlice;
  byIndustry: IndustrySlice[];
  staircase: PriceStep[];
  /** Cheapest model at the tier the bulk sits in, and at the top tier. */
  priceAnchor: {
    commonIndex: number;
    commonPrice: number | null;
    commonModel: string | null;
    topIndex: number;
    topPrice: number | null;
    topModel: string | null;
    multiple: number | null;
  };
}

function slice(scope: Role[], industry: string): IndustrySlice {
  const withCap = scope.filter(
    (r) => typeof r.profile?.["CAP-01"]?.score === "number"
  );
  const measured = measuredTiers(withCap);
  const total = measured.reduce((a, m) => a + m.headcount, 0);
  const atOrAbove = (t: number) =>
    measured.filter((m) => m.tier >= t).reduce((a, m) => a + m.share, 0);
  return {
    industry,
    measured,
    totalHeadcount: total,
    roleCount: withCap.length,
    topTierShare: atOrAbove(70),
    peakTierShare: atOrAbove(90),
    exceptions: topTierRoles(withCap, null, 12),
  };
}

/** Cheapest priced model clearing a capability level, or null past the end. */
function cheapestAt(index: number): ModelRecord | null {
  let best: ModelRecord | null = null;
  for (const m of MODELS) {
    const cap = m.benchmarks?.intelligence;
    const cost = m.cost_input_per_1m;
    if (typeof cap !== "number" || typeof cost !== "number" || cost <= 0) {
      continue;
    }
    if (cap < index) continue;
    if (best === null || cost < (best.cost_input_per_1m as number)) best = m;
  }
  return best;
}

export function workforcePayload(): WorkforcePayload {
  // The mode of the distribution sits between tier 30 and tier 50, so tier 30
  // is the honest "what most of the workforce needs" anchor: it is the tier
  // the largest single share of staff sits at.
  const COMMON_INDEX = 20;
  const common = cheapestAt(COMMON_INDEX);
  const top = cheapestAt(TOP_TIER_INDEX);

  return {
    all: slice(ROLES, "All industries"),
    byIndustry: industries(ROLES).map((i) => slice(filterRoles(ROLES, i), i)),
    staircase: priceStaircase(MODELS),
    priceAnchor: {
      commonIndex: COMMON_INDEX,
      commonPrice: common?.cost_input_per_1m ?? null,
      commonModel: common?.model_id ?? null,
      topIndex: TOP_TIER_INDEX,
      topPrice: top?.cost_input_per_1m ?? null,
      topModel: top?.model_id ?? null,
      multiple:
        common?.cost_input_per_1m && top?.cost_input_per_1m
          ? (top.cost_input_per_1m as number) /
            (common.cost_input_per_1m as number)
          : null,
    },
  };
}

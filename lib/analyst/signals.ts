// The normalised signal: one observation, from one dataset, about one subject.
//
// WHY THIS EXISTS. Each page reads its own datasets and reaches its own
// conclusion, and the conclusions that matter most to a buyer are not on any
// one page. Capability converging is a Competitive Intel fact. Price staying
// separated is a Price/Performance fact. Together they say something neither
// says alone: the premium is no longer buying what it used to. Nothing in this
// product could see that, because the two pages never met.
//
// This is the shape they meet in. It is deliberately thin.
//
// WHAT IT IS NOT. It is not a numeric normalisation. Forcing a 0 to 5
// composite, a percentage share, a price multiple and an open risk count onto
// one scale would produce a number that compares things that do not compare,
// which is the same error as ranking across market categories. `state` stays
// in the dataset's own words and `magnitude` is optional and carries its own
// native units.
//
// THE TEMPORAL RULE, which is the important one. A signal knows how many
// observations it rests on. One observation is a STATE and can never be spoken
// of as a change, no matter how much a sentence would like to. The audit
// behind this module found that of thirteen canonical sources exactly three
// carry a prior reading, and none carries three, so acceleration is not
// derivable from anything this product currently holds. `temporalClass()`
// returns it only where the observations are actually there, which today means
// never, and that is the honest answer rather than a gap.

import type { DataLane } from "@/lib/provenance";
import type { DecisionEvidence } from "./decision";

/**
 * The axes a signal can be about.
 *
 * Deliberately the ones the datasets actually populate. A dimension with no
 * source behind it is an invitation to write a rule that can never fire.
 */
export type SignalDimension =
  | "capability"
  | "price"
  | "position"
  | "concentration"
  | "disclosure"
  | "adoption"
  | "delivery"
  | "risk"
  | "movement"
  | "reputation";

/**
 * Which way it points, where that can be established.
 *
 * "unknown" is the default and the common case. It means the dataset holds one
 * observation, or publishes no prior, or publishes a prior identical to the
 * current reading. All three are the same thing to a reader: no direction has
 * been established, and claiming one would be manufacturing a trend.
 */
export type SignalDirection = "up" | "down" | "flat" | "unknown";

/**
 * What can honestly be said about time.
 *
 *   state         one observation. "Vendor A leads."
 *   change        two, and they differ. "Vendor A's lead has narrowed."
 *   acceleration  three, and the change between them is growing. "The
 *                 narrowing is happening faster."
 */
export type TemporalClass = "state" | "change" | "acceleration";

export interface Signal {
  id: string;
  /** What this is about: the tracked set, a named vendor, a market category. */
  subject: string;
  dimension: SignalDimension;
  /**
   * The dataset's own reading, in its own words. "narrow", "tight",
   * "sole-sourced", "mostly undisclosed". Never a normalised number.
   */
  state: string;
  direction: SignalDirection;
  /** Only where the dataset genuinely carries one, in its own units. */
  magnitude?: number;
  observedAt: string | null;
  /** Traceability. Every synthesis can name the evidence behind every input. */
  evidence: DecisionEvidence;
  lane: DataLane;
  /**
   * How many readings this rests on. One means state only, forever.
   *
   * Not a confidence proxy. A single measured observation can be excellent
   * evidence for what is true now and is still no evidence at all about what
   * is changing.
   */
  observations: number;
}

/**
 * What may be said about a signal over time.
 *
 * The guard is the observation count and nothing else. A direction on a single
 * observation is a direction somebody wanted rather than one the data carries,
 * so it is reported as a state regardless of what `direction` says.
 */
export function temporalClass(signal: Signal): TemporalClass {
  if (signal.observations >= 3 && signal.direction !== "unknown") {
    // Reachable only when a dataset starts carrying three readings. Nothing
    // in this product does today, which is why no builder passes 3 and why
    // the test asserting that is worth keeping when one eventually does.
    return "acceleration";
  }
  if (signal.observations >= 2 && signal.direction !== "unknown") return "change";
  return "state";
}

/** True when this signal may be described as moving at all. */
export function hasTrend(signal: Signal): boolean {
  return temporalClass(signal) !== "state";
}

/**
 * How a signal should be worded, so a snapshot cannot be written as a trend.
 *
 * Used by the synthesis prose and by the prompt block. A caller that wants to
 * say "narrowing" has to ask for it here first and gets "is narrow" back when
 * the observations are not there.
 */
export function stateWording(signal: Signal): string {
  if (!hasTrend(signal)) return `is ${signal.state}`;
  const moving =
    signal.direction === "up"
      ? "rising"
      : signal.direction === "down"
        ? "falling"
        : "steady";
  return `is ${signal.state} and ${moving}`;
}

/** Build a signal, forcing the temporal rule at the point of construction. */
export function signal(input: {
  id: string;
  subject: string;
  dimension: SignalDimension;
  state: string;
  direction?: SignalDirection;
  magnitude?: number;
  observedAt: string | null;
  evidence: DecisionEvidence;
  lane: DataLane;
  observations?: number;
}): Signal {
  const observations = input.observations ?? 1;
  // A direction on one observation is discarded here rather than trusted and
  // filtered later. There is no path by which a caller can talk it back in.
  const direction: SignalDirection =
    observations >= 2 ? (input.direction ?? "unknown") : "unknown";
  return {
    id: input.id,
    subject: input.subject,
    dimension: input.dimension,
    state: input.state,
    direction,
    magnitude: input.magnitude,
    observedAt: input.observedAt,
    evidence: input.evidence,
    lane: input.lane,
    observations,
  };
}

/**
 * Two signals observed close enough together to be described as simultaneous.
 *
 * Used only to license the words "coincides with". It is a statement about two
 * timestamps and nothing else: see `synthesis.ts` for why that must never be
 * allowed to become a statement about cause.
 *
 * Signals with no date cannot coincide with anything, because an undated
 * reading has no window to fall inside.
 */
export function coincident(a: Signal, b: Signal, withinDays = 30): boolean {
  if (!a.observedAt || !b.observedAt) return false;
  const ta = Date.parse(a.observedAt);
  const tb = Date.parse(b.observedAt);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= withinDays * 24 * 60 * 60 * 1000;
}

/** The worst lane across a set, so a synthesis cannot outrank its inputs. */
export function worstLane(signals: readonly Signal[]): DataLane {
  // Ordered best to worst. A synthesis over a modelled estimate and a measured
  // filing is only as good as the modelled estimate.
  const ORDER: DataLane[] = [
    "live",
    "aie-live",
    "aie",
    "cited",
    "derived",
    "sample",
    "mock",
    "stub",
  ];
  let worst = 0;
  for (const s of signals) {
    const i = ORDER.indexOf(s.lane);
    if (i > worst) worst = i;
  }
  return ORDER[worst];
}

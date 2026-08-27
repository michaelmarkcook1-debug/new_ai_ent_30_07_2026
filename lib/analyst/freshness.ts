// How old a reading is allowed to be before it stops meaning "now".
//
// WHY PER SOURCE. A single shelf life across every dataset would be wrong in
// both directions at once. A news item is worthless after a fortnight; a 10-K
// is the current position for a quarter and a bit; the set of integrators who
// can stand a platform up does not turn over in a month. Applying one number
// to all three either throws away good evidence or presents dead evidence as
// live, and this product has already shipped the second: the previous audit
// found a benchmark capture 33 days old feeding a "why now".
//
// THE FOUR STATES, and the one that matters most.
//
//   current   inside the source's own refresh cadence
//   aging     past it, not yet meaningless
//   stale     old enough that a claim about NOW cannot rest on it
//   unknown   no usable date
//
// `unknown` is NOT a synonym for current, and that is the whole reason it
// exists as a state rather than defaulting. A reading with no date is a reading
// nobody can vouch for the currency of, and treating it as fresh is the same
// class of error as inventing the date.
//
// WHAT THIS IS NOT. Not a confidence score, not a decay curve, not a weighting.
// Four named states from a comparison of two dates against a documented
// threshold, and the thresholds are stated here with their reasoning so they
// can be argued with rather than inherited.

import type { Signal } from "./signals";

export type Freshness = "current" | "aging" | "stale" | "unknown";

/**
 * Days before a source's readings stop being current, and then stop being
 * usable for a claim about the present.
 *
 * Keyed on the `source` string the signal's evidence carries, because that is
 * the value already threaded through every layer. An unlisted source falls to
 * DEFAULT_SHELF_LIFE rather than to "always current", so adding a dataset
 * without thinking about its cadence produces a conservative answer instead of
 * a flattering one.
 */
export const SHELF_LIFE: Readonly<
  Record<string, { current: number; stale: number; why: string }>
> = {
  "AIE news feed": {
    current: 7,
    stale: 21,
    why: "A news cycle in this market turns over inside a week. An item a month old is history rather than news, whatever its impact score said at the time.",
  },
  "Artificial Analysis benchmark": {
    current: 21,
    stale: 60,
    why: "Model releases land monthly, and each one can move the frontier score. A benchmark older than two months describes a leaderboard that has since reordered.",
  },
  "Vendor pricing pages": {
    current: 21,
    stale: 60,
    why: "List pricing changes on the vendors' own timetable, historically several times a year. Paired with the benchmark because the price multiple is computed across both.",
  },
  "AIE capability matrix": {
    current: 30,
    stale: 90,
    why: "The assessment is re-synced from v1 on a monthly-ish cadence, and an evidence-graded capability score does not move faster than the evidence behind it.",
  },
  "AIE vendor rankings": {
    current: 30,
    stale: 90,
    why: "Same cadence and same underlying assessment as the capability matrix.",
  },
  "AIE market share estimates": {
    current: 30,
    stale: 90,
    why: "A modelled category-presence estimate recomputed each refresh. It is directional at the best of times, so a stale one carries very little.",
  },
  "AIE vendor movement classification": {
    current: 21,
    stale: 45,
    why: "The shortest life of any structural source here, deliberately. Movement is a claim about what is happening now, and an old movement reading is the exact thing that must never be presented as current.",
  },
  "AIE reputation pillars": {
    current: 90,
    stale: 270,
    why: "The slowest tracked measure to move, by this product's own reading of it. Support quality and documentation do not turn over in a quarter, so a reputation capture stays informative far longer than a price does.",
  },
  "AG reputation snapshots": {
    current: 90,
    stale: 270,
    why: "Same measure, captured by us rather than seeded.",
  },
  "AIE risk register": {
    current: 60,
    stale: 180,
    why: "Registers lag by construction: a finding is recorded well after it arises and closes on the vendor's timetable. A long window is correct, and an absent finding was always weaker evidence than a present one.",
  },
  "SEC filings, full-text search": {
    current: 120,
    stale: 400,
    why: "Filings arrive quarterly and annually. Last quarter's 10-Q is the current disclosed position, not a stale one, and the annual cycle sets the outer bound.",
  },
  "SEC segment revenue extraction": {
    current: 120,
    stale: 400,
    why: "Derived from the same filings on the same cadence.",
  },
  "AIE exposure map": {
    current: 180,
    stale: 540,
    why: "Which integrators carry which vendors is a structural relationship built on trained delivery staff. It changes over years, not weeks, so a long window is not laxity here.",
  },
  "AIE uptake model": {
    current: 60,
    stale: 180,
    why: "A modelled adoption estimate rebuilt periodically. Adoption shifts over quarters rather than weeks.",
  },
  "AIE workflow catalogue": {
    current: 180,
    stale: 540,
    why: "A curated library of enterprise workflows. The work enterprises do changes slowly; the vendors serving it change faster, and that is a different signal.",
  },
  "AIE workflow taxonomy": {
    current: 180,
    stale: 540,
    why: "Same library, same cadence.",
  },
  "AIE workflow vendor mapping": {
    current: 60,
    stale: 180,
    why: "The mapping from a workflow to who sells for it moves with the vendor set rather than with the taxonomy, so it turns over faster than the catalogue it hangs off.",
  },
};

/**
 * For a source nobody has thought about yet.
 *
 * Deliberately short. A new dataset with no declared cadence should be treated
 * as needing attention, not as permanently current.
 */
export const DEFAULT_SHELF_LIFE = { current: 30, stale: 90, why: "No cadence declared for this source, so the conservative default applies." };

export function shelfLifeFor(source: string) {
  return SHELF_LIFE[source] ?? DEFAULT_SHELF_LIFE;
}

/** Age in days, or null when the reading carries no usable date. */
export function ageDays(observedAt: string | null | undefined, now: number): number | null {
  if (!observedAt) return null;
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t)) return null;
  return (now - t) / (24 * 60 * 60 * 1000);
}

/**
 * How current a signal is, against its own source's cadence.
 *
 * A future-dated reading is treated as unknown rather than as maximally fresh:
 * a date ahead of the clock is a defect in the feed, and rewarding it would
 * make the freshest possible signal the one with the most broken timestamp.
 */
export function freshnessOf(signal: Signal, now: number): Freshness {
  const age = ageDays(signal.observedAt, now);
  if (age === null) return "unknown";
  if (age < -1) return "unknown";
  const { current, stale } = shelfLifeFor(signal.evidence.source);
  if (age <= current) return "current";
  if (age <= stale) return "aging";
  return "stale";
}

/**
 * Whether a reading may support a claim about the present.
 *
 * `current` and `aging` both qualify: a reading past its refresh window but
 * inside its useful life is still evidence about now, and excluding it would
 * throw away most of what this product holds. `stale` and `unknown` do not,
 * and `unknown` is refused here rather than anywhere downstream so there is
 * exactly one place the "no date does not mean fresh" rule lives.
 */
export function speaksToNow(f: Freshness): boolean {
  return f === "current" || f === "aging";
}

/**
 * Whether a reading may be the reason to act NOW.
 *
 * STRICTER THAN `speaksToNow`, AND DELIBERATELY SO. The two questions are
 * different and were being answered by one test:
 *
 *   "may this evidence inform what we should do?"   -> speaksToNow
 *   "may this evidence be why we must do it now?"   -> this
 *
 * An aging reading passes the first and fails the second. It is past its
 * source's own refresh window, which means the thing it measures has had a
 * full cadence to move since anybody looked. That is still good evidence about
 * the decision and it is not a reason to hurry, because the honest sentence
 * about a reading nobody has refreshed in over a cycle is "this was true when
 * we last looked", which is an argument for looking again rather than for
 * signing this week.
 *
 * This is the gap the header of this file describes and did not close. The
 * previous audit found a benchmark capture 33 days old feeding a "why now";
 * the shelf life below correctly calls that reading aging, `speaksToNow` let
 * aging through, and the capture went on feeding a why now. The shelf life was
 * never the defect. What urgency required was.
 */
export function canCreateUrgency(f: Freshness): boolean {
  return f === "current";
}

/** The least fresh state in a set, which is the one that governs. */
export function worstFreshness(signals: readonly Signal[], now: number): Freshness {
  const ORDER: Freshness[] = ["current", "aging", "stale", "unknown"];
  let worst = 0;
  for (const s of signals) {
    const i = ORDER.indexOf(freshnessOf(s, now));
    if (i > worst) worst = i;
  }
  return signals.length === 0 ? "unknown" : ORDER[worst];
}

/**
 * How a signal's age should be said out loud, where it is worth saying.
 *
 * Only returns text for readings that are no longer current, because "this is
 * current" beside every figure is noise, and the reader's default assumption
 * that a figure is live is correct for a current one.
 */
export function freshnessNote(signal: Signal, now: number): string | null {
  const f = freshnessOf(signal, now);
  if (f === "current") return null;
  const age = ageDays(signal.observedAt, now);
  if (f === "unknown") {
    return `${signal.evidence.source} carries no usable date, so its currency cannot be established.`;
  }
  return `${signal.evidence.source} was last read ${Math.round(age ?? 0)} days ago, ${f === "stale" ? "which is past the point it can support a claim about now" : "which is past its refresh window but still inside its useful life"}.`;
}

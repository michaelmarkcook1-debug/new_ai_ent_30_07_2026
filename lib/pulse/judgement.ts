import type { MarketKpi, MarketSignal } from "@/lib/market-metrics";
import type { MarketStructure } from "@/lib/analyst/insight";

// Today's Pulse, written from the tracked figures rather than read from a
// fixture.
//
// The headline and the judgement underneath it used to come from
// fixture.editorial, which is sample copy with a fixed date. That put a SAMPLE
// badge on the flagship section of the product: the one thing a CIO reads
// before a board meeting was the one thing not drawn from the data. The badge
// was honest, which is why it could not simply be removed; the fix is to give
// the section a real source.
//
// Everything below is built from figures already on the page: which vendors
// gained and slipped, what the tracked averages did, and how many open risks
// are published. Nothing is asserted that the inputs do not carry, and when an
// input is absent the sentence says so instead of reaching for a number.

export interface PulseJudgementInput {
  gaining: MarketSignal[];
  slipping: MarketSignal[];
  risks: MarketSignal[];
  kpis: MarketKpi[];
  /** False when the source publishes priors identical to current figures. */
  shareMovementPublished: boolean;
  /**
   * The shape of the tracked market, where the caller computed it.
   *
   * WHY THE HEADLINE NEEDED THIS. Without it the only thing this function knew
   * was how many vendors moved, so the best headline it could write was "5
   * vendors gaining, 3 slipping". That is an input to a market judgement, not
   * a market judgement: it tells an executive that something happened and
   * nothing about whether it matters. With the structure in hand the headline
   * can say what the market IS, and movement becomes the supporting detail it
   * always was.
   *
   * Optional, because the shape is only available to callers holding
   * MarketMetrics. Absent, this behaves exactly as it did.
   */
  structure?: MarketStructure | null;
}

export interface PulseJudgement {
  headline: string;
  judgement: string;
  /** Null when there is nothing measured to say. Never a filler sentence. */
  movement: string | null;
}

const plural = (n: number, one: string, many: string) =>
  n === 1 ? `1 ${one}` : `${n} ${many}`;

/** The tracked average that moved furthest, ignoring the ones with no prior. */
function largestMove(kpis: MarketKpi[]): MarketKpi | null {
  const moved = kpis.filter((k) => k.delta !== null && k.delta !== 0);
  if (moved.length === 0) return null;
  return moved.reduce((best, k) =>
    Math.abs(k.delta ?? 0) > Math.abs(best.delta ?? 0) ? k : best
  );
}

function severe(risks: MarketSignal[]): number {
  return risks.filter((r) => (r.severity ?? "").toLowerCase() === "high").length;
}

export function pulseJudgement(input: PulseJudgementInput): PulseJudgement {
  const { gaining, slipping, risks, kpis, shareMovementPublished } = input;
  const movers = gaining.length + slipping.length;

  // Headline: the most important thing an executive should take from the
  // market's CURRENT SHAPE, with movement as evidence rather than as the point.
  //
  // The ladder is ordered by what actually deserves attention, and each rung
  // is a market condition rather than a count. A market where the leaders
  // carry unresolved governance findings is a different problem from one where
  // nobody is separated, and both are different from one that simply has not
  // moved. Where no structure was supplied the old movement headline stands.
  let headline: string;
  const st = input.structure ?? null;
  if (st && st.riskContradictions > 0 && st.separated <= st.judged / 2) {
    headline =
      "Vendor choice is not where this quarter's risk sits; governance and terms are";
  } else if (st && st.judged >= 4 && st.separated / st.judged <= 0.4) {
    headline = `Differentiation holds in ${st.separated} of ${st.judged} categories, so the contract is doing the work the shortlist cannot`;
  } else if (st && st.topThreeShare !== null && st.topThreeShare >= 60) {
    headline = `A long shortlist is hiding a concentrated market: three vendors hold about ${st.topThreeShare} per cent of a typical category`;
  } else if (st && movers === 0) {
    headline =
      "The tracked market did not move this period, which makes this a quarter to spend on terms rather than on selection";
  } else if (!shareMovementPublished) {
    // NOT "share held flat". The source republished priors identical to the
    // current figures, so whether share moved is unknown. market-metrics.ts
    // makes the same point where the flag is derived: reporting this as "0 per
    // cent gaining" would read as "nothing is growing" when the truth is that
    // no movement has been published. The headline names what can be read.
    headline = "Vendor positions moved; category share gives no read";
  } else if (movers === 0) {
    headline = "No vendor changed position in the tracked set";
  } else if (slipping.length === 0) {
    headline = `${plural(gaining.length, "vendor is", "vendors are")} gaining position, none slipping`;
  } else if (gaining.length === 0) {
    headline = `${plural(slipping.length, "vendor is", "vendors are")} slipping, none gaining`;
  } else {
    headline = `${plural(gaining.length, "vendor", "vendors")} gaining, ${slipping.length} slipping`;
  }

  // Judgement: the argument under the headline, not a list of readings.
  //
  // WHAT THIS ADDS. The body used to open on whichever tracked average had
  // moved furthest and then state the risk count, which is two measurements
  // sitting next to each other. Under a headline that now makes a claim about
  // where this quarter's risk actually sits, the body has to support that
  // claim: what the market's shape is, then what it means, then the readings
  // that qualify it. The measurements below are unchanged and still follow;
  // they are evidence for the argument rather than the whole of it.
  const parts: string[] = [];
  if (st) {
    if (st.judged >= 4 && st.separated / st.judged <= 0.4) {
      parts.push(
        `Only ${st.separated} of ${st.judged} judged categories carry a lead wide enough to decide a purchase, so the scores are no longer doing the work of separating this market and the leverage has moved to what you sign.`
      );
    } else if (st.topThreeShare !== null && st.topThreeShare >= 60) {
      parts.push(
        `The three largest vendors hold about ${st.topThreeShare} per cent of a typical category, so a long shortlist is not the same thing as a contested one.`
      );
    }
    if (st.riskContradictions > 0) {
      parts.push(
        `${plural(st.riskContradictions, "category leader carries", "category leaders carry")} an open high-severity finding while ranking in the top third, which makes governance a condition of the shortlist rather than a step after it.`
      );
    }
  }
  const top = largestMove(kpis);
  if (top && top.score !== null && top.delta !== null) {
    const dir = top.delta > 0 ? "up" : "down";
    const better = top.invert ? top.delta < 0 : top.delta > 0;
    parts.push(
      `${top.label} averages ${top.score.toFixed(1)} across ${plural(top.sampleSize, "vendor", "vendors")}, ${dir} ${Math.abs(top.delta).toFixed(1)} on the previous reading and moving in the ${better ? "buyer's favour" : "wrong direction for buyers"}.`
    );
  } else if (kpis.length > 0) {
    parts.push(
      // Said as a fact about the market rather than a fact about our ingest.
      // The old wording, "the tracked averages carry no prior reading this
      // period, so no direction of travel is claimed for them", is true and is
      // written for whoever maintains the pipeline.
      //
      // AND IT MUST NOT BECOME "nothing moved". There is no prior to compare
      // against, so whether the averages moved is unknown, not flat. Saying
      // they held steady would manufacture the very reading the absent prior
      // denies us. The sentence therefore says what cannot be read, and points
      // at what can.
      `The tracked averages have nothing to compare against this period, so no aggregate trend can be read and the only movement to go on is vendor level.`
    );
  }

  if (risks.length > 0) {
    const high = severe(risks);
    parts.push(
      high > 0
        ? `${plural(risks.length, "open governance risk", "open governance risks")} against tracked vendors, ${high} of them high severity.`
        : `${plural(risks.length, "open governance risk", "open governance risks")} against tracked vendors, none high severity.`
    );
  } else {
    parts.push("No open governance risk is recorded against any tracked vendor.");
  }

  // Named movement, so the headline count is attributable rather than abstract.
  const named = [
    ...gaining.slice(0, 2).map((s) => `${s.vendorName} (gaining)`),
    ...slipping.slice(0, 2).map((s) => `${s.vendorName} (slipping)`),
  ];

  return {
    headline,
    judgement: parts.join(" "),
    movement: named.length > 0 ? named.join(", ") : null,
  };
}

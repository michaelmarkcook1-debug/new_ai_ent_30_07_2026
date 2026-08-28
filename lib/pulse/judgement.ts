import type { MarketKpi, MarketSignal } from "@/lib/market-metrics";

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

  // Headline: the single thing that actually happened to the tracked set.
  let headline: string;
  if (!shareMovementPublished) {
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

  // Judgement: the tracked average that moved furthest, named and numbered,
  // then the published risk load. Both are figures, not characterisations.
  const parts: string[] = [];
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

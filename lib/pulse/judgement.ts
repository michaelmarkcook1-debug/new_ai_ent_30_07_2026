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
    headline = "Positions steady: no movement published this period";
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
      `The tracked averages carry no prior reading this period, so no direction of travel is claimed for them.`
    );
  }

  if (risks.length > 0) {
    const high = severe(risks);
    parts.push(
      high > 0
        ? `${plural(risks.length, "risk is", "risks are")} published against the set, ${high} rated high.`
        : `${plural(risks.length, "risk is", "risks are")} published against the set, none rated high.`
    );
  } else {
    parts.push("No open risks are published against the tracked set.");
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

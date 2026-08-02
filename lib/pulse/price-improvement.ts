import { TOKEN_PRICING } from "@/lib/aie/model-inventory/token-pricing";
import { TOKEN_PRICING_VERIFIED } from "@/lib/aie/model-inventory/token-pricing-verified";
import type { CostCapabilityModel } from "@/app/(ai-ent)/price-performance/data";

// Largest price-performance improvement, between two dated price captures.
//
// This slot read "insufficient evidence" until now, correctly: one capture
// cannot show movement. There are two captures now, the ported snapshot of
// 2026-06-02 and the vendor pages re-read on 2026-08-02, so the comparison is
// available and the honest answer changes.
//
// The first thing the two captures show is that NO model changed price. All
// ten models present in both are listed at exactly the same input and output
// price on both dates. So the improvement is not a discount, and describing it
// as one would be wrong.
//
// What actually moved is the capability you can buy at a given price, because
// new models entered underneath the old ones. The measure is therefore: for
// each model that did not exist at the earlier capture, what was the cheapest
// way to reach its benchmark score back then, and what is it now. A model that
// beats every earlier option outright is excluded rather than credited with an
// infinite gain: there is no earlier price to compare against, so there is no
// improvement to compute, only a new capability level.

export interface PriceImprovement {
  model: string;
  intelligence: number;
  priceNow: number;
  /** Cheapest model at the earlier capture that matched or beat this score. */
  baselineModel: string;
  baselinePrice: number;
  baselineIntelligence: number;
  /** How many times cheaper the same capability is now. */
  factor: number;
  costPerPointNow: number;
  costPerPointBefore: number;
}

export interface ImprovementResult {
  best: PriceImprovement | null;
  /** Models that beat everything available at the earlier capture. */
  beyondBaseline: string[];
  baselineCount: number;
  comparedCount: number;
  repricedCount: number;
  unchangedCount: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]/g, "");

/**
 * Best benchmark score for a named model family.
 *
 * The benchmark capture names variants ("GPT-5.6 Luna (max)"), the pricing
 * tables name families ("GPT-5.6 Luna"), so the family name is matched as a
 * prefix of the variant and the strongest variant wins. A model with no
 * benchmark entry is skipped rather than assumed.
 */
function scoreFor(
  family: string,
  models: CostCapabilityModel[]
): CostCapabilityModel | null {
  const n = norm(family);
  if (!n) return null;
  const hits = models.filter((m) => norm(m.model).startsWith(n));
  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (b.intelligence > a.intelligence ? b : a));
}

export function largestPriceImprovement(
  models: CostCapabilityModel[]
): ImprovementResult {
  const earlierNames = new Set(TOKEN_PRICING.map((r) => r.modelName));

  // How many models actually moved price between the two captures. Reported
  // because "nothing was repriced" is the finding that stops this being read
  // as a discount.
  let repriced = 0;
  let unchanged = 0;
  for (const now of TOKEN_PRICING_VERIFIED) {
    const before = TOKEN_PRICING.find((r) => r.modelName === now.modelName);
    if (!before) continue;
    if (
      before.inputPerM !== now.inputPerM ||
      before.outputPerM !== now.outputPerM
    ) {
      repriced += 1;
    } else {
      unchanged += 1;
    }
  }

  // Baseline: what could be bought at the earlier capture, priced then.
  const baseline: { name: string; price: number; intelligence: number }[] = [];
  for (const r of TOKEN_PRICING) {
    if (r.inputPerM === null) continue;
    const m = scoreFor(r.modelName, models);
    if (!m) continue;
    baseline.push({
      name: r.modelName,
      price: r.inputPerM,
      intelligence: m.intelligence,
    });
  }

  const beyondBaseline: string[] = [];
  const gains: PriceImprovement[] = [];

  for (const r of TOKEN_PRICING_VERIFIED) {
    if (r.inputPerM === null || earlierNames.has(r.modelName)) continue;
    const m = scoreFor(r.modelName, models);
    if (!m) continue;

    const matched = baseline.filter((b) => b.intelligence >= m.intelligence);
    if (matched.length === 0) {
      // Nothing at the earlier capture reached this score. That is a new
      // capability ceiling, not a price improvement, and is reported as such.
      beyondBaseline.push(r.modelName);
      continue;
    }
    const cheapest = matched.reduce((a, b) => (b.price < a.price ? b : a));
    if (r.inputPerM >= cheapest.price) continue;

    gains.push({
      model: r.modelName,
      intelligence: m.intelligence,
      priceNow: r.inputPerM,
      baselineModel: cheapest.name,
      baselinePrice: cheapest.price,
      baselineIntelligence: cheapest.intelligence,
      factor: Math.round((cheapest.price / r.inputPerM) * 10) / 10,
      costPerPointNow:
        Math.round((r.inputPerM / m.intelligence) * 10000) / 10000,
      costPerPointBefore:
        Math.round((cheapest.price / cheapest.intelligence) * 10000) / 10000,
    });
  }

  gains.sort((a, b) => b.factor - a.factor);

  return {
    best: gains[0] ?? null,
    beyondBaseline,
    baselineCount: baseline.length,
    comparedCount: gains.length,
    repricedCount: repriced,
    unchangedCount: unchanged,
  };
}

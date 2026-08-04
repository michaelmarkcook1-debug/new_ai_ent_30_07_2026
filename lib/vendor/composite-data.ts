import capabilitiesJson from "@/fixtures/aie-live/capabilities.json";
import reputationJson from "@/fixtures/aie-live/reputation.json";
import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { VALUATIONS, REVENUES } from "@/lib/finance/private-revenue";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";
import {
  composite,
  terciles,
  verdicts,
  INPUT_KEYS,
  DEFAULT_WEIGHTS,
  DURABILITY_CUTS,
  type CompositeInputs,
  type CompositeResult,
  type Thresholds,
  type Verdict,
  type Weights,
  type InputKey,
} from "./composite";

// The three inputs, per vendor, from the sources the product already holds.
//
// Coverage, measured 4 August 2026 across the 43 tracked vendors (the 47 in
// the directory less 4 investors, who are not vendors anyone buys from):
//   winning     43 of 43   every vendor is assessed on at least one capability
//   trust       28 of 43   reputation is published for a subset
//   durability  18 of 43   15 listed companies plus 3 disclosed private rounds
//
// So no vendor is 0 of 3 and 14 are 3 of 3. That is worth stating plainly
// because it sets what the composite can honestly claim: it is always a
// reading of something, and it is rarely a reading of everything.

interface CapRow {
  vendorId: string;
  maturityScore?: number | null;
}
interface RepBlock {
  overall?: number | null;
}
interface RepRow {
  vendorId: string;
  customer?: RepBlock | null;
  developer?: RepBlock | null;
  employee?: RepBlock | null;
}

const CAPS = (capabilitiesJson as { vendorCapabilities: CapRow[] })
  .vendorCapabilities;
const REP = (reputationJson as { rows: RepRow[] }).rows;

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Assessed capability, averaged across the dimensions a vendor is scored on. */
function winningScore(vendorId: string): number | null {
  const xs = CAPS.filter(
    (r) => r.vendorId === vendorId && typeof r.maturityScore === "number"
  ).map((r) => r.maturityScore as number);
  return mean(xs);
}

/** Customer, developer and employee reputation, averaged over those published. */
function trustScore(vendorId: string): number | null {
  const row = REP.find((r) => r.vendorId === vendorId);
  if (!row) return null;
  const xs = [row.customer, row.developer, row.employee]
    .map((b) => (typeof b?.overall === "number" ? b.overall : null))
    .filter((v): v is number => v !== null);
  return mean(xs);
}

/**
 * What the company discloses about its own finances, on four rungs.
 *
 * This is NOT a solvency forecast and the copy that renders it says so. Every
 * rung is a fact about disclosure, which is the only thing available: nobody
 * publishes runway, and inventing one from a valuation would be exactly the
 * fabrication this product refuses. A vendor that discloses nothing scores
 * null and reads Unknown, rather than scoring low and reading No.
 */
function durabilityScore(vendorId: string): number | null {
  const tracked = TRACKED_VENDORS.find((v) => v.id === vendorId);
  // A listed company files audited accounts. That is the strongest standing
  // evidence available here that it will still be around to invoice.
  if (tracked?.ticker) return 85;

  const val = VALUATIONS.find((v) => v.vendorId === vendorId);
  if (val?.state === "closed") {
    // A closed round at a disclosed valuation. Funded, but with no audited
    // revenue and no published runway. Revenue disclosure nudges it up.
    return REVENUES.some((r) => r.vendorId === vendorId) ? 60 : 55;
  }
  if (val) return 40; // reported, not closed

  return null;
}

export interface VendorScorecard {
  vendorId: string;
  name: string;
  inputs: CompositeInputs;
  verdicts: Record<InputKey, Verdict>;
  result: CompositeResult;
}

export interface ScorecardSet {
  thresholds: Thresholds;
  vendors: VendorScorecard[];
  coverage: Record<InputKey, number>;
  total: number;
}

function rawInputs(vendorId: string): CompositeInputs {
  return {
    winning: winningScore(vendorId),
    trust: trustScore(vendorId),
    durability: durabilityScore(vendorId),
  };
}

/**
 * Every tracked vendor scored, with the tercile cuts computed over the set.
 * The cuts are relative by necessity: capability and reputation sit on
 * different scales, so no single absolute threshold reads both correctly.
 */
// Investors are excluded. "Is it winning, do people trust it, will it still
// exist in three years" are questions about a vendor you might buy from, and
// asking them of Sequoia Capital is a category error. They are also absent
// from /vendor-view for the same reason, so scoring them here offered a
// verdict on something the rest of the product does not treat as a vendor.
const INVESTOR_CATEGORY = "AI investor";

export function scorecardSet(weights: Weights = DEFAULT_WEIGHTS): ScorecardSet {
  const roster = VENDOR_DIRECTORY.filter(
    (v) => v.category !== INVESTOR_CATEGORY
  ).map((v) => ({
    vendorId: v.id,
    name: v.name,
    inputs: rawInputs(v.id),
  }));

  const thresholds = {
    // Terciles for the two continuous measures, because they sit on
    // different scales and no absolute threshold reads both correctly.
    winning: terciles(roster.map((r) => r.inputs.winning)),
    trust: terciles(roster.map((r) => r.inputs.trust)),
    // Fixed for durability: it is a four-rung ordinal whose values pile on
    // one rung, and terciles over it put both cuts at 85, which read a
    // closed $380B round as "No". See DURABILITY_CUTS.
    durability: { ...DURABILITY_CUTS },
  } as Thresholds;

  const coverage = Object.fromEntries(
    INPUT_KEYS.map((k) => [
      k,
      roster.filter((r) => r.inputs[k] !== null).length,
    ])
  ) as Record<InputKey, number>;

  return {
    thresholds,
    coverage,
    total: roster.length,
    vendors: roster.map((r) => ({
      ...r,
      verdicts: verdicts(r.inputs, thresholds),
      result: composite(r.inputs, weights),
    })),
  };
}

export function vendorScorecard(
  vendorId: string,
  weights: Weights = DEFAULT_WEIGHTS
): VendorScorecard | null {
  const set = scorecardSet(weights);
  return set.vendors.find((v) => v.vendorId === vendorId) ?? null;
}

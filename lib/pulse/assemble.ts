import { promises as fs } from "fs";
import path from "path";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { FinancialIndicator } from "@/app/(ai-ent)/pulse/components/financial-strip";
import type { PulseSignal } from "@/app/(ai-ent)/pulse/components/decision-lists";
import type { ToolKey } from "@/lib/ui/tools";
import type { ActionIntent } from "@/lib/analyst/canonical";

// Server-side assembly for the Pulse brief: the pieces that need the
// filesystem or that stitch several sources together.

interface Disclosure {
  ticker: string;
  name: string;
  vendorId: string;
  discloses: boolean;
  statements?: unknown[];
}

interface SegmentCompany {
  ticker: string;
  name: string;
  filingDate?: string;
  segments?: unknown[];
  segmentTotalUsd?: number | null;
}

async function readJson<T>(rel: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), rel), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Four financial indicators, three of which are counts of what filings do and
 * do not say. Counting disclosure is itself the finding: an enterprise buyer
 * planning multi-year spend should know how little of this market reports the
 * revenue it is supposedly built on.
 */
export async function buildFinancialIndicators(): Promise<{
  indicators: FinancialIndicator[];
  capturedAt: string | null;
  /** Returned as numbers so callers do not parse them back out of the copy. */
  disclosure: { disclosing: number; total: number } | null;
}> {
  const disc = await readJson<{ capturedAt?: string; vendors?: Disclosure[] }>(
    "fixtures/sec/ai-revenue-disclosures.json"
  );
  const seg = await readJson<{ capturedAt?: string; companies?: SegmentCompany[] }>(
    "fixtures/sec/segment-revenue.json"
  );

  const vendors = disc?.vendors ?? [];
  const disclosing = vendors.filter((v) => v.discloses);
  const companies = seg?.companies ?? [];
  const withSegments = companies.filter(
    (c) => Array.isArray(c.segments) && c.segments.length > 0
  );

  // An indicator is an absence when its value is not a figure. Deriving this
  // rather than setting it by hand means a "Data unavailable" fallback can
  // never slip through and render at headline size, which is what happened
  // when the flag was hardcoded per indicator.
  const ABSENT = /^(not disclosed|not published|data unavailable|insufficient evidence)$/i;
  const withAbsence = (list: Omit<FinancialIndicator, "isAbsence">[]) =>
    list.map((i) => ({ ...i, isAbsence: ABSENT.test(i.value.trim()) }));

  const indicators: FinancialIndicator[] = withAbsence([
    {
      label: "AI revenue disclosure",
      value: vendors.length
        ? `${disclosing.length} of ${vendors.length}`
        : "Data unavailable",
      detail: vendors.length
        ? `Only ${disclosing.map((v) => v.name).join(", ")} state a quantified AI revenue figure in their filings. The rest report none.`
        : "No filing capture is currently held.",
      lane: "aie",
    },
    {
      label: "Segment revenue filed",
      value: companies.length
        ? `${withSegments.length} of ${companies.length}`
        : "Data unavailable",
      detail: companies.length
        ? "Vendors whose filings break revenue down by segment, which is as close as most get to showing where AI money lands."
        : "No filing capture is currently held.",
      lane: "aie",
    },
    {
      label: "Funding durability",
      value: "Not disclosed",
      detail:
        "Runway and funding depth are not filed by public vendors and not published by private ones. No estimate is substituted.",
      lane: "aie",
    },
    {
      label: "Enterprise spending direction",
      value: "Not published",
      detail:
        "No prior period is published for the tracked spend figures, so no direction of travel can be shown without inventing one.",
      lane: "aie",
    },
  ]);

  return {
    indicators,
    capturedAt: disc?.capturedAt ?? seg?.capturedAt ?? null,
    disclosure: vendors.length
      ? { disclosing: disclosing.length, total: vendors.length }
      : null,
  };
}

/**
 * The three signals the judgement rests on.
 *
 * Chosen from what the tracked data actually carries today rather than written
 * to fit the headline: the counts and the price spread are recomputed on every
 * render, so if the market changes the signals change with it.
 */
export function buildSignals(
  metrics: MarketMetrics,
  priceRatio: number | null,
  modelCount: number,
  disclosureShortfall: { disclosing: number; total: number } | null
): PulseSignal[] {
  const signals: PulseSignal[] = [];

  if (priceRatio !== null && priceRatio >= 2) {
    signals.push({
      what: `The top-scoring model costs ${priceRatio} times more than the cheapest model that reaches 80 per cent of its benchmark score.`,
      why: "The last increment of capability is priced far above the rest of the curve. Most enterprise work does not need it, so paying for it everywhere is the largest avoidable line in a deployment.",
      supports: "Price efficiency.",
      source: `Across ${modelCount} priced and benchmarked models`,
      href: "/price-performance",
      lane: "derived",
    });
  }

  const gaining = metrics.gaining.length;
  const slipping = metrics.slipping.length;
  if (gaining + slipping > 0) {
    signals.push({
      what: `${gaining} tracked ${gaining === 1 ? "vendor is" : "vendors are"} gaining position and ${slipping} ${slipping === 1 ? "is" : "are"} slipping.`,
      why:
        gaining >= slipping
          ? "The field is still opening rather than consolidating, so a shortlist closed six months ago is probably missing something."
          : "The field is consolidating, which narrows real alternatives and weakens negotiating position over time.",
      supports: "Market momentum, and the movers list below.",
      source: "AIE market dashboard",
      href: "/vendor-view",
      lane: metrics.lane,
    });
  }

  if (disclosureShortfall && disclosureShortfall.total > 0) {
    const undisclosed =
      disclosureShortfall.total - disclosureShortfall.disclosing;
    signals.push({
      what: `${undisclosed} of ${disclosureShortfall.total} tracked public vendors state no AI revenue figure in their filings.`,
      why: "Vendor claims about AI traction are largely unaudited. Treat commercial projections in a sales cycle as unverified unless the filing carries them.",
      supports: "How far to trust any vendor's own commercial claims.",
      source: "SEC filings, full-text search",
      href: "/financial-snapshot",
      lane: "aie",
    });
  }

  return signals.slice(0, 3);
}

/**
 * The three executive actions. Derived from the same readings as the
 * scorecard so the brief cannot recommend one thing while the scorecard says
 * another.
 */
// Each action names the tool that does the thing it is asking for. The
// mapping lives beside the advice rather than in the component, so a new
// action cannot be written without someone deciding where it sends the reader.
export function buildActions(
  priceRatio: number | null,
  highRisks: number | null,
  readiness: number | null,
  lastUpdated: string | null
): { action: string; detail: string; tools: ToolKey[]; intent: ActionIntent; meta: { horizon: "Immediate" | "30 days" | "90 days" | "12 months"; lane: "derived"; lastUpdated: string | null } }[] {
  return [
    {
      action: "Tier your model spend",
      // Commercial pressure on an existing commitment, not a change of scope.
      intent: "press",
      detail:
        priceRatio !== null && priceRatio >= 2
          ? `The top model costs ${priceRatio}x the cheapest one reaching 80 per cent of its score. Map workloads to tiers before renewal and reserve the top tier for complex or regulated work.`
          : "Map workloads to model tiers before renewal, and check the price spread against your own token mix rather than list rates.",
      tools: ["modelForRole", "pricePerformance"],
      meta: {
        horizon: "90 days",
        lane: "derived",
        lastUpdated,
      },
    },
    {
      action: "Re-open closed shortlists",
      intent: "select",
      detail:
        "Capability across the tracked set moves faster than most procurement cycles. Any shortlist older than two quarters should be re-checked against current rankings before it is signed.",
      tools: ["workflowShortlist", "competitiveIntel"],
      meta: {
        horizon: "30 days",
        lane: "derived",
        lastUpdated,
      },
    },
    {
      action:
        highRisks !== null && highRisks > 0
          ? "Clear open risks before widening"
          : "Keep governance ahead of rollout",
      // Declared rather than read off the sentence, and this is the one that
      // proves why. "Clear open risks before widening" contains the word
      // widening and asks for the opposite of widening: a classifier reads it
      // as advance, the builder knows it is restraint.
      intent:
        highRisks !== null && highRisks > 0 ? "restrain" : "examine",
      detail:
        highRisks !== null && highRisks > 0
          ? `${highRisks} high-severity ${highRisks === 1 ? "risk is" : "risks are"} open against tracked vendors. Get a dated remediation position on each before expanding scope.`
          : "No high-severity risk is currently open. Keep the review cadence rather than standing it down, since readiness is uneven across the set" +
            (readiness !== null ? ` (typical capability maturity ${readiness}).` : "."),
      tools: ["trustRank", "securityDesk"],
      meta: {
        horizon: highRisks !== null && highRisks > 0 ? "Immediate" : "90 days",
        lane: "derived",
        lastUpdated,
      },
    },
  ];
}

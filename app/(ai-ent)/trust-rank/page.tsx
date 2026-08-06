import { PageHeader } from "@/lib/ui/page";
import {
  loadGrid,
  loadLensVendors,
  loadRegEvents,
  loadGovernancePostures,
} from "./data";
import { TrustRankView } from "./components/trust-rank-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { governanceInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";
import { DailyBrief } from "./components/daily-brief";
import { readWatchState } from "@/lib/changes/watchlist";
// Folded in from /security-desk, 5 August 2026. Security posture and
// regulatory exposure are one question for a buyer , "can I defend this
// choice", and splitting them across two tabs meant a reader answering it
// had to know to visit both.
import { CyberRiskPanel } from "../security-desk/components/cyber-risk-panel";
import { LabsSection } from "../security-desk/components/labs-section";
import { loadLabPostures } from "../security-desk/data";
// Ported from The Security Desk, 5 August 2026. Trust Rank answered what the
// law binds you to and how each vendor's governance is assessed; it did not
// answer the question a buyer asks first, which is what this vendor's own
// contract says it may do with our data. That answer exists, quoted, and now
// sits above the assessment rather than in a second product.
import { PrivacyIpShield } from "./components/privacy-ip-shield";
import { SovereigntyLens } from "./components/sovereignty-lens";
import { SHIELD_VERSION } from "@/lib/shield/data";
import { shieldFreshness } from "@/lib/shield/freshness";
import {
  shieldSlugsOnList,
  unmappedShieldSlugs,
} from "@/lib/shield/vendor-map";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily and
// is fetched at render.
//
// The daily brief reads the reader's watchlist so it can name the obligations
// landing on vendors they actually run, which opts this route into dynamic
// rendering. The `revalidate` this page used to declare would no longer have
// applied, so it is gone rather than left implying a cadence that is not
// happening. analystNews() keeps its own 24-hour cache, so the per-request
// cost is the render and not the pull.

export const metadata = { title: "Trust Rank | AI Enterprise" };

export default async function TrustRankPage() {
  const watch = await readWatchState();
  // One clock reading for the whole render, so every countdown on the page
  // agrees with every other one.
  const asOf = new Date();
  const labs = await loadLabPostures();
  const news = await analystNews();
  const postures = await loadGovernancePostures();
  const m = await loadMarketMetrics();
  const insight = governanceInsight(
    m,
    pickNews(news.items, { categories: ["Regulation", "Enterprise control"] }),
    13,
    5,
    "governance"
  );

  const written = await authorInsight(
    insight,
    "governance",
    m.vendors.slice(0, 12).map((v) => v.name)
  );

  // The Shield's own clock, read against the same `asOf` as every other
  // countdown on the page.
  const freshness = shieldFreshness(SHIELD_VERSION, asOf);
  const shieldOnList = [...shieldSlugsOnList(watch.vendorIds)];

  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="What each vendor's own contract says it may do with your data, quoted from their published terms; whose government can reach it; what AI legislation binds you rather than them; and the evidence-graded governance assessment underneath."
        lanes={["cited", "aie", postures.lane]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="governance"
      />
      {/* The contract question comes before the compliance question. A reader
          asking "can I defend this choice" needs to know what the vendor has
          committed to in writing before they need to know which statute lands
          on them, and until now this page only answered the second. */}
      <div className="mt-4 space-y-4">
        <PrivacyIpShield
          freshness={freshness}
          onList={shieldOnList}
          unmapped={unmappedShieldSlugs()}
        />
        <SovereigntyLens onList={shieldOnList} />
      </div>
      <div className="mt-4">
        <DailyBrief asOf={asOf} watchedVendorIds={watch.vendorIds} />
      </div>
      <div className="mt-4 space-y-4">
        <CyberRiskPanel />
        <LabsSection view={labs} />
      </div>
      <TrustRankView
        vendors={loadLensVendors()}
        grid={loadGrid()}
        events={loadRegEvents()}
        postures={postures}
      />
    </>
  );
}

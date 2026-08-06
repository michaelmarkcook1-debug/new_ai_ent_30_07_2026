import { PageHeader } from "@/lib/ui/page";
import {
  loadGrid,
  loadLensVendors,
  loadRegEvents,
  loadGovernancePostures,
} from "./data";
import { TrustRankView } from "./components/trust-rank-view";
import { DailyBrief } from "./components/daily-brief";
import { TodaysBrief } from "./components/desk/todays-brief";
import { readWatchState } from "@/lib/changes/watchlist";
// Folded in from /security-desk, 5 August 2026. Security posture and
// regulatory exposure are one question for a buyer , "can I defend this
// choice", and splitting them across two tabs meant a reader answering it
// had to know to visit both.
import { CyberRiskPanel } from "../security-desk/components/cyber-risk-panel";
import { LabsSection } from "../security-desk/components/labs-section";
import { loadLabPostures } from "../security-desk/data";

// Everything ported from The Security Desk, 5 to 6 August 2026.
//
// It was briefly spread across six tabs and moved here in one piece the same
// day. Split up it was six additions to six products; together it is a
// product, and it is this one. Trust Rank asks whether a buyer can defend a
// vendor choice, and every part of The Desk answers some piece of that.
//
// The page is four steps rather than one scroll, because it now holds eleven
// substantial panels. See ./components/desk/desk-view.tsx for why, and for
// what each step carries.
import { PrivacyIpShield } from "./components/privacy-ip-shield";
import { SovereigntyLens } from "./components/sovereignty-lens";
import { DeskView } from "./components/desk/desk-view";
import { DeskWire } from "./components/desk/desk-wire";
import { SHIELD, SHIELD_VERSION } from "@/lib/shield/data";
import { shieldFreshness } from "@/lib/shield/freshness";
import {
  shieldSlugsOnList,
  unmappedShieldSlugs,
  vendorIdForSlug,
} from "@/lib/shield/vendor-map";
import { fetchStatuses, STATUS_SOURCE_COUNT } from "@/lib/desk/status";
import { fetchDeskNews } from "@/lib/desk/news";
import { assembleBrief } from "@/lib/desk/brief";
import { buildDossier, type VendorDossier } from "@/lib/desk/dossier";
import { vendorName } from "@/lib/aie/vendor-directory";

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
  const postures = await loadGovernancePostures();


  const freshness = shieldFreshness(SHIELD_VERSION, asOf);
  const shieldOnList = [...shieldSlugsOnList(watch.vendorIds)];

  // Today's spine. Both fetches are safe-fail by construction, so a dark
  // source costs the brief a section rather than costing the reader the page.
  const [statuses, deskNews] = await Promise.all([
    fetchStatuses(),
    fetchDeskNews(8),
  ]);
  const brief = assembleBrief(
    statuses,
    STATUS_SOURCE_COUNT,
    deskNews,
    watch.vendorIds,
    asOf
  );

  // One dossier per Shield vendor the directory also carries. Reka is on the
  // Shield and not in the directory, so it gets none and is simply not
  // offered, which is the honest absence rather than an invented id.
  const dossiers: Record<string, { name: string; dossier: VendorDossier }> = {};
  for (const v of SHIELD) {
    const id = vendorIdForSlug(v.slug);
    if (!id) continue;
    dossiers[id] = { name: vendorName(id), dossier: buildDossier(id, asOf) };
  }

  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="Whether you can defend a vendor choice: what changed overnight, what each vendor's own contract permits with your data, who you may therefore buy from, and what the law puts on you rather than on them."
        lanes={["live", "cited", "aie", postures.lane]}
      />
      {/* Today's brief leads the page. It answers what changed overnight and
          what to do about it, which is what a reader opens Trust Rank for. The
          analyst reading that used to sit here summarised the same governance
          data one level further from the decision. */}
      <TodaysBrief brief={brief} />
      <div className="mt-4">
        <DeskView
          statuses={statuses}
          statusesAttempted={STATUS_SOURCE_COUNT}
          watchedVendorIds={watch.vendorIds}
          wire={<DeskWire />}
          shield={
            <PrivacyIpShield
              freshness={freshness}
              onList={shieldOnList}
              unmapped={unmappedShieldSlugs()}
            />
          }
          sovereignty={<SovereigntyLens onList={shieldOnList} />}
          obligations={
            <DailyBrief asOf={asOf} watchedVendorIds={watch.vendorIds} />
          }
          posture={
            <>
              <CyberRiskPanel />
              <LabsSection view={labs} />
              <TrustRankView
                vendors={loadLensVendors()}
                grid={loadGrid()}
                events={loadRegEvents()}
                postures={postures}
              />
            </>
          }
          dossiers={dossiers}
        />
      </div>
    </>
  );
}

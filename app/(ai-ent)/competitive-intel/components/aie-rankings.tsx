import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import {
  COMPARABILITY_NOTE,
  THIN_CATEGORY_NOTE,
  placeByCategory,
} from "@/lib/comparability";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { AieRankingRow } from "../types";

// AIE vendor rankings block: the seed roster's overall scores with their
// evidence grades, linking through to each vendor's view. Plain
// scored list, no medal or league-table styling.
export function AieRankings({ rows }: { rows: AieRankingRow[] }) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="AIE vendor rankings"
          tooltip="AG's own overall score per vendor from the AI Enterprise intelligence dataset. Investors are excluded."
        />
        <LaneBadge lane="aie" />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        AG's own overall score for each vendor.
        Separate from the live BoardRadar heatmap beside it: the two datasets
        cover different companies on different scales and are never blended.
      </p>
      <p className="mt-1 text-[11px] text-muted">{COMPARABILITY_NOTE}</p>
      <div className="mt-3 space-y-3">
        {placeByCategory(rows, (a: AieRankingRow, b: AieRankingRow) => b.overallScore - a.overallScore).map(
          (group) => (
            <div key={group.category.id}>
              <div className="flex items-baseline justify-between gap-2 border-b border-base-300 pb-1">
                <h4 className="text-[11.5px] font-bold">{group.category.name}</h4>
                <span className="shrink-0 font-mono text-[9px] text-muted">
                  {group.rows.length}
                  {group.thin ? " (thin)" : ""}
                </span>
              </div>
              {group.thin ? (
                <p className="mt-1 text-[10px] text-muted">
                  {THIN_CATEGORY_NOTE}
                </p>
              ) : null}
              <ul className="mt-1.5 space-y-1.5">
                {group.rows.map((r: AieRankingRow) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <Link
                      href={`/vendor-view/${r.id}`}
                      className="min-w-0 truncate text-[12.5px] font-medium hover:text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <ScorePill score={r.overallScore} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>
      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How the AIE vendor scores are derived">
          <p>
            Each overall score (0 to 100) comes straight from the AIE
            intelligence dataset seed, where it is maintained alongside
            per-pillar capability scores and evidence grades.
          </p>
          <p className="text-muted">
            Scores are derived signals, not analyst medals: claims below the
            strong-evidence bar are suppressed in the source dataset rather
            than scored. Follow a vendor link for the pillar
            detail behind its score.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

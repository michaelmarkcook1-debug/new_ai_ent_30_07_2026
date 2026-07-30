"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CategoryChip, LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { EVIDENCE_MODIFIER, PILLARS } from "@/lib/aie/types";
import {
  SCORE_COLUMNS,
  type RankingRow,
  type ScoreSortKey,
} from "../data";

type LayerFilter = "all" | RankingRow["layer"];

const LAYER_CHIPS: { key: LayerFilter; label: string }[] = [
  { key: "all", label: "All layers" },
  { key: "frontier", label: "Frontier" },
  { key: "hyperscaler", label: "Hyperscaler" },
  { key: "enterprise", label: "Enterprise" },
  { key: "application", label: "Application" },
  { key: "infrastructure", label: "Infrastructure" },
];

const PILLAR_LABEL = new Map(PILLARS.map((p) => [p.id as string, p.label]));

function scoreFor(row: RankingRow, key: ScoreSortKey): number | null {
  if (key === "overallScore") return row.overallScore;
  if (key === "confidenceScore") return row.confidenceScore;
  return row.pillars[key]?.score ?? null;
}

function headerHelp(key: ScoreSortKey): string {
  return PILLAR_LABEL.get(key) ?? "Vendor record field";
}

// Rankings surface: a sortable evidence table over the tracked vendor set.
// One named score per column (the dataset's real field names), no medal
// styling, and a plain index instead of any league-table treatment.
export function RankingsTable({
  rows,
  generatedOn,
}: {
  rows: RankingRow[];
  generatedOn: string;
}) {
  const [layer, setLayer] = useState<LayerFilter>("all");
  const [sortBy, setSortBy] = useState<ScoreSortKey>("overallScore");

  const visible = useMemo(() => {
    const filtered =
      layer === "all" ? rows : rows.filter((r) => r.layer === layer);
    return [...filtered].sort(
      (a, b) =>
        (scoreFor(b, sortBy) ?? -1) - (scoreFor(a, sortBy) ?? -1) ||
        a.name.localeCompare(b.name)
    );
  }, [rows, layer, sortBy]);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {LAYER_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setLayer(chip.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                layer === chip.key
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-base-200"
              }`}
            >
              {chip.label}
              <span className="ml-1 font-mono text-[9px] opacity-70">
                {chip.key === "all"
                  ? rows.length
                  : rows.filter((r) => r.layer === chip.key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] text-muted">
            {visible.length} vendors
          </span>
          <LaneBadge lane="aie" />
          <RankingsDerivation />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                #
              </th>
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                Vendor
              </th>
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                Layer
              </th>
              {SCORE_COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSortBy(col.key)}
                    title={`${headerHelp(col.key)}. ${col.help} Click to sort.`}
                    className={`whitespace-nowrap font-mono text-[10px] font-medium tracking-wide ${
                      sortBy === col.key
                        ? "text-primary"
                        : "text-muted hover:text-base-content"
                    }`}
                  >
                    {col.key} {sortBy === col.key ? "↓" : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {visible.map((row, index) => (
              <tr key={row.id} className="transition hover:bg-base-200/60">
                <td className="px-3 py-2 font-mono text-[10px] text-muted">
                  {index + 1}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/vendor-view/${row.id}`}
                    className="text-[12.5px] font-semibold hover:text-primary"
                  >
                    {row.name}
                  </Link>
                  <div className="mt-0.5 text-[10px] text-muted">
                    {row.category}
                    {row.ticker ? (
                      <span className="ml-1 font-mono">{row.ticker}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <CategoryChip label={row.layer} />
                </td>
                {SCORE_COLUMNS.map((col) => {
                  const value = scoreFor(row, col.key);
                  const grade =
                    col.key === "overallScore" || col.key === "confidenceScore"
                      ? null
                      : row.pillars[col.key]?.grade ?? null;
                  return (
                    <td key={col.key} className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <ScorePill score={value} />
                        {grade ? (
                          <span
                            className="font-mono text-[9px] text-muted"
                            title="Evidence grade recorded against this pillar score in the AIE dataset"
                          >
                            {grade}
                          </span>
                        ) : null}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/vendor-view/${row.id}`}
                    className="whitespace-nowrap text-[11px] text-primary hover:underline"
                  >
                    Profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-base-300 px-3 py-2 font-mono text-[10px] text-muted">
        <span className="micro-label mr-2">Generated</span>
        {generatedOn}. Column labels are the dataset&apos;s own field names.
        Values are confidence-labelled analyst estimates from the AI Enterprise
        dataset, not audited market fact.
      </p>
    </section>
  );
}

function RankingsDerivation() {
  return (
    <DerivationDrawer title="How these scores are derived">
      <p>
        Every figure in this table is carried unchanged from the AI Enterprise
        dataset (ported from the ranking-engine repository). Nothing is
        recalculated, reweighted or blended with any other source, and no
        BoardRadar or third-party analyst framework input enters these
        figures.
      </p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <span className="font-mono text-[12px]">overallScore</span>: the
          composite analyst estimate (0 to 100) recorded per vendor in the
          intelligence seed.
        </li>
        <li>
          <span className="font-mono text-[12px]">confidenceScore</span>: the
          analyst confidence attached to that vendor record.
        </li>
        <li>
          Each pillar column is the{" "}
          <span className="font-mono text-[12px]">capabilityScore</span> for
          that pillar from the dataset&apos;s per-vendor pillar scores, shown
          with its evidence grade.
        </li>
      </ul>
      <p>
        The dataset&apos;s own evidence language applies throughout: values are
        confidence-labelled derived signals, each pillar cell carries an
        evidence grade (E1 to E5) and a numeric confidence, and claims below
        the strong-evidence bar are suppressed at source rather than presented
        as verified. Weakly evidenced cells (E1 to E2) are flagged in the
        dataset as needing third-party validation before high-risk rollout.
      </p>
      <div>
        <p className="font-semibold">Evidence grade modifiers (from the dataset)</p>
        <table className="mt-1 w-full text-[12px]">
          <tbody>
            {(Object.entries(EVIDENCE_MODIFIER) as [string, number][]).map(
              ([grade, modifier]) => (
                <tr key={grade} className="border-b border-base-300 last:border-0">
                  <td className="py-1 pr-3 font-mono">{grade}</td>
                  <td className="py-1 font-mono text-muted">{modifier}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted">
        These figures rank evidence, not prestige: there is no quadrant, wave
        or medal treatment anywhere in this module, and the index column is a
        plain position within the current sort.
      </p>
    </DerivationDrawer>
  );
}

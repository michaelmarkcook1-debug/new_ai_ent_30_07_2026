"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { EVIDENCE_MODIFIER, PILLARS } from "@/lib/aie/types";
import {
  COMPARABILITY_NOTE,
  THIN_CATEGORY_NOTE,
  UNPLACED_NOTE,
  categoryNamesForVendor,
  placeByCategory,
  unplaced,
} from "@/lib/comparability";
import {
  SCORE_COLUMNS,
  type RankingRow,
  type ScoreSortKey,
} from "../data";

const PILLAR_LABEL = new Map(PILLARS.map((p) => [p.id as string, p.label]));

function scoreFor(row: RankingRow, key: ScoreSortKey): number | null {
  if (key === "overallScore") return row.overallScore;
  if (key === "confidenceScore") return row.confidenceScore;
  return row.pillars[key]?.score ?? null;
}

function headerHelp(key: ScoreSortKey): string {
  return PILLAR_LABEL.get(key) ?? "Vendor record field";
}

// Rankings surface: an evidence table ranked WITHIN each market category,
// never across one. Sorting reorders vendors inside their own category only,
// so no interaction can produce a cross-category league table.
export function RankingsTable({
  rows,
  generatedOn,
}: {
  rows: RankingRow[];
  generatedOn: string;
}) {
  const [sortBy, setSortBy] = useState<ScoreSortKey>("overallScore");
  const [only, setOnly] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      placeByCategory(rows, (a, b) =>
        (scoreFor(b, sortBy) ?? -1) - (scoreFor(a, sortBy) ?? -1) ||
        a.name.localeCompare(b.name)
      ),
    [rows, sortBy]
  );
  const notPlaced = useMemo(() => unplaced(rows), [rows]);

  const visibleGroups = only
    ? groups.filter((g) => g.category.id === only)
    : groups;

  return (
    <div className="space-y-3">
      {/* Comparability statement, category picker and the ranking basis */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-3xl text-[12px] text-muted">
            <span className="micro-label mr-1.5">Comparability</span>
            {COMPARABILITY_NOTE}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <LaneBadge lane="aie" />
            <RankingsDerivation />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setOnly(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              only === null ? "bg-primary text-white" : "text-muted hover:bg-base-200"
            }`}
          >
            All categories
            <span className="ml-1 font-mono text-[9px] opacity-70">{groups.length}</span>
          </button>
          {groups.map((g) => (
            <button
              key={g.category.id}
              type="button"
              onClick={() => setOnly(only === g.category.id ? null : g.category.id)}
              title={g.category.description}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                only === g.category.id ? "bg-primary text-white" : "text-muted hover:bg-base-200"
              }`}
            >
              {g.category.name}
              
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-base-300 pt-2">
          <span className="micro-label">Rank within category by</span>
          {SCORE_COLUMNS.map((col) => (
            <button
              key={col.key}
              type="button"
              onClick={() => setSortBy(col.key)}
              title={`${headerHelp(col.key)}. ${col.help}`}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition ${
                sortBy === col.key
                  ? "border-primary text-primary"
                  : "border-base-300 text-muted hover:text-base-content"
              }`}
            >
              {col.key}
            </button>
          ))}
        </div>
      </section>

      {/* One ranked block per category */}
      {visibleGroups.map((group) => (
        <Accordion
          key={group.category.id}
          title={group.category.name}
          count={group.rows.length}
          defaultOpen={visibleGroups.length === 1}
        >
        <section className="rounded-lg border-base-300 bg-base-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
            <div className="min-w-0">
              <h3 className="text-[13px] font-bold">{group.category.name}</h3>
              {group.category.description ? (
                <p className="mt-0.5 text-[11px] text-muted">
                  {group.category.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {group.thin ? (
                <span
                  className="rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn"
                  title={THIN_CATEGORY_NOTE}
                >
                  thin category
                </span>
              ) : null}
              <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] text-muted">
                {group.rows.length} vendors
              </span>
            </div>
          </div>

          {group.thin ? (
            <p className="border-b border-base-300 px-3 py-1.5 text-[11px] text-muted">
              {THIN_CATEGORY_NOTE}
            </p>
          ) : null}

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
                  {SCORE_COLUMNS.map((col) => (
                    <th key={col.key} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSortBy(col.key)}
                        title={`${headerHelp(col.key)}. ${col.help} Click to rank this category by it.`}
                        className={`whitespace-nowrap font-mono text-[10px] font-medium tracking-wide ${
                          sortBy === col.key ? "text-primary" : "text-muted hover:text-base-content"
                        }`}
                      >
                        {col.key} {sortBy === col.key ? "\u2193" : ""}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {group.rows.map((row, index) => (
                  <tr key={row.id} className="transition hover:bg-base-200/60">
                    <td className="px-3 py-2 font-mono text-[10px] text-muted">{index + 1}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/vendor-view/${row.id}`}
                        className="text-[12.5px] font-semibold hover:text-primary"
                      >
                        {row.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {row.ticker ? (
                          <span className="font-mono text-[10px] text-muted">
                            {row.ticker}
                          </span>
                        ) : null}
                        {categoryNamesForVendor(row.id).length > 1 ? (
                          <span
                            className="font-mono text-[9px] text-muted"
                            title={`Also competes in: ${categoryNamesForVendor(row.id)
                              .filter((n) => n !== group.category.name)
                              .join(", ")}`}
                          >
                            +{categoryNamesForVendor(row.id).length - 1} other
                            {categoryNamesForVendor(row.id).length - 1 === 1
                              ? " category"
                              : " categories"}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {SCORE_COLUMNS.map((col) => {
                      const value = scoreFor(row, col.key);
                      return (
                        <td key={col.key} className="px-3 py-2">
                          <span className="inline-flex items-center gap-1">
                            <ScorePill score={value} />
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
        </section>
        </Accordion>
      ))}

      {notPlaced.length > 0 && !only ? (
        <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-3">
          <h3 className="text-[12.5px] font-bold">
            Tracked but not placed in a market category ({notPlaced.length})
          </h3>
          <p className="mt-1 max-w-3xl text-[11px] text-muted">{UNPLACED_NOTE}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {notPlaced.map((row) => (
              <Link
                key={row.id}
                href={`/vendor-view/${row.id}`}
                className="rounded-full border border-base-300 px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary"
              >
                {row.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <p className="font-mono text-[10px] text-muted">
        <span className="micro-label mr-2">Generated</span>
        {generatedOn}. Column labels are the dataset&apos;s own field names.
        Values are AG's own estimates from the AI Enterprise
        dataset, not audited market fact.
      </p>
    </div>
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
          Each pillar column is the{" "}
          <span className="font-mono text-[12px]">capabilityScore</span> for
          that pillar from the dataset&apos;s per-vendor pillar scores, shown
          with its evidence grade.
        </li>
      </ul>
      <p>
        The dataset&apos;s own evidence language applies throughout: values are
        derived signals, each pillar cell carries an evidence grade (E1 to
        E5), and claims below
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

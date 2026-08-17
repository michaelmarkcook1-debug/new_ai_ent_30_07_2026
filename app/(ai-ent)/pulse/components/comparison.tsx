"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import {
  COMPARABILITY_NOTE,
  THIN_CATEGORY_NOTE,
  categoriesPresent,
  vendorIdsInCategory,
} from "@/lib/comparability";
import type { CategoryShare, VendorMetrics } from "@/lib/market-metrics";

// Vendor comparison, scoped to one market category at a time (the
// comparability rule: rank within a category, never across one).
//
// Every column is a real field rather than a composite invented here, and the
// column label says which. A vendor the dataset does not reach on a given
// metric shows an empty cell, not a zero and not a midpoint.

type MetricKey =
  | "assessment"
  | "momentum"
  | "maturity"
  | "reputation"
  | "share";

const COLUMNS: {
  key: MetricKey;
  label: string;
  title: string;
}[] = [
  {
    key: "assessment",
    label: "Assessment",
    title:
      "The weighted composite (0 to 5) of evidence-graded assessment domains, with weights specific to this category, as published on the AI Enterprise category ranking. This is the number that ranking sorts on. Each domain's score is capped by its evidence grade, and a vendor under 60% domain coverage is held rather than ranked.",
  },
  {
    key: "momentum",
    label: "Momentum",
    title:
      "market-dashboard agenticMomentum momentumScore, rolling 30 days. Published for a subset of vendors only.",
  },
  {
    key: "maturity",
    label: "Capability maturity",
    title:
      "Mean maturityScore across the vendor's assessed capabilities. Every row carries an evidence grade.",
  },
  {
    key: "reputation",
    label: "Reputation",
    title:
      "Mean of the customer, developer and employee pillar scores. Published for a subset of vendors only.",
  },
  {
    key: "share",
    label: "Category presence",
    title:
      "estimatedShare within the selected category. The source states this is a directional adoption-signal estimate, not measured revenue share.",
  },
];

export function VendorComparisonTable({
  vendors,
  shares,
  primaryId,
  onSelect,
  lane,
  shareMovementPublished,
  composites,
}: {
  vendors: VendorMetrics[];
  shares: CategoryShare[];
  primaryId: string;
  onSelect: (id: string) => void;
  lane: "aie" | "aie-live";
  shareMovementPublished: boolean;
  composites: Record<
    string,
    Record<string, { composite: number; rank: number; position: string | null }>
  >;
  held: Record<string, number>;
}) {
  // Sorted on the assessment, because that is what the AI Enterprise category
  // ranking sorts on. Sorting on overallScore was the reason this table named a
  // different leader from that ranking: both numbers are published, they
  // disagree, and this was quietly showing the one that is not category-aware.
  const [sortBy, setSortBy] = useState<MetricKey>("assessment");

  const categories = useMemo(
    () => categoriesPresent(vendors.map((v) => v.id)),
    [vendors]
  );
  const [categoryId, setCategoryId] = useState<string>(
    () => categoriesPresent(vendors.map((v) => v.id))[0]?.id ?? ""
  );

  // Category presence is only meaningful inside its own category, so it is
  // looked up per selected category rather than summed across them.
  const shareFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shares) {
      if (s.categoryId === categoryId) map.set(s.vendorId, s.estimatedShare);
    }
    return map;
  }, [shares, categoryId]);

  // The assessment is per category, not per vendor: Anthropic scores 3.65 in
  // frontier models and 3.69 as a coding agent, so there is no single value to
  // hang on a vendor row.
  const assessmentFor = useMemo(
    () => composites[categoryId] ?? {},
    [composites, categoryId]
  );

  const rows = useMemo(() => {
    const members = new Set(vendorIdsInCategory(categoryId));
    const inCategory = vendors.filter((v) => members.has(v.id));
    const value = (v: VendorMetrics, k: MetricKey): number | null =>
      k === "share"
        ? (shareFor.get(v.id) ?? null)
        : k === "assessment"
          ? (assessmentFor[v.id]?.composite ?? null)
          : v[k];
    return [...inCategory].sort((a, b) => {
      const av = value(a, sortBy);
      const bv = value(b, sortBy);
      // Vendors with no reading sort last rather than being treated as zero.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [vendors, categoryId, sortBy, shareFor, assessmentFor]);

  const coverage = (k: MetricKey) =>
    rows.filter((v) =>
      k === "share"
        ? shareFor.has(v.id)
        : k === "assessment"
          ? assessmentFor[v.id] !== undefined
          : v[k] !== null
    ).length;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <h2 className="text-base font-bold">Vendor comparison</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs text-muted">
            {rows.length} in category
          </span>
          <LaneBadge lane={lane} />
        </div>
      </div>

      {/* Comparability gate: one market category at a time */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 px-3 py-2.5">
        <span className="micro-label">Comparing within</span>
        <select
          aria-label="Market category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm font-semibold"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="ml-1 measure text-xs text-muted">
          {COMPARABILITY_NOTE}
        </p>
      </div>

      {rows.length < 3 ? (
        <p className="border-b border-base-300 px-3 py-2 text-xs text-muted">
          {THIN_CATEGORY_NOTE}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-muted">
                Vendor
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2.5" title={c.title}>
                  <button
                    type="button"
                    onClick={() => setSortBy(c.key)}
                    className={`font-mono text-xs font-medium uppercase tracking-wider ${
                      sortBy === c.key
                        ? "text-primary"
                        : "text-muted hover:text-base-content"
                    }`}
                  >
                    {c.label} {sortBy === c.key ? "↓" : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {rows.map((v) => {
              const share = shareFor.get(v.id) ?? null;
              return (
                <tr
                  key={v.id}
                  className={`transition hover:bg-base-200/60 ${
                    v.id === primaryId ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSelect(v.id)}
                      className="flex flex-wrap items-center gap-2 text-left text-sm font-semibold hover:text-primary"
                    >
                      {v.name}
                      {v.id === primaryId ? (
                        <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-white">
                          Primary
                        </span>
                      ) : null}
                    </button>
                    {v.marketPosition ? (
                      <div className="text-xs text-muted">
                        {v.marketPosition}
                      </div>
                    ) : null}
                  </td>
                  {/* The assessment, on its own 0 to 5 scale. Deliberately not
                      run through ScorePill, which bands 0 to 100: a 3.65 would
                      read as a failing score against that scale when it is in
                      fact the top of its category. */}
                  <td className="px-3 py-2.5">
                    {assessmentFor[v.id] ? (
                      <span
                        className="font-mono text-sm font-semibold tabular-nums"
                        title={`Rank ${assessmentFor[v.id].rank} of ${rows.length} in this category${assessmentFor[v.id].position ? `, banded ${assessmentFor[v.id].position}` : ""}.`}
                      >
                        {assessmentFor[v.id].composite.toFixed(2)}
                        <span className="ml-0.5 text-xs font-normal text-muted">
                          /5
                        </span>
                      </span>
                    ) : (
                      <span
                        className="font-mono text-xs text-muted"
                        title="Held: under 60% domain coverage, so the assessment withholds a score rather than ranking this vendor on defaults."
                      >
                        held
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {v.momentum === null ? (
                      <span
                        className="font-mono text-xs text-muted"
                        title="No momentum reading published for this vendor."
                      >
                        not published
                      </span>
                    ) : (
                      <ScorePill score={v.momentum} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <ScorePill score={v.maturity} />
                  </td>
                  <td className="px-3 py-2.5">
                    {v.reputation === null ? (
                      <span
                        className="font-mono text-xs text-muted"
                        title="This vendor is not covered by the reputation dataset."
                      >
                        not covered
                      </span>
                    ) : (
                      <ScorePill score={v.reputation} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {share === null ? (
                      <span className="font-mono text-xs text-muted">
                        no estimate
                      </span>
                    ) : (
                      <span className="font-mono text-sm font-semibold">
                        {share.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/vendor-view/${v.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Profile
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-base-300 px-3 py-2.5">
        <DerivationDrawer title="How these columns are derived">
          <p>
            Each column is one named field from the AI Enterprise datasets, not
            a composite built here. Composite is AG&apos;s own{" "}
            <code>overallScore</code> for the vendor. Momentum is the rolling
            30 day{" "}
            <code>momentumScore</code>. Capability maturity is the mean{" "}
            <code>maturityScore</code> across a vendor&apos;s assessed
            capabilities, shown with the weakest evidence grade among them,
            because a mean is only as good as its weakest input. Reputation is
            the mean of the customer, developer and employee pillar scores.
          </p>
          <p>
            Category presence is <code>estimatedShare</code> inside the
            selected category. The source describes it as a directional
            adoption-signal estimate and states plainly that it is not measured
            revenue or market share, so it is labelled presence rather than
            share here.
            {shareMovementPublished
              ? ""
              : " No movement is published against it yet: every prior estimate in the dataset is identical to the current one, so no change figure is shown rather than a misleading flat zero."}
          </p>
          <p className="measure text-muted">
            The count under each column heading is how many vendors in this
            category carry that reading. A vendor the dataset does not reach
            shows what is missing and why, never a zero or a filled-in average.
            Sorting moves rows within the selected category only, so no
            interaction can produce a cross-category league table.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

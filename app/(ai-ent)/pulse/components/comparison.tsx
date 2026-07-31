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

type MetricKey = "composite" | "momentum" | "maturity" | "reputation" | "share";

const COLUMNS: {
  key: MetricKey;
  label: string;
  title: string;
}[] = [
  {
    key: "composite",
    label: "Composite",
    title: "vendors[].overallScore: the AI Enterprise analyst composite, 0 to 100.",
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
}: {
  vendors: VendorMetrics[];
  shares: CategoryShare[];
  primaryId: string;
  onSelect: (id: string) => void;
  lane: "aie" | "aie-live";
  shareMovementPublished: boolean;
}) {
  const [sortBy, setSortBy] = useState<MetricKey>("composite");

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

  const rows = useMemo(() => {
    const members = new Set(vendorIdsInCategory(categoryId));
    const inCategory = vendors.filter((v) => members.has(v.id));
    const value = (v: VendorMetrics, k: MetricKey): number | null =>
      k === "share" ? (shareFor.get(v.id) ?? null) : v[k];
    return [...inCategory].sort((a, b) => {
      const av = value(a, sortBy);
      const bv = value(b, sortBy);
      // Vendors with no reading sort last rather than being treated as zero.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
  }, [vendors, categoryId, sortBy, shareFor]);

  const coverage = (k: MetricKey) =>
    rows.filter((v) =>
      k === "share" ? shareFor.has(v.id) : v[k] !== null
    ).length;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <h2 className="text-[14px] font-bold">Vendor comparison</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] text-muted">
            {rows.length} in category
          </span>
          <LaneBadge lane={lane} />
        </div>
      </div>

      {/* Comparability gate: one market category at a time */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 px-3 py-2">
        <span className="micro-label">Comparing within</span>
        <select
          aria-label="Market category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px] font-semibold"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="ml-1 max-w-2xl text-[11px] text-muted">
          {COMPARABILITY_NOTE}
        </p>
      </div>

      {rows.length < 3 ? (
        <p className="border-b border-base-300 px-3 py-1.5 text-[11px] text-muted">
          {THIN_CATEGORY_NOTE}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                Vendor
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2" title={c.title}>
                  <button
                    type="button"
                    onClick={() => setSortBy(c.key)}
                    className={`font-mono text-[10px] font-medium uppercase tracking-wider ${
                      sortBy === c.key
                        ? "text-primary"
                        : "text-muted hover:text-base-content"
                    }`}
                  >
                    {c.label} {sortBy === c.key ? "↓" : ""}
                  </button>
                  <div className="font-mono text-[8.5px] text-muted">
                    {coverage(c.key)}/{rows.length}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2" />
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
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(v.id)}
                      className="flex flex-wrap items-center gap-2 text-left text-[12.5px] font-semibold hover:text-primary"
                    >
                      {v.name}
                      {v.id === primaryId ? (
                        <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-white">
                          Primary
                        </span>
                      ) : null}
                    </button>
                    {v.marketPosition ? (
                      <div className="text-[10.5px] text-muted">
                        {v.marketPosition}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <ScorePill score={v.composite} />
                    {v.compositeConfidence !== null ? (
                      <div
                        className="font-mono text-[8.5px] text-muted"
                        title="The dataset's own confidence in this composite."
                      >
                        conf {v.compositeConfidence.toFixed(0)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {v.momentum === null ? (
                      <span
                        className="font-mono text-[10px] text-muted"
                        title="No momentum reading published for this vendor."
                      >
                        not published
                      </span>
                    ) : (
                      <ScorePill score={v.momentum} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ScorePill score={v.maturity} />
                    {v.maturityEvidence ? (
                      <div
                        className="font-mono text-[8.5px] text-muted"
                        title={`Weakest evidence grade across ${v.maturityRows} assessed capability rows.`}
                      >
                        {v.maturityEvidence} · {v.maturityRows} rows
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    {v.reputation === null ? (
                      <span
                        className="font-mono text-[10px] text-muted"
                        title="This vendor is not covered by the reputation dataset."
                      >
                        not covered
                      </span>
                    ) : (
                      <ScorePill score={v.reputation} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {share === null ? (
                      <span className="font-mono text-[10px] text-muted">
                        no estimate
                      </span>
                    ) : (
                      <span className="font-mono text-[12px] font-semibold">
                        {share.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/vendor-view/${v.id}`}
                      className="text-[11px] text-primary hover:underline"
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

      <div className="border-t border-base-300 px-3 py-2">
        <DerivationDrawer title="How these columns are derived">
          <p>
            Each column is one named field from the AI Enterprise datasets, not
            a composite built here. Composite is the analyst{" "}
            <code>overallScore</code> with the dataset&apos;s own confidence
            beside it. Momentum is the rolling 30 day{" "}
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
          <p className="text-muted">
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

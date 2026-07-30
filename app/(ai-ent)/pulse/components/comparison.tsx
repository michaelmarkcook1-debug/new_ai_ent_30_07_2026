"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill } from "@/lib/ui/score";
import type { ComparisonRow } from "../types";

type MetricKey = "composite" | "momentum" | "adoption" | "trust" | "delivery";

const METRIC_TABS: { label: string; key: MetricKey | "overview" }[] = [
  { label: "Overview", key: "overview" },
  { label: "Composite", key: "composite" },
  { label: "Momentum", key: "momentum" },
  { label: "Adoption", key: "adoption" },
  { label: "Trust", key: "trust" },
  { label: "Delivery readiness", key: "delivery" },
];

// Comparison table (house idiom): metric tabs across the top, "Primary"
// badge on the focal vendor, companies-count chip, sortable score pills.
export function VendorComparisonTable({
  rows,
  primaryId,
  onSelect,
}: {
  rows: ComparisonRow[];
  primaryId: string;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<MetricKey | "overview">("overview");
  const [sortBy, setSortBy] = useState<MetricKey>("composite");

  const sorted = useMemo(() => {
    const key = tab === "overview" ? sortBy : tab;
    return [...rows].sort((a, b) => b[key] - a[key]);
  }, [rows, tab, sortBy]);

  const visibleMetrics: MetricKey[] =
    tab === "overview" ? ["composite", "momentum", "adoption", "trust", "delivery"] : [tab];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {METRIC_TABS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setTab(m.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                tab === m.key
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-base-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] text-muted">
            {rows.length} companies
          </span>
          <LaneBadge lane="sample" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
                Vendor
              </th>
              {visibleMetrics.map((m) => (
                <th key={m} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setSortBy(m)}
                    className={`font-mono text-[10px] font-medium uppercase tracking-wider ${
                      (tab === "overview" ? sortBy : tab) === m
                        ? "text-primary"
                        : "text-muted hover:text-base-content"
                    }`}
                  >
                    {m === "delivery" ? "Delivery" : m} {"↓"}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {sorted.map((row) => (
              <tr
                key={row.id}
                className={`transition hover:bg-base-200/60 ${row.id === primaryId ? "bg-primary/5" : ""}`}
              >
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className="flex items-center gap-2 text-[12.5px] font-semibold hover:text-primary"
                  >
                    {row.name}
                    {row.id === primaryId ? (
                      <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-white">
                        Primary
                      </span>
                    ) : null}
                  </button>
                </td>
                {visibleMetrics.map((m) => (
                  <td key={m} className="px-3 py-2">
                    <ScorePill score={row[m]} estimated={row.estimated} />
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/vendor-view/${row.id}`}
                    className="text-[11px] text-primary hover:underline"
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
  );
}

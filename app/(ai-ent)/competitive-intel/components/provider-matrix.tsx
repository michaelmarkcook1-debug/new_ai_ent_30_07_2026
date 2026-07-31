"use client";

import { useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { COMPARABILITY_NOTE } from "@/lib/comparability";
import type { ProviderMatrix } from "../provider-matrix-data";

// Competitive dynamics across the model providers: rows are the providers in
// one market category, columns are the ten assessed capabilities, cells are
// evidence-graded maturity.
//
// An intensity grid, not a positioning chart: no axes, no quadrants (spec
// rule 4). Comparison is scoped to one category, because a frontier lab and a
// regulated-industry specialist are not competing on the same yardstick.

// Six bands over the 0 to 100 maturity scale, same visual vocabulary as the
// company heatmap so the two read consistently.
function cellClass(v: number | null): string {
  if (v === null) return "bg-base-200 text-muted";
  if (v >= 80) return "bg-primary/85 text-white";
  if (v >= 68) return "bg-primary/65 text-white";
  if (v >= 56) return "bg-primary/45 text-white";
  if (v >= 44) return "bg-primary/25 text-base-content";
  if (v >= 30) return "bg-primary/10 text-base-content";
  return "bg-base-200 text-muted";
}

const STATUS_HELP: Record<string, string> = {
  verified: "Checked against a primary source.",
  tested: "Tested against public or proxy evidence.",
  documented: "Recorded from vendor documentation.",
  inferred: "Inferred from adjacent signals: the weakest basis here.",
};

export function ProviderCapabilityMatrix({
  matrix,
}: {
  matrix: ProviderMatrix;
}) {
  const [categoryId, setCategoryId] = useState(matrix.categoryId);
  const [focus, setFocus] = useState<{ v: string; c: string } | null>(null);

  // The server rendered one category; switching navigates so the next one is
  // fetched rather than held in the client.
  const active = matrix.categories.find((c) => c.id === categoryId);
  const showing = categoryId === matrix.categoryId;

  const focusCell =
    focus && showing
      ? matrix.rows.find((r) => r.vendorId === focus.v)?.cells[focus.c]
      : null;
  const focusRow = focus
    ? matrix.rows.find((r) => r.vendorId === focus.v)
    : null;
  const focusCap = focus
    ? matrix.capabilities.find((c) => c.id === focus.c)
    : null;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Model provider capability matrix"
              tooltip="Rows are the providers in the selected market category, columns are the ten assessed capabilities, darker means a stronger evidence-graded maturity score."
            />
            <LaneBadge lane={matrix.lane} />
            <span className="font-mono text-[10px] text-muted">
              {matrix.rows.length} providers &times; {matrix.capabilities.length}{" "}
              capabilities
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="micro-label">Category</span>
          <select
            aria-label="Market category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px] font-semibold"
          >
            {matrix.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-1.5 max-w-3xl text-[11px] text-muted">
        {COMPARABILITY_NOTE}
      </p>

      {!showing ? (
        <p className="mt-3 rounded border border-primary/30 bg-primary/5 px-3 py-2 text-[12px]">
          Showing {matrix.categoryName}.{" "}
          <Link
            href={`/competitive-intel?category=${categoryId}`}
            className="font-semibold text-primary hover:underline"
          >
            Load {active?.name ?? "the selected category"}
          </Link>
        </p>
      ) : null}

      {matrix.rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-6 text-[12px] text-muted">
          No provider in this category carries a capability assessment.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-[12px]">
            <thead>
              <tr>
                <th className="min-w-[10rem] py-1 pr-2 text-left align-bottom">
                  <span className="micro-label">Provider</span>
                </th>
                {matrix.capabilities.map((c) => (
                  <th
                    key={c.id}
                    className="px-1 py-1 text-center align-bottom"
                    title={c.description}
                  >
                    <span className="micro-label whitespace-normal leading-tight">
                      {c.name}
                    </span>
                  </th>
                ))}
                <th className="px-1 py-1 text-center align-bottom">
                  <span className="micro-label">Mean</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => (
                <tr key={r.vendorId}>
                  <td className="whitespace-nowrap py-0.5 pr-2">
                    <Link
                      href={`/vendor-view/${r.vendorId}`}
                      className="text-[12.5px] font-semibold hover:text-primary hover:underline"
                    >
                      {r.name}
                    </Link>
                    {r.marketPosition ? (
                      <div className="text-[10px] text-muted">
                        {r.marketPosition}
                      </div>
                    ) : null}
                  </td>
                  {matrix.capabilities.map((c) => {
                    const cell = r.cells[c.id];
                    const v = cell?.maturity ?? null;
                    const on =
                      focus?.v === r.vendorId && focus?.c === c.id;
                    return (
                      <td key={c.id} className="p-0">
                        <button
                          type="button"
                          onClick={() =>
                            setFocus(on ? null : { v: r.vendorId, c: c.id })
                          }
                          className={`flex h-9 w-full min-w-[3.2rem] items-center justify-center rounded font-mono text-[11px] font-semibold transition ${cellClass(v)} ${on ? "ring-2 ring-primary" : ""}`}
                          title={
                            v === null
                              ? `${r.name}: ${c.name} not assessed`
                              : `${r.name}: ${c.name} ${v} of 100 (${cell?.status ?? "no status"}${cell?.evidenceGrade ? `, ${cell.evidenceGrade}` : ""}). Click for the evidence.`
                          }
                        >
                          {v === null ? "–" : Math.round(v)}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-0">
                    <div
                      className="flex h-9 min-w-[3.2rem] items-center justify-center rounded border border-base-300 font-mono text-[11px] font-bold"
                      title={
                        r.weakestGrade
                          ? `Mean over ${r.assessed} assessed capabilities. Weakest evidence grade in the row: ${r.weakestGrade}.`
                          : undefined
                      }
                    >
                      {r.mean === null ? "–" : Math.round(r.mean)}
                    </div>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-muted">Weaker</span>
        {[20, 35, 50, 60, 72, 85].map((v) => (
          <span key={v} className={`h-3.5 w-6 rounded-sm ${cellClass(v)}`} />
        ))}
        <span className="font-mono text-[10px] text-muted">Stronger</span>
        <span className="ml-2 font-mono text-[10px] text-muted">
          0 to 100 maturity &middot; click a cell for its evidence
        </span>
      </div>

      {/* Evidence for the selected cell */}
      {focusCell && focusRow && focusCap ? (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-bold">{focusRow.name}</span>
            <span className="text-[12px] text-muted">{focusCap.name}</span>
            <span className="font-mono text-[12px] font-bold">
              {focusCell.maturity ?? "not assessed"}
            </span>
            <span
              className="font-mono text-[9.5px] uppercase tracking-wider text-muted"
              title={
                focusCell.status
                  ? (STATUS_HELP[focusCell.status] ?? focusCell.status)
                  : undefined
              }
            >
              {focusCell.status ?? "no status"}
              {focusCell.evidenceGrade ? ` · ${focusCell.evidenceGrade}` : ""}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            {focusCell.note ?? "No evidence note is recorded for this cell."}
          </p>
          {focusCell.lastVerified ? (
            <p className="mt-1 font-mono text-[9px] text-muted">
              verified {focusCell.lastVerified.slice(0, 10)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        <DerivationDrawer title="How the matrix is derived">
          <p>
            Every cell is the AI Enterprise capability assessment&apos;s own{" "}
            <code>maturityScore</code> for that provider on that capability, 0
            to 100, carrying the status and evidence grade the dataset assigns
            it. Grades run E1 (strongest) to E5. Clicking a cell shows the
            evidence excerpt behind it, unedited.
          </p>
          <p>
            Rows are the providers the taxonomy places in the selected market
            category, and comparison never crosses a category boundary. The row
            mean is taken over the capabilities that provider is actually
            assessed on, shown with the weakest grade in the row, because a
            mean is only as good as its weakest input.
          </p>
          <p className="text-muted">
            This is an intensity grid, not a positioning chart: no axes, no
            quadrants, no composite ranking of providers against each other. A
            dash is an unassessed capability, not a zero.
            {matrix.unassessed.length > 0
              ? ` In this category but carrying no capability assessment: ${matrix.unassessed.join(", ")}.`
              : ""}
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { CompetitiveIntelFixture } from "../types";

// Cell color depth encodes intensity 0 to 5, using theme tokens only.
const CELL_CLASS: Record<number, string> = {
  0: "bg-base-200 text-muted",
  1: "bg-primary/10 text-base-content",
  2: "bg-primary/25 text-base-content",
  3: "bg-primary/45 text-white",
  4: "bg-primary/65 text-white",
  5: "bg-primary/85 text-white",
};

function cellClass(value: number): string {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return CELL_CLASS[v];
}

// Competitive dynamics heatmap: a color-intensity grid over the sample
// fixture that mirrors the BoardRadar heatmap schema. Rows are vendors,
// columns are the category's metrics, and darker cells mean stronger
// observed signal. Deliberately not a positioning chart: no axes.
export function CompetitiveHeatmap({
  fixture,
}: {
  fixture: CompetitiveIntelFixture;
}) {
  const categoryIds = Object.keys(fixture.metrics);
  const [selected, setSelected] = useState(categoryIds[0] ?? "");
  const meta = fixture.categories[selected];
  const metricNames = fixture.metrics[selected] ?? [];
  const rows = fixture.heatMap[selected] ?? [];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Competitive dynamics heatmap"
          tooltip="Colour-intensity grid over the tracked AI vendors: rows are vendors, columns are the category's signal dimensions, darker means stronger. Values are illustrative samples on the BoardRadar heatmap schema."
        />
        <LaneBadge lane="sample" />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        An intensity grid, not a positioning chart: there are no axes and no
        quadrants. Darker cells mean a stronger observed signal on that
        dimension. All intensities are illustrative samples.
      </p>

      {/* Category tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {categoryIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
              selected === id
                ? "border-primary bg-primary text-white"
                : "border-base-300 bg-base-100 text-base-content/75 hover:border-primary hover:text-primary"
            }`}
          >
            {fixture.categories[id]?.label ?? id}
          </button>
        ))}
      </div>
      {meta ? (
        <p className="mt-1.5 text-[11px] text-muted">{meta.description}</p>
      ) : null}

      {/* The grid */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-[12px]">
          <thead>
            <tr>
              <th className="min-w-[7rem] py-1 pr-2 text-left align-bottom">
                <span className="micro-label">Vendor</span>
              </th>
              {metricNames.map((m) => (
                <th
                  key={m}
                  className="px-1 py-1 text-center align-bottom"
                  title={fixture.metricDescriptions[m] ?? m}
                >
                  <span className="micro-label whitespace-normal leading-tight">
                    {m}
                  </span>
                </th>
              ))}
              <th className="px-1 py-1 text-center align-bottom">
                <span className="micro-label">Avg</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.company}>
                <td className="whitespace-nowrap py-0.5 pr-2 font-medium">
                  {row.displayName}
                  {row.isDisruptor ? (
                    <span
                      className="ml-1 rounded bg-warn-bg px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-warn"
                      title="Flagged as a disruptor in the sample dynamics"
                    >
                      Disruptor
                    </span>
                  ) : null}
                </td>
                {metricNames.map((m) => {
                  const value = row.metrics[m] ?? 0;
                  return (
                    <td key={m} className="p-0">
                      <div
                        className={`flex h-8 min-w-[3rem] items-center justify-center rounded font-mono text-[11px] font-semibold ${cellClass(value)}`}
                        title={`${row.displayName}: ${m} ${value} of 5 (sample)`}
                      >
                        {value}
                      </div>
                    </td>
                  );
                })}
                <td className="p-0">
                  <div className="flex h-8 min-w-[3rem] items-center justify-center rounded border border-base-300 font-mono text-[11px] font-bold">
                    {row.categoryAverage}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend and methodology */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted">Weak 0</span>
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <span key={v} className={`h-3.5 w-3.5 rounded-sm ${cellClass(v)}`} />
          ))}
          <span className="font-mono text-[10px] text-muted">5 Strong</span>
        </div>
        {meta ? (
          <DerivationDrawer title={`How ${meta.label} is derived`}>
            <p>{meta.methodology.summary}</p>
            <p className="text-muted">{meta.methodology.details}</p>
            <p className="text-muted">
              The response shape mirrors the live BoardRadar
              competitive-intelligence heatmap schema; in this module it is
              populated with SAMPLE-badged AI-vendor content, so no cell is a
              measured value.
            </p>
          </DerivationDrawer>
        ) : null}
      </div>

      {/* Momentum index strip from the same fixture */}
      <div className="mt-4 border-t border-base-300 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MicroLabel
              label="Competitive momentum index"
              tooltip="The mean of the three category averages per vendor, on the same 0 to 5 scale. Sample values."
            />
            <LaneBadge lane="sample" />
          </div>
          <DerivationDrawer title="How the momentum index is derived">
            <p>
              Each vendor's competitive momentum index is the mean of its three
              category averages (model capability, enterprise traction and
              ecosystem leverage) on the 0 to 5 intensity scale.
            </p>
            <p className="text-muted">
              Because every underlying intensity is an illustrative sample, the
              index is a sample too. It shows how the live heatmap pattern
              rolls up, not a real market measurement.
            </p>
          </DerivationDrawer>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fixture.rankings.map((r) => (
            <span
              key={r.company}
              className="inline-flex items-center gap-1.5 rounded-full border border-base-300 px-2.5 py-1 text-[11px]"
            >
              {r.displayName}
              <span className="font-mono font-semibold">
                {r.competitiveMomentumIndex}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

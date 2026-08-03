"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { brFetch, type BrSource } from "@/lib/br-client";
import type { CompetitiveIntelFixture } from "../types";

// Competitive dynamics heatmap, live from the BoardRadar
// competitive-intelligence endpoint. Every cell is a measured 0 to 5 signal
// from the API, with the API's own metric descriptions and per-category
// methodology carried through.
//
// Deliberately not a positioning chart: an intensity grid with no axes and no
// quadrants (spec rule 4).

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

// The endpoint resolves exactly two real peer groups, and they are different
// markets. Grouping them in the selector keeps that explicit: an AI platform
// heatmap and an IT-services heatmap answer different questions, and reading
// one as the other is the mistake this grouping exists to prevent.
//
// Anchors that return only themselves are omitted. A one-row grid is not a
// comparison, and offering it invites the reader to treat a single company as
// a competitive set.
const ANCHOR_GROUPS: {
  group: string;
  note: string;
  anchors: { ticker: string; label: string }[];
}[] = [
  {
    group: "AI platforms",
    note: "Hyperscale platform vendors competing on AI capability.",
    anchors: [
      { ticker: "GOOGL", label: "Alphabet" },
      { ticker: "AMZN", label: "Amazon" },
      { ticker: "BABA", label: "Alibaba" },
    ],
  },
  {
    group: "Delivery channel (IT services)",
    note: "Systems integrators that deliver AI, not AI vendors themselves.",
    anchors: [
      { ticker: "ACN", label: "Accenture" },
      { ticker: "IBM", label: "IBM" },
    ],
  },
];

const SERVICES_TICKERS = new Set(["ACN", "IBM"]);

export function CompetitiveHeatmap() {
  const [anchor, setAnchor] = useState("GOOGL");
  const [data, setData] = useState<CompetitiveIntelFixture | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [selected, setSelected] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let live = true;
    setState("loading");
    brFetch<CompetitiveIntelFixture>("competitive-intelligence/heatmap", {
      ticker: anchor,
    }).then((res) => {
      if (!live) return;
      setSource(res.source);
      if (!res.ok || !res.data?.heatMap) {
        setData(null);
        setState("empty");
        return;
      }
      setData(res.data);
      setSelected(Object.keys(res.data.heatMap)[0] ?? "");
      setState("ready");
    });
    return () => {
      live = false;
    };
  }, [anchor]);

  const categoryIds = data ? Object.keys(data.heatMap) : [];
  const meta = data && selected ? data.categories?.[selected] : undefined;
  const metricNames = (data && selected ? data.metrics?.[selected] : []) ?? [];
  const rows = (data && selected ? data.heatMap[selected] : []) ?? [];
  const soloPeerSet = state === "ready" && rows.length <= 1;

  const anchorPicker = (
    <select
      aria-label="Peer group anchor"
      value={anchor}
      onChange={(e) => setAnchor(e.target.value)}
      className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm font-semibold"
    >
      {ANCHOR_GROUPS.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.anchors.map((a) => (
            <option key={a.ticker} value={a.ticker}>
              {a.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  const isChannel = SERVICES_TICKERS.has(anchor);

  return (
    <section
      className={`rounded-lg bg-base-100 p-4 ${
        isChannel ? "delivery-channel-card" : "border border-base-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Competitive dynamics heatmap"
          tooltip="Colour-intensity grid from the BoardRadar competitive-intelligence endpoint: rows are companies in the anchor's peer group, columns are the category's scored dimensions, darker means a stronger observed signal."
        />
        <div className="flex items-center gap-2">
          {anchorPicker}
          <LaneBadge lane={source === "live" ? "live" : "mock"} />
        </div>
      </div>
      <p className="measure mt-1 text-xs text-muted">
        An intensity grid, not a positioning chart: there are no axes and no
        quadrants. Each cell is the endpoint&apos;s own 0 to 5 score for that
        company on that dimension. The peer group is the one the API returns
        for the selected anchor, not a set chosen here.
      </p>
      {isChannel ? (
        <p className="mt-2 rounded border border-warn/40 bg-warn-bg px-2.5 py-2 text-xs text-warn">
          This peer group is the delivery channel: systems integrators that
          implement AI for enterprises, not AI vendors competing on model or
          platform capability. Read it as &quot;who delivers AI well&quot;, not
          &quot;who builds the best AI&quot;. For the AI vendor market, switch
          the anchor to an AI platform or use the rankings beside this panel.
        </p>
      ) : null}

      {state === "loading" ? (
        <p className="mt-4 text-sm text-muted">Loading peer group…</p>
      ) : state === "empty" ? (
        <p className="mt-4 rounded-lg border border-dashed border-base-300 px-3 py-6 text-sm text-muted">
          No competitive analysis is published for this anchor. Awaiting public
          disclosure rather than an estimated grid.
        </p>
      ) : (
        <>
          {/* Category tabs */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categoryIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  selected === id
                    ? "border-primary bg-primary text-white"
                    : "border-base-300 bg-base-100 text-base-content/75 hover:border-primary hover:text-primary"
                }`}
              >
                {data?.categories?.[id]?.label ?? id}
              </button>
            ))}
          </div>
          {meta ? (
            <p className="mt-1.5 text-xs text-muted">{meta.description}</p>
          ) : null}

          {soloPeerSet ? (
            <p className="mt-2 rounded border border-base-300 bg-base-200/60 px-2.5 py-2 text-xs text-muted">
              The API returns no peer group for this anchor, so the grid is a
              single company. Pick another anchor to compare a set.
            </p>
          ) : null}

          {/* The grid */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr>
                  <th className="min-w-[7rem] py-1.5 pr-2 text-left align-bottom">
                    <span className="micro-label">Company</span>
                  </th>
                  {metricNames.map((m) => (
                    <th
                      key={m}
                      className="px-1 py-1.5 text-center align-bottom"
                      title={data?.metricDescriptions?.[m] ?? m}
                    >
                      <span className="micro-label whitespace-normal leading-tight">
                        {m}
                      </span>
                    </th>
                  ))}
                  <th className="px-1 py-1.5 text-center align-bottom">
                    <span className="micro-label">Avg</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.ticker || row.company}>
                    <td className="whitespace-nowrap py-0.5 pr-2 font-medium">
                      {row.displayName}
                      {row.ticker === anchor ? (
                        <span className="ml-1 rounded bg-primary px-1 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-white">
                          Anchor
                        </span>
                      ) : null}
                      {row.isDisruptor ? (
                        <span
                          className="ml-1 rounded bg-warn-bg px-1 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-warn"
                          title="Flagged as a disruptor by the endpoint"
                        >
                          Disruptor
                        </span>
                      ) : null}
                    </td>
                    {metricNames.map((m) => {
                      const value = row.metrics?.[m];
                      if (typeof value !== "number") {
                        return (
                          <td key={m} className="p-0">
                            <div
                              className="flex h-8 min-w-[3rem] items-center justify-center rounded bg-base-200 font-mono text-xs text-muted"
                              title={`${row.displayName}: no score published for ${m}`}
                            >
                              &ndash;
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={m} className="p-0">
                          <div
                            className={`flex h-8 min-w-[3rem] items-center justify-center rounded font-mono text-xs font-semibold ${cellClass(value)}`}
                            title={`${row.displayName}: ${m} ${value} of 5`}
                          >
                            {value}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-0">
                      <div className="flex h-8 min-w-[3rem] items-center justify-center rounded border border-base-300 font-mono text-xs font-bold">
                        {row.categoryAverage ?? "–"}
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
              <span className="font-mono text-xs text-muted">Weak 0</span>
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <span
                  key={v}
                  className={`h-3.5 w-3.5 rounded-sm ${cellClass(v)}`}
                />
              ))}
              <span className="font-mono text-xs text-muted">5 Strong</span>
            </div>
            {meta ? (
              <DerivationDrawer title={`How ${meta.label} is derived`}>
                <p>{meta.methodology?.summary}</p>
                <p className="text-muted">{meta.methodology?.details}</p>
                <p className="measure text-muted">
                  Both paragraphs above are the endpoint&apos;s own methodology
                  text, carried through unchanged. Cells with no published
                  score render as a dash rather than a zero, because zero is a
                  real score on this scale and would misread as weakest.
                  {source === "mock"
                    ? " This view is the recorded response: the live call did not answer."
                    : ""}
                </p>
              </DerivationDrawer>
            ) : null}
          </div>

          {/* Momentum index strip from the same response */}
          {data?.rankings?.length ? (
            <div className="mt-4 border-t border-base-300 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MicroLabel
                    label="Competitive momentum index"
                    tooltip="The endpoint's own competitiveMomentumIndex per company, on the same 0 to 5 scale."
                  />
                  <LaneBadge lane={source === "live" ? "live" : "mock"} />
                </div>
                <DerivationDrawer title="How the momentum index is derived">
                  <p>
                    Each company&apos;s competitive momentum index is the{" "}
                    <code>competitiveMomentumIndex</code> field returned by the
                    endpoint, on the same 0 to 5 intensity scale as the grid. It
                    is not recomputed here.
                  </p>
                  <p className="measure text-muted">
                    Trend is the endpoint&apos;s own <code>trend</code> field.
                    Where it is zero, no movement is published, which is shown
                    as a dash rather than as a flat arrow implying stability.
                  </p>
                </DerivationDrawer>
              </div>
              <ol className="mt-2 space-y-1">
                {data.rankings.map((r) => (
                  <li
                    key={r.ticker || r.company}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="w-5 font-mono text-xs text-muted">
                      {r.rank}
                    </span>
                    <span className="min-w-[9rem] font-medium">
                      {r.displayName}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded bg-base-200">
                      <span
                        className="block h-full rounded bg-primary"
                        style={{
                          width: `${Math.max(0, Math.min(100, ((r.competitiveMomentumIndex ?? 0) / 5) * 100))}%`,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-xs font-semibold">
                      {r.competitiveMomentumIndex ?? "–"}
                    </span>
                    <span
                      className="w-6 text-right font-mono text-xs text-muted"
                      title={
                        r.trend
                          ? `Trend ${r.trend > 0 ? "up" : "down"} ${Math.abs(r.trend)}`
                          : "No movement published"
                      }
                    >
                      {r.trend ? (r.trend > 0 ? `+${r.trend}` : r.trend) : "–"}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import snapshots from "@/fixtures/reputation-snapshots.json";

// Reputation pillar trend, built from dated snapshots of the real scores.
//
// The upstream API publishes current values and no history, so there is no
// past to plot on day one. The answer is not a cleverer derivation, it is
// time: scripts/capture-reputation.mjs appends a dated snapshot on each run
// and the line grows from the first capture.
//
// Below two snapshots this renders the current standing and says plainly that
// tracking has started, rather than drawing a line through a single point or
// back-projecting one from today's figure.

type PillarKey = "overall" | "customer" | "developer" | "employee";

interface SnapVendor {
  vendorId: string;
  customer: number | null;
  developer: number | null;
  employee: number | null;
  overall: number | null;
}
interface Snapshot {
  capturedAt: string;
  sourceAsOf: string | null;
  vendorCount: number;
  vendors: SnapVendor[];
  /** True for illustrative quarters seeded to demonstrate the chart. */
  synthetic?: boolean;
}

const PILLARS: { key: PillarKey; label: string; help: string }[] = [
  { key: "overall", label: "Overall", help: "Mean of the three pillars." },
  { key: "customer", label: "Customer", help: "How buyers rate the vendor." },
  { key: "developer", label: "Developer", help: "How builders rate the vendor." },
  { key: "employee", label: "Employee", help: "How its own staff rate it." },
];

const PALETTE = [
  "#2b50c8", "#e8590c", "#9333ea", "#0891b2", "#be185d",
  "#b45309", "#dc2626", "#7c3aed", "#0369a1", "#64748b",
];

const W = 900;
const H = 340;
const PAD = { top: 18, right: 128, bottom: 38, left: 46 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

// Vendors worth charting by default: the ones a buyer is most likely to be
// comparing. Everything the dataset covers stays available in the legend.
const DEFAULT_VENDORS = [
  "openai", "anthropic", "google", "microsoft", "meta",
  "mistral", "cohere", "aws", "ibm", "deepseek",
];

export function ReputationHistoryChart({
  vendorNames,
}: {
  vendorNames: Record<string, string>;
}) {
  const data = snapshots as {
    source: string;
    provenance: string;
    snapshots: Snapshot[];
    demoQuarters?: number;
  };
  const snaps = data.snapshots ?? [];
  const demoCount = snaps.filter((s) => s.synthetic).length;
  const firstRealIndex = snaps.findIndex((s) => !s.synthetic);
  const latest = snaps[snaps.length - 1];

  const [pillar, setPillar] = useState<PillarKey>("overall");
  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<number | null>(null);

  // Chart the default set, but only those the dataset actually covers.
  const covered = useMemo(() => {
    const ids = new Set(latest?.vendors.map((v) => v.vendorId) ?? []);
    return DEFAULT_VENDORS.filter((id) => ids.has(id));
  }, [latest]);

  const shown = covered.filter((id) => !muted.has(id));

  const valueFor = (snap: Snapshot, id: string): number | null =>
    snap.vendors.find((v) => v.vendorId === id)?.[pillar] ?? null;

  const enoughHistory = snaps.length >= 2;

  const { min, max } = useMemo(() => {
    const vals = snaps.flatMap((s) =>
      shown.map((id) => valueFor(s, id)).filter((n): n is number => n !== null)
    );
    if (!vals.length) return { min: 0, max: 100 };
    const lo = Math.floor(Math.min(...vals) / 5) * 5 - 5;
    const hi = Math.ceil(Math.max(...vals) / 5) * 5 + 5;
    return { min: Math.max(0, lo), max: Math.min(100, hi) };
  }, [snaps, shown, pillar]);

  const x = (i: number) =>
    PAD.left + (snaps.length === 1 ? PW / 2 : (i / (snaps.length - 1)) * PW);
  const y = (v: number) => PAD.top + PH - ((v - min) / (max - min || 1)) * PH;

  const ticks = Array.from({ length: 5 }, (_, i) =>
    Math.round(min + ((max - min) / 4) * i)
  );

  const toggle = (id: string) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === covered.length ? new Set() : next;
    });

  const name = (id: string) => vendorNames[id] ?? id;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Reputation trend"
              tooltip="The real reputation pillar scores, captured on a schedule so a trend accumulates. Nothing is back-projected."
            />
            <LaneBadge lane={demoCount > 0 ? "sample" : "aie-live"} />
            <span className="font-mono text-[10px] text-muted">
              {snaps.length - demoCount} captured
              {demoCount > 0 ? `, ${demoCount} illustrative` : ""}
            </span>
          </div>
          <p className="mt-1 measure text-[11.5px] text-muted">
            The customer, developer and employee pillar scores, tracked over
            time. The source publishes current values only, so this history
            starts at the first capture and grows from there.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PILLARS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPillar(p.key)}
              title={p.help}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                pillar === p.key
                  ? "border-primary bg-primary text-white"
                  : "border-base-300 text-muted hover:border-primary hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend doubles as the filter */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {covered.map((id, i) => (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] transition ${
              muted.has(id) ? "border-base-300 opacity-40" : "border-base-300"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
              aria-hidden
            />
            {name(id)}
          </button>
        ))}
      </div>

      {demoCount > 0 ? (
        <p className="mt-2 rounded border border-warn/40 bg-warn-bg px-2.5 py-1.5 text-[11.5px] text-warn">
          The first {demoCount} quarters are <strong>illustrative sample data,
          invented to demonstrate the trend</strong>. They are drawn dashed and
          are not captured readings. Only{" "}
          {snaps.filter((s) => !s.synthetic).map((s) => s.capturedAt).join(", ")}{" "}
          {snaps.length - demoCount === 1 ? "is a real capture" : "are real captures"}.
        </p>
      ) : null}

      {!enoughHistory ? (
        // One point is not a trend. Show the current standing instead and be
        // explicit that the line begins once a second capture lands.
        <div className="mt-3">
          <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-3 py-2">
            <p className="measure text-[12px]">
              <span className="font-semibold">Tracking has started.</span> One
              snapshot is held, taken {latest?.capturedAt}. A trend line needs
              two, so the current standing is shown below and the line begins at
              the next capture. Nothing here is back-projected from today.
            </p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {shown
              .map((id) => ({ id, v: latest ? valueFor(latest, id) : null }))
              .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
              .map(({ id, v }, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[12.5px]">
                    {name(id)}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-base-200">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${v ?? 0}%`,
                        background: PALETTE[covered.indexOf(id) % PALETTE.length],
                      }}
                    />
                  </span>
                  <span className="w-10 text-right font-mono text-[12px] font-semibold">
                    {v ?? "–"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="mt-2 overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full min-w-[560px]"
              role="img"
              aria-label={`Reputation ${pillar} score across ${snaps.length} captures for ${shown.length} vendors`}
              onMouseLeave={() => setHover(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="var(--ag-base-300)"
                    strokeWidth={1}
                    opacity={0.5}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y(t) + 3.5}
                    textAnchor="end"
                    className="fill-[var(--ag-muted)] font-mono"
                    fontSize={9.5}
                  >
                    {t}
                  </text>
                </g>
              ))}

              {snaps.map((s, i) => (
                <g key={s.capturedAt}>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={PAD.top}
                    y2={PAD.top + PH}
                    stroke="var(--ag-base-300)"
                    strokeWidth={1}
                    opacity={hover === i ? 0.9 : 0.25}
                  />
                  <text
                    x={x(i)}
                    y={PAD.top + PH + 16}
                    textAnchor="middle"
                    className="fill-[var(--ag-muted)] font-mono"
                    fontSize={9.5}
                    fontWeight={hover === i ? 700 : 400}
                  >
                    {s.capturedAt.slice(5)}
                    {s.synthetic ? "*" : ""}
                  </text>
                  <rect
                    x={x(i) - PW / Math.max(1, snaps.length - 1) / 2}
                    y={PAD.top}
                    width={PW / Math.max(1, snaps.length - 1)}
                    height={PH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              ))}

              {shown.map((id) => {
                const colour = PALETTE[covered.indexOf(id) % PALETTE.length];
                const pts = snaps
                  .map((s, i) => {
                    const v = valueFor(s, id);
                    return v === null ? null : `${x(i)},${y(v)}`;
                  })
                  .filter(Boolean)
                  .join(" ");
                const last = valueFor(snaps[snaps.length - 1], id);
                return (
                  <g key={id}>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={colour}
                      strokeWidth={1.9}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={demoCount > 0 ? "5 3" : undefined}
                      opacity={demoCount > 0 ? 0.7 : 1}
                    />
                    {/* The captured stretch is redrawn solid on top, so a real
                        reading is never mistaken for a seeded one. */}
                    {firstRealIndex > 0 ? (
                      <polyline
                        points={snaps
                          .map((sn, i) => {
                            if (i < firstRealIndex - 1) return null;
                            const val = valueFor(sn, id);
                            return val === null ? null : `${x(i)},${y(val)}`;
                          })
                          .filter(Boolean)
                          .join(" ")}
                        fill="none"
                        stroke={colour}
                        strokeWidth={2.4}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}
                    {snaps.map((s, i) => {
                      const v = valueFor(s, id);
                      return v !== null && hover === i ? (
                        <circle
                          key={s.capturedAt}
                          cx={x(i)}
                          cy={y(v)}
                          r={3.4}
                          fill={colour}
                          stroke="var(--ag-base-100)"
                          strokeWidth={1.2}
                        />
                      ) : null;
                    })}
                    {last !== null ? (
                      <text
                        x={W - PAD.right + 6}
                        y={y(last) + 3.5}
                        className="fill-current"
                        fontSize={10}
                        fontWeight={500}
                      >
                        {name(id)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-1 min-h-[32px] rounded border border-base-300 bg-base-200/50 px-3 py-1.5">
            {hover === null ? (
              <p className="text-[11px] text-muted">
                Move over the chart for the reading at each capture.
              </p>
            ) : (
              <p className="measure flex flex-wrap items-center gap-x-3 text-[11.5px]">
                <span className="font-mono font-bold">
                  {snaps[hover].capturedAt}
                </span>
                {shown
                  .map((id) => ({ id, v: valueFor(snaps[hover], id) }))
                  .filter((r) => r.v !== null)
                  .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
                  .slice(0, 6)
                  .map(({ id, v }) => (
                    <span key={id} className="font-mono text-[11px]">
                      {name(id)} <span className="font-bold">{v}</span>
                    </span>
                  ))}
              </p>
            )}
          </div>
        </>
      )}

      <div className="mt-2">
        <DerivationDrawer title="How the trend is built">
          <p>
            Each point is the reputation pillar score exactly as the dataset
            published it on that date. The upstream API carries current values
            and no history, so this file is the history: a capture appends a
            dated snapshot, and the line grows from the first run.
          </p>
          <p>
            Nothing is back-projected. A trend reconstructed from today&apos;s
            score and a momentum figure would look like history and would not
            be, so below two captures the chart shows the current standing and
            says so rather than drawing a line through one point.
          </p>
          {demoCount > 0 ? (
            <p>
              <strong>
                The first {demoCount} quarters on this chart are invented.
              </strong>{" "}
              They were seeded so the trend could be demonstrated before real
              captures accumulate, they are drawn dashed and marked with an
              asterisk on the axis, and they carry the SAMPLE badge. Remove them
              with <code>node scripts/seed-demo-reputation-history.mjs
              --clear</code>. Every other figure in this product is a real
              reading, which is exactly why these are labelled this heavily.
            </p>
          ) : null}
          <p className="text-muted">
            Overall is the mean of the three pillars, taken per vendor over the
            pillars it carries. Source: {data.source}.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

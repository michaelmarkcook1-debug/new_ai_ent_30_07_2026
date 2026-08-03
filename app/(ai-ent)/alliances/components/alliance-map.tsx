"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { AllianceEdgeView } from "../data";

// Alliance topology: who partners with whom across the tracked channel.
//
// A radial layout rather than the bipartite one used by the dependency graph,
// because alliances are a two-sided market read (AI vendors and the partners
// that deliver them) and the ring makes the cross-links legible without
// implying the left-to-right direction the dependency graph carries.
//
// The layout is deterministic: nodes are placed by their position in a sorted
// list, so the same data always draws the same map. No physics, no randomness,
// nothing that would move between renders.

const W = 760;
const H = 620;
const CX = W / 2;
const CY = H / 2 + 6;
const R = 232;
const NODE_R = 7;

/**
 * Quantise a trig-derived coordinate before it reaches an attribute.
 *
 * Math.sin and Math.cos are not required to be correctly rounded, so Node and
 * the browser can disagree in the last bit: the server rendered cy
 * "91.43590127604531" and the client computed 91.43590127604534. React saw two
 * different strings and abandoned hydration for the whole map subtree, which is
 * why the alliance chart logged a hydration mismatch on every load.
 *
 * Three decimals is far below a pixel in a 760-unit viewBox, and it is stable
 * across both engines because the difference is many orders of magnitude
 * smaller than the step.
 */
const q = (n: number): number => Math.round(n * 1000) / 1000;

// Type palette, matching the dependency graph's vocabulary so the two views
// agree on what a partnership and an investment look like.
const TYPE_COLOUR: Record<string, string> = {
  commercial_partnership: "#0b8457",
  investment: "#8b5cf6",
};
const TYPE_LABEL: Record<string, string> = {
  commercial_partnership: "Commercial partnership",
  investment: "Investment",
};

type Side = "vendor" | "partner";

interface Placed {
  id: string;
  label: string;
  side: Side;
  x: number;
  y: number;
  angle: number;
  degree: number;
}

export function AllianceMap({
  edges,
  vendorNodeIds,
  datasetUpdated,
}: {
  edges: AllianceEdgeView[];
  /** Node ids the dataset places on the model and API provider side. */
  vendorNodeIds: string[];
  datasetUpdated: string;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | Side>("all");

  const vendorSet = useMemo(() => new Set(vendorNodeIds), [vendorNodeIds]);

  const { nodes, byId } = useMemo(() => {
    const degree = new Map<string, number>();
    const label = new Map<string, string>();
    for (const e of edges) {
      degree.set(e.fromId, (degree.get(e.fromId) ?? 0) + 1);
      degree.set(e.toId, (degree.get(e.toId) ?? 0) + 1);
      label.set(e.fromId, e.fromLabel);
      label.set(e.toId, e.toLabel);
    }

    const sideOf = (id: string): Side =>
      vendorSet.has(id) ? "vendor" : "partner";

    // Vendors fill the upper half of the ring, partners the lower half, each
    // sorted by connection count so the busiest sit at the top of their arc.
    const groups: Record<Side, string[]> = { vendor: [], partner: [] };
    for (const id of degree.keys()) groups[sideOf(id)].push(id);
    for (const s of ["vendor", "partner"] as Side[]) {
      groups[s].sort(
        (a, b) =>
          (degree.get(b) ?? 0) - (degree.get(a) ?? 0) ||
          (label.get(a) ?? a).localeCompare(label.get(b) ?? b)
      );
    }

    const placed: Placed[] = [];
    const arc = (
      ids: string[],
      startDeg: number,
      endDeg: number,
      side: Side
    ) => {
      const n = ids.length;
      ids.forEach((id, i) => {
        // Half-step inset keeps the first and last node clear of the seam.
        const t = n === 1 ? 0.5 : (i + 0.5) / n;
        const deg = startDeg + (endDeg - startDeg) * t;
        const rad = (deg * Math.PI) / 180;
        placed.push({
          id,
          label: label.get(id) ?? id,
          side,
          x: q(CX + R * Math.cos(rad)),
          y: q(CY + R * Math.sin(rad)),
          angle: deg,
          degree: degree.get(id) ?? 0,
        });
      });
    };
    arc(groups.vendor, -170, -10, "vendor");
    arc(groups.partner, 10, 170, "partner");

    return {
      nodes: placed,
      byId: new Map(placed.map((p) => [p.id, p])),
    };
  }, [edges, vendorSet]);

  const connected = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const e of edges) {
      if (e.fromId === focus) set.add(e.toId);
      if (e.toId === focus) set.add(e.fromId);
    }
    return set;
  }, [focus, edges]);

  const visible = (n: Placed) => show === "all" || n.side === show;
  const shownEdges = edges.filter((e) => {
    const a = byId.get(e.fromId);
    const b = byId.get(e.toId);
    return a && b && visible(a) && visible(b);
  });

  const focusEdges = focus
    ? edges.filter((e) => e.fromId === focus || e.toId === focus)
    : [];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Alliance topology</h2>
            <LaneBadge lane="aie" />
            <span className="font-mono text-[10px] text-muted">
              {shownEdges.length} of {edges.length} edges
            </span>
          </div>
          <p className="mt-1 measure text-[12px] text-muted">
            Who partners with whom across the tracked channel. Model and API
            providers sit on the upper arc, the companies that build on them on
            the lower arc, each ordered by how many alliances it carries. Click
            a node to lock its connections; click again to release.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", "Show all"],
              ["vendor", "AI vendors only"],
              ["partner", "Partners only"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                show === k
                  ? "border-primary bg-primary text-white"
                  : "border-base-300 text-muted hover:border-primary hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
          {focus ? (
            <button
              type="button"
              onClick={() => setFocus(null)}
              className="rounded-full border border-primary px-2.5 py-1 text-[11px] font-semibold text-primary"
            >
              Clear focus
            </button>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-base-300 py-2">
        <span className="micro-label">Legend</span>
        {Object.entries(TYPE_LABEL).map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px]">
            <svg width="20" height="8" aria-hidden>
              <line
                x1="0"
                y1="4"
                x2="20"
                y2="4"
                stroke={TYPE_COLOUR[k]}
                strokeWidth="2.5"
              />
            </svg>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px]">
          <svg width="20" height="8" aria-hidden>
            <line
              x1="0"
              y1="4"
              x2="20"
              y2="4"
              stroke="var(--ag-muted)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          Seed confidence, needs verification
        </span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Model and API provider
        </span>
        <span className="flex items-center gap-1.5 text-[11px]">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ag-channel)]" />
          Partner or integrator
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 @4xl:grid-cols-3">
        <div className="@container @4xl:col-span-2">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label={`Alliance topology: ${edges.length} partnership and investment edges across ${nodes.length} companies`}
          >
            {/* Edges first, so nodes sit above them */}
            {shownEdges.map((e) => {
              const a = byId.get(e.fromId);
              const b = byId.get(e.toId);
              if (!a || !b) return null;
              const dim = connected
                ? !(e.fromId === focus || e.toId === focus)
                : false;
              // Pull the control point toward the centre so chords bow inward
              // instead of crossing as straight lines.
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const cx = mx + (CX - mx) * 0.55;
              const cy = my + (CY - my) * 0.55;
              return (
                <path
                  key={e.id}
                  d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={TYPE_COLOUR[e.type] ?? "var(--ag-muted)"}
                  strokeWidth={0.9 + e.strengthScore * 2.4}
                  strokeDasharray={e.confidence === "seed" ? "4 3" : undefined}
                  opacity={dim ? 0.07 : connected ? 0.85 : 0.5}
                  style={{ transition: "opacity 160ms" }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.filter(visible).map((n) => {
              const dim = connected ? !connected.has(n.id) : false;
              const isFocus = n.id === focus;
              // Labels read outward; flip the ones on the left half so none
              // render upside down.
              const flip = n.angle > 90 || n.angle < -90;
              const lx = q(CX + (R + 14) * Math.cos((n.angle * Math.PI) / 180));
              const ly = q(CY + (R + 14) * Math.sin((n.angle * Math.PI) / 180));
              return (
                <g
                  key={n.id}
                  onClick={() => setFocus(isFocus ? null : n.id)}
                  style={{
                    cursor: "pointer",
                    opacity: dim ? 0.2 : 1,
                    transition: "opacity 160ms",
                  }}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={isFocus ? NODE_R + 2.5 : NODE_R}
                    fill={
                      n.side === "vendor"
                        ? "var(--ag-primary)"
                        : "var(--ag-channel)"
                    }
                    stroke="var(--ag-base-100)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={flip ? "end" : "start"}
                    dominantBaseline="middle"
                    transform={`rotate(${flip ? n.angle + 180 : n.angle} ${lx} ${ly})`}
                    className="fill-current"
                    fontSize={10.5}
                    fontWeight={isFocus ? 700 : 500}
                  >
                    {n.label}
                  </text>
                  {/* One template string, not interleaved nodes: React refuses
                      an array of children on <title> and logs on every render. */}
                  <title>
                    {`${n.label}: ${n.degree} alliance${n.degree === 1 ? "" : "s"}`}
                  </title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Dossier for the focused node */}
        <div className="@container @4xl:col-span-1">
          <MicroLabel
            label={focus ? "Alliance dossier" : "Inspect"}
            tooltip="Click a node on the map to see every alliance it carries, with the dataset's own summary, evidence tier and sources."
          />
          {!focus ? (
            <p className="mt-2 rounded-lg border border-dashed border-base-300 px-3 py-6 text-[11.5px] text-muted">
              Click any company on the map to lock its connections and list its
              alliances here.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-[13px] font-bold">{byId.get(focus)?.label}</p>
              {focusEdges.map((e) => {
                const other = e.fromId === focus ? e.toLabel : e.fromLabel;
                return (
                  <article
                    key={e.id}
                    className="rounded-lg border border-base-300 p-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-white"
                        style={{ background: TYPE_COLOUR[e.type] }}
                      >
                        {TYPE_LABEL[e.type] ?? e.type}
                      </span>
                      <span className="text-[12px] font-semibold">{other}</span>
                    </div>
                    <p className="measure mt-1 text-[11.5px] leading-snug text-muted">
                      {e.summary}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-muted">
                      {e.confidence} evidence
                      {e.estimatedValue ? ` · ${e.estimatedValue}` : ""} ·
                      updated {e.dateUpdated.slice(0, 10)}
                    </p>
                    {e.sourceUrls.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {e.sourceUrls.slice(0, 3).map((u) => {
                          let host = u;
                          try {
                            host = new URL(u).hostname.replace(/^www\./, "");
                          } catch {
                            /* keep the raw string if it will not parse */
                          }
                          return (
                            <a
                              key={u}
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[9px] text-primary hover:underline"
                            >
                              {host}
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 border-t border-base-300 pt-2">
        <DerivationDrawer title="How the topology is drawn">
          <p>
            Every edge is a commercial partnership or investment recorded in the
            AI Enterprise exposure dataset, with its own summary, confidence
            tier and public sources. Line thickness is the dataset&apos;s
            <code> strengthScore</code>; seed-evidence edges render dashed
            because they are recorded but not independently verified.
          </p>
          <p>
            Placement carries no meaning beyond grouping: providers on the
            upper arc, partners on the lower, each ordered by how many alliances
            it carries. The layout is deterministic, so the same data always
            draws the same map. Nothing here is a force simulation, and no
            position implies rank, size or quality.
          </p>
          <p className="measure text-muted">
            An absent edge means the dataset records no public alliance, not
            that none exists. Dataset last updated{" "}
            {datasetUpdated.slice(0, 10)}.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

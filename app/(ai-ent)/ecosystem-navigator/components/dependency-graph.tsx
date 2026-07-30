"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EXPOSURE_EDGES, EXPOSURE_NODES } from "@/lib/aie";
import type { ExposureMapEdge, ExposureMapNode, RelationshipType } from "@/lib/aie";
import { vendorLinkIdForNode } from "../data";

// The dependency graph: who relies on whom for capital, cloud, models and
// silicon. Exposure owners sit on the left, model and API providers on the
// right, and every edge is a publicly sourced relationship from the AIE
// exposure dataset. Hover a node to isolate its dependencies, click to pin
// up to three, and filter by relationship type or confidence.

const REL_LABEL: Record<RelationshipType, string> = {
  investment: "Investment",
  cloud: "Cloud capacity",
  model_hosting: "Model hosting",
  commercial_partnership: "Partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

// Edge colours are categorical, not a good-to-bad scale: they identify the
// kind of dependency, so they deliberately avoid the score bands.
const REL_COLOUR: Record<RelationshipType, string> = {
  investment: "#8b5cf6",
  cloud: "#2b50c8",
  model_hosting: "#0891b2",
  commercial_partnership: "#0b8457",
  supply_chain: "#b45309",
  subsidiary: "#be185d",
};

const REL_ORDER: RelationshipType[] = [
  "investment",
  "cloud",
  "model_hosting",
  "commercial_partnership",
  "supply_chain",
  "subsidiary",
];

const CONFIDENCE_ORDER = ["high", "medium", "seed"] as const;
type Confidence = (typeof CONFIDENCE_ORDER)[number];

const ROW = 34;
const PAD_TOP = 20;
const COL_L = 168;
const COL_R = 612;
const NODE_R = 13;

export function DependencyGraph() {
  const [types, setTypes] = useState<Set<RelationshipType>>(
    () => new Set(REL_ORDER)
  );
  const [confidences, setConfidences] = useState<Set<Confidence>>(
    () => new Set(CONFIDENCE_ORDER)
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);

  const left = useMemo(
    () => EXPOSURE_NODES.filter((n) => n.side === "left"),
    []
  );
  const right = useMemo(
    () => EXPOSURE_NODES.filter((n) => n.side === "right"),
    []
  );

  const visibleEdges = useMemo(
    () =>
      EXPOSURE_EDGES.filter(
        (e) =>
          types.has(e.relationshipType) &&
          confidences.has(e.confidence as Confidence)
      ),
    [types, confidences]
  );

  // Focus set: pinned nodes take precedence, hover is transient.
  const focus = pinned.length > 0 ? pinned : hovered ? [hovered] : [];
  const isFocused = focus.length > 0;

  const focusEdges = useMemo(
    () =>
      visibleEdges.filter(
        (e) => focus.includes(e.sourceId) || focus.includes(e.targetId)
      ),
    [visibleEdges, focus]
  );

  const litNodes = useMemo(() => {
    if (!isFocused) return null;
    const s = new Set(focus);
    for (const e of focusEdges) {
      s.add(e.sourceId);
      s.add(e.targetId);
    }
    return s;
  }, [isFocused, focus, focusEdges]);

  const yOf = (list: ExposureMapNode[], id: string) => {
    const i = list.findIndex((n) => n.id === id);
    return PAD_TOP + i * ROW + NODE_R;
  };

  const height = PAD_TOP * 2 + Math.max(left.length, right.length) * ROW;

  const edgeShown = (e: ExposureMapEdge) =>
    !isFocused || focus.includes(e.sourceId) || focus.includes(e.targetId);

  const togglePin = (id: string) => {
    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const detailEdges = isFocused ? focusEdges : [];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">
              Dependency graph: who relies on whom
            </h2>
            <LaneBadge lane="aie" />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            {EXPOSURE_NODES.length} named entities and {EXPOSURE_EDGES.length}{" "}
            publicly sourced edges. Edges run left to right, from the exposure
            owner to the model or API provider it relies on. Hover a node to
            isolate its dependencies, click to pin up to three, and use the
            filters to narrow by relationship type or confidence.
          </p>
        </div>
        <DerivationDrawer title="How the dependency graph is derived">
          <p>
            Every edge is a documented relationship from the AI Enterprise
            exposure dataset, carried across unchanged with its own confidence
            tier, strength score, last-updated date and public source links.
            Nothing here is inferred by this product: an edge exists only
            where the dataset records one.
          </p>
          <p>
            Line thickness reflects the dataset&apos;s own{" "}
            <code>strengthScore</code> (0 to 1). Colour identifies the kind of
            dependency and is deliberately categorical, not a good-to-bad
            scale. Seed-confidence edges render dashed because the dataset
            flags them as needing independent verification.
          </p>
          <p className="text-muted">
            Positions carry no meaning beyond the left-to-right direction of
            reliance: the vertical order is the dataset&apos;s own node order,
            not a ranking. Absence of an edge means the dataset records no
            public relationship, not that none exists.
          </p>
        </DerivationDrawer>
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-base-300 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <MicroLabel
            label="Relationship"
            tooltip="Kind of dependency recorded on the edge. Colours are categorical."
          />
          {REL_ORDER.map((t) => {
            const on = types.has(t);
            const count = EXPOSURE_EDGES.filter(
              (e) => e.relationshipType === t
            ).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(t)) next.delete(t);
                    else next.add(t);
                    return next.size === 0 ? new Set(REL_ORDER) : next;
                  })
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] transition ${
                  on
                    ? "border-base-300 text-base-content"
                    : "border-base-300 text-muted opacity-45"
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: REL_COLOUR[t] }}
                  aria-hidden
                />
                {REL_LABEL[t]}
                <span className="font-mono text-[9px] text-muted">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MicroLabel
            label="Confidence"
            tooltip="The dataset's own confidence tier per edge. Seed edges need independent verification and render dashed."
          />
          {CONFIDENCE_ORDER.map((c) => {
            const on = confidences.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() =>
                  setConfidences((prev) => {
                    const next = new Set(prev);
                    if (next.has(c)) next.delete(c);
                    else next.add(c);
                    return next.size === 0 ? new Set(CONFIDENCE_ORDER) : next;
                  })
                }
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                  on
                    ? "border-base-300 text-base-content"
                    : "border-base-300 text-muted opacity-45"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
        <span className="font-mono text-[10px] text-muted">
          {visibleEdges.length} of {EXPOSURE_EDGES.length} edges
        </span>
        {pinned.length > 0 ? (
          <button
            type="button"
            onClick={() => setPinned([])}
            className="rounded-full border border-primary px-2 py-0.5 text-[10.5px] font-semibold text-primary"
          >
            Clear {pinned.length} pinned
          </button>
        ) : null}
      </div>

      {/* The graph */}
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 780 ${height}`}
          className="w-full min-w-[680px]"
          role="img"
          aria-label="Dependency graph of exposure owners and model providers"
          onMouseLeave={() => setHovered(null)}
        >
          <text
            x={COL_L}
            y={12}
            textAnchor="middle"
            className="fill-[var(--ag-muted)] font-mono"
            fontSize={9}
          >
            EXPOSURE OWNERS
          </text>
          <text
            x={COL_R}
            y={12}
            textAnchor="middle"
            className="fill-[var(--ag-muted)] font-mono"
            fontSize={9}
          >
            MODEL AND API PROVIDERS
          </text>

          {/* Edges first so nodes sit above them */}
          {visibleEdges.map((e) => {
            const y1 = yOf(left, e.sourceId);
            const y2 = yOf(right, e.targetId);
            if (Number.isNaN(y1) || Number.isNaN(y2)) return null;
            const x1 = COL_L + NODE_R + 42;
            const x2 = COL_R - NODE_R - 42;
            const mid = (x1 + x2) / 2;
            const shown = edgeShown(e);
            return (
              <path
                key={e.id}
                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={REL_COLOUR[e.relationshipType]}
                strokeWidth={0.8 + e.strengthScore * 2.2}
                strokeDasharray={e.confidence === "seed" ? "4 3" : undefined}
                opacity={shown ? (isFocused ? 0.85 : 0.4) : 0.06}
              />
            );
          })}

          {/* Nodes */}
          {[
            { list: left, x: COL_L, anchor: "end" as const, dx: -(NODE_R + 6) },
            { list: right, x: COL_R, anchor: "start" as const, dx: NODE_R + 6 },
          ].map(({ list, x, anchor, dx }) =>
            list.map((n) => {
              const y = yOf(list, n.id);
              const lit = !litNodes || litNodes.has(n.id);
              const isPinned = pinned.includes(n.id);
              return (
                <g
                  key={n.id}
                  opacity={lit ? 1 : 0.2}
                  onMouseEnter={() => setHovered(n.id)}
                  onClick={() => togglePin(n.id)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={NODE_R}
                    fill={n.brandColor}
                    stroke={isPinned ? "var(--ag-primary)" : "var(--ag-base-100)"}
                    strokeWidth={isPinned ? 2.5 : 1.5}
                  />
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={9}
                    fontWeight={700}
                    style={{ pointerEvents: "none" }}
                  >
                    {n.monogram}
                  </text>
                  <text
                    x={x + dx}
                    y={y + 3.5}
                    textAnchor={anchor}
                    className="fill-[var(--ag-base-content)]"
                    fontSize={10.5}
                    fontWeight={isPinned ? 700 : 500}
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label}
                  </text>
                  <title>
                    {n.label}
                    {n.ticker ? ` (${n.ticker})` : ""}: {n.category}
                  </title>
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Detail panel for the focused node or pins */}
      <div className="mt-2 rounded border border-base-300 bg-base-200/50 p-3">
        {!isFocused ? (
          <p className="text-[11.5px] text-muted">
            Hover a node to isolate its dependencies. Click to pin it (up to
            three) and keep its edges in view while you compare.
          </p>
        ) : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="micro-label">
                {pinned.length > 0 ? "Pinned" : "Hovering"}
              </span>
              {focus.map((id) => {
                const node = EXPOSURE_NODES.find((n) => n.id === id);
                const linkId = node ? vendorLinkIdForNode(node.id) : null;
                if (!node) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-base-300 bg-base-100 px-2 py-0.5 text-[11px]"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: node.brandColor }}
                      aria-hidden
                    />
                    {linkId ? (
                      <Link
                        href={`/vendor-view/${linkId}`}
                        className="font-semibold hover:text-primary hover:underline"
                      >
                        {node.label}
                      </Link>
                    ) : (
                      <span className="font-semibold">{node.label}</span>
                    )}
                    <span className="text-muted">{node.category}</span>
                  </span>
                );
              })}
              <span className="font-mono text-[10px] text-muted">
                {detailEdges.length} edge
                {detailEdges.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {detailEdges.map((e) => {
                const src = EXPOSURE_NODES.find((n) => n.id === e.sourceId);
                const tgt = EXPOSURE_NODES.find((n) => n.id === e.targetId);
                return (
                  <li
                    key={e.id}
                    className="rounded border border-base-300 bg-base-100 px-2.5 py-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold">
                        {src?.label}
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-white"
                        style={{ background: REL_COLOUR[e.relationshipType] }}
                      >
                        {REL_LABEL[e.relationshipType]}
                      </span>
                      <span className="text-[11.5px] font-semibold">
                        {tgt?.label}
                      </span>
                      <span
                        className="font-mono text-[9px] uppercase tracking-wider text-muted"
                        title="The dataset's own confidence tier for this edge"
                      >
                        {e.confidence}
                      </span>
                      {e.estimatedValue ? (
                        <span className="font-mono text-[9.5px] text-muted">
                          {e.estimatedValue}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">
                      {e.summary}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] text-muted">
                        updated {e.dateUpdated}
                      </span>
                      {e.sourceUrls.map((u) => {
                        let host = u;
                        try {
                          host = new URL(u).hostname.replace(/^www\./, "");
                        } catch {
                          // keep the raw string when the URL does not parse
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
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

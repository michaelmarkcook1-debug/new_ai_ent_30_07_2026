"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EXPOSURE_EDGES, EXPOSURE_NODES } from "@/lib/aie";
import type { ExposureMapEdge, RelationshipType } from "@/lib/aie";
import { vendorLinkIdForNode } from "../data";

// The dependency graph, mirroring the ranking engine's exposure map.
// Exposure owners sit in the left column, model and API providers in the
// right, and every edge runs left to right from the owner to the provider it
// relies on. Geometry, node treatment, edge curves, arrow markers and the
// interaction model are ported from that implementation: logo discs with a
// monogram fallback beneath, control points on the vertical midline, arrow
// heads per relationship type, thickness bands from the dataset's own
// strengthScore, and dashes for seed confidence.

const REL_LABEL: Record<RelationshipType, string> = {
  investment: "Investment",
  cloud: "Cloud / compute",
  model_hosting: "Model hosting",
  commercial_partnership: "Commercial partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

// Categorical edge palette carried across from the ranking engine so the map
// reads the same: these identify a kind of dependency, not a good-to-bad band.
const REL_COLOUR: Record<RelationshipType, string> = {
  investment: "#eab308",
  cloud: "#06b6d4",
  model_hosting: "#14b8a6",
  commercial_partnership: "#84cc16",
  supply_chain: "#94a3b8",
  subsidiary: "#a855f7",
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

// Geometry from the source implementation.
const COL_L = 230;
const COL_R = 970;
const ROW = 78;
const TOP = 92;
const NODE_R = 26;
const INNER_R = 23;
const MID = 600;
const VIEW_W = 1200;

// Thickness bands from strengthScore, matching the source's 6 / 4.5 / 3 / 1.5.
function widthFor(strength: number): number {
  if (strength >= 0.9) return 6;
  if (strength >= 0.6) return 4.5;
  if (strength >= 0.3) return 3;
  return 1.5;
}

export function DependencyGraph() {
  const [types, setTypes] = useState<Set<RelationshipType>>(
    () => new Set(REL_ORDER)
  );
  const [confidences, setConfidences] = useState<Set<Confidence>>(
    () => new Set(CONFIDENCE_ORDER)
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  // Logos are fetched from a third party, so any of them can fail (blocked
  // network, offline demo, retired service). A failed image is removed rather
  // than left to render a broken-image glyph, which uncovers the monogram
  // drawn beneath it: the graph is fully legible with no logos at all.
  const [logoFailed, setLogoFailed] = useState<Set<string>>(() => new Set());

  const left = useMemo(() => EXPOSURE_NODES.filter((n) => n.side === "left"), []);
  const right = useMemo(() => EXPOSURE_NODES.filter((n) => n.side === "right"), []);

  const posOf = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    left.forEach((n, i) => map.set(n.id, { x: COL_L, y: TOP + i * ROW }));
    right.forEach((n, i) => map.set(n.id, { x: COL_R, y: TOP + i * ROW }));
    return map;
  }, [left, right]);

  const visibleEdges = useMemo(
    () =>
      EXPOSURE_EDGES.filter(
        (e) =>
          types.has(e.relationshipType) &&
          confidences.has(e.confidence as Confidence)
      ),
    [types, confidences]
  );

  // Pinned nodes hold focus; hover is transient and yields to pins.
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

  const height = TOP + Math.max(left.length, right.length) * ROW;

  const togglePin = (id: string) =>
    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });

  const edgeLit = (e: ExposureMapEdge) =>
    !isFocused || focus.includes(e.sourceId) || focus.includes(e.targetId);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">
              AI Ecosystem Navigator: who relies on whom
            </h2>
            <LaneBadge lane="aie" />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            Hover a logo to highlight its dependencies. Click to pin (up to
            three). Filter by relationship type or confidence. Every edge here
            is publicly source-backed: seed-confidence edges render dashed and
            require independent verification.
          </p>
          <p className="mt-1 max-w-3xl text-[11px] text-muted">
            Direction: edges run left to right, from exposure owner to model or
            API provider. Investment and subsidiary indicate ownership or
            control exposure; cloud, hosting, partnership and supply chain
            indicate operational reliance.
          </p>
        </div>
        <DerivationDrawer title="How the dependency graph is derived">
          <p>
            Every edge is a documented relationship from the AI Enterprise
            exposure dataset, carried across unchanged with its own confidence
            tier, strength score, last-updated date and public source links.
            Nothing is inferred here: an edge exists only where the dataset
            records one, and absence means no public relationship is recorded,
            not that none exists.
          </p>
          <p>
            Line thickness is banded from the dataset&apos;s own{" "}
            <code>strengthScore</code>. Colour identifies the kind of
            dependency and is categorical, not a good-to-bad scale. Seed
            edges render dashed because the dataset flags them as needing
            independent verification.
          </p>
          <p className="text-muted">
            Vertical position carries no meaning: it is the dataset&apos;s own
            node order, not a ranking. Only the left-to-right direction is
            meaningful.
          </p>
        </DerivationDrawer>
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-base-300 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <MicroLabel
            label="Relationship"
            tooltip="Kind of dependency recorded on the edge. Colours are categorical, not a scale."
          />
          {REL_ORDER.map((t) => {
            const on = types.has(t);
            const count = EXPOSURE_EDGES.filter((e) => e.relationshipType === t).length;
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
                  on ? "border-base-300 text-base-content" : "border-base-300 text-muted opacity-45"
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
            label="Evidence"
            tooltip="The dataset's own evidence tier per edge. Seed edges render dashed and need independent verification."
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
                  on ? "border-base-300 text-base-content" : "border-base-300 text-muted opacity-45"
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

      {/* The map */}
      <div className="mt-2">
        <svg
          viewBox={`0 0 ${VIEW_W} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="min-h-[460px] cursor-default"
          role="img"
          aria-label="Indirect AI market exposure: who relies on whom"
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            {REL_ORDER.map((t) => (
              <marker
                key={t}
                id={`arrow-${t}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
                markerUnits="userSpaceOnUse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={REL_COLOUR[t]} />
              </marker>
            ))}
            {EXPOSURE_NODES.map((n) => (
              <clipPath key={n.id} id={`clip-${n.id}`}>
                <circle r={INNER_R} />
              </clipPath>
            ))}
          </defs>

          <text
            x={COL_L}
            y={44}
            textAnchor="middle"
            className="fill-[var(--ag-muted)] font-mono"
            fontSize={13}
          >
            EXPOSURE OWNERS
          </text>
          <text
            x={COL_R}
            y={44}
            textAnchor="middle"
            className="fill-[var(--ag-muted)] font-mono"
            fontSize={13}
          >
            MODEL AND API PROVIDERS
          </text>

          {/* Edges, drawn under the nodes */}
          {visibleEdges.map((e) => {
            const a = posOf.get(e.sourceId);
            const b = posOf.get(e.targetId);
            if (!a || !b) return null;
            const x1 = a.x + NODE_R;
            const x2 = b.x - NODE_R - 6;
            const lit = edgeLit(e);
            return (
              <path
                key={e.id}
                d={`M ${x1} ${a.y} C ${MID} ${a.y}, ${MID} ${b.y}, ${x2} ${b.y}`}
                fill="none"
                stroke={REL_COLOUR[e.relationshipType]}
                strokeWidth={widthFor(e.strengthScore)}
                strokeOpacity={lit ? (isFocused ? 0.9 : 0.35) : 0.06}
                strokeDasharray={e.confidence === "seed" ? "6 5" : undefined}
                markerEnd={`url(#arrow-${e.relationshipType})`}
                style={{
                  transition: "stroke-opacity 180ms, stroke-width 180ms",
                  vectorEffect: "non-scaling-stroke",
                }}
              />
            );
          })}

          {/* Nodes: brand ring, white disc, monogram, then the logo clipped
              over it so a failed image load falls back to the monogram. */}
          {EXPOSURE_NODES.map((n) => {
            const p = posOf.get(n.id);
            if (!p) return null;
            const isLeft = n.side === "left";
            const lit = !litNodes || litNodes.has(n.id);
            const isPinned = pinned.includes(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                aria-label={`${n.label} — ${n.category}`}
                onMouseEnter={() => setHovered(n.id)}
                onClick={() => togglePin(n.id)}
                style={{
                  cursor: "pointer",
                  opacity: lit ? 1 : 0.25,
                  transition: "opacity 180ms",
                }}
              >
                <circle
                  r={NODE_R}
                  fill={n.brandColor}
                  stroke={isPinned ? "var(--ag-primary)" : n.brandColor}
                  strokeWidth={isPinned ? 4 : 2.5}
                />
                <circle r={INNER_R} className="fill-base-100" />
                <text
                  textAnchor="middle"
                  dy="5"
                  fill={n.brandColor}
                  fontSize={13}
                  fontWeight={700}
                  style={{ pointerEvents: "none" }}
                >
                  {n.monogram}
                </text>
                {n.logoDomain && !logoFailed.has(n.id) ? (
                  <image
                    href={`/api/logo/${n.logoDomain}`}
                    x={-INNER_R}
                    y={-INNER_R}
                    width={INNER_R * 2}
                    height={INNER_R * 2}
                    clipPath={`url(#clip-${n.id})`}
                    preserveAspectRatio="xMidYMid slice"
                    style={{ pointerEvents: "none" }}
                    onError={() =>
                      setLogoFailed((prev) => {
                        if (prev.has(n.id)) return prev;
                        const next = new Set(prev);
                        next.add(n.id);
                        return next;
                      })
                    }
                  />
                ) : null}
                <text
                  x={isLeft ? -40 : 40}
                  y={4}
                  textAnchor={isLeft ? "end" : "start"}
                  className="fill-current"
                  fontSize={13}
                  fontWeight={isPinned ? 700 : 600}
                  style={{ pointerEvents: "none" }}
                >
                  {n.label}
                </text>
                <text
                  x={isLeft ? -40 : 40}
                  y={20}
                  textAnchor={isLeft ? "end" : "start"}
                  className="fill-[var(--ag-muted)]"
                  fontSize={11}
                  style={{ pointerEvents: "none" }}
                >
                  {n.category}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Dossier for the focused node or pins */}
      <div className="mt-2 rounded border border-base-300 bg-base-200/50 p-3">
        {!isFocused ? (
          <p className="text-[11.5px] text-muted">
            Hover a logo to highlight its dependencies. Click to pin it (up to
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
                if (!node) return null;
                const linkId = vendorLinkIdForNode(node.id);
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
                {focusEdges.length} edge{focusEdges.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {focusEdges.map((e) => {
                const src = EXPOSURE_NODES.find((n) => n.id === e.sourceId);
                const tgt = EXPOSURE_NODES.find((n) => n.id === e.targetId);
                return (
                  <li
                    key={e.id}
                    className="rounded border border-base-300 bg-base-100 px-2.5 py-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold">{src?.label}</span>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-white"
                        style={{ background: REL_COLOUR[e.relationshipType] }}
                      >
                        {REL_LABEL[e.relationshipType]}
                      </span>
                      <span className="text-[11.5px] font-semibold">{tgt?.label}</span>
                      <span
                        className="font-mono text-[9px] uppercase tracking-wider text-muted"
                        title="The dataset's own evidence tier for this edge"
                      >
                        {e.confidence}
                      </span>
                      {e.estimatedValue ? (
                        <span className="font-mono text-[9.5px] text-muted">
                          {e.estimatedValue}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted">{e.summary}</p>
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

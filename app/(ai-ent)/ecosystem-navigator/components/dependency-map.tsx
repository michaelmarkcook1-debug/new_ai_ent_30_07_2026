"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import {
  layerBands,
  edgesForVendor,
  connectedNodeIds,
  nodeById,
  relationshipTypesPresent,
  RELATIONSHIP_LABEL,
  CONFIDENCE_LABEL,
  INVESTOR_BAND,
  EXPOSURE_COUNTS,
  type RelationshipType,
  type ExposureMapEdge,
  type ConfidenceTier,
} from "../data";

const CONFIDENCE_STYLE: Record<ConfidenceTier, string> = {
  high: "bg-good-bg text-good",
  medium: "bg-warn-bg text-warn",
  seed: "bg-base-200 text-muted",
};

function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider ${CONFIDENCE_STYLE[tier]}`}
      title={
        tier === "high"
          ? "Disclosed in filings, press releases or official model catalogues"
          : tier === "medium"
            ? "Publicly stated but with lower disclosure depth"
            : "Plausible but not independently verified: treat as a hypothesis"
      }
    >
      {CONFIDENCE_LABEL[tier]}
    </span>
  );
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function EdgeRow({ edge }: { edge: ExposureMapEdge }) {
  const source = nodeById(edge.sourceId);
  const target = nodeById(edge.targetId);
  const strengthPct = Math.round(edge.strengthScore * 100);
  return (
    <li className="rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold">{source?.label ?? edge.sourceId}</span>
        <span
          className="inline-flex rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-base-content/80"
        >
          {RELATIONSHIP_LABEL[edge.relationshipType]}
        </span>
        <span className="text-[13px] font-semibold">{target?.label ?? edge.targetId}</span>
        <ConfidenceBadge tier={edge.confidence} />
        {edge.estimatedValue ? (
          <span className="font-mono text-[10px] text-muted">{edge.estimatedValue}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[12px] leading-snug text-muted">{edge.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span
          className="flex items-center gap-1.5"
          title="Relationship strength, native to the AIE dataset: 1.0 is strongest"
        >
          <span className="micro-label">Strength</span>
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-base-300">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${strengthPct}%` }}
            />
          </span>
          <span className="font-mono text-[10px] text-muted">{edge.strengthScore.toFixed(2)}</span>
        </span>
        <span className="font-mono text-[10px] text-muted">Updated {edge.dateUpdated}</span>
        {edge.sourceUrls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] text-primary hover:underline"
          >
            {sourceHost(url)}
          </a>
        ))}
      </div>
    </li>
  );
}

// Section (a): the dependency map. Layer bands from the tracked-vendor
// roster; every edge carries its native AIE confidence tier and source URLs.
export function DependencyMap() {
  const bands = useMemo(() => layerBands(), []);
  const typeCounts = useMemo(() => relationshipTypesPresent(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<RelationshipType | null>(null);

  const connected = useMemo(
    () => (selected ? connectedNodeIds(selected) : new Set<string>()),
    [selected]
  );
  const edges = useMemo(() => {
    const base = edgesForVendor(selected);
    return typeFilter ? base.filter((e) => e.relationshipType === typeFilter) : base;
  }, [selected, typeFilter]);

  const selectedNode = selected ? nodeById(selected) : null;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Dependency map: who depends on whom</h2>
        <LaneBadge lane="aie" />
        <DerivationDrawer title="How the dependency map is derived">
          <p>
            The map renders the AIE exposure dataset unchanged: {EXPOSURE_COUNTS.nodes} named
            companies and {EXPOSURE_COUNTS.edges} sourced relationship edges. Every node is a named
            company; vague category buckets are never used.
          </p>
          <p>
            <strong>Strength</strong> is the dataset&apos;s native 0 to 1 relationship score (1.0 is
            strongest, for example a wholly owned subsidiary or a headline multi-billion-dollar
            investment). It is displayed as recorded and never recomputed here.
          </p>
          <p>
            <strong>Confidence tiers</strong> are the dataset&apos;s own labels: HIGH means disclosed
            in SEC filings, press releases or official model catalogues; MEDIUM means publicly
            stated but with lower disclosure depth; SEED means plausible but not independently
            verified and should be treated as a hypothesis. Claims below the strong-evidence bar
            are suppressed rather than shown.
          </p>
          <p>
            Layer bands come from the tracked-vendor roster&apos;s layer taxonomy; nodes outside the
            roster are banded by their own dataset category label. Every edge links to its public
            source.
          </p>
        </DerivationDrawer>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        {EXPOSURE_COUNTS.nodes} named nodes and {EXPOSURE_COUNTS.edges} sourced edges from the AIE
        exposure dataset: investment, cloud, model hosting, partnership, supply chain and
        subsidiary relationships, each with per-edge source attribution.
      </p>

      {/* Vendor selector */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Focus vendor"
          tooltip="Filters the edge list to one vendor and highlights its counterparties in the layer bands."
        />
        <select
          aria-label="Focus vendor"
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value === "" ? null : e.target.value)}
          className="rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
        >
          <option value="">All vendors</option>
          {bands.map((band) => (
            <optgroup key={band.id} label={band.label}>
              {band.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                  {n.ticker ? ` (${n.ticker})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selected ? (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-[11px] text-primary hover:underline"
          >
            Clear focus
          </button>
        ) : null}
      </div>

      {/* Layer bands */}
      <div className="mt-3 space-y-2">
        {bands.map((band) => (
          <div key={band.id} className="rounded-lg border border-base-300 bg-base-100 p-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <MicroLabel label={band.label} tooltip={band.description} />
              <span className="font-mono text-[10px] text-muted">{band.nodes.length} nodes</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {band.nodes.map((n) => {
                const isSelected = selected === n.id;
                const isConnected = selected !== null && connected.has(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelected(isSelected ? null : n.id)}
                    title={n.category}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                      isSelected
                        ? "border-primary bg-primary font-semibold text-white"
                        : isConnected
                          ? "border-primary/60 bg-primary/10 font-medium text-primary"
                          : selected
                            ? "border-base-300 text-muted opacity-60 hover:opacity-100"
                            : "border-base-300 text-base-content/85 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {n.label}
                    {n.ticker ? (
                      <span className={`font-mono text-[9px] ${isSelected ? "text-white/80" : "text-muted"}`}>
                        {n.ticker}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Capital layer: roster investors, no sourced edges in the dataset */}
        <div className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <MicroLabel label={INVESTOR_BAND.label} tooltip={INVESTOR_BAND.description} />
            <span className="font-mono text-[10px] text-muted">
              {INVESTOR_BAND.investors.length} investors
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {INVESTOR_BAND.investors.map((inv) => (
              <span
                key={inv.id}
                className="inline-flex items-center rounded-full border border-base-300 px-2.5 py-1 text-[11.5px] text-muted"
              >
                {inv.name}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">{INVESTOR_BAND.description}</p>
        </div>
      </div>

      {/* Edge-type filter */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <MicroLabel label="Relationship type" tooltip="Filter the edge list by relationship type. Counts cover the whole dataset." />
        <button
          type="button"
          onClick={() => setTypeFilter(null)}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
            typeFilter === null
              ? "border-primary bg-primary/10 font-semibold text-primary"
              : "border-base-300 text-muted hover:border-primary hover:text-primary"
          }`}
        >
          All types
        </button>
        {typeCounts.map(({ type, count }) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter(typeFilter === type ? null : type)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              typeFilter === type
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-base-300 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {RELATIONSHIP_LABEL[type]} <span className="font-mono text-[9px]">{count}</span>
          </button>
        ))}
      </div>

      {/* Edge list */}
      <div className="mt-2">
        <p className="mb-2 font-mono text-[10px] text-muted">
          {edges.length} of {EXPOSURE_COUNTS.edges} edges
          {selectedNode ? ` for ${selectedNode.label}` : ""}
          {typeFilter ? `, type ${RELATIONSHIP_LABEL[typeFilter]}` : ""}
        </p>
        {edges.length === 0 ? (
          <EmptyState
            title="No sourced edges"
            detail={
              selectedNode
                ? `The AIE exposure dataset records no ${
                    typeFilter ? `${RELATIONSHIP_LABEL[typeFilter].toLowerCase()} ` : ""
                  }edges for ${selectedNode.label}. Where a relationship is only indirect, the dataset omits the edge rather than inventing one.`
                : "No edges match this filter."
            }
          />
        ) : (
          <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {edges.map((edge) => (
              <EdgeRow key={edge.id} edge={edge} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

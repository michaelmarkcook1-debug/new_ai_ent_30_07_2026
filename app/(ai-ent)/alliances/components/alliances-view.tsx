"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { AllianceMap } from "./alliance-map";
import { DepthDonut } from "./depth-donut";
import {
  ALLIANCE_TYPE_LABEL,
  type AllianceEdgeView,
  type AlliancesData,
} from "../data";

// Alliances map, rendered as a filterable list: partnership and investment
// edges from the AIE exposure map, each with its native confidence tier,
// value note, date and public sources.

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "bg-good-bg text-good",
  medium: "bg-warn-bg text-warn",
  seed: "bg-base-200 text-muted",
};

const CONFIDENCE_TITLE: Record<string, string> = {
  high: "Native dataset tier: disclosed in SEC filings, press releases or model catalogues that can be independently verified",
  medium: "Native dataset tier: publicly stated but with lower disclosure depth",
  seed: "Native dataset tier: plausible but not independently verified; treat as a hypothesis",
};

function EvidenceBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${CONFIDENCE_STYLE[tier] ?? CONFIDENCE_STYLE.seed}`}
      title={CONFIDENCE_TITLE[tier] ?? tier}
    >
      {tier}
    </span>
  );
}

function TypeChip({ type }: { type: AllianceEdgeView["type"] }) {
  const isInvestment = type === "investment";
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
        isInvestment
          ? "bg-primary/10 text-primary"
          : "border border-base-300 text-muted"
      }`}
    >
      {ALLIANCE_TYPE_LABEL[type]}
    </span>
  );
}

function PartyName({
  label,
  vendorId,
  bold,
}: {
  label: string;
  vendorId: string | null;
  bold?: boolean;
}) {
  const cls = `text-[13px] ${bold ? "font-bold" : "font-semibold"}`;
  if (!vendorId) return <span className={cls}>{label}</span>;
  return (
    <Link href={`/vendor-view/${vendorId}`} className={`${cls} hover:text-primary hover:underline`}>
      {label}
    </Link>
  );
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function EdgeCard({ edge }: { edge: AllianceEdgeView }) {
  return (
    <article className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip type={edge.type} />
        <EvidenceBadge tier={edge.confidence} />
        {edge.estimatedValue ? (
          <span
            className="font-mono text-[10px] text-base-content/80"
            title="Rough size note as recorded in the dataset, not a measured figure"
          >
            {edge.estimatedValue}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-[10px] text-muted">
          Updated {formatDate(edge.dateUpdated)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PartyName label={edge.fromLabel} vendorId={edge.fromVendorId} bold />
        <span className="text-[11px] text-muted">
          {edge.type === "investment" ? "invests in" : "partners with"}
        </span>
        <span aria-hidden className="text-muted">
          &rarr;
        </span>
        <PartyName label={edge.toLabel} vendorId={edge.toVendorId} bold />
      </div>
      <p className="measure mt-1.5 text-[12px] leading-snug text-muted">{edge.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="micro-label">Strength</span>
        <div
          className="h-1.5 w-24 overflow-hidden rounded-full bg-base-200"
          title="Native strength score from the AIE exposure map (1.0 strongest); see the derivation drawer above"
        >
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${Math.round(edge.strengthScore * 100)}%` }}
          />
        </div>
        <span className="font-mono text-[10px] text-muted">{edge.strengthScore.toFixed(2)}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          {edge.sourceUrls.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              {sourceHost(url)}
            </a>
          ))}
        </span>
      </div>
    </article>
  );
}

export function AlliancesView({ data }: { data: AlliancesData }) {
  const [selected, setSelected] = useState<string>("all");

  const visible = useMemo(() => {
    if (selected === "all") return data.edges;
    return data.edges.filter((e) => e.fromId === selected || e.toId === selected);
  }, [data.edges, selected]);

  const groups = useMemo(() => {
    if (selected !== "all") return null;
    const map = new Map<string, { label: string; edges: AllianceEdgeView[] }>();
    for (const edge of visible) {
      const group = map.get(edge.fromId) ?? { label: edge.fromLabel, edges: [] };
      group.edges.push(edge);
      map.set(edge.fromId, group);
    }
    return [...map.values()].sort((a, b) => b.edges.length - a.edges.length);
  }, [selected, visible]);

  const selectedLabel =
    selected === "all"
      ? null
      : data.options.find((o) => o.nodeId === selected)?.label ?? selected;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <section className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
        {(
          [
            ["Alliance edges", data.summary.total, "Partnership plus investment edges in the AIE exposure map"],
            ["Partnerships", data.summary.partnerships, "Edges typed commercial partnership in the dataset"],
            ["Investments", data.summary.investments, "Edges typed investment in the dataset"],
            ["Companies covered", data.summary.vendorsCovered, "Named companies appearing on at least one alliance edge"],
          ] as const
        ).map(([label, value, tooltip]) => (
          <div key={label} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel label={label} tooltip={tooltip} />
              <LaneBadge lane="aie" />
            </div>
            <p className="mt-1 font-mono text-2xl font-bold leading-none">{value}</p>
          </div>
        ))}
      </section>

      {/* Topology map beside the depth distribution */}
      <div className="grid grid-cols-1 gap-4 @6xl:grid-cols-4">
        <div className="@container @6xl:col-span-3">
          <AllianceMap
            edges={data.edges}
            vendorNodeIds={data.vendorNodeIds}
            datasetUpdated={data.datasetUpdatedLatest}
          />
        </div>
        <div className="@container @6xl:col-span-1">
          <DepthDonut edges={data.edges} />
        </div>
      </div>
      <div className="-mt-2 flex flex-wrap items-center gap-3">
        <DerivationDrawer title="How the alliance figures are derived">
          <p>
            The AIE exposure map is a hand-curated, source-backed edge list. This
            page filters it to the two alliance types, partnership and
            investment, and the strip above is a plain count of the filtered
            rows: total edges, edges per type, and distinct companies appearing
            on at least one edge. Nothing is weighted, sampled or estimated.
          </p>
          <p>
            Each edge keeps its native labels: a confidence tier (high means
            disclosed in primary sources such as filings, press releases or
            model catalogues; medium means publicly stated with lower disclosure
            depth; seed means plausible but not independently verified), a rough
            value note where one is recorded, a last-updated date and public
            source URLs. The strength bar is the dataset&apos;s own 0 to 1 strength
            score, where 1.0 is the strongest tie.
          </p>
          <p className="measure text-muted">
            Evidence split in this dataset: {data.summary.byConfidence.high} verified,{" "}
            {data.summary.byConfidence.medium} documented, {data.summary.byConfidence.seed} seed.
            Seed-tier edges should be treated as hypotheses, not confirmed relationships.
          </p>
        </DerivationDrawer>
        <span className="font-mono text-[10px] text-muted">
          Latest edge update in the dataset: {formatDate(data.datasetUpdatedLatest)}
        </span>
      </div>

      {/* Vendor selector */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Filter by company"
            tooltip="Show only the alliance edges a company appears on, on either side of the relationship."
          />
          <select
            aria-label="Filter alliances by company"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
          >
            <option value="all">All companies ({data.summary.total} edges)</option>
            {data.options.map((o) => (
              <option key={o.nodeId} value={o.nodeId}>
                {o.label} ({o.edgeCount})
              </option>
            ))}
          </select>
        </div>

        {selected !== "all" ? (
          <div className="mt-3">
            <h3 className="text-[13px] font-bold">
              {selectedLabel}: {visible.length}{" "}
              {visible.length === 1 ? "alliance edge" : "alliance edges"}
            </h3>
            {visible.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">
                No partnership or investment edges recorded for this company in
                the dataset.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 @2xl:grid-cols-2">
                {visible.map((edge) => (
                  <EdgeCard key={edge.id} edge={edge} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {groups?.map((group) => (
              <div key={group.label}>
                <h3 className="text-[13px] font-bold">
                  {group.label}{" "}
                  <span className="font-normal text-muted">
                    ({group.edges.length} {group.edges.length === 1 ? "edge" : "edges"})
                  </span>
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-3 @2xl:grid-cols-2">
                  {group.edges.map((edge) => (
                    <EdgeCard key={edge.id} edge={edge} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Cross-links */}
      <section className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
        <Link
          href="/ecosystem-navigator"
          className="rounded-lg border border-base-300 bg-base-100 p-4 transition hover:border-primary"
        >
          <span className="micro-label">Delivery channel</span>
          <p className="mt-1 text-[13px] font-semibold">AI Ecosystem Navigator</p>
          <p className="measure mt-0.5 text-[11px] text-muted">
            Integrators and delivery partners are tracked separately in the
            labelled delivery and services channel, not mixed into this map.
          </p>
        </Link>
        <Link
          href="/market-watch"
          className="rounded-lg border border-base-300 bg-base-100 p-4 transition hover:border-primary"
        >
          <span className="micro-label">Related view</span>
          <p className="mt-1 text-[13px] font-semibold">Market Watch</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Dependency concentration by layer, computed from the same exposure
            map, sits on Market Watch.
          </p>
        </Link>
      </section>
    </div>
  );
}

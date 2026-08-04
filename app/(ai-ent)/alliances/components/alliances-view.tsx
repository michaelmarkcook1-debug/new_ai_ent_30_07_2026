"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { AllianceGraph } from "./alliance-graph";
import { AllianceDossiers } from "./dossiers";
import {
  CHANNEL_TIER_LABEL,
  PARTNER_KIND_LABEL,
  type AllianceVenture,
  type ChannelLink,
  type ChannelTier,
} from "@/lib/aie/alliances/seed";

// The AI x GSI Alliance Explorer.
//
// The question this answers is not "who partners with whom" in the abstract.
// It is the delivery question: an enterprise does not buy a frontier model and
// stand it up alone, it buys through an integrator, and which integrator
// carries which vendor decides who actually turns up. That is why the map is
// bipartite (vendors against partners) rather than a general company graph.
//
// Four views on one dataset, because the same 51 links answer four different
// questions: where the topology concentrates (map), what the individual link
// says (directory), how two vendors' channels compare (compare), and how
// thinly the evidence is spread (stats).

type View = "map" | "directory" | "compare" | "stats";
type Category = "all" | "vendors" | "partners";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "map", label: "Map", hint: "The topology, as a force-directed graph" },
  { id: "directory", label: "Directory", hint: "Every link as a sortable list" },
  { id: "compare", label: "Compare", hint: "Two vendors' channels side by side" },
  { id: "stats", label: "Stats", hint: "Coverage and evidence spread" },
];

const TIER_STYLE: Record<ChannelTier, string> = {
  direct_named: "bg-insight-bg text-insight",
  cloud_certified: "bg-base-200 text-muted",
  observed_implementer: "bg-base-200 text-muted",
};

const EVIDENCE_ORDER = [
  "verified",
  "strong",
  "moderate",
  "partial",
  "plausible_unverified",
] as const;

const EVIDENCE_LABEL: Record<string, string> = {
  verified: "Verified",
  strong: "Strong",
  moderate: "Moderate",
  partial: "Partial",
  plausible_unverified: "Plausible, unverified",
};

export function AlliancesView({
  links,
  ventures,
  industries,
}: {
  links: ChannelLink[];
  ventures: AllianceVenture[];
  industries: string[];
}) {
  const [view, setView] = useState<View>("map");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [industry, setIndustry] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      industry ? links.filter((l) => l.industries.includes(industry)) : links,
    [links, industry]
  );

  // Which node ids stay at full strength on the map. Search and the category
  // buttons narrow it; a selected node narrows it to itself and its partners.
  const highlight = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && category === "all" && !selected) return null;
    const keep = new Set<string>();
    if (selected) {
      keep.add(selected);
      for (const l of filtered) {
        const v = `v:${l.vendorId}`;
        const p = `p:${l.partnerId}`;
        if (v === selected) keep.add(p);
        if (p === selected) keep.add(v);
      }
      return keep;
    }
    for (const l of filtered) {
      const v = `v:${l.vendorId}`;
      const p = `p:${l.partnerId}`;
      const vMatch =
        (!q || l.vendorName.toLowerCase().includes(q)) && category !== "partners";
      const pMatch =
        (!q || l.partnerName.toLowerCase().includes(q)) && category !== "vendors";
      if (vMatch) keep.add(v);
      if (pMatch) keep.add(p);
    }
    return keep;
  }, [category, filtered, query, selected]);

  const selectedLinks = useMemo(() => {
    if (!selected) return [];
    const [kind, id] = selected.split(":");
    return filtered.filter((l) =>
      kind === "v" ? l.vendorId === id : l.partnerId === id
    );
  }, [filtered, selected]);

  const selectedName =
    selectedLinks.length > 0
      ? selected?.startsWith("v:")
        ? selectedLinks[0].vendorName
        : selectedLinks[0].partnerName
      : null;

  const partnerCount = new Set(filtered.map((l) => l.partnerId)).size;
  const citedCount =
    filtered.filter((l) => l.spotlight).length + ventures.length;

  return (
    <div className="space-y-4">
      {/* Scope line */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-base-300 bg-base-100 px-5 py-3">
        {[
          ["Cited alliances", citedCount],
          ["Integrators", partnerCount],
          ["Channel links", filtered.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-baseline gap-2">
            <span className="micro-label">{label}</span>
            <span className="font-mono text-base font-bold">{value}</span>
          </div>
        ))}
        <div className="ml-auto">
          <DerivationDrawer title="How to read this map" trigger="How to read this">
            <p>
              The map is bipartite: AI vendors on one side, the firms that
              deliver them on the other. An edge means that partner has a
              publicly evidenced route to market for that vendor, not that the
              two are commercially equivalent.
            </p>
            <p>
              <strong className="text-base-content">Direct named alliance</strong>{" "}
              is a relationship both sides have announced.{" "}
              <strong className="text-base-content">Cloud-certified</strong> and{" "}
              <strong className="text-base-content">observed implementer</strong>{" "}
              are breadth signals: the source calls them directional and
              confidence-tiered, never audited fact, and they are drawn thinner
              for that reason.
            </p>
            <p className="text-muted">
              Node size is the number of links that node carries, so the large
              circles are the busiest channels, not the best ones. Nothing on
              this page ranks a partner.
            </p>
          </DerivationDrawer>
        </div>
      </section>

      {/* View switch */}
      <div className="flex flex-wrap gap-1 rounded-full border border-base-300 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            title={v.hint}
            onClick={() => setView(v.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              view === v.id
                ? "bg-primary text-white"
                : "text-muted hover:text-base-content"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters, shared by every view */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="Controls and filters"
          tooltip="Search and category narrow what is emphasised; industry focus narrows the dataset itself."
        />
        <div className="mt-2 grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="micro-label">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an AI vendor or integrator"
              className="rounded border border-base-300 bg-base-100 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="micro-label">Industry focus</span>
            <select
              value={industry ?? ""}
              onChange={(e) => setIndustry(e.target.value || null)}
              className="rounded border border-base-300 bg-base-100 px-3 py-2 text-sm"
            >
              <option value="">All industries</option>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Show all nodes"],
              ["vendors", "AI vendors only"],
              ["partners", "Integrators only"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                category === id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-base-300 text-muted hover:text-base-content"
              }`}
            >
              {label}
            </button>
          ))}
          {(selected || industry || query || category !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setIndustry(null);
                setQuery("");
                setCategory("all");
              }}
              className="rounded-full border border-base-300 px-3 py-1 text-xs font-semibold text-muted transition hover:text-base-content"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          title="No channel links in this cut"
          detail="No partner in the dataset publishes a route to market for this industry. Nothing is shown rather than widening the filter silently."
        />
      ) : view === "map" ? (
        <section className="rounded-lg border border-base-300 bg-base-100 p-5">
          <Legend />
          <AllianceGraph
            links={filtered}
            highlight={highlight}
            selected={selected}
            onSelect={setSelected}
          />
          {selected && selectedName ? (
            <div className="finding mt-3 rounded-lg p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold">{selectedName}</h3>
                <span className="font-mono text-xs text-muted">
                  {selectedLinks.length} link
                  {selectedLinks.length === 1 ? "" : "s"}
                </span>
              </div>
              <ul className="measure mt-2 space-y-1">
                {selectedLinks.map((l) => (
                  <li key={l.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">
                      {selected.startsWith("v:") ? l.partnerName : l.vendorName}
                    </span>
                    <TierChip tier={l.tier} />
                    <span className="text-xs text-muted">
                      {EVIDENCE_LABEL[l.evidence]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : view === "directory" ? (
        <Directory links={filtered} />
      ) : view === "compare" ? (
        <Compare links={filtered} />
      ) : (
        <Stats links={filtered} />
      )}

      <AllianceDossiers links={filtered} ventures={ventures} />
    </div>
  );
}

function TierChip({ tier }: { tier: ChannelTier }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${TIER_STYLE[tier]}`}
    >
      {tier === "direct_named" ? "Named" : tier === "cloud_certified" ? "Certified" : "Observed"}
    </span>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-base-300 pb-3 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-[var(--ag-insight)]" />
        AI vendors
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-[var(--ag-channel)]" />
        Integrators and consultancies
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-[var(--ag-primary)]" />
        Platform hybrid (owns a rival platform)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-5 bg-[var(--ag-insight)]" />
        Direct named alliance
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-5 bg-muted" />
        Certified or observed link
      </span>
    </div>
  );
}

function Directory({ links }: { links: ChannelLink[] }) {
  const sorted = useMemo(
    () =>
      [...links].sort(
        (a, b) =>
          a.partnerName.localeCompare(b.partnerName) ||
          a.vendorName.localeCompare(b.vendorName)
      ),
    [links]
  );
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <MicroLabel
        label="Channel directory"
        tooltip="Every link in the current cut, as text. This is the accessible equivalent of the map."
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-base-300">
              {["Partner", "Kind", "AI vendor", "Tier", "Evidence", "Industries"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 font-mono text-xs font-medium uppercase tracking-wider text-muted"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {sorted.map((l) => (
              <tr key={l.key} className="hover:bg-base-200/50">
                <td className="px-3 py-2.5 font-semibold">{l.partnerName}</td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {PARTNER_KIND_LABEL[l.partnerKind]}
                </td>
                <td className="px-3 py-2.5">{l.vendorName}</td>
                <td className="px-3 py-2.5">
                  <TierChip tier={l.tier} />
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {EVIDENCE_LABEL[l.evidence]}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {l.industries.length > 0 ? l.industries.join(", ") : "not stated"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Compare({ links }: { links: ChannelLink[] }) {
  const vendors = useMemo(
    () =>
      [...new Map(links.map((l) => [l.vendorId, l.vendorName])).entries()].sort(
        (a, b) => a[1].localeCompare(b[1])
      ),
    [links]
  );
  const [left, setLeft] = useState(vendors[0]?.[0] ?? "");
  const [right, setRight] = useState(vendors[1]?.[0] ?? "");

  const partnersOf = (id: string) =>
    new Set(links.filter((l) => l.vendorId === id).map((l) => l.partnerName));
  const a = partnersOf(left);
  const b = partnersOf(right);
  const both = [...a].filter((p) => b.has(p)).sort();
  const onlyA = [...a].filter((p) => !b.has(p)).sort();
  const onlyB = [...b].filter((p) => !a.has(p)).sort();

  const nameOf = (id: string) => vendors.find((v) => v[0] === id)?.[1] ?? id;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <MicroLabel
        label="Compare channels"
        tooltip="Which delivery partners two vendors share, and where each is alone."
      />
      <div className="mt-2 grid grid-cols-1 gap-3 @xl:grid-cols-2">
        {[
          [left, setLeft] as const,
          [right, setRight] as const,
        ].map(([value, set], i) => (
          <select
            key={i}
            value={value}
            onChange={(e) => set(e.target.value)}
            className="rounded border border-base-300 bg-base-100 px-3 py-2 text-sm"
          >
            {vendors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        <Column title={`${nameOf(left)} only`} items={onlyA} />
        <Column title="Shared" items={both} emphasis />
        <Column title={`${nameOf(right)} only`} items={onlyB} />
      </div>
      <p className="measure mt-3 text-xs text-muted">
        A shared partner is not a tie-break: the same firm can carry two vendors
        with very different depth. Read the tier and the dossier before treating
        an overlap as equivalence.
      </p>
    </section>
  );
}

function Column({
  title,
  items,
  emphasis = false,
}: {
  title: string;
  items: string[];
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 ${emphasis ? "finding" : "border border-base-300"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="micro-label">{title}</span>
        <span className="font-mono text-sm font-bold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">None in this cut.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stats({ links }: { links: ChannelLink[] }) {
  const byVendor = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.vendorName, (m.get(l.vendorName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [links]);

  const byEvidence = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.evidence, (m.get(l.evidence) ?? 0) + 1);
    return EVIDENCE_ORDER.map((e) => [e, m.get(e) ?? 0] as const).filter(
      ([, n]) => n > 0
    );
  }, [links]);

  const named = links.filter((l) => l.tier === "direct_named").length;
  const max = byVendor[0]?.[1] ?? 1;

  return (
    <section className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      <div className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="Channel breadth by vendor"
          tooltip="How many delivery partners each vendor has in this cut. Breadth, not quality."
        />
        <ul className="mt-3 space-y-2">
          {byVendor.map(([name, n]) => (
            <li key={name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-semibold">{name}</span>
              <span className="h-2.5 flex-1 rounded-full bg-base-200">
                <span
                  className="block h-2.5 rounded-full bg-[var(--ag-insight)]"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </span>
              <span className="w-6 text-right font-mono text-sm font-bold">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="What the evidence rests on"
          tooltip="The source's own evidence grade for each link."
        />
        <ul className="mt-3 space-y-2">
          {byEvidence.map(([e, n]) => (
            <li key={e} className="flex items-center justify-between gap-3 text-sm">
              <span>{EVIDENCE_LABEL[e]}</span>
              <span className="font-mono font-bold">{n}</span>
            </li>
          ))}
        </ul>
        <p className="measure mt-3 border-t border-base-300 pt-3 text-xs text-muted">
          {named} of {links.length} links are alliances both sides have named.
          The rest are breadth signals the source publishes as directional, and
          they should not be read as contracts.
        </p>
      </div>
    </section>
  );
}

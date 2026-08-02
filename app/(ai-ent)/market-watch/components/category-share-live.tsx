"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  aieFetch,
  type AieMarketShareEstimate,
  type AieSource,
} from "@/lib/aie-live";
import { formatDate, type CategoryShareView, type ShareLookups } from "../data";

// "The market by category", now sourced live from the deployed AIE app's
// market-share API (directional, confidence-labelled estimates, dated as of
// today). The ported seed remains the explicit fallback when the pull fails.

function DeltaArrow({ changePct }: { changePct: number }) {
  const colour =
    changePct > 0 ? "text-good" : changePct < 0 ? "text-error" : "text-muted";
  const glyph = changePct > 0 ? "▲" : changePct < 0 ? "▼" : "▬";
  return (
    <span
      className={`font-mono text-[10px] ${colour}`}
      title="Change versus the engine's previous estimate for this vendor, in per cent"
    >
      {glyph} {changePct > 0 ? "+" : ""}
      {changePct}%
    </span>
  );
}

function VendorName({
  vendorId,
  name,
  tracked,
}: {
  vendorId: string;
  name: string;
  tracked: boolean;
}) {
  if (!tracked) return <span className="text-[12px] font-medium">{name}</span>;
  return (
    <Link
      href={`/vendor-view/${vendorId}`}
      className="text-[12px] font-medium hover:text-primary hover:underline"
    >
      {name}
    </Link>
  );
}

// Thirteen category cards opening at once was the densest block on the page
// and the hardest to scan. They are grouped into the five layers a buyer
// actually shops in, and each layer opens closed.
//
// Grouping is by where a category sits in the stack, not by score, so it stays
// stable as vendors move. A category the map does not name falls into "Other
// categories" rather than being dropped.
const LAYERS: { id: string; label: string; blurb: string; match: string[] }[] = [
  {
    id: "models",
    label: "Models and reasoning",
    blurb: "The models themselves, and the coding agents built directly on them.",
    match: ["Frontier model/API", "Developer/coding agent"],
  },
  {
    id: "compute",
    label: "Compute and silicon",
    blurb: "Where the models actually run, and the hardware underneath.",
    match: ["AI cloud & compute", "AI silicon / acceleration", "Neocloud & inference"],
  },
  {
    id: "platform",
    label: "Platforms",
    blurb: "The build-and-operate layer: cloud AI platforms and agent platforms.",
    match: ["Cloud AI platform", "Agent platform"],
  },
  {
    id: "apps",
    label: "Enterprise applications",
    blurb: "Bought as finished software rather than assembled.",
    match: [
      "Enterprise assistant",
      "CRM/customer AI",
      "ITSM/HR/service AI",
      "Workflow automation AI",
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge and regulated work",
    blurb: "Retrieval over your own material, and the regulated verticals.",
    match: ["RAG/enterprise search", "Regulated-industry AI"],
  },
];

function groupCategories(categories: CategoryShareView[]) {
  const taken = new Set<string>();
  const groups = LAYERS.map((layer) => {
    const members = categories.filter((c) => layer.match.includes(c.name));
    members.forEach((c) => taken.add(c.id));
    return { ...layer, members };
  }).filter((g) => g.members.length > 0);

  const rest = categories.filter((c) => !taken.has(c.id));
  if (rest.length > 0) {
    groups.push({
      id: "other",
      label: "Other categories",
      blurb: "Categories outside the five layers above.",
      match: [],
      members: rest,
    });
  }
  return groups;
}

function ShareCards({ categories }: { categories: CategoryShareView[] }) {
  const groups = groupCategories(categories);
  return (
    <div className="mt-3 space-y-2">
      {groups.map((g) => (
        <Accordion key={g.id} title={g.label} count={g.members.length}>
          <p className="mb-2 text-[12px] text-muted">{g.blurb}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.members.map((cat) => (
        <div key={cat.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
          <h3 className="text-[13px] font-bold">{cat.name}</h3>
          {cat.description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{cat.description}</p>
          ) : null}
          <div className="mt-3 space-y-2">
            {cat.rows.map((row) => (
              <div key={row.vendorId}>
                <div className="flex items-baseline justify-between gap-2">
                  <VendorName
                    vendorId={row.vendorId}
                    name={row.vendorName}
                    tracked={row.tracked}
                  />
                  <div className="flex items-baseline gap-2">
                    <DeltaArrow changePct={row.changePct} />
                    <span className="font-mono text-[11px] font-semibold">
                      {row.share}%
                      <span className="ml-0.5 font-normal text-muted">est.</span>
                    </span>
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.min(100, row.share)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-base-300/60 pt-2 text-[10px] text-muted">
            Named vendors cover {cat.namedShareTotal} per cent of this category
            in the model; the rest is not modelled.
          </p>
        </div>
            ))}
          </div>
        </Accordion>
      ))}
    </div>
  );
}

export function CategoryShareLive({
  fallback,
  lookups,
}: {
  fallback: CategoryShareView[];
  lookups: ShareLookups;
}) {
  const [payload, setPayload] = useState<{
    estimates: AieMarketShareEstimate[];
    asOf: string;
    provenance: string;
  } | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    aieFetch<{ estimates: AieMarketShareEstimate[]; asOf: string; provenance: string }>(
      "market-share"
    ).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.estimates) setPayload(res.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveView = useMemo<CategoryShareView[] | null>(() => {
    if (!payload) return null;
    const catMeta = new Map(lookups.categories.map((c) => [c.id, c]));
    const tracked = new Set(lookups.trackedIds);
    const byCat = new Map<string, AieMarketShareEstimate[]>();
    for (const e of payload.estimates) {
      const list = byCat.get(e.categoryId) ?? [];
      list.push(e);
      byCat.set(e.categoryId, list);
    }
    return [...byCat.entries()].map(([catId, rows]) => {
      const meta = catMeta.get(catId);
      const mapped = rows
        .map((e) => ({
          vendorId: e.vendorId,
          vendorName: lookups.vendorNames[e.vendorId] ?? e.vendorId,
          share: Math.round(e.estimatedShare * 10) / 10,
          previousEstimate: e.previousEstimate ?? undefined,
          changePct: e.changePct ?? 0,
          confidence: e.confidence,
          tracked: tracked.has(e.vendorId),
        }))
        .sort((a, b) => b.share - a.share);
      return {
        id: catId,
        name: meta?.name ?? catId.replace(/_/g, " "),
        description: meta?.description ?? "",
        rows: mapped,
        namedShareTotal: Math.round(mapped.reduce((s, r) => s + r.share, 0)),
        source: rows[0]?.source ?? "",
        sourceDate: rows[0]?.sourceDate ?? "",
        methodology: rows[0]?.methodology ?? "",
      };
    });
  }, [payload, lookups]);

  const usingLive = liveView !== null;
  const view = liveView ?? fallback;
  const lane = usingLive ? (source === "mock" ? "mock" : "aie-live") : "aie";
  const methodology = view[0]?.methodology ?? "";

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">The market by category</h2>
        <LaneBadge lane={lane} />
        {usingLive && payload ? (
          <>
            <span className="micro-label">Generated</span>
            <span className="font-mono text-[10px] text-muted">{formatDate(payload.asOf)}</span>
          </>
        ) : (
          <span className="font-mono text-[10px] text-muted">
            {failed ? "Live pull unavailable; showing the ported seed." : "Loading the live estimates..."}
          </span>
        )}
      </div>
      <p className="mt-1 max-w-3xl text-[11px] text-muted">
        {usingLive && payload
          ? `Native provenance line from the engine: "${payload.provenance}"`
          : `Native estimate label from the dataset: "${methodology}"`}
      </p>
      <div className="mt-1">
        <DerivationDrawer title="How category shares are derived">
          <p>
            Every bar is the engine&apos;s <code>estimatedShare</code> field, shown
            in per cent of the category, pulled live from the deployed AI
            Enterprise app&apos;s market-share API through our proxy. The delta
            arrow is its own <code>changePct</code> versus its previous estimate,
            and the small &quot;conf&quot; figure is the row&apos;s native
            estimate (0 to 100).
          </p>
          <p className="text-muted">
            These are directional, evidence-graded estimates, not audited
            market shares; the engine&apos;s own provenance line stays visible
            above. When the live pull fails the ported seed renders instead
            under its AIE dataset badge, and a recorded response serves under
            Cached sample in mock mode.
          </p>
        </DerivationDrawer>
      </div>
      <ShareCards categories={view} />
    </section>
  );
}

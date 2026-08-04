"use client";

import { useEffect, useMemo, useState } from "react";
import {
  REGIONS,
  COMPANY_SIZES,
  aggregateUptake,
  INDUSTRIES as ARCHETYPES,
} from "@/lib/aie";
import type { Region, CompanySize } from "@/lib/aie";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { PeerAdoptionChart } from "./peer-adoption-chart";
import { aieFetch, type AieSource, type AieUptakeRow } from "@/lib/aie-live";
import { ARCHETYPE_TO_LIVE_INDUSTRY, ARCHETYPE_TO_UPTAKE, UPTAKE_VENDOR_ID } from "./data";

// Peer adoption: who your industry, region and size band is actually buying.
//
// This is the question a CIO asks first — "what are firms like us doing?" —
// and it belongs here rather than beside a model-fit tool, which is why it
// moved off FitEngine.
//
// It carries a correction. The ported segment model dates from May 2026 and
// its ordering has since been overtaken: it has OpenAI ahead of Anthropic in
// every slice, while Menlo Ventures and the Ramp AI Index both now measure
// Anthropic ahead on enterprise spend and business adoption. The response is
// the house rule for the news seed — ship it with its vintage stated and its
// contradiction named, not silently, and not deleted. The live pull is
// preferred whenever the deployed app answers, and the relative ordering
// carries a correction note whenever the ported seed is what you are seeing.
const SEED_VINTAGE = "May 2026";

export function PeerAdoptionExplorer() {
  const [archetypeId, setArchetypeId] = useState("");
  const [region, setRegion] = useState<"" | Region>("");
  const [size, setSize] = useState<"" | CompanySize>("");
  const [live, setLive] = useState<AieUptakeRow[] | null>(null);
  const [liveSource, setLiveSource] = useState<AieSource>("live");

  const archetypes = useMemo(() => Object.values(ARCHETYPES), []);
  const liveIndustry = archetypeId ? ARCHETYPE_TO_LIVE_INDUSTRY[archetypeId] : undefined;

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = {};
    if (liveIndustry) params.industry = liveIndustry;
    if (region) params.region = region;
    aieFetch<{ rows: AieUptakeRow[] }>("uptake", params).then((res) => {
      if (cancelled) return;
      setLiveSource(res.source);
      setLive(res.ok && res.data?.rows ? res.data.rows : null);
    });
    return () => {
      cancelled = true;
    };
  }, [liveIndustry, region]);

  const portedRows = useMemo(
    () =>
      aggregateUptake({
        regions: region ? [region] : undefined,
        industries: archetypeId ? ARCHETYPE_TO_UPTAKE[archetypeId] : undefined,
        companySize: size || null,
      }),
    [archetypeId, region, size]
  );

  const usingLive = live !== null;
  const rows = usingLive ? live : portedRows;
  const lane = usingLive ? (liveSource === "mock" ? "mock" : "aie-live") : "aie";

  const sliceLabel = [
    archetypeId
      ? `${ARCHETYPES[archetypeId].name} (mapped to ${ARCHETYPE_TO_UPTAKE[archetypeId].join(" and ")})`
      : "All industries",
    region || "All regions",
    size || "All organisation sizes",
  ].join(" · ");

  const select = "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]";

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Peer adoption: who firms like yours are buying"
          tooltip="Share of model-provider adoption within your slice. Shares are normalised inside the slice; the evidence labels are the source's own."
        />
        <LaneBadge lane={lane} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="micro-label">Industry</span>
          <select
            aria-label="Industry"
            value={archetypeId}
            onChange={(e) => setArchetypeId(e.target.value)}
            className={select}
          >
            <option value="">All industries</option>
            {archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="micro-label">Region</span>
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value as "" | Region)}
            className={select}
          >
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="micro-label">Organisation size</span>
          <select
            aria-label="Organisation size"
            value={size}
            onChange={(e) => setSize(e.target.value as "" | CompanySize)}
            className={select}
          >
            <option value="">All sizes</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-2 text-[11px] text-muted">{sliceLabel}</p>

      <div className="mt-3">
        {rows.length === 0 ? (
          <EmptyState
            title="No adoption rows for this slice"
            detail="The dataset has no contributing cells here; nothing is shown rather than a guess."
          />
        ) : (
          <PeerAdoptionChart
            rows={rows}
            vendorIdFor={(v) => UPTAKE_VENDOR_ID[v]}
            showDerivation={false}
          />
        )}
      </div>

      {/* The correction travels with the chart, not in a footnote. */}
      {usingLive ? (
        <p className="measure mt-3 text-[11px] text-muted">
          Pulled live from the deployed AIE app
          {archetypeId && !liveIndustry
            ? ", unfiltered by industry because this archetype spans several of the engine's segments"
            : ", filtered upstream by the selections above"}
          .
        </p>
      ) : (
        <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
          <b>Ordering is {SEED_VINTAGE} and has since been overtaken.</b> The
          live pull did not answer, so this is the ported segment model, which
          places OpenAI ahead of Anthropic in every slice. Two later
          measurements disagree: Menlo Ventures puts Anthropic at roughly 40 per
          cent of enterprise LLM spend against OpenAI&apos;s 27, and the Ramp AI
          Index recorded Anthropic passing OpenAI on business adoption in April
          2026. Read the shape of the slice — which vendors appear at all, and
          how concentrated it is — rather than the order of the top two.
        </p>
      )}

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How the adoption shares are derived">
          <p>
            Shares come from the AIE vendor uptake model, pulled live from the
            deployed app when it answers and from the ported dataset otherwise.
            The ported dataset is 585 region-by-industry-by-vendor rows (5
            regions, 9 industry segments, 13 model providers), each a fraction
            normalised within its region-and-industry cell.
          </p>
          <ul className="list-disc space-y-1 pl-4 text-muted">
            <li>
              Matching cells are averaged per vendor, optionally re-weighted by
              the vendor&apos;s large-enterprise or SME propensity, then
              renormalised so the slice sums to 100 per cent.
            </li>
            <li>
              The eight industry archetypes map onto the dataset&apos;s own nine
              segments; the mapping is shown in the slice label and the dataset
              itself is not altered.
            </li>
            <li>
              Confidence per row is the average of the contributing cells&apos;
              native labels. Two of those labels, &quot;Low-Medium&quot; and
              &quot;Medium-Low&quot;, share a rank, so a slice made only of
              Medium-Low cells reports as Low-Medium.
            </li>
          </ul>
          <p className="text-muted">
            These are directional adoption-share estimates, not disclosed vendor
            revenue or audited market share, and the ported seed&apos;s ordering
            of the two largest vendors is contradicted by later measurement.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

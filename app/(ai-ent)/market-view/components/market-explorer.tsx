"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INDUSTRIES,
  industryMaturityScore,
  adoptionMaturityBand,
  USE_CASES,
  workflowsByCategory,
  REGIONS,
  COMPANY_SIZES,
  aggregateUptake,
} from "@/lib/aie";
import type { Region, CompanySize, UseCase } from "@/lib/aie";
import { LaneBadge, SeverityBadge, type Severity } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import { PeerAdoptionChart } from "./peer-adoption-chart";
import { aieFetch, type AieSource, type AieUptakeRow } from "@/lib/aie-live";
import { WorkflowShortlistPanel } from "./workflow-shortlist";
import type { WorkflowShortlist } from "@/lib/workflow-vendors";
import {
  ARCHETYPE_TO_LIVE_INDUSTRY,
  ARCHETYPE_TO_UPTAKE,
  UPTAKE_VENDOR_ID,
} from "../data";


function BandChip({ band }: { band: string }) {
  const styles: Record<string, string> = {
    nascent: "bg-base-200 text-muted",
    emerging: "bg-warn-bg text-warn",
    developing: "bg-warn-bg text-warn",
    mainstream: "bg-good-bg text-good",
    advanced: "bg-good-bg text-good",
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${styles[band] ?? "bg-base-200 text-muted"}`}
    >
      {band}
    </span>
  );
}

function pretty(token: string): string {
  return token.replace(/_/g, " ");
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="micro-label">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]";

// The Market View explorer: who is using which models, how and where.
// Filters over the AIE industry archetypes, workflow taxonomy and the
// region-by-industry vendor uptake seed; results keep the seed's own
// adoption shares.
export function MarketExplorer({
  workflowVendors,
}: {
  workflowVendors: Record<string, WorkflowShortlist>;
}) {
  const [archetypeId, setArchetypeId] = useState("");
  const [region, setRegion] = useState<"" | Region>("");
  const [size, setSize] = useState<"" | CompanySize>("");
  const [category, setCategory] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [live, setLive] = useState<AieUptakeRow[] | null>(null);
  const [liveSource, setLiveSource] = useState<AieSource>("live");
  // The upstream publishes its own caveat on every response. It used to be
  // dropped here, which left a bare percentage under a LIVE badge reading as
  // measured market share when the source itself calls it directional.
  const [liveProvenance, setLiveProvenance] = useState<string | null>(null);

  // The live uptake API expects its own industry display names and rejects
  // anything else, so only mapped archetypes send the filter; the rest run
  // unfiltered upstream and the UI says so.
  const liveIndustry = archetypeId ? ARCHETYPE_TO_LIVE_INDUSTRY[archetypeId] : undefined;

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string> = {};
    if (liveIndustry) params.industry = liveIndustry;
    if (region) params.region = region;
    aieFetch<{ rows: AieUptakeRow[]; provenance?: string }>("uptake", params).then((res) => {
      if (cancelled) return;
      setLiveSource(res.source);
      setLiveProvenance(res.ok ? (res.data?.provenance ?? null) : null);
      setLive(res.ok && res.data?.rows ? res.data.rows : null);
    });
    return () => {
      cancelled = true;
    };
  }, [liveIndustry, region]);

  const archetypes = useMemo(() => Object.values(INDUSTRIES), []);
  const byCategory = useMemo(() => workflowsByCategory(USE_CASES), []);
  const categories = useMemo(() => Array.from(byCategory.keys()), [byCategory]);
  const workflowChoices: UseCase[] = category
    ? (byCategory.get(category) ?? [])
    : USE_CASES;
  const workflow = USE_CASES.find((u) => u.id === workflowId);
  const archetype = archetypeId ? INDUSTRIES[archetypeId] : null;

  const portedRows = useMemo(
    () =>
      aggregateUptake({
        regions: region ? [region] : undefined,
        industries: archetypeId ? ARCHETYPE_TO_UPTAKE[archetypeId] : undefined,
        companySize: size || null,
      }),
    [archetypeId, region, size]
  );
  // Live rows carry the same fields (vendor, share as a 0 to 1 fraction,
  // contributingCells, confidence), so the panel renders either source.
  //
  // Organisation size is the exception. The upstream API facets on industry
  // and region only, and echoes that back in its scope object, so a size sent
  // with the request would be ignored: the control looked live and changed
  // nothing, while the slice label above the chart claimed the cut had been
  // applied. The ported dataset does carry the size split, from the same
  // spreadsheet the upstream model was built from, so selecting a size hands
  // the panel to that dataset and the badge says so.
  const sizeForcesPorted = size !== "";
  const usingLive = live !== null && !sizeForcesPorted;
  const rows = usingLive ? live : portedRows;
  const uptakeLane = usingLive
    ? liveSource === "mock"
      ? "mock"
      : "aie-live"
    : "aie";

  const sliceLabel = [
    archetype
      ? `${archetype.name} (mapped to ${ARCHETYPE_TO_UPTAKE[archetypeId].join(" and ")})`
      : "All industries",
    region || "All regions",
    size || "All organisation sizes",
  ].join(", ");

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex items-center gap-2">
          <MicroLabel
            label="Explore the market"
            tooltip="Industry uses the eight AIE industry archetypes; Region and Organisation size come from the uptake dataset's own facets; Workflow narrows the evidenced-impact panel."
          />
          <LaneBadge lane="aie" />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-5">
          <FilterField label="Industry">
            <select
              aria-label="Industry archetype"
              value={archetypeId}
              onChange={(e) => setArchetypeId(e.target.value)}
              className={selectClass}
            >
              <option value="">All industries</option>
              {archetypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Region">
            <select
              aria-label="Region"
              value={region}
              onChange={(e) => setRegion(e.target.value as "" | Region)}
              className={selectClass}
            >
              <option value="">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Organisation size">
            <select
              aria-label="Organisation size"
              value={size}
              onChange={(e) => setSize(e.target.value as "" | CompanySize)}
              className={selectClass}
            >
              <option value="">All sizes</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Workflow area">
            <select
              aria-label="Workflow category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setWorkflowId("");
              }}
              className={selectClass}
            >
              <option value="">All areas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({byCategory.get(c)?.length ?? 0})
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Workflow">
            <select
              aria-label="Workflow"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              className={selectClass}
            >
              <option value="">Any workflow</option>
              {workflowChoices.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </FilterField>
        </div>
        <p className="measure mt-2 text-[11px] text-muted">
          Industry and region are faceted by the live uptake API. Organisation
          size exists only in the ported dataset, so choosing one moves the
          provider panel to that source and says so. The workflow selector
          drives the evidenced-impact panel below and does not re-rank
          vendors.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
        {/* Who is strong in this slice */}
        <section className="@container rounded-lg border border-base-300 bg-base-100 p-4 @4xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <MicroLabel
              label="Model providers in this slice"
              tooltip="Share of model-provider adoption within the selected slice. Shares are normalised inside the slice; evidence labels are the source's own."
            />
            <LaneBadge lane={uptakeLane} />
          </div>
          <p className="mt-1 text-[11px] text-muted">{sliceLabel}</p>
          <p className="measure mt-0.5 text-[10.5px] text-muted">
            {usingLive
              ? archetypeId && !liveIndustry
                ? "Pulled live from the deployed AIE app. This archetype spans several of the engine's industry segments, so the live slice is unfiltered by industry and the filter applies to the panels below."
                : "Pulled live from the deployed AIE app, filtered upstream on industry and region."
              : sizeForcesPorted
                ? "Organisation size is not a facet of the live API, so this cut is served from the ported dataset, which carries the size split from the same source spreadsheet."
                : "The live uptake pull did not answer, so the ported region-by-industry dataset is shown."}
          </p>

          {/* The source's own words, not a restatement. A modelled estimate
              under a percentage reads as measurement unless the caveat that
              came with it is on the same screen. */}
          <p className="measure mt-2 rounded border border-warn/40 bg-warn-bg px-2.5 py-1.5 text-[11px] leading-snug">
            {usingLive && liveProvenance
              ? liveProvenance
              : "MODELLED ESTIMATE — May 2026 segment-share model; directional, not audited market share"}
          </p>

          {/* The reason a broad vendor outranks one that leads the largest
              segments. Without it the ranking invites a reading it will not
              support. */}
          <p className="measure mt-1.5 text-[10.5px] leading-snug text-muted">
            Every {region ? "industry" : "region and industry"} cell in the cut
            is weighted equally before the shares are renormalised, so this
            ranks breadth of presence across segments, not size of business.
            A vendor leading the largest segment can still sit below one
            present in all of them.
          </p>

          <div className="mt-3">
            {rows.length === 0 ? (
              <EmptyState
                title="No adoption rows for this slice"
                detail="The uptake dataset has no contributing cells here; nothing is shown rather than a guess."
              />
            ) : (
              <PeerAdoptionChart
                rows={rows}
                vendorIdFor={(v) => UPTAKE_VENDOR_ID[v]}
                showDerivation={false}
              />
            )}
          </div>
          <div className="mt-3 border-t border-base-300 pt-2">
            <DerivationDrawer title="How the adoption shares are derived">
              <p>
                <strong>This cut is being served from{" "}
                {usingLive
                  ? "the deployed AIE app, live"
                  : "the ported dataset"}
                .</strong>{" "}
                {usingLive
                  ? "The upstream returns the model's own output for the industry and region asked for. Its provenance line is reproduced above the chart verbatim."
                  : "585 region by industry by vendor rows (5 regions, 9 industry segments, 13 model providers), each a fraction normalised within its region-and-industry cell and carrying the dataset's own estimate."}
              </p>
              <p className="measure text-muted">
                Both come from the same May 2026 segment-share model, built
                from a vendor-by-industry-by-region spreadsheet. Live here
                means freshly fetched, not freshly measured: no figure on this
                chart was observed after May 2026.
              </p>
              <ul className="measure list-disc space-y-1 pl-4 text-muted">
                <li>
                  Matching cells for the selected slice are averaged per
                  vendor, then renormalised so the slice sums to 100 per cent.
                  Every cell counts once regardless of how large that segment
                  is, so the ranking reads as breadth of presence rather than
                  weight of business.
                </li>
                <li>
                  Organisation size is not a facet of the live API. Choosing
                  one moves the panel to the ported dataset, which carries the
                  large-enterprise and SME split, and the badge changes with
                  it.
                </li>
                <li>
                  The eight industry archetypes map onto the dataset&apos;s own
                  nine segments (the mapping is shown in the slice label
                  above); the dataset itself is not altered.
                </li>
                <li>
                  Cells and confidence are printed against every row.
                  Confidence is the average of the contributing cells&apos;
                  native labels (Low, Low-Medium, Medium, High). Bars are
                  scaled to the slice leader for readability.
                </li>
              </ul>
              <p className="measure text-muted">
                These are directional adoption-share estimates from
                the dataset, not disclosed vendor revenue or market-share
                figures.
              </p>
            </DerivationDrawer>
          </div>
        </section>

        {/* Industry adoption profile */}
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <MicroLabel
              label="Industry adoption profile"
              tooltip="The AIE industry archetype's adoption profile: how far AI use has progressed from experimentation to scaled deployment, including agentic use."
            />
            <LaneBadge lane="aie" />
          </div>
          {archetype ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold">{archetype.name}</h3>
                <BandChip
                  band={adoptionMaturityBand(industryMaturityScore(archetype))}
                />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <ScorePill score={Math.round(industryMaturityScore(archetype))} />
                <span className="text-[11px] text-muted">maturity, 0 to 100</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {(
                  [
                    ["Experimentation", archetype.adoption.experimentationPct],
                    ["Regular use", archetype.adoption.regularUsePct],
                    ["Production", archetype.adoption.productionPct],
                    ["Scaled", archetype.adoption.scaledPct],
                    [
                      "Agentic experimentation",
                      archetype.adoption.agenticExperimentationPct,
                    ],
                    ["Agentic scaled", archetype.adoption.agenticScaledPct],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <li key={label} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 text-[11.5px]">{label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
                      <span
                        className="block h-full rounded-full bg-secondary/60"
                        style={{ width: `${value}%` }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px]">
                      {value} per cent
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                Evidence strictness x{archetype.evidenceStrictness}
              </p>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[300px] text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-base-300 font-mono text-[9px] uppercase tracking-wider text-muted">
                    <th className="py-1.5 pr-2 font-medium">Archetype</th>
                    <th className="px-1 py-1.5 text-right font-medium">Production</th>
                    <th className="px-1 py-1.5 text-right font-medium">Scaled</th>
                    <th className="py-1.5 pl-1 text-right font-medium">Band</th>
                  </tr>
                </thead>
                <tbody>
                  {archetypes.map((a) => (
                    <tr key={a.id} className="border-b border-base-300/60">
                      <td className="py-1.5 pr-2">{a.name}</td>
                      <td className="px-1 py-1.5 text-right font-mono text-[10px]">
                        {a.adoption.productionPct} per cent
                      </td>
                      <td className="px-1 py-1.5 text-right font-mono text-[10px]">
                        {a.adoption.scaledPct} per cent
                      </td>
                      <td className="py-1.5 pl-1 text-right">
                        <BandChip band={adoptionMaturityBand(industryMaturityScore(a))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-muted">
                Pick an industry above for its full adoption profile.
              </p>
            </div>
          )}
          <div className="mt-3 border-t border-base-300 pt-2">
            <DerivationDrawer title="How industry maturity is derived">
              <p>
                Each archetype carries a native adoption profile: the
                percentage of organisations at experimentation, regular use,
                production and scaled deployment, plus the agentic equivalents.
              </p>
              <p>
                The maturity score is the dataset's own formula: 25 per cent
                of regular use, plus 35 per cent of production, plus 40 per
                cent of scaled deployment, banded nascent to advanced.
              </p>
            </DerivationDrawer>
          </div>
        </section>
      </div>

      {/* Workflows with evidenced impact */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Workflows with evidenced impact"
            tooltip="The AIE enterprise workflow taxonomy: each record carries native risk, reliability, autonomy, complexity and regulatory fields describing how the workflow is deployed in practice."
          />
          <LaneBadge lane="aie" />
          <span className="font-mono text-[10px] text-muted">
            {USE_CASES.length} workflows in {categories.length} areas
          </span>
        </div>
        {workflow ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold">{workflow.label}</h3>
              <SeverityBadge
                severity={workflow.riskTier.toUpperCase() as Severity}
              />
              <span className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-muted">
                {workflow.category}
                {workflow.subcategory ? ` / ${workflow.subcategory}` : ""}
              </span>
            </div>
            {workflow.description ? (
              <p className="mt-1 measure text-[12.5px] text-base-content/85">
                {workflow.description}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-3 @3xl:grid-cols-3 @5xl:grid-cols-6">
              <div>
                <p className="micro-label">Risk tier</p>
                <p className="mt-1 font-mono text-[12px] font-semibold uppercase">
                  {workflow.riskTier}
                </p>
              </div>
              <div>
                <p className="micro-label">Reliability requirement</p>
                <p className="mt-1 font-mono text-[12px] font-semibold">
                  {workflow.reliabilityRequirement} of 5
                </p>
              </div>
              <div>
                <p className="micro-label">Autonomy default</p>
                <p className="mt-1 font-mono text-[12px] font-semibold">
                  {pretty(workflow.autonomyDefault)}
                </p>
              </div>
              <div>
                <p className="micro-label">Complexity</p>
                <p className="mt-1 font-mono text-[12px] font-semibold">
                  {workflow.complexity ?? "not graded"}
                </p>
              </div>
              <div>
                <p className="micro-label">Assessment tier</p>
                <p className="mt-1 font-mono text-[12px] font-semibold">
                  {workflow.tier ?? "advanced"}
                </p>
              </div>
              <div>
                <p className="micro-label">Industry tags</p>
                <p className="mt-1 text-[11px]">
                  {workflow.industries && workflow.industries.length > 0
                    ? workflow.industries.map(pretty).join(", ")
                    : "horizontal (all industries)"}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
              <div>
                <p className="micro-label">Common inputs</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(workflow.commonInputs ?? []).map((c) => (
                    <span
                      key={c}
                      className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="micro-label">Regulatory flags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {workflow.regulatoryFlags && workflow.regulatoryFlags.length > 0 ? (
                    workflow.regulatoryFlags.map((f) => (
                      <span
                        key={f}
                        className="inline-flex rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[9px] text-warn"
                      >
                        {pretty(f)}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-muted">none recorded</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <WorkflowShortlistPanel
                shortlist={workflowVendors[workflow.category] ?? null}
                workflowLabel={workflow.label}
                riskTier={workflow.riskTier}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCategory(c);
                    setWorkflowId("");
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition hover:border-primary hover:text-primary ${category === c ? "border-primary text-primary" : "border-base-300 text-muted"}`}
                >
                  {c} ({byCategory.get(c)?.length ?? 0})
                </button>
              ))}
            </div>
            <p className="measure mt-2 text-[11px] text-muted">
              Pick a workflow in the filter bar to see its evidenced-impact
              profile: risk tier, reliability requirement, autonomy default,
              complexity and regulatory flags, all native to the taxonomy.
            </p>
          </div>
        )}
        <div className="mt-3 border-t border-base-300 pt-2">
          <DerivationDrawer title="How workflow records are graded">
            <p>
              Workflow records are ported unchanged from the AIE enterprise
              workflow taxonomy. Each carries native fields: a risk tier (low
              to critical), a reliability requirement on a 1 to 5 scale, a
              default autonomy posture (advisory only, human in loop or
              supervised agent), a complexity grade and the regulatory regimes
              that typically apply.
            </p>
            <p className="measure text-muted">
              These gradings describe how the workflow is deployed in
              practice; they are taxonomy attributes, not measurements of any
              single vendor, and nothing here is blended into a vendor score.
            </p>
          </DerivationDrawer>
        </div>
      </section>
    </div>
  );
}

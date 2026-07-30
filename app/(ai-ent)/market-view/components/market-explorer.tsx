"use client";

import { useMemo, useState } from "react";
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
import { ARCHETYPE_TO_UPTAKE, UPTAKE_VENDOR_ID } from "../data";

// Native confidence labels from the uptake seed, shown verbatim.
function ConfidenceChip({ label }: { label: string }) {
  const styles: Record<string, string> = {
    High: "bg-good-bg text-good",
    Medium: "bg-base-200 text-base-content",
    "Medium-Low": "bg-warn-bg text-warn",
    "Low-Medium": "bg-warn-bg text-warn",
    Low: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider ${styles[label] ?? "bg-base-200 text-muted"}`}
      title="The dataset's own confidence label for the contributing cells"
    >
      {label}
    </span>
  );
}

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
// adoption shares and confidence labels.
export function MarketExplorer() {
  const [archetypeId, setArchetypeId] = useState("");
  const [region, setRegion] = useState<"" | Region>("");
  const [size, setSize] = useState<"" | CompanySize>("");
  const [category, setCategory] = useState("");
  const [workflowId, setWorkflowId] = useState("");

  const archetypes = useMemo(() => Object.values(INDUSTRIES), []);
  const byCategory = useMemo(() => workflowsByCategory(USE_CASES), []);
  const categories = useMemo(() => Array.from(byCategory.keys()), [byCategory]);
  const workflowChoices: UseCase[] = category
    ? (byCategory.get(category) ?? [])
    : USE_CASES;
  const workflow = USE_CASES.find((u) => u.id === workflowId);
  const archetype = archetypeId ? INDUSTRIES[archetypeId] : null;

  const rows = useMemo(
    () =>
      aggregateUptake({
        regions: region ? [region] : undefined,
        industries: archetypeId ? ARCHETYPE_TO_UPTAKE[archetypeId] : undefined,
        companySize: size || null,
      }),
    [archetypeId, region, size]
  );
  const maxShare = rows.reduce((acc, r) => Math.max(acc, r.share), 0);

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
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <p className="mt-2 text-[11px] text-muted">
          The adoption dataset facets on region, industry and organisation
          size; the workflow selector drives the evidenced-impact panel below
          and does not re-rank vendors.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Who is strong in this slice */}
        <section className="rounded-lg border border-base-300 bg-base-100 p-4 lg:col-span-2">
          <div className="flex items-start justify-between gap-2">
            <MicroLabel
              label="Model providers in this slice"
              tooltip="Share of model-provider adoption within the selected slice, from the AIE region-by-industry uptake dataset. Shares are normalised inside the slice; confidence labels are the dataset's own."
            />
            <LaneBadge lane="aie" />
          </div>
          <p className="mt-1 text-[11px] text-muted">{sliceLabel}</p>
          <div className="mt-3">
            {rows.length === 0 ? (
              <EmptyState
                title="No adoption rows for this slice"
                detail="The uptake dataset has no contributing cells here; nothing is shown rather than a guess."
              />
            ) : (
              <ul className="space-y-1.5">
                {rows.map((r, i) => {
                  const vendorId = UPTAKE_VENDOR_ID[r.vendor];
                  const pct = (r.share * 100).toFixed(1);
                  return (
                    <li key={r.vendor} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted">
                        {i + 1}
                      </span>
                      <span className="w-32 shrink-0 truncate text-[12.5px]">
                        {vendorId ? (
                          <Link
                            href={`/vendor-view/${vendorId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {r.vendor}
                          </Link>
                        ) : (
                          r.vendor
                        )}
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{
                            width: `${maxShare > 0 ? (r.share / maxShare) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right font-mono text-[11px]">
                        {pct} per cent
                      </span>
                      <span className="w-20 shrink-0 text-right">
                        <ConfidenceChip label={r.confidence} />
                      </span>
                      <span
                        className="w-12 shrink-0 text-right font-mono text-[9px] text-muted"
                        title="Contributing region-by-industry cells"
                      >
                        {r.contributingCells} cells
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mt-3 border-t border-base-300 pt-2">
            <DerivationDrawer title="How the adoption shares are derived">
              <p>
                Shares come from the AIE vendor uptake dataset: 585 region by
                industry by vendor rows (5 regions, 9 industry segments, 13
                model providers), each a fraction normalised within its
                region-and-industry cell and carrying the dataset's own
                confidence label.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-muted">
                <li>
                  Matching cells for the selected slice are averaged per
                  vendor, optionally re-weighted by the vendor's
                  large-enterprise or SME propensity, then renormalised so the
                  slice sums to 100 per cent.
                </li>
                <li>
                  The eight industry archetypes map onto the dataset's own
                  nine segments (the mapping is shown in the slice label
                  above); the dataset itself is not altered.
                </li>
                <li>
                  Confidence shown per row is the average of the contributing
                  cells' native labels (Low, Low-Medium, Medium, High). Bars
                  are scaled to the slice leader for readability.
                </li>
              </ul>
              <p className="text-muted">
                These are confidence-labelled adoption-share estimates from
                the dataset, not disclosed vendor revenue or market-share
                figures.
              </p>
            </DerivationDrawer>
          </div>
        </section>

        {/* Industry adoption profile */}
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex items-start justify-between gap-2">
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
              <p className="mt-1 max-w-2xl text-[12.5px] text-base-content/85">
                {workflow.description}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <p className="mt-2 text-[11px] text-muted">
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
            <p className="text-muted">
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

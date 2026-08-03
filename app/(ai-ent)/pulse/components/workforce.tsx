"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  ALLOCATION_EVIDENCE,
  DEFAULT_ALLOCATION,
  INDUSTRY_LABEL,
  recommendFor,
  workflowsForIndustry,
  type AllocationBand,
} from "@/lib/pulse/allocation";

// Model allocation, and one worked industry-and-role recommendation.
//
// The two halves carry different badges on purpose. The split is an
// assumption and is badged SAMPLE; the recommendation is read from the real
// workflow library and is badged DERIVED. Putting one badge across both would
// have made the assumption look measured.

const TIER_COLOUR: Record<string, string> = {
  frontier: "bg-primary",
  mid: "bg-secondary/70 dark:bg-secondary-content/60",
  low: "bg-base-300",
};

function AllocationBar({ bands }: { bands: AllocationBand[] }) {
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full"
      role="img"
      aria-label={bands
        .map((b) => `${b.label} ${b.percent} per cent`)
        .join(", ")}
    >
      {bands.map((b) => (
        <div
          key={b.tier}
          className={TIER_COLOUR[b.tier]}
          style={{ width: `${b.percent}%` }}
        />
      ))}
    </div>
  );
}

export function Workforce({
  industries,
  complexityMix,
}: {
  industries: string[];
  complexityMix: {
    complex: number;
    moderate: number;
    simple: number;
    counted: number;
    total: number;
  };
}) {
  const [industry, setIndustry] = useState(
    industries.includes("retail_consumer") ? "retail_consumer" : industries[0]
  );
  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined);

  const workflows = useMemo(() => workflowsForIndustry(industry), [industry]);
  const rec = useMemo(
    () => recommendFor(industry, workflowId),
    [industry, workflowId]
  );

  return (
    <section className="grid grid-cols-1 gap-4 @4xl:grid-cols-5">
      {/* Allocation: an assumption, labelled as one */}
      <div className="@container rounded-lg border border-base-300 bg-base-100 p-4 @4xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="Model allocation"
            tooltip="How to spread model tiers across the work, so frontier pricing goes only where it earns its cost."
          />
          <LaneBadge lane="sample" />
        </div>

        <div className="mt-3">
          <AllocationBar bands={DEFAULT_ALLOCATION} />
        </div>

        <dl className="mt-3 space-y-2.5">
          {DEFAULT_ALLOCATION.map((b) => (
            <div key={b.tier} className="flex items-start gap-2.5">
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${TIER_COLOUR[b.tier]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <dt className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{b.label}</span>
                  <span className="font-mono text-[12px]">{b.percent}%</span>
                </dt>
                <dd className="measure text-[12px] leading-snug text-muted">
                  {b.work}
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-3 rounded border border-warn/40 bg-warn-bg px-2.5 py-1.5 text-[12px] leading-snug text-warn">
          Illustrative allocation, not a measurement. Nothing here measures what
          share of your work is routine against complex. Adjust by industry and
          role.
        </p>

        <div className="mt-2">
          <DerivationDrawer title="Why this is an assumption, and what is measured">
            <p>
              These percentages are a planning assumption, not an output. A
              research pass went looking for a measured replacement and
              concluded there is not one, for a substantive reason rather than
              a gap in the search: <strong>the allocation is not a property of
              work.</strong> It is a property of work measured against current
              model capability, and that denominator moves every few months. A
              figure measured today expires when the next model ships, which is
              why nobody publishes one.
            </p>
            <p>
              What is measured, and what the argument here actually rests on:
            </p>
            <ul className="measure list-disc space-y-1.5 pl-4">
              {ALLOCATION_EVIDENCE.map((e) => (
                <li key={e.figure}>
                  <strong className="text-base-content">{e.figure}</strong>{" "}
                  <span className="text-muted">
                    ({e.source}, {e.period}).
                  </span>{" "}
                  {e.claim}
                </li>
              ))}
            </ul>
            <p>
              The catalogue shape is real but is deliberately not the
              allocation:{" "}
              <strong>
                {complexityMix.complex} per cent of the {complexityMix.counted}{" "}
                catalogued workflows are complex, {complexityMix.moderate} per
                cent moderate and {complexityMix.simple} per cent simple
              </strong>
              . A catalogue records workflow types and over-samples the
              interesting ones, so it says nothing about how much of each an
              enterprise does. O*NET occupation data was obtained and rejected
              for the same reason: it counts occupations, not hours.
            </p>
            <p className="measure text-muted">
              The conclusion holds without the split being true. Capability
              barely degrades across tiers while price moves by an order of
              magnitude, so the burden of proof belongs on using the expensive
              tier rather than on avoiding it. Full write-up in
              docs/model-allocation-research.md.
            </p>
          </DerivationDrawer>
        </div>
      </div>

      {/* Role recommendation: derived from the real workflow library */}
      <div className="@container rounded-lg border border-base-300 bg-base-100 p-4 @4xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Which tier for which work"
              tooltip="A worked recommendation for one workflow, from its recorded risk tier and complexity."
            />
            <LaneBadge lane="derived" />
          </div>
          <Link
            href="/market-view"
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            All workflows →
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[12px] uppercase tracking-wider text-muted">
              Industry
            </span>
            <select
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setWorkflowId(undefined);
              }}
              className="max-w-[11rem] rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
            >
              {industries.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABEL[i] ?? i}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="font-mono text-[12px] uppercase tracking-wider text-muted">
              Workflow
            </span>
            <select
              value={workflowId ?? workflows[0]?.id ?? ""}
              onChange={(e) => setWorkflowId(e.target.value)}
              className="max-w-[13rem] rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {rec === null ? (
          <p className="mt-4 rounded-lg border border-dashed border-base-300 px-3 py-6 text-center text-[12px] text-muted">
            No workflow in the catalogue is tagged to this industry, so no
            recommendation is offered rather than a guess.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-[15px] font-bold">{rec.workflowLabel}</h3>
              <span className="text-[12px] text-muted">
                {rec.industryLabel} · {rec.category}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white">
                {rec.tierLabel}
              </span>
              <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[12px] text-muted">
                {rec.riskTier} risk
              </span>
              <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[12px] text-muted">
                {rec.complexity}
              </span>
              {rec.regulatoryFlags.slice(0, 3).map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-warn-bg px-2 py-0.5 font-mono text-[12px] text-warn"
                >
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>

            <dl className="mt-3 space-y-2.5">
              <div>
                <dt className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  Why
                </dt>
                <dd className="measure mt-0.5 text-[13px] leading-snug">{rec.why}</dd>
              </div>
              <div>
                <dt className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  Escalate to a higher tier for
                </dt>
                <dd className="measure mt-0.5 text-[13px] leading-snug text-muted">
                  {rec.escalateFor.join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  Likely impact
                </dt>
                <dd className="measure mt-0.5 text-[13px] leading-snug">
                  {rec.impact}
                </dd>
              </div>
            </dl>

            <div className="mt-3 border-t border-base-300 pt-2">
              <DerivationDrawer title="How this tier is chosen">
                <p>
                  Read from the workflow catalogue, which records a risk tier,
                  a complexity and any regulatory flags against every entry.
                  For {rec.workflowLabel} those are{" "}
                  <strong>{rec.riskTier} risk</strong>,{" "}
                  <strong>{rec.complexity} complexity</strong> and{" "}
                  {rec.regulatoryFlags.length
                    ? `${rec.regulatoryFlags.length} regulatory ${rec.regulatoryFlags.length === 1 ? "flag" : "flags"} (${rec.regulatoryFlags.join(", ")})`
                    : "no regulatory flags"}
                  .
                </p>
                <p>
                  The rule applied: <strong>{rec.rule}</strong> Risk outranks
                  complexity throughout, because the cost of a wrong answer on a
                  critical task exceeds anything saved on inference.
                </p>
                <p className="measure text-muted">
                  This recommends a tier, not a product. Which model fills the
                  tier is a separate question, answered by the price-performance
                  picks above and the full analysis behind them.
                </p>
              </DerivationDrawer>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

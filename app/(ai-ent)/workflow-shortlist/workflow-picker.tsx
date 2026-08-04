"use client";

import { useMemo, useState } from "react";
import {
  USE_CASES,
  workflowsByCategory,
} from "@/lib/aie";
import type { UseCase } from "@/lib/aie";
import { LaneBadge, SeverityBadge, type Severity } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { WorkflowShortlistPanel } from "./shortlist-panel";
import type { WorkflowShortlist } from "@/lib/workflow-vendors";

function pretty(token: string): string {
  return token.replace(/_/g, " ");
}

// The workflow picker as a tool, not a filter.
//
// This selector used to sit at the end of Model 4 Role's filter bar, where
// choosing a workflow changed nothing the eye could see: the result rendered
// three panels further down, below an adoption chart it had nothing to do
// with. A tool whose output is somewhere else is a tool that does not work.
//
// Here the choice IS the page. Pick an area, pick a workflow, and the answer
// renders directly underneath: the workflow's own risk and deployment
// profile, then who to buy it from and who to build it on.
export function WorkflowPicker({
  workflowVendors,
}: {
  workflowVendors: Record<string, WorkflowShortlist>;
}) {
  const [category, setCategory] = useState("");
  const [workflowId, setWorkflowId] = useState("");

  const byCategory = useMemo(() => workflowsByCategory(USE_CASES), []);
  const categories = useMemo(() => Array.from(byCategory.keys()), [byCategory]);
  const choices: UseCase[] = category ? (byCategory.get(category) ?? []) : [];
  const workflow = USE_CASES.find((u) => u.id === workflowId);

  return (
    <div className="space-y-4">
      {/* Step 1: the area chips */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="1 · Pick the workflow area"
            tooltip="The AIE enterprise workflow taxonomy: 75 workflows in 15 areas, each carrying native risk, reliability, autonomy and regulatory gradings."
          />
          <LaneBadge lane="aie" />
          <span className="font-mono text-[10px] text-muted">
            {USE_CASES.length} workflows in {categories.length} areas
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setWorkflowId("");
              }}
              className={`rounded-full border px-2.5 py-1 text-sm transition hover:border-primary hover:text-primary ${category === c ? "border-primary bg-primary/[0.06] font-semibold text-primary" : "border-base-300 text-muted"}`}
            >
              {c} ({byCategory.get(c)?.length ?? 0})
            </button>
          ))}
        </div>

        {category ? (
          <div className="mt-4 border-t border-base-300 pt-3">
            <MicroLabel label={`2 · Pick the workflow in ${category}`} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {choices.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setWorkflowId(u.id)}
                  className={`rounded-full border px-2.5 py-1 text-sm transition hover:border-primary hover:text-primary ${workflowId === u.id ? "border-primary bg-primary/[0.06] font-semibold text-primary" : "border-base-300"}`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Pick an area to see its workflows. The answer renders right here.
          </p>
        )}
      </section>

      {/* The answer: profile, then shortlist */}
      {workflow ? (
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-bold">{workflow.label}</h3>
            <SeverityBadge severity={workflow.riskTier.toUpperCase() as Severity} />
            <span className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-muted">
              {workflow.category}
              {workflow.subcategory ? ` / ${workflow.subcategory}` : ""}
            </span>
            <LaneBadge lane="aie" />
          </div>
          {workflow.description ? (
            <p className="measure mt-1 text-[12.5px] text-base-content/85">
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

          <div className="mt-4">
            <WorkflowShortlistPanel
              shortlist={workflowVendors[workflow.category] ?? null}
              workflowLabel={workflow.label}
              riskTier={workflow.riskTier}
            />
          </div>

          <div className="mt-3 border-t border-base-300 pt-2">
            <DerivationDrawer title="How workflow records are graded">
              <p>
                Workflow records are ported unchanged from the AIE enterprise
                workflow taxonomy. Each carries native fields: a risk tier (low
                to critical), a reliability requirement on a 1 to 5 scale, a
                default autonomy posture, a complexity grade and the regulatory
                regimes that typically apply.
              </p>
              <p className="text-muted">
                These gradings describe how the workflow is deployed in
                practice; they are taxonomy attributes, not measurements of any
                single vendor, and nothing here is blended into a vendor score.
              </p>
            </DerivationDrawer>
          </div>
        </section>
      ) : null}
    </div>
  );
}

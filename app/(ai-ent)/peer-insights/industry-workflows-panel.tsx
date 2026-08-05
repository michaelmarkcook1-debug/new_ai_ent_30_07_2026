"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LaneBadge, SeverityBadge, type Severity } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  workflowsForSegment,
  WORKFLOW_LIBRARY_SIZE,
  type IndustryWorkflow,
} from "@/lib/peer/industry-workflows";
import { ADOPTION_SEGMENTS } from "./data";

// What firms in your industry run AI for.
//
// The reverse lookup on the workflow library: it has always been read
// workflow-to-vendors on Workflow Shortlist, and never industry-to-workflow,
// which is the question a reader on this page is already asking.
//
// It follows the explorer's industry selector rather than adding a second
// one. Two industry pickers on one page would be a worse answer than none.

const RISK_SEVERITY: Record<IndustryWorkflow["riskTier"], Severity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const AUTONOMY_LABEL: Record<IndustryWorkflow["autonomyDefault"], string> = {
  advisory_only: "Advisory only",
  human_in_loop: "Human in the loop",
  supervised_agent: "Supervised agent",
};

function WorkflowRow({ w }: { w: IndustryWorkflow }) {
  return (
    <li className="border-b border-base-300/60 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold">{w.label}</span>
        <SeverityBadge severity={RISK_SEVERITY[w.riskTier]} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {w.category}
          {w.subcategory ? ` · ${w.subcategory}` : ""}
        </span>
      </div>
      {w.description ? (
        <p className="measure mt-0.5 text-[12px] leading-relaxed text-muted">
          {w.description}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-muted">
        <span>{AUTONOMY_LABEL[w.autonomyDefault]} by default</span>
        <span>reliability {w.reliabilityRequirement}/5</span>
        {w.complexity ? <span>{w.complexity}</span> : null}
        {w.regulatoryFlags.length > 0 ? (
          <span className="text-warn">
            {w.regulatoryFlags.join(" · ").replace(/_/g, " ")}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function IndustryWorkflowsPanel({ segment }: { segment: string }) {
  const set = useMemo(() => workflowsForSegment(segment), [segment]);
  const segmentLabel =
    ADOPTION_SEGMENTS.find((s) => s.apiValue === segment)?.label ?? null;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label={
            segmentLabel
              ? `What firms in ${segmentLabel} run AI for`
              : "What enterprises run AI for"
          }
          tooltip="The workflow library read industry-first. Every entry carries a risk tier, the autonomy it should default to, the reliability bar it must clear, and the regulations that typically apply."
        />
        <LaneBadge lane="aie" />
      </div>

      {!segment ? (
        <p className="measure mt-2 text-[12.5px] leading-relaxed text-muted">
          Pick an industry above and this narrows to the workflows tagged to
          it. Until then, these are the{" "}
          <b className="text-base-content">{set.horizontal.length}</b>{" "}
          workflows run across every industry — the common ground, out of{" "}
          {WORKFLOW_LIBRARY_SIZE} in the library.
        </p>
      ) : (
        <p className="measure mt-2 text-[12.5px] leading-relaxed text-muted">
          <b className="text-base-content">{set.specific.length}</b>{" "}
          {set.specific.length === 1 ? "workflow is" : "workflows are"} tagged
          to {segmentLabel} specifically, and{" "}
          <b className="text-base-content">{set.horizontal.length}</b> more run
          across every industry. Most of what you will run is what everyone
          runs; the first list is what is different about your sector.
          {set.specific.length > 0 && set.specific.length < 3 ? (
            <>
              {" "}
              That specific list is thin — the industry tagging is editorial
              and this sector has had little of it, so read the absence as
              missing curation rather than a sector that does nothing
              distinctive.
            </>
          ) : null}
        </p>
      )}

      {set.specific.length > 0 ? (
        <div className="mt-3">
          <p className="micro-label">Specific to this industry</p>
          <ul className="mt-1">
            {set.specific.map((w) => (
              <WorkflowRow key={w.id} w={w} />
            ))}
          </ul>
        </div>
      ) : segment ? (
        <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12px] text-muted">
          No workflow in the library is tagged to {segmentLabel} specifically.
          That is a gap in the library rather than a finding about the
          industry — the tagging is editorial, and an untagged sector means
          nobody has curated it yet, not that its firms run nothing distinctive.
        </p>
      ) : null}

      <div className="mt-3">
        <p className="micro-label">Run across every industry</p>
        <ul className="mt-1">
          {set.horizontal.slice(0, segment ? 8 : 12).map((w) => (
            <WorkflowRow key={w.id} w={w} />
          ))}
        </ul>
        {set.horizontal.length > (segment ? 8 : 12) ? (
          <p className="mt-1 font-mono text-[10px] text-muted">
            Showing {segment ? 8 : 12} of {set.horizontal.length} horizontal
            workflows, riskiest first. The full library, with the vendors that
            ship each one, is on{" "}
            <Link
              href="/workflow-shortlist"
              className="font-semibold text-primary hover:underline"
            >
              Workflow Shortlist
            </Link>
            .
          </p>
        ) : null}
      </div>

      <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
        <b>These are workflow types, not observed deployments.</b> The library
        says contract review is common in legal; it does not say which firms
        run it, and this product holds no such record. Read it as a map of
        what your sector uses AI for, then take a workflow to{" "}
        <Link
          href="/workflow-shortlist"
          className="font-semibold text-primary hover:underline"
        >
          Workflow Shortlist
        </Link>{" "}
        for the vendors that ship it.
      </p>

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How the industry mapping works">
          <p>
            The explorer&apos;s nine segments come from the uptake engine; the
            workflow library carries its own fifteen industry tags. The two
            vocabularies were built for different purposes, so the join is an
            editorial mapping declared in full in{" "}
            <code>lib/peer/industry-workflows.ts</code> rather than inferred
            from name similarity.
          </p>
          {set.mappingNote ? (
            <p>
              <b>{segmentLabel}:</b> {set.mappingNote}
            </p>
          ) : null}
          <p>
            A workflow with no industry tag, or an explicitly empty one, is
            horizontal — it runs anywhere. That is a deliberate value in the
            library and not missing data, which is why those{" "}
            {set.horizontal.length} entries are shown as common ground rather
            than hidden.
          </p>
          <p className="text-muted">
            Rows are ordered riskiest first, because a reader scanning their
            sector is better served meeting the workflows that need the most
            control before the ones that need least. Risk tier, reliability
            bar, default autonomy and regulatory flags are the library&apos;s
            own fields, carried through unchanged.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

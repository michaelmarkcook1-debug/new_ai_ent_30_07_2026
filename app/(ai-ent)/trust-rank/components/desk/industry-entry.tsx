"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  workflowsForSegment,
  WORKFLOW_LIBRARY_SIZE,
} from "@/lib/peer/industry-workflows";
import { ADOPTION_SEGMENTS } from "@/app/(ai-ent)/peer-insights/data";
import { useDeskProfile } from "@/lib/desk/profile";

// Start from your industry.
//
// Added 6 August 2026 for the element picked out of The Security Desk's Decide
// room: "ten industries, five real workflows each, claiming nothing about
// vendors".
//
// WHY NOTHING WAS PORTED. The source's list is ten industries of five
// workflows. This repository already holds 75 workflows across 15 industry
// tags in `lib/aie/use-cases.ts`, each carrying risk tier, reliability
// requirement, autonomy default and regulatory flags, with a segment mapping
// in `lib/peer/industry-workflows.ts` that is already declared in full and
// already used on Peer Insights. The two vocabularies share two labels out of
// sixty-three. Porting the smaller one alongside the larger would have given
// the product two workflow taxonomies that disagree with each other, and the
// register would then have to document both.
//
// So the taxonomy is not the gap. The ENTRY POINT was: this page could only be
// entered by workflow area, so a reader who knows they are a bank and not that
// they want "Document Processing" had nowhere to start. That is what this adds,
// over the library that was already here.
//
// It reads the desk set on Your Pulse, so a reader who has already said who
// they are is not asked twice.

export function IndustryEntry({
  onPick,
}: {
  /** Optional. On Workflow Shortlist this drove the picker below it; on Trust
   *  Rank there is no picker to drive, so the workflows read as the taxonomy
   *  they are and clicking one links out to the tool that acts on it. */
  onPick?: (category: string, workflowId: string) => void;
}) {
  const { profile, ready, save } = useDeskProfile();
  const set = useMemo(
    () => (profile ? workflowsForSegment(profile.industry) : null),
    [profile]
  );
  const label =
    ADOPTION_SEGMENTS.find((s) => s.apiValue === profile?.industry)?.label ??
    profile?.industry ??
    "";

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Start from your industry"
          tooltip="The workflows tagged to your industry in the AIE taxonomy, riskiest first. A taxonomy of enterprise workflows, not a log of who has deployed what."
        />
        <LaneBadge lane="aie" />
      </div>

      {!ready ? (
        <p className="mt-2 text-[13px] text-muted">Reading your desk…</p>
      ) : !profile ? (
        <>
          <p className="measure mt-1.5 text-[12.5px] leading-relaxed text-muted">
            Pick your industry and this narrows {WORKFLOW_LIBRARY_SIZE}{" "}
            workflows to the ones your sector actually runs. Or ignore it and
            browse by area below.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ADOPTION_SEGMENTS.map((s) => (
              <button
                key={s.apiValue}
                type="button"
                onClick={() => save({ industry: s.apiValue, region: null })}
                className="rounded border border-base-300 bg-base-200/40 px-2 py-1 text-[12px] transition hover:border-primary/50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="measure mt-1.5 text-[12.5px] leading-relaxed">
            <b>{set!.specific.length}</b> of {WORKFLOW_LIBRARY_SIZE} workflows
            are tagged to <b>{label}</b> specifically, riskiest first. The other{" "}
            {set!.horizontal.length} run across every industry and are in the
            areas below.
          </p>
          {set!.mappingNote ? (
            <p className="measure mt-1 text-[11.5px] leading-relaxed text-muted">
              {set!.mappingNote}
            </p>
          ) : null}

          {set!.specific.length === 0 ? (
            <p className="measure mt-2.5 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
              Nothing in the library is tagged to this sector specifically. That
              is a real reading rather than a gap: what this sector runs is what
              everyone runs, and the areas below are the whole answer.
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {set!.specific.map((w) => {
                const risk = (
                  <span
                    className={`ml-1.5 font-mono text-[9px] uppercase tracking-wider ${
                      w.riskTier === "critical" || w.riskTier === "high"
                        ? "text-warn"
                        : "text-muted"
                    }`}
                  >
                    {w.riskTier}
                  </span>
                );
                const cls =
                  "rounded border border-base-300 bg-base-200/40 px-2 py-1 text-[12px] transition hover:border-primary/50";
                return onPick ? (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onPick(w.category, w.id)}
                    title={w.description || w.label}
                    className={cls}
                  >
                    {w.label}
                    {risk}
                  </button>
                ) : (
                  <Link
                    key={w.id}
                    href="/workflow-shortlist"
                    title={w.description || w.label}
                    className={cls}
                  >
                    {w.label}
                    {risk}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => save(null)}
              className="font-mono text-[10px] uppercase tracking-wider text-muted hover:underline"
            >
              Change industry
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              A taxonomy of workflows, not a log of deployments
            </span>
          </div>
        </>
      )}
    </section>
  );
}

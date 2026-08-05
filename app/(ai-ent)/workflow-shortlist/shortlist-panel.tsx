"use client";

import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { WorkflowShortlist } from "@/lib/workflow-vendors";
import { ShortlistButton } from "@/lib/ui/shortlist-button";

// Who to shortlist for the selected workflow.
//
// Split into buy and build because they are different purchases, and ranking
// a finished application against a raw model in one list would be comparing
// two things that are not substitutes.

function VendorList({
  vendors,
  limit,
}: {
  vendors: WorkflowShortlist["buy"];
  limit: number;
}) {
  if (vendors.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-muted">
        No tracked vendor sits in the market categories this workflow maps to.
      </p>
    );
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {vendors.slice(0, limit).map((v, i) => (
        <li key={v.vendorId} className="flex flex-wrap items-center gap-2">
          <span className="w-4 shrink-0 text-right font-mono text-xs text-muted">
            {i + 1}
          </span>
          <Link
            href={`/vendor-view/${v.vendorId}`}
            className="min-w-[7rem] text-sm font-semibold hover:text-primary hover:underline"
          >
            {v.name}
          </Link>
          <span className="rounded-full border border-base-300 px-2 py-0.5 text-xs text-muted">
            {v.marketCategoryName}
          </span>
          {v.marketPosition ? (
            <span className="text-xs text-muted">{v.marketPosition}</span>
          ) : null}
          {/* Reached through a shared "regulated industry" category but built
              for a different regulated domain. Ranked last and said so, rather
              than quietly sitting mid-list on the strength of its score. */}
          {v.offDomain ? (
            <span
              className="rounded-full bg-warn-bg px-2 py-0.5 text-xs text-warn"
              title={`This vendor declares ${v.offDomain}, not this workflow's domain. It is reached through the shared regulated-industry category and ranked below vendors built for this job.`}
            >
              {v.offDomain}, not this domain
            </span>
          ) : null}
          <span className="ml-auto flex items-center gap-1.5">
            <ScorePill score={v.score} />
            <ShortlistButton vendorId={v.vendorId} name={v.name} size="xs" />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WorkflowShortlistPanel({
  shortlist,
  workflowLabel,
  riskTier,
}: {
  shortlist: WorkflowShortlist | null;
  workflowLabel: string | null;
  riskTier: string | null;
}) {
  if (!workflowLabel) {
    return (
      <section className="rounded-lg border border-dashed border-base-300 px-4 py-5">
        <MicroLabel
          label="Who to shortlist"
          tooltip="Pick a workflow above to see the vendors that serve it."
        />
        <p className="measure mt-1 text-sm text-muted">
          Choose a workflow above and this becomes a shortlist: the vendors that
          ship it, and the model providers you would build it on.
        </p>
      </section>
    );
  }

  if (!shortlist) {
    return (
      <section className="rounded-lg border border-dashed border-base-300 px-4 py-5">
        <MicroLabel label="Who to shortlist" />
        <p className="measure mt-1 text-sm text-muted">
          No vendor mapping is defined for this workflow&apos;s category, so no
          shortlist is offered rather than a guess.
        </p>
      </section>
    );
  }

  const highRisk = (riskTier ?? "").toLowerCase() === "high";

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Who to shortlist"
              tooltip="Vendors that serve this workflow, split into what you can buy and what you would build on."
            />
            <LaneBadge lane={shortlist.lane} />
          </div>
          <p className="mt-1 text-sm text-muted">
            For <span className="font-semibold">{workflowLabel}</span>, via its{" "}
            {shortlist.workflowCategory} category.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {shortlist.mappedCategories.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-base-200 px-2 py-0.5 text-xs text-muted"
            >
              {c.name}
            </span>
          ))}
        </div>
      </div>

      {highRisk ? (
        <p className="mt-2 rounded border border-warn/40 bg-warn-bg px-2.5 py-2 text-xs text-warn">
          This workflow is high risk tier. Weigh governance and enterprise
          controls at least as heavily as capability, and check each candidate
          on Trust Rank and The Security Desk before committing.
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-1 gap-4 @2xl:grid-cols-2">
        <div>
          <p className="text-sm font-bold">Buy it</p>
          <p className="text-xs text-muted">
            Vendors that ship this workflow as a product.
          </p>
          <VendorList vendors={shortlist.buy} limit={8} />
        </div>
        <div>
          <p className="text-sm font-bold">Build it</p>
          <p className="text-xs text-muted">
            Model providers you would build it on yourself.
          </p>
          <VendorList vendors={shortlist.build} limit={6} />
        </div>
      </div>

      {/* Buy and build are both "what to run it on". Who actually delivers the
          programme is a third answer, and it lives on its own page with a
          chooser across every live provider. */}
      <p className="mt-3 text-xs text-muted">
        Neither list is who delivers the programme.{" "}
        <Link
          href="/ecosystem-navigator"
          className="font-semibold text-primary hover:underline"
        >
          Integrators and service providers
        </Link>{" "}
        are on the Ecosystem Navigator.
      </p>

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How this shortlist is built">
          <p>
            The datasets do not join workflows to vendors. Vendors carry coarse
            use-case tags, the workflow library carries 75 granular entries,
            and the overlap between the two vocabularies is zero. So the bridge
            is the workflow&apos;s own category:{" "}
            <strong>{shortlist.workflowCategory}</strong> maps to{" "}
            {shortlist.mappedCategories.map((c) => c.name).join(", ")}, and the
            vendors shown are the ones the taxonomy places in those categories.
          </p>
          <p>
            <strong>That mapping is an editorial judgement, not a
            measurement.</strong> It is shown above as category chips so it can
            be disagreed with: if a category looks wrong for your use of this
            workflow, the shortlist below it is wrong too. Within each list the
            order is the vendor&apos;s own AG score, and a vendor with no score
            sorts last rather than being treated as zero.
          </p>
          <p className="measure text-muted">
            Buy and build are kept apart because they are not substitutes:
            ranking a finished application against a raw model in one list would
            compare two different purchases. Neither list is a recommendation,
            and neither is exhaustive: it covers the tracked vendor set only.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

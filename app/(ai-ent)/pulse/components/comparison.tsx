"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  COMPARABILITY_NOTE,
  THIN_CATEGORY_NOTE,
  categoriesPresent,
  vendorIdsInCategory,
} from "@/lib/comparability";
import type {
  CategoryShare,
  VendorMetrics,
  CategoryPlacement,
} from "@/lib/market-metrics";

// Vendor comparison, scoped to one market category at a time (the
// comparability rule: rank within a category, never across one).
//
// Every column is a real field rather than a composite invented here, and the
// column label says which. A vendor the dataset does not reach on a given
// metric shows an empty cell, not a zero and not a midpoint.

export function VendorComparisonTable({
  vendors,
  shares,
  primaryId,
  onSelect,
  lane,
  shareMovementPublished,
  composites,
}: {
  vendors: VendorMetrics[];
  shares: CategoryShare[];
  primaryId: string;
  onSelect: (id: string) => void;
  lane: "aie" | "aie-live";
  shareMovementPublished: boolean;
  composites: Record<string, Record<string, CategoryPlacement>>;
}) {
  const categories = useMemo(
    () => categoriesPresent(vendors.map((v) => v.id)),
    [vendors]
  );
  const [categoryId, setCategoryId] = useState<string>(
    () => categoriesPresent(vendors.map((v) => v.id))[0]?.id ?? ""
  );

  // Category presence is only meaningful inside its own category, so it is
  // looked up per selected category rather than summed across them.
  const shareFor = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shares) {
      if (s.categoryId === categoryId) map.set(s.vendorId, s.estimatedShare);
    }
    return map;
  }, [shares, categoryId]);

  // The assessment is per category, not per vendor: Anthropic scores 3.65 in
  // frontier models and 3.69 as a coding agent, so there is no single value to
  // hang on a vendor row.
  const assessmentFor = useMemo(
    () => composites[categoryId] ?? {},
    [composites, categoryId]
  );

  // Ordered by the assessment's own rank, never re-sorted. There is one rating
  // now, so a sort control would only offer ways of disagreeing with it. A
  // vendor it held carries no rank and sorts last, where the list says "held"
  // rather than placing it as though it had scored badly.
  const rows = useMemo(() => {
    const members = new Set(vendorIdsInCategory(categoryId));
    return vendors
      .filter((v) => members.has(v.id))
      .sort(
        (a, b) =>
          (assessmentFor[a.id]?.rank ?? Infinity) -
            (assessmentFor[b.id]?.rank ?? Infinity) ||
          a.name.localeCompare(b.name)
      );
  }, [vendors, categoryId, assessmentFor]);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <h2 className="text-base font-bold">Vendor comparison</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs text-muted">
            {rows.length} in category
          </span>
          <LaneBadge lane={lane} />
        </div>
      </div>

      {/* Comparability gate: one market category at a time */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 px-3 py-2.5">
        <span className="micro-label">Comparing within</span>
        <select
          aria-label="Market category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm font-semibold"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="ml-1 measure text-xs text-muted">
          {COMPARABILITY_NOTE}
        </p>
      </div>

      {rows.length < 3 ? (
        <p className="border-b border-base-300 px-3 py-2 text-xs text-muted">
          {THIN_CATEGORY_NOTE}
        </p>
      ) : null}

      {/* The ranking, laid out the way the AI Enterprise category ranking lays
          it out: a ranked list rather than a grid. A table gives every column
          equal weight, which is exactly wrong here, because one of them is the
          rating and the rest are context. This puts the rank, the vendor and
          the score on one line and the evidence underneath it. */}
      <ol className="divide-y divide-base-300">
        {rows.map((v) => {
          const share = shareFor.get(v.id) ?? null;
          const a = assessmentFor[v.id];
          return (
            <li key={v.id} className="px-3 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm text-muted tabular-nums">
                    {a ? `#${a.rank}` : "\u2014"}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(v.id)}
                    className={`text-base font-bold hover:underline ${
                      v.id === primaryId ? "text-primary" : ""
                    }`}
                  >
                    {v.name}
                  </button>
                  {a?.position ? (
                    <span className="rounded-full border border-good/40 bg-good-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-good">
                      {a.position}
                    </span>
                  ) : null}
                  {/* Coverage stated as a badge only where it is short, the way
                      the source flags it. A vendor evidenced on every domain
                      needs no badge; one evidenced on fewer does. */}
                  {a && a.evidenced < a.domainsTotal ? (
                    <span
                      className="rounded-full border border-warn/40 bg-warn-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide text-warn"
                      title={`${a.domainsTotal - a.evidenced} of ${a.domainsTotal} domains carried too little evidence to score.`}
                    >
                      limited evidence
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-3">
                  {a ? (
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {a.composite.toFixed(2)}
                      <span className="ml-0.5 text-xs font-normal text-muted">
                        /5
                      </span>
                    </span>
                  ) : (
                    <span
                      className="font-mono text-sm text-muted"
                      title="Held: under 60 per cent domain coverage, so the assessment withheld a score rather than ranking this vendor on defaults."
                    >
                      held
                    </span>
                  )}
                  <Link
                    href={`/vendor-view/${v.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Profile
                  </Link>
                </div>
              </div>

              {/* Presence is context and says so on the line, because a share
                  figure sitting beside a rank invites the reading that it
                  produced the rank. The source states it is not measured share
                  at all. */}
              {share !== null ? (
                <p className="mt-0.5 text-xs text-muted">
                  Category presence: ~{share}%{" "}
                  <span className="opacity-70">
                    · context only, not the rank
                  </span>
                </p>
              ) : null}

              {a ? (
                <>
                  <p className="mt-1.5 font-mono text-xs text-muted">
                    <span className="font-semibold text-base-content">
                      Why this rank
                    </span>{" "}
                    {a.evidenced}/{a.domainsTotal} domains evidenced
                    {a.weakestGrade ? ` · weakest evidence ${a.weakestGrade}` : ""}
                  </p>
                  {/* One chip per domain, in the order the assessment weighs
                      them. An unscored domain is a dash, never a zero: it
                      contributes nothing to the composite but it is not a
                      judgement that the vendor scored nothing. */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.domains.map((d) => (
                      <span
                        key={d.domain}
                        title={`${d.domain.replace(/_/g, " ")}: ${
                          d.state === "scored"
                            ? `${d.score} of 5, evidence ${d.grade ?? "ungraded"}, confidence ${d.confidence ?? "?"}%`
                            : "insufficient evidence, contributes zero and still counts toward coverage"
                        }`}
                        className={`min-w-9 rounded px-1.5 py-0.5 text-center font-mono text-xs tabular-nums ${
                          d.state === "scored"
                            ? "bg-base-200 text-base-content"
                            : "border border-dashed border-base-300 text-muted"
                        }`}
                      >
                        {d.state === "scored" && d.score !== null
                          ? d.score.toFixed(1)
                          : "\u2013"}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="border-t border-base-300 px-3 py-2.5">
        <DerivationDrawer title="How this ranking is computed">
          <p>
            The score is the AI Enterprise assessment: a weighted composite, 0
            to 5, of evidence-graded assessment domains. The weights are{" "}
            <strong className="text-base-content">
              specific to each market
            </strong>
            , because a frontier model API and a service desk are not judged on
            the same things, and the number of domains varies with them: seven
            for AI silicon, fourteen for frontier models. A bare accelerator has
            no identity or governance surface, so those domains are excluded
            rather than scored as thin.
          </p>
          <p>
            Each chip is one domain. Every domain&apos;s score is capped by the
            grade of the evidence behind it, so a claim cannot reach the top
            bands without audit-grade proof.{" "}
            <strong className="text-base-content">A dash is not a zero.</strong>{" "}
            It marks a domain with too little evidence to score, which
            contributes nothing to the composite while still counting toward the
            coverage that decides whether the vendor is ranked at all. Hover any
            chip for its grade and confidence.
          </p>
          <p>
            A vendor under 60 per cent domain coverage is{" "}
            <strong className="text-base-content">held rather than ranked</strong>
            , and reads as held here. That is the assessment refusing to place a
            vendor it could not evidence, not a low score.
          </p>
          <p>
            Category presence is <code>estimatedShare</code> inside the selected
            market, and it is context rather than the rank. The source describes
            it as a directional adoption-signal estimate and states plainly that
            it is not measured revenue or market share, which is why it is
            labelled presence and set apart from the score.
            {shareMovementPublished
              ? ""
              : " No movement is published against it yet: every prior estimate in the dataset is identical to the current one, so no change figure is shown rather than a misleading flat zero."}
          </p>
          <p className="measure text-muted">
            The order is the ranking&apos;s own, read rather than recalculated.
            Where two vendors tie, re-sorting on the score would invent a
            tiebreak we did not compute. Ranking runs inside one market and
            never across, so no interaction here can produce a cross-market
            league table.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

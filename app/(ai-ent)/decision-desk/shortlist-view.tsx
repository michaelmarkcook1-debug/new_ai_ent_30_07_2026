"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { useShortlist } from "@/lib/shortlist";
import { shortlistFor, type ShortlistPayload } from "@/lib/desk/shortlist-payload";
import type { JurisdictionFilter } from "@/lib/desk/shortlist";

// Step 3: the three names, and what to do about them.
//
// Steps 1 and 2 answer "what is my situation" and "how do I score the call".
// Neither produces the thing a buyer actually leaves with, which is a short
// list of vendors and a defensible sentence about each. This does, and then
// hands over to the pilot sequence, because a shortlist that ends at the third
// card implies the decision is made when it has only been narrowed.
//
// Every figure is computed on the server from the same composite the vendor
// pages render. Nothing here is written by a model, so the paragraph beside a
// vendor cannot drift from the score above it.

export function ShortlistView({ payload }: { payload: ShortlistPayload }) {
  const [category, setCategory] = useState(payload.defaultCategory);
  // How much foreign-jurisdiction exposure the reader will accept. Default
  // is everything, with the flags shown: a product that silently excluded
  // vendors on our reading of sovereignty would be making the buyer's
  // decision for them.
  const [filter, setFilter] = useState<JurisdictionFilter>("all");
  const [done, setDone] = useState<Set<number>>(new Set());
  // The shortlist the rest of the product already reads. ModelEngine, Trust
  // Rank and Integrators all watch it, so putting these three on it is what
  // carries this decision into the tabs that come after it.
  const { ids, has, toggle: toggleVendor, ready, full } = useShortlist();

  const list = shortlistFor(payload, filter, category);
  const cats = payload.categories;

  // Coverage reads differently once it is complete. At 13 of 43 the sentence
  // had to warn about the two thirds we had not reached; at 43 of 43 that
  // warning describes an empty set and reads as though something is missing.
  // The pass-through rule is still stated, as a standing rule rather than as a
  // caveat about vendors on screen.
  const cov = payload.jurisdictionCoverage;
  const covComplete = cov.assessed === cov.total;

  const shortlisted = list
    ? list.entries.filter((e) => ids.includes(e.vendorId)).length
    : 0;
  const allOn = list ? shortlisted === list.entries.length : false;

  const takeAll = () => {
    if (!list) return;
    for (const e of list.entries) {
      // toggle() would remove the ones already on, which is the opposite of
      // what a button called "take all three" should do.
      if (!has(e.vendorId)) toggleVendor(e.vendorId);
    }
  };

  const toggleStep = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const progress = useMemo(
    () => `${done.size} of ${payload.steps.length}`,
    [done.size, payload.steps.length]
  );

  return (
    <div className="space-y-4 py-4">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="Which market are you buying in"
            tooltip="The composite rests on capability scores that are comparable only inside a market category, so the ranking never crosses one."
          />
          <LaneBadge lane="derived" />
        </div>
        <p className="measure mt-2 text-sm text-muted">
          Capability is scored within a category, never across one, so this asks
          which market you are buying in before it names anybody. A frontier lab
          and a chip maker do not share a scale.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(c.category)}
              aria-pressed={category === c.category}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                category === c.category
                  ? "border-primary bg-primary/[0.08] font-semibold text-primary"
                  : "border-base-300 hover:border-primary/50"
              }`}
            >
              {c.category}
              <span className="ml-1.5 font-mono text-sm text-muted">
                {c.scored}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Jurisdiction. A real buyer constraint, answered from the Sovereignty
          Lens rather than from a list of countries we decided we disliked. */}
      <section>
        <MicroLabel
          label="Whose law reaches your data"
          tooltip="From the Sovereignty Lens on Trust Rank: the jurisdiction of the company holding your data, not only where the data sits."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["all", "Rank everybody"],
              ["no-stop", "Exclude hard stops"],
              ["cleared", "Exclude anything flagged"],
            ] as [JurisdictionFilter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                filter === f
                  ? "border-primary bg-primary/[0.08] font-semibold text-primary"
                  : "border-base-300 hover:border-primary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* The sentence that stops this control being worse than useless. */}
        <p className="measure mt-2 text-sm text-muted">
          Jurisdiction is established for{" "}
          <span className="font-semibold">
            {covComplete
              ? `all ${cov.total}`
              : `${cov.assessed} of the ${cov.total}`}
          </span>{" "}
          scored vendors, and how we know it differs:{" "}
          <span className="font-semibold">
            {cov.fromDocument} from the vendor&rsquo;s own published terms
          </span>
          , which is the stronger answer because it says where your data sits,
          and{" "}
          <span className="font-semibold">
            {cov.fromPublicRecord} from public record
          </span>
          , which establishes only which legal system reaches the company, not
          where it keeps your data.{" "}
          {covComplete
            ? "A vendor we had not reached would be ranked rather than excluded, because silence is not clearance. There are none today."
            : "A vendor we have not reached is left in the ranking rather than excluded: it has not been cleared, it has not been looked at."}
        </p>
      </section>

      {!list ? (
        <p className="measure rounded-lg border border-dashed border-base-300 px-4 py-4 text-sm text-muted">
          No vendor in this category carries a published input, so there is
          nothing to rank. That is a gap in what is published, not a verdict on
          the market.
        </p>
      ) : (
        <>
          {list.excluded.length > 0 ? (
            <div className="rounded-lg border border-base-300 bg-base-200/40 px-4 py-3">
              <p className="micro-label">
                Dropped by your jurisdiction setting
              </p>
              <ul className="measure mt-2 space-y-1 text-sm">
                {list.excluded.map((x) => (
                  <li key={x.name}>
                    <span className="font-semibold">{x.name}</span>
                    <span className="text-muted"> ({x.hq}). {x.why}</span>
                  </li>
                ))}
              </ul>
              <p className="measure mt-2 text-sm text-muted">
                Named rather than removed quietly. A vendor that drops off a
                ranking without a reason is a decision made on your behalf.
              </p>
            </div>
          ) : null}

          {list.shortfall ? (
            <p className="measure rounded-lg border border-warn/30 bg-warn-bg/40 px-4 py-3 text-sm text-warn">
              {list.shortfall}
            </p>
          ) : null}

          {/* Taking these forward is what makes the rest of the section about
              them. Said in those terms rather than "add to shortlist", because
              the useful fact is what happens on the next four tabs, not that a
              list somewhere grew. */}
          {ready && list.entries.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-3">
              <p className="measure text-sm">
                {shortlisted === 0 ? (
                  <>
                    Take these forward and the rest of this section follows
                    them: ModelEngine prices them for a role, Trust Rank reads
                    their contracts and tells you what changed overnight, and
                    Integrators shows who would actually deliver them.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">
                      {shortlisted} of {list.entries.length} taken forward.
                    </span>{" "}
                    ModelEngine, Trust Rank and Integrators are now about{" "}
                    {shortlisted === 1 ? "this vendor" : "these vendors"}.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={takeAll}
                disabled={allOn || full}
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {allOn
                  ? "All taken forward"
                  : `Take all ${list.entries.length} forward`}
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-3">
            {list.entries.map((e) => (
              <article
                key={e.vendorId}
                className="flex flex-col rounded-xl border border-base-300 bg-base-100 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="micro-label text-primary">
                      Shortlisted {e.rank} of {list.entries.length}
                    </span>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight">
                      {e.name}
                    </h3>
                    {e.marketPosition ? (
                      <p className="text-sm text-muted">{e.marketPosition}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-2xl font-bold leading-none">
                      {e.score}
                    </p>
                    <p className="mt-1 font-mono text-sm text-muted">
                      {e.inputsPresent} of 3 inputs
                    </p>
                  </div>
                </div>

                {e.jurisdiction ? (
                  // title carries the reasoning in full. Every note is written
                  // to be checkable, so a reader can accept the facts and
                  // reject the inference rather than take the flag on trust.
                  <p
                    title={e.jurisdiction.why}
                    className={`mt-2 rounded px-2 py-1 text-sm ${
                      e.jurisdiction.flag === "hard-stop"
                        ? "bg-bad-bg text-error"
                        : e.jurisdiction.flag === "consideration"
                          ? "bg-warn-bg text-warn"
                          : "bg-base-200 text-muted"
                    }`}
                  >
                    {e.jurisdiction.hq}
                    {e.jurisdiction.flag !== "none"
                      ? ` · ${e.jurisdiction.flag === "hard-stop" ? "hard stop" : "consideration"}`
                      : ""}
                    {/* How we know, because the two are not the same claim: a
                        fetched policy says where the data sits, public record
                        only says which legal system reaches the company. */}
                    <span className="opacity-70">
                      {" · "}
                      {e.jurisdiction.basis === "vendor-document"
                        ? "their terms"
                        : "public record"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 rounded bg-base-200 px-2 py-1 text-sm text-muted">
                    Jurisdiction not yet established
                  </p>
                )}

                {/* The paragraph the reader asked for: one per card, and every
                    clause a restatement of a figure above it. */}
                <p className="measure mt-3 flex-1 text-sm leading-relaxed">
                  {e.reason}
                </p>

                <p className="measure mt-3 border-t border-base-300 pt-3 text-sm text-muted">
                  {e.limit}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {ready ? (
                    <button
                      type="button"
                      onClick={() => toggleVendor(e.vendorId)}
                      aria-pressed={has(e.vendorId)}
                      disabled={!has(e.vendorId) && full}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                        has(e.vendorId)
                          ? "bg-good-bg text-good"
                          : "bg-primary text-white hover:opacity-90"
                      }`}
                    >
                      {has(e.vendorId) ? "On your shortlist" : "Take forward"}
                    </button>
                  ) : (
                    // Reserve the height so the card does not jump once the
                    // stored list has been read.
                    <span className="inline-block h-8" aria-hidden />
                  )}
                  <Link
                    href={`/vendor-view/${e.vendorId}`}
                    className="text-sm font-semibold text-insight underline underline-offset-2"
                  >
                    Full profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {/* Narrowed is not decided. The sequence that turns three names into a
          defensible choice, and it is the reader's own data that does it. */}
      <section className="rounded-xl border border-base-300 bg-base-200/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="What to do next"
            tooltip="A shortlist narrows the field. Only your own evaluation closes it, and this is the order that keeps the result defensible."
          />
          <span className="font-mono text-sm text-muted">{progress} done</span>
        </div>
        <p className="measure mt-2 text-sm">
          These three are where to start looking, not who to buy. The ranking
          reads published evidence and cannot see your data, your latency bar or
          your price. Running these seven steps against the shortlist is what
          turns it into a decision you can defend, and step seven is the one
          most pilots skip.
        </p>

        <ol className="mt-4 space-y-2">
          {payload.steps.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => toggleStep(i)}
                aria-pressed={done.has(i)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  done.has(i)
                    ? "border-good/40 bg-good-bg/40"
                    : "border-base-300 bg-base-100 hover:border-primary/50"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${done.has(i) ? "text-good" : "text-primary"}`}
                  >
                    {done.has(i) ? "done" : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-semibold">{s.title}</span>
                </div>
                <p className="measure mt-1 text-sm text-muted">{s.why}</p>
                <p className="measure mt-1 text-sm">{s.how}</p>
              </button>
            </li>
          ))}
        </ol>

        <p className="measure mt-3 text-sm text-muted">
          Ticking a step marks it off for this visit only. Nothing is stored and
          nothing is reported back to us.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/trust-rank"
            className="rounded-full border border-base-300 px-4 py-2 text-sm font-semibold transition hover:border-primary/50"
          >
            Check what their contracts permit
          </Link>
          <Link
            href="/price-performance"
            className="rounded-full border border-base-300 px-4 py-2 text-sm font-semibold transition hover:border-primary/50"
          >
            Price the work against capability
          </Link>
        </div>
      </section>

      <DerivationDrawer
        title="How these three were chosen, and what would change them"
        trigger="How this shortlist is derived"
      >
        <p>
          Each vendor carries up to three published inputs: assessed capability,
          reputation across customer, developer and employee sources, and what
          the company discloses about its finances. The composite weights them{" "}
          {payload.weightNote}, and where an input is unpublished the weights are
          renormalised over the ones that exist rather than treating the absence
          as a zero. A vendor with one published input therefore gets a score
          built on one, and its card says so.
        </p>
        <p>
          <strong className="text-base-content">
            Ranked inside one category, never across.
          </strong>{" "}
          Capability is assessed relative to the other vendors doing the same
          job, so the number means something against a peer and nothing against
          a company in a different market. Where a category holds fewer than
          three scored vendors the list is shorter, and it says so instead of
          reaching into a neighbouring category to fill the third card.
        </p>
        <p>
          <strong className="text-base-content">
            The paragraph is computed, not written.
          </strong>{" "}
          Every clause restates a figure on the card above it. No model writes
          this, so the reason cannot drift from the score it explains, and it
          reads the same whether or not the analyst is reachable.
        </p>
        <p className="text-muted">
          This is a starting point for evaluation, not a recommendation to buy.
          It does not price the work, does not know your stack or your data
          residency, and does not read your contract. Trust Rank answers the
          contract question and the seven steps above answer the rest.
        </p>
      </DerivationDrawer>
    </div>
  );
}

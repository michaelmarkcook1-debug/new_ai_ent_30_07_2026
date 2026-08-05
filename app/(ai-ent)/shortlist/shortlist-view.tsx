"use client";

import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import { useShortlist } from "@/lib/shortlist";
import { categoryNamesForVendor } from "@/lib/comparability";
import type { VendorMetrics } from "@/lib/market-metrics";

// The shortlist, compared.
//
// Every column is a real field carried through from its own source, and a
// vendor the dataset does not reach shows an empty cell rather than a zero.
// Comparability still applies: vendors from different market categories are
// not competing on the same yardstick, so the view says which categories are
// in play rather than presenting one ranked league table.

export function ShortlistView({ vendors }: { vendors: VendorMetrics[] }) {
  const { ids, ready, remove, clear } = useShortlist();

  if (!ready) {
    return <p className="text-sm text-muted">Reading your shortlist…</p>;
  }

  if (ids.length === 0) {
    return (
      <EmptyState
        title="Your shortlist is empty"
        detail="Add vendors with the + button wherever they appear: on a workflow shortlist in Model 4 Role, in the Vendor View rankings, or on the Competitive Intel matrix. The list is kept in this browser only."
      />
    );
  }

  const rows = ids
    .map((id) => vendors.find((v) => v.id === id))
    .filter((v): v is VendorMetrics => Boolean(v));

  const missing = ids.length - rows.length;

  // Which market categories the shortlist spans. More than one means the
  // scores are not directly comparable and the view has to say so.
  const categories = new Set(
    rows.flatMap((r) => categoryNamesForVendor(r.id))
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Your shortlist"
              tooltip="Vendors you have added, compared on the fields the datasets actually publish."
            />
            <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs text-muted">
              {rows.length} vendor{rows.length === 1 ? "" : "s"}
            </span>
            <LaneBadge lane="aie-live" />
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-base-300 px-2.5 py-1.5 text-xs text-muted transition hover:border-error hover:text-error"
          >
            Clear all
          </button>
        </div>

        {categories.size > 1 ? (
          <p className="border-b border-base-300 px-3 py-2 text-xs text-muted">
            This shortlist spans {categories.size} market categories (
            {[...categories].slice(0, 4).join(", ")}
            {categories.size > 4 ? " and others" : ""}). Scores are comparable
            inside a category, not across one, so read the columns as a profile
            of each vendor rather than as a single ranking.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                {[
                  "Vendor",
                  "AG score",
                  "Capability",
                  "Reputation",
                  "Momentum",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-base-200/60">
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/vendor-view/${v.id}`}
                      className="text-sm font-semibold hover:text-primary hover:underline"
                    >
                      {v.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {v.marketPosition ?? v.category}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ScorePill score={v.composite} />
                  </td>
                  <td className="px-3 py-2.5">
                    <ScorePill score={v.maturity} />
                  </td>
                  <td className="px-3 py-2.5">
                    {v.reputation === null ? (
                      <span className="font-mono text-xs text-muted">
                        not covered
                      </span>
                    ) : (
                      <ScorePill score={v.reputation} />
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {v.momentum === null ? (
                      <span className="font-mono text-xs text-muted">
                        not published
                      </span>
                    ) : (
                      <ScorePill score={v.momentum} />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => remove(v.id)}
                      title={`Remove ${v.name}`}
                      className="rounded-md border border-base-300 px-2 py-0.5 text-xs text-muted transition hover:border-error hover:text-error"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {missing > 0 ? (
          <p className="border-t border-base-300 px-3 py-2 text-xs text-muted">
            {missing} shortlisted{" "}
            {missing === 1 ? "vendor is" : "vendors are"} not in the tracked
            metric set, so {missing === 1 ? "it has" : "they have"} no row here.
          </p>
        ) : null}

        <div className="border-t border-base-300 px-3 py-2.5">
          <DerivationDrawer title="What these columns are">
            <p>
              AG score is AG&apos;s own overall assessment of the vendor.
              Capability is the mean evidence-graded maturity across its
              assessed capabilities. Reputation is the mean of the customer,
              developer and employee pillars. Momentum is the rolling 30 day
              reading, published for a subset of vendors only.
            </p>
            <p className="measure text-muted">
              A vendor the dataset does not reach shows what is missing rather
              than a zero. The shortlist itself lives in this browser and is
              never sent anywhere.
            </p>
          </DerivationDrawer>
        </div>
      </section>

      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="Take it further"
          tooltip="Where to go next with this set."
        />
        <ul className="mt-2 grid grid-cols-1 gap-2 @xl:grid-cols-2">
          {[
            ["/trust-rank", "Check governance and regulatory exposure"],
            ["/trust-rank", "Check what regulation binds you and which vendors carry open risk"],
            ["/price-performance", "Compare what capability costs"],
            ["/decision-desk", "Ask the analyst about this shortlist"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="block rounded-lg border border-base-300 px-3 py-2.5 text-sm transition hover:border-primary hover:text-primary"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

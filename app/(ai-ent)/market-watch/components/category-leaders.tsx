import Link from "next/link";
import { CategoryChip, LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import type { LeaderView, WatchlistView } from "../data";

// "Leaders by category": the top vendor per category by seed share estimate,
// with the seed's own composite score, position label and watchlist coverage.

function VendorLink({
  vendorId,
  name,
  tracked,
  className,
}: {
  vendorId: string;
  name: string;
  tracked: boolean;
  className?: string;
}) {
  if (!tracked) return <span className={className}>{name}</span>;
  return (
    <Link
      href={`/vendor-view/${vendorId}`}
      className={`${className ?? ""} hover:text-primary hover:underline`}
    >
      {name}
    </Link>
  );
}

export function CategoryLeaders({
  leaders,
  watchlists,
}: {
  leaders: LeaderView[];
  watchlists: WatchlistView[];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Leaders by category</h2>
        <LaneBadge lane="aie" />
      </div>
      <p className="mt-1 measure text-[11px] text-muted">
        Leadership here means the highest seed share estimate in each category,
        shown with the dataset&apos;s own composite scores. No
        ranking beyond the dataset&apos;s own fields is applied.
      </p>
      <div className="mt-1">
        <DerivationDrawer title="How the category leaders are derived">
          <p>
            The leader of each category is the vendor with the highest{" "}
            <code>estimatedShare</code> in the AIE market share seed for that
            category; &quot;also placed&quot; lists the next two by the same field.
          </p>
          <p>
            The composite score is the dataset&apos;s own <code>overallScore</code>{" "}
            (0 to 100) for the vendor, an analyst seed estimate carrying its own
            estimate, shown here with an &quot;est.&quot; marker. The position
            label (Leader, Major challenger and so on) is also the dataset&apos;s own
            banding of that score, not a judgement made by this demo.
          </p>
          <p className="measure text-muted">
            No medal or league-table treatment is applied: within a category the
            order is simply the seed share field, and cross-category comparison
            is not meaningful because each category is modelled separately.
          </p>
        </DerivationDrawer>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-base-300 bg-base-100">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2"><span className="micro-label">Category</span></th>
              <th className="px-3 py-2"><span className="micro-label">Leader</span></th>
              <th className="px-3 py-2"><span className="micro-label">Position (seed label)</span></th>
              <th className="px-3 py-2 text-right"><span className="micro-label">Share est.</span></th>
              <th className="px-3 py-2 text-right"><span className="micro-label">Composite score</span></th>
              <th className="px-3 py-2"><span className="micro-label">Also placed</span></th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((row) => (
              <tr key={row.categoryId} className="border-b border-base-300/60 last:border-0">
                <td className="px-3 py-2 text-[12px] font-medium">{row.categoryName}</td>
                <td className="px-3 py-2">
                  <VendorLink
                    vendorId={row.leader.vendorId}
                    name={row.leader.name}
                    tracked={row.leader.tracked}
                    className="text-[12px] font-semibold"
                  />
                </td>
                <td className="px-3 py-2 text-[11px] text-muted">
                  {row.leader.marketPosition}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-mono text-[11px] font-semibold">
                    {row.leader.share}%
                    <span className="ml-0.5 font-normal text-muted">est.</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <ScorePill score={row.leader.overallScore} estimated />
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                    {row.runnersUp.map((r) => (
                      <VendorLink
                        key={r.vendorId}
                        vendorId={r.vendorId}
                        name={`${r.name} (${r.share}%)`}
                        tracked={r.tracked}
                        className="text-[11px] text-muted"
                      />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Watchlists from the dataset */}
      <div className="mt-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold">Dataset watchlists</h3>
          <LaneBadge lane="aie" />
        </div>
        <p className="measure mt-0.5 text-[11px] text-muted">
          Watchlist groupings defined in the AIE dataset itself, useful cohorts
          for tracking rather than rankings.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
          {watchlists.map((w) => (
            <div key={w.id} className="rounded-lg border border-base-300 bg-base-100 p-3">
              <p className="text-[12px] font-semibold">{w.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {w.vendors.map((v) =>
                  v.tracked ? (
                    <Link
                      key={v.id}
                      href={`/vendor-view/${v.id}`}
                      className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-base-content/85 hover:border-primary hover:text-primary"
                    >
                      {v.name}
                    </Link>
                  ) : (
                    <span
                      key={v.id}
                      className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-muted"
                    >
                      {v.name}
                    </span>
                  ),
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {w.categories.map((c) => (
                  <CategoryChip key={c} label={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

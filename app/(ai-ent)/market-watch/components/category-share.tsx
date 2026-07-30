import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { formatDate, type CategoryShareView } from "../data";

// "The market by category": the 13 AIE market categories with their seed
// share estimates rendered as bars and the seed's own change and confidence
// labels rendered untouched.

function DeltaArrow({ changePct }: { changePct: number }) {
  const colour =
    changePct > 0 ? "text-good" : changePct < 0 ? "text-error" : "text-muted";
  const glyph = changePct > 0 ? "▲" : changePct < 0 ? "▼" : "▬";
  return (
    <span
      className={`font-mono text-[10px] ${colour}`}
      title="Change versus the seed's previous estimate for this vendor, in per cent"
    >
      {glyph} {changePct > 0 ? "+" : ""}
      {changePct}%
    </span>
  );
}

function VendorName({
  vendorId,
  name,
  tracked,
}: {
  vendorId: string;
  name: string;
  tracked: boolean;
}) {
  if (!tracked) return <span className="text-[12px] font-medium">{name}</span>;
  return (
    <Link
      href={`/vendor-view/${vendorId}`}
      className="text-[12px] font-medium hover:text-primary hover:underline"
    >
      {name}
    </Link>
  );
}

export function CategoryShare({ categories }: { categories: CategoryShareView[] }) {
  const methodology = categories[0]?.methodology ?? "";
  const source = categories[0]?.source ?? "";
  const sourceDate = categories[0]?.sourceDate ?? "";
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">The market by category</h2>
        <LaneBadge lane="aie" />
        <span className="micro-label">Dataset dated</span>
        <span className="font-mono text-[10px] text-muted">{formatDate(sourceDate)}</span>
      </div>
      <p className="mt-1 max-w-3xl text-[11px] text-muted">
        Native estimate label from the dataset: &quot;{methodology}&quot; Source: {source}.
      </p>
      <div className="mt-1">
        <DerivationDrawer title="How category shares are derived">
          <p>
            Every bar is the <code>estimatedShare</code> field from the AIE market
            share seed, shown in per cent of the category. The delta arrow is the
            dataset&apos;s own <code>changePct</code>: the movement versus its previous
            estimate. The small &quot;conf&quot; figure is the row&apos;s native confidence
            label (0 to 100).
          </p>
          <p className="text-muted">
            These are directional seed estimates, not audited market shares; the
            dataset says so in its own methodology string and that label is kept
            visible above. Where named vendors cover less than 100 per cent of a
            category, the remainder is simply not modelled, so no bar is drawn
            for it.
          </p>
        </DerivationDrawer>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <h3 className="text-[13px] font-bold">{cat.name}</h3>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">{cat.description}</p>
            <div className="mt-3 space-y-2">
              {cat.rows.map((row) => (
                <div key={row.vendorId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <VendorName
                      vendorId={row.vendorId}
                      name={row.vendorName}
                      tracked={row.tracked}
                    />
                    <div className="flex items-baseline gap-2">
                      <DeltaArrow changePct={row.changePct} />
                      <span className="font-mono text-[11px] font-semibold">
                        {row.share}%
                        <span className="ml-0.5 font-normal text-muted">est.</span>
                      </span>
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-200">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.min(100, row.share)}%` }}
                      />
                    </div>
                    <span
                      className="font-mono text-[9px] text-muted"
                      title="Native confidence label from the AIE share seed (0 to 100)"
                    >
                      conf {row.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 border-t border-base-300/60 pt-2 text-[10px] text-muted">
              Named vendors cover {cat.namedShareTotal} per cent of this category in
              the seed model; the rest is not modelled.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

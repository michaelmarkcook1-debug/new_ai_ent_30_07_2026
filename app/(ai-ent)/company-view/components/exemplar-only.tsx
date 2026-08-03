import Link from "next/link";

// Shown on a Company View tab when a BoardRadar-covered company is selected
// but this particular tab has no live equivalent behind it. Saying so beats
// rendering the Shell exemplar's figures under that company's name, which
// would attribute one organisation's numbers to another.
export function ExemplarOnly({
  tab,
  pathname,
  reason,
}: {
  tab: string;
  pathname: string;
  reason?: string;
}) {
  return (
    <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 px-4 py-6">
      <h2 className="text-base font-bold">
        {tab} has no live source for this company
      </h2>
      <p className="mt-1 measure text-sm text-muted">
        {reason ??
          "The BoardRadar API publishes no equivalent of this tab, so there is nothing real to show for the selected company."}{" "}
        The exemplar buyer&apos;s content is not shown here: it describes a
        different organisation, and putting it under this company&apos;s name
        would attribute figures to the wrong business.
      </p>
      <Link
        href={pathname}
        className="mt-3 inline-block rounded-full border border-primary px-3 py-1.5 text-sm font-semibold text-primary"
      >
        Back to the Shell exemplar
      </Link>
    </section>
  );
}

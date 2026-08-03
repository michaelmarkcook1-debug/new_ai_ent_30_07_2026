import { LaneBadge } from "@/lib/ui/badges";
import type { CompanySelection } from "@/lib/company-source";
import { CompanySelect } from "./company-select";

// Header for the Company View: which company is on screen and where its
// figures come from.
//
// A server component, rendered by each tab page from the resolved query
// parameter. It lived in the layout before, but layouts do not receive
// searchParams, and reading them from a client component inside a Suspense
// boundary left the header unhydrated. Rendering it per page keeps the title,
// the badge and the dropdown in agreement on the first paint.

export function CompanyHeader({
  company,
  displayName,
}: {
  company: CompanySelection;
  /** Resolved company name where the caller knows it; the ticker otherwise. */
  displayName?: string | null;
}) {
  const title = displayName?.trim() || company.name;
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-md font-display text-sm font-extrabold ${
            company.live ? "bg-good-bg text-good" : "bg-warn-bg text-warn"
          }`}
        >
          {title.slice(0, 1).toUpperCase()}
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">
          {company.live ? "BoardRadar coverage" : "Exemplar buyer"}
        </span>
        <LaneBadge lane={company.live ? "live" : "sample"} />
        <CompanySelect selected={company.ticker} />
      </div>
      <p className="mt-0.5 font-mono text-xs text-muted">{today}</p>
      <p className="mt-1 measure text-sm text-muted">
        {company.live ? (
          <>
            The tailored view a customer sees of their own organisation, run
            against a company BoardRadar covers. Tabs with a live equivalent
            fetch real figures; where the API has no analysis for this company
            the tab says so rather than filling the gap.
          </>
        ) : (
          <>
            The tailored view a customer sees of their own organisation. Shell
            is an energy major and the coverage universe is technology,
            financial services and telecoms, so Shell is not in it: every
            figure here is a SAMPLE shaped exactly like the live response
            schemas. Pick a covered company above to see the same tabs on real
            data.
          </>
        )}
      </p>
    </header>
  );
}

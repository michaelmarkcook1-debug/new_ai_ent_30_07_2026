import type { CompanySelection } from "@/lib/company-source";
import { CompanyHeader } from "./company-header";
import { CompanyTabs } from "./tabs";

// Wraps a Company View tab: the header for the selected company, the tab
// strip that carries that selection between tabs, then the tab's own content.
// Pages render this rather than the layout, because only pages receive
// searchParams.
export function CompanyShell({
  company,
  displayName,
  children,
}: {
  company: CompanySelection;
  displayName?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <CompanyHeader company={company} displayName={displayName} />
      <CompanyTabs company={company.ticker} />
      <div className="mt-4">{children}</div>
    </div>
  );
}

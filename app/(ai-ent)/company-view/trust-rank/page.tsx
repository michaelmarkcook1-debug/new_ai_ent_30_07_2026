import { PageHeader } from "@/lib/ui/page";
import { CompanyEntry } from "../components/company-entry";
import { ResearchedCompany } from "../components/researched-company";
import { researchTopic } from "@/lib/research/company";

export const metadata = { title: "Governance and Obligations | AI Enterprise" };

// This page carried the Shell fixture's own figures for whoever was reading.
// None of that was retrievable per company, so it reports what the open
// sources say about the named company and leaves the rest empty rather than
// shaped like data.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).company;
  const typed = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const research = typed.length > 1 ? await researchTopic(typed, "governance") : null;

  return (
    <>
      <PageHeader
        title="Governance and Obligations"
        subtitle="The regulatory and compliance obligations this company operates under."
        lanes={["live"]}
      />
      <div className="space-y-4">
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <CompanyEntry />
        </section>
        {research ? (
          <ResearchedCompany research={research} />
        ) : (
          <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-6">
            <h2 className="text-base font-bold">Name a company to begin</h2>
            <p className="measure mt-1.5 text-sm text-muted">
              Public sources are retrieved when you ask, and every statement
              carries the link behind it. Where the sources are silent, so is
              this page.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

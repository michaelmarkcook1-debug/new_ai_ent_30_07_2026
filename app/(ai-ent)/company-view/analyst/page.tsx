import { Suspense } from "react";
import { resolveCompany } from "@/lib/company-source";
import { CompanyShell } from "../components/company-shell";
import { ExemplarOnly } from "../components/exemplar-only";
import { AnalystView } from "./analyst-view";

export const metadata = { title: "AI Analyst | AI Enterprise" };

const PRELOADED = [
  "Shell AI vendor assessment brief (sample)",
  "EU AI Act readiness note (sample)",
  "Integrator shortlist memo (sample)",
];

export default async function AnalystPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = resolveCompany((await searchParams).company);
  return (
    <CompanyShell company={company}>
      {company.live ? (
        <ExemplarOnly
          tab="AI Analyst"
          pathname="/company-view/analyst"
          reason="The analyst is grounded in the exemplar buyer's own documents, and no document set is held for the selected company."
        />
      ) : (
        <Suspense>
          <AnalystView preloaded={PRELOADED} />
        </Suspense>
      )}
    </CompanyShell>
  );
}

import { PageHeader } from "@/lib/ui/page";
import { AdminOverview } from "./admin-overview";

export const metadata = { title: "Admin | AI Enterprise" };

// The admin page (5 August 2026). Operator answers on one screen: did the
// ingestions run, what did they write, what would they cost, are the
// connectors up, and is anyone using the tools.
//
// Public on purpose. The rest of the site shows its provenance; hiding the
// operations page would be the one closed door in an open kitchen. Nothing
// here is served that could not already be derived from the public endpoints
// and the public catalogue views: the usage numbers come through an
// aggregate-only function, and the raw usage table stays unreadable from
// outside by row-level security.

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Admin"
        subtitle="The operations view: ingestion runs and what each costs, catalogue counts, connector health, and anonymous usage totals. Every cost figure is measured quantities times published unit prices, and the headline is stated plainly: on current plans, runs cost nothing."
        lanes={["live", "derived"]}
      />
      <AdminOverview />
    </>
  );
}

import { PageHeader } from "@/lib/ui/page";
import { DataOperations } from "./data-operations";

export const metadata = { title: "Data operations | AI Enterprise" };

// Manual discovery, review, categorisation, validation and ingestion of the
// canonical AI Enterprise payloads (6 September 2026). Nothing on this page
// happens on a schedule and nothing moves into canonical data until a person
// presses "Ingest approved changes". Discovery, review and validation work
// everywhere; ingestion works on an operator's checkout with DATAOPS_WRITE=1,
// and the commit that follows is what makes it real. Like /admin, this is
// reachable by URL and not from the sidebar.

export default function DataOperationsPage() {
  return (
    <>
      <PageHeader
        title="Data operations"
        subtitle="Discover what the AI Enterprise source holds now, see it against what this product holds, decide what each new entity is, validate, and only then ingest. Every step is started by a person. Nothing here calls the analyst model: a reading is authored when a reader next opens a page whose evidence moved."
        lanes={["aie-live", "aie"]}
      />
      <DataOperations />
    </>
  );
}

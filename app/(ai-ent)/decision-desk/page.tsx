import { PageHeader } from "@/lib/ui/page";
import { loadShellFixture } from "@/lib/shell-fixture";
import { DecisionDeskView } from "./decision-desk-view";

export const metadata = { title: "Decision Desk | AI Enterprise" };

// The Decision Desk (3 August 2026). Interrogate and Assess and Decide were
// separate top-level tabs, which read as two products; they are one moment in
// the CIO's journey — converging on a call that must survive a board or a
// procurement committee — so they now sit together as numbered steps. The old
// routes redirect here with their query strings intact.
export default async function DecisionDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = await loadShellFixture();
  // Arriving with a situation to interrogate opens the finding tool whatever
  // the tool parameter says: the visitor brought a question, answer it.
  const initialTool =
    sp.tool === "assess" && !sp.q && !sp.situation ? "assess" : "finding";
  return (
    <>
      <PageHeader
        title="Decision Desk"
        subtitle="Converge on a call you can defend: describe your situation for a source-cited finding, then score the decision against your own weights with the derivation open. Nothing here invents a figure."
        lanes={["aie-live", "aie", "sample"]}
      />
      <DecisionDeskView assessment={f.assess.assessment} initialTool={initialTool} />
    </>
  );
}

import { PageHeader } from "@/lib/ui/page";
import { loadShellFixture } from "@/lib/shell-fixture";
import { AssessDecideView } from "./assess-decide-view";

export const metadata = { title: "Assess and Decide | New AI.Ent" };

// Assess and Decide, promoted to its own tab (30 July 2026). Mirrors the
// deployed AI Enterprise assessment: three depth tiers, the six-pillar
// methodology with live default weights, dynamic re-weighting, and the
// worked derivation drawer applied to the exemplar buyer's decision.
export default async function AssessDecidePage() {
  const f = await loadShellFixture();
  return (
    <>
      <PageHeader
        title="Assess and Decide"
        subtitle="What should your organisation deploy? Pick a depth tier, weight the dimensions to your priorities, and read the decision with its full derivation: the scores never move, only your weights do."
        lanes={["aie-live", "aie", "sample"]}
      />
      <AssessDecideView assessment={f.assess.assessment} />
    </>
  );
}

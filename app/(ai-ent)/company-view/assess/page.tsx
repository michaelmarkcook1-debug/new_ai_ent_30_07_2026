import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { loadShellFixture } from "../data";
import { AssessView } from "./assess-view";

export const metadata = { title: "Assess and Decide: Shell | New AI.Ent" };

// The 4-dimension weighted framework from /assessment/framework applied to
// the buyer's AI adoption decision. The derivation drawer here is one of
// the two moments that sell the product (spec Phase 2).
export default async function AssessPage() {
  const f = await loadShellFixture();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Assessment subject"
          tooltip="The weighted framework schema is the live /assessment/framework shape; the subject here is the buyer's adoption decision rather than a provider."
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted">
            Generated {f.assess.assessment.generated}
          </span>
          <LaneBadge lane="sample" />
        </div>
      </div>
      <AssessView assessment={f.assess.assessment} />
    </div>
  );
}

import { PageHeader } from "@/lib/ui/page";
import { loadSecurityDeskFixture } from "./data";
import { CyberRiskPanel } from "./components/cyber-risk-panel";
import { LabsSection } from "./components/labs-section";

export const metadata = { title: "The Security Desk | New AI.Ent" };

export default async function SecurityDeskPage() {
  const fixture = await loadSecurityDeskFixture();
  return (
    <>
      <PageHeader
        title="The Security Desk"
        subtitle="Cyber risk posture across the AI platform vendors: live BoardRadar analysis where coverage exists, honest empty states where it does not, and sample-badged posture prompts for the private labs."
        lanes={["live", "sample"]}
      />
      <div className="space-y-6">
        <CyberRiskPanel />
        <LabsSection labs={fixture.labs} />
      </div>
    </>
  );
}

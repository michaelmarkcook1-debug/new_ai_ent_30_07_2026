import { PageHeader } from "@/lib/ui/page";
import { loadLabPostures } from "./data";
import { CyberRiskPanel } from "./components/cyber-risk-panel";
import { LabsSection } from "./components/labs-section";

export const metadata = { title: "The Security Desk | AI Enterprise" };

export default async function SecurityDeskPage() {
  const labs = await loadLabPostures();
  return (
    <>
      <PageHeader
        title="The Security Desk"
        subtitle="Cyber risk posture across the AI platform vendors: live BoardRadar incident analysis where coverage exists, honest empty states where it does not, and the AI Enterprise security capability assessment for the private labs BoardRadar does not reach."
        lanes={["live", labs.lane]}
      />
      <div className="space-y-6">
        <CyberRiskPanel />
        <LabsSection view={labs} />
      </div>
    </>
  );
}

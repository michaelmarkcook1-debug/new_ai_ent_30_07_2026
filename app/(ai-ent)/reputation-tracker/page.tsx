import { PageHeader } from "@/lib/ui/page";
import { loadReputationFixture } from "./data";
import { AiePillarsSection } from "./components/aie-pillars";
import { LiveUnifiedSection } from "./components/live-unified";
import { ThirdPartySignals } from "./components/third-party";

export const metadata = { title: "Reputation Tracker | AI Enterprise" };

export default async function ReputationTrackerPage() {
  const fixture = await loadReputationFixture();
  return (
    <>
      <PageHeader
        title="Reputation Tracker"
        subtitle="How the AI vendor set is perceived by the people who use it, build on it and work in it: three AIE reputation pillars, the live BoardRadar unified read for the platform players, and clearly separated third-party signals."
        lanes={["aie", "live", "sample"]}
      />
      <div className="space-y-4">
        <AiePillarsSection />
        <LiveUnifiedSection />
        <ThirdPartySignals fixture={fixture} />
      </div>
    </>
  );
}

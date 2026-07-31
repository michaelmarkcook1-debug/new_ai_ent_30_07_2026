import { PageHeader } from "@/lib/ui/page";
import { loadPulseFixture, loadPulseMetrics } from "./data";
import { PulseView } from "./components/pulse-view";
import { loadNarrativeGap } from "@/lib/narrative-gap";

export const metadata = { title: "The Pulse | AI Enterprise" };

export default async function PulsePage() {
  const [fixture, metrics, gap] = await Promise.all([
    loadPulseFixture(),
    loadPulseMetrics(),
    loadNarrativeGap(),
  ]);
  return (
    <>
      <PageHeader
        title="The Pulse"
        subtitle="The daily read on the enterprise AI market: model moves, adoption signals, regulation and spend, with the delivery channel watched live."
        lanes={[metrics.lane, "live", "derived", "sample"]}
      />
      <PulseView fixture={fixture} metrics={metrics} gap={gap} />
    </>
  );
}

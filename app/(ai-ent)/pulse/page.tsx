import { PageHeader } from "@/lib/ui/page";
import { loadPulseFixture } from "./data";
import { PulseView } from "./components/pulse-view";

export const metadata = { title: "The Pulse | AI Enterprise" };

export default async function PulsePage() {
  const fixture = await loadPulseFixture();
  return (
    <>
      <PageHeader
        title="The Pulse"
        subtitle="The daily read on the enterprise AI market: model moves, adoption signals, regulation and spend, with the delivery channel watched live."
        lanes={["sample", "live", "aie-live"]}
      />
      <PulseView fixture={fixture} />
    </>
  );
}

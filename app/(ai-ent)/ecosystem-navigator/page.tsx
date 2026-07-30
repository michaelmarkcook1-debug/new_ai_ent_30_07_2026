import { PageHeader } from "@/lib/ui/page";
import { DependencyGraph } from "./components/dependency-graph";
import { ModelsCatalogue } from "./components/models-catalogue";
import { IntegratorLayer } from "./components/integrator-layer";

export const metadata = { title: "AI Ecosystem Navigator | AI Enterprise" };

export default function EcosystemNavigatorPage() {
  return (
    <>
      <PageHeader
        title="AI Ecosystem Navigator"
        subtitle="Who depends on whom across the AI stack, the commercial models catalogue, and the live services channel that delivers it."
        lanes={["aie", "live"]}
      />
      <div className="space-y-8">
        <DependencyGraph />
        <ModelsCatalogue />
        <IntegratorLayer />
      </div>
    </>
  );
}

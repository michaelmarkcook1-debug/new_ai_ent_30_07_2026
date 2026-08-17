import { PageHeader } from "@/lib/ui/page";
import { analystNews } from "@/lib/analyst/news-source";
import { DependencyGraph } from "./components/dependency-graph";
import { ModelsCatalogue } from "./components/models-catalogue";
import { IntegratorLayer } from "./components/integrator-layer";

export const metadata = { title: "AI Ecosystem Navigator | AI Enterprise" };

export default async function EcosystemNavigatorPage() {
  // The live capability signal for the delivery layer: which integrator has
  // partnered with whom. Fetched here rather than in the client component so
  // it costs one server pull rather than a round trip per reader.
  const news = await analystNews();
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
        <IntegratorLayer news={news.items} />
      </div>
    </>
  );
}

import { PageHeader } from "@/lib/ui/page";
import { fullNewsFeed } from "@/lib/analyst/news-source";
import { DependencyGraph } from "./components/dependency-graph";
import { ModelsCatalogue } from "./components/models-catalogue";
import { IntegratorLayer } from "./components/integrator-layer";

export const metadata = { title: "AI Ecosystem Navigator | AI Enterprise" };

export default async function EcosystemNavigatorPage() {
  // The FULL feed, not analystNews(), which trims to the 300 most recent.
  //
  // That trim is right for the analyst insight, which picks a single item. It is
  // wrong here: measured against the full feed, the top 300 holds 9 of the 89
  // integrator capability events and reaches 3 of the 16 integrators with any
  // signal at all. Accenture's own Anthropic partnership falls outside it.
  //
  // The feed is 3.28 MB, so it is matched here on the server and only the
  // matched events cross to the browser.
  const news = await fullNewsFeed();
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
        <IntegratorLayer news={news} />
      </div>
    </>
  );
}

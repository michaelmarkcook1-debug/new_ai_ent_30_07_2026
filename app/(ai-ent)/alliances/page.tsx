import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { supplyMapInsight, pickNews } from "@/lib/analyst/insight";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "Alliances | AI Enterprise" };

// The AI x GSI Alliance Explorer.
//
// The previous page mapped partnership and investment edges between AI
// companies, which is a different question from the one a buyer arrives with.
// Nobody stands a frontier model up alone: they buy through an integrator, and
// which integrator carries which vendor decides who actually turns up on the
// engagement. This maps that channel.
export default async function AlliancesPage() {
  const data = getAlliancesData();
  const named = data.links.filter((l) => l.tier === "direct_named").length;

  const insight = supplyMapInsight(
    {
      edges: data.links.length,
      verified: named,
      seed: data.links.length - named,
      nodes: data.partnerCount,
      label: "alliance",
    },
    pickNews(newsFixture.news, {
      categories: ["Partnership", "Strategy signal"],
    }),
    null
  );

  return (
    <>
      <PageHeader
        title="AI × GSI Alliance Explorer"
        subtitle="Which firms deliver which AI vendors. An enterprise rarely stands a frontier model up alone, so the integrator carrying a vendor decides who turns up on the engagement, how fast, and in which jurisdictions."
        lanes={["aie"]}
      />
      <AnalystInsight insight={insight} context="alliance channel" />
      <AlliancesView
        links={data.links}
        ventures={data.ventures}
        industries={data.industries}
      />
    </>
  );
}

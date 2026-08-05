import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { supplyMapInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Integrators | AI Enterprise" };

// The AI x GSI Alliance Explorer.
//
// The previous page mapped partnership and investment edges between AI
// companies, which is a different question from the one a buyer arrives with.
// Nobody stands a frontier model up alone: they buy through an integrator, and
// which integrator carries which vendor decides who actually turns up on the
// engagement. This maps that channel.
export default async function AlliancesPage() {
  const news = await analystNews();
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
    pickNews(news.items, {
      categories: ["Partnership", "Strategy signal"],
    }),
    null
  );

  const written = await authorInsight(
    insight,
    "alliance channel",
    [...new Set(data.links.flatMap((l) => [l.vendorName, l.partnerName]))].slice(0, 14)
  );


  return (
    <>
      <PageHeader
        title="Integrators"
        subtitle="Which firms deliver which AI vendors. An enterprise rarely stands a frontier model up alone, so the integrator carrying a vendor decides who turns up on the engagement, how fast, and in which jurisdictions."
        lanes={["aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="alliance channel"
      />
      <AlliancesView
        links={data.links}
        ventures={data.ventures}
        industries={data.industries}
      />
    </>
  );
}

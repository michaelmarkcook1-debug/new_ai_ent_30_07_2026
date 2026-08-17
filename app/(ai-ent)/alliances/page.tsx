import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { supplyMapInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";
import { CompanyContextBar } from "@/lib/position/context-bar";

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

  // How many distinct firms could actually deliver each vendor, and which firm
  // carries the most vendors. This is what the channel does to a buyer's
  // options, and it is the thing this page knows that no other page does.
  const partnersPerVendor = new Map<string, Set<string>>();
  const vendorsPerPartner = new Map<string, Set<string>>();
  for (const l of data.links) {
    (partnersPerVendor.get(l.vendorName) ??
      partnersPerVendor.set(l.vendorName, new Set()).get(l.vendorName)!).add(
      l.partnerId
    );
    (vendorsPerPartner.get(l.partnerName) ??
      vendorsPerPartner.set(l.partnerName, new Set()).get(l.partnerName)!).add(
      l.vendorId
    );
  }
  const breadth = [...partnersPerVendor.entries()]
    .map(([vendor, set]) => ({ vendor, partners: set.size }))
    .sort((a, b) => b.partners - a.partners);
  const busiestEntry = [...vendorsPerPartner.entries()].sort(
    (a, b) => b[1].size - a[1].size
  )[0];

  const insight = supplyMapInsight(
    {
      edges: data.links.length,
      verified: named,
      seed: data.links.length - named,
      nodes: data.partnerCount,
      label: "alliance",
      breadth,
      busiest: busiestEntry
        ? { partner: busiestEntry[0], vendors: busiestEntry[1].size }
        : null,
    },
    pickNews(news.items, {
      categories: ["Partnership", "Strategy signal"],
      // The vendors this page maps alliances for.
      pageVendorIds: [...partnersPerVendor.keys()],
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
      <CompanyContextBar here="integrators" />
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

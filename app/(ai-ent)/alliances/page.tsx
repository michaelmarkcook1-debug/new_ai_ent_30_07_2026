import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { supplyMapInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { aieServerFetch } from "@/lib/aie-server";
import {
  adoptionSignal,
  deliverySignal,
  enrichWithSynthesis,
} from "@/lib/analyst/cross";
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

  // Cross-signal. Delivery breadth is this page's own reading; adoption is not,
  // and the pair is the one relationship in the engine that no page could
  // reach until now. Everyone buying a vendor that one firm can install is a
  // decision-relevant contradiction, and it lives in two datasets that never
  // met.
  //
  // The uptake read goes through the same cached server fetch every other page
  // uses, with the recorded payload behind it, so this adds no new data source
  // and no new failure mode: a miss produces no adoption signal and therefore
  // no synthesis, which is the honest outcome.
  const uptake = await aieServerFetch<{
    rows: { vendor: string; share: number }[];
    provenance?: string;
  }>("uptake");
  const topUptake = (uptake.data?.rows ?? [])
    .filter((r) => typeof r.share === "number")
    .sort((a, b) => b.share - a.share)[0];

  const soleSourced = breadth.filter((b) => b.partners === 1).length;
  const crossInputs = [
    deliverySignal(soleSourced, data.partnerCount, data.links.length, null),
    topUptake
      ? adoptionSignal(topUptake.vendor, topUptake.share, null)
      : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  const { insight: crossed, synthesis, signals } = enrichWithSynthesis(
    insight,
    crossInputs
  );

  const written = await authorInsight(
    crossed,
    "alliance channel",
    // Every vendor and delivery firm on the map. Sliced to 14 before, which
    // silently barred the model from naming integrators the page plots.
    [...new Set(data.links.flatMap((l) => [l.vendorName, l.partnerName]))],
    null,
    { signals, synthesis }
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

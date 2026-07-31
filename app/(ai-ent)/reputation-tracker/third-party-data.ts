import { aieServerFetch, type AieLane } from "@/lib/aie-server";

// Third-party signals, built from the real sources the reputation dataset
// actually draws on rather than from placeholder analyst-firm cards.
//
// Spec rule 4 governs this section: third-party recognitions sit under their
// own divider, attributed, and are never blended into an AG score. What
// follows honours that literally. Each card names one external source, states
// the field it supplies, how many vendors it reaches, how many of those cells
// the dataset marks verified rather than inferred, and when it was last
// fetched. None of it feeds any score on this page.

export interface ThirdPartySource {
  id: string;
  host: string;
  label: string;
  pillar: "Customer" | "Developer" | "Employee";
  measures: string;
  field: string;
  unit: string;
  coverage: number;
  verified: number;
  documented: number;
  seed: number;
  freshest: string | null;
  examples: { vendor: string; value: string }[];
}

export interface ThirdPartyView {
  sources: ThirdPartySource[];
  vendorCount: number;
  provenance: string | null;
  asOf: string | null;
  lane: AieLane;
}

interface RepPillar {
  sources?: string[];
  cellStatus?: Record<string, string>;
  [key: string]: unknown;
}
interface RepRow {
  vendorId: string;
  customer: RepPillar | null;
  developer: RepPillar | null;
  employee: RepPillar | null;
}

// One entry per external source the dataset cites, tied to the exact field it
// supplies and the cellStatus key that grades it.
const SPECS: {
  id: string;
  host: string;
  label: string;
  pillar: ThirdPartySource["pillar"];
  pillarKey: "customer" | "developer" | "employee";
  valueKey: string;
  statusKey: string;
  fetchedKey: string;
  measures: string;
  unit: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}[] = [
  {
    id: "github",
    host: "github.com",
    label: "GitHub",
    pillar: "Developer",
    pillarKey: "developer",
    valueKey: "githubStars",
    statusKey: "github",
    fetchedKey: "githubLastFetched",
    measures:
      "Stars on the vendor's primary public SDK repository, as a proxy for developer reach.",
    unit: "stars",
    format: (v) => v.toLocaleString("en-GB"),
    higherIsBetter: true,
  },
  {
    id: "hn",
    host: "hn.algolia.com",
    label: "Hacker News",
    pillar: "Developer",
    pillarKey: "developer",
    valueKey: "forumHnHits",
    statusKey: "forum",
    fetchedKey: "forumLastFetched",
    measures:
      "Count of Hacker News items mentioning the vendor, as a proxy for practitioner discussion volume.",
    unit: "mentions",
    format: (v) => v.toLocaleString("en-GB"),
    higherIsBetter: true,
  },
  {
    id: "reddit",
    host: "reddit.com",
    label: "Reddit",
    pillar: "Developer",
    pillarKey: "developer",
    valueKey: "redditUpvoteRatio",
    statusKey: "reddit",
    fetchedKey: "redditLastFetched",
    measures:
      "Mean upvote ratio on vendor-related posts, as a proxy for how the developer community receives them.",
    unit: "ratio",
    format: (v) => v.toFixed(3),
    higherIsBetter: true,
  },
  {
    id: "status",
    host: "Atlassian Statuspage",
    label: "Vendor status pages",
    pillar: "Developer",
    pillarKey: "developer",
    valueKey: "apiIncidents90d",
    statusKey: "api",
    fetchedKey: "apiLastFetched",
    measures:
      "Incidents published on the vendor's own status page over 90 days. Self-reported by the vendor, so it is a floor, not a ceiling.",
    unit: "incidents / 90d",
    format: (v) => String(v),
    higherIsBetter: false,
  },
  {
    id: "courtlistener",
    host: "courtlistener.com",
    label: "CourtListener",
    pillar: "Employee",
    pillarKey: "employee",
    valueKey: "litigationPerThousand",
    statusKey: "litigationRate",
    fetchedKey: "litigationLastFetched",
    measures:
      "Public court filings naming the vendor, normalised per thousand employees. A raw count would just rank by headcount.",
    unit: "filings / 1k staff",
    format: (v) => v.toFixed(1),
    higherIsBetter: false,
  },
];

export async function loadThirdPartySignals(): Promise<ThirdPartyView> {
  const [repRes, vendorsRes] = await Promise.all([
    aieServerFetch<{ rows: RepRow[]; provenance?: string; asOf?: string }>(
      "reputation"
    ),
    aieServerFetch<{ vendors: { id: string; name: string }[] }>("vendors"),
  ]);

  const rows = repRes.data?.rows ?? [];
  const names = new Map(
    (vendorsRes.data?.vendors ?? []).map((v) => [v.id, v.name])
  );

  const sources: ThirdPartySource[] = SPECS.map((spec) => {
    const present: { vendor: string; raw: number }[] = [];
    let verified = 0;
    let documented = 0;
    let seed = 0;
    let freshest: string | null = null;

    for (const row of rows) {
      const pillar = row[spec.pillarKey];
      if (!pillar) continue;
      const raw = pillar[spec.valueKey];
      if (typeof raw !== "number") continue;

      present.push({ vendor: names.get(row.vendorId) ?? row.vendorId, raw });

      const status = pillar.cellStatus?.[spec.statusKey];
      if (status === "verified") verified += 1;
      else if (status === "documented") documented += 1;
      else if (status === "seed") seed += 1;

      const fetched = pillar[spec.fetchedKey];
      if (typeof fetched === "string" && (!freshest || fetched > freshest)) {
        freshest = fetched;
      }
    }

    // Examples lead with the end of the range that reads as notable for that
    // signal: most stars, fewest incidents.
    const ordered = [...present].sort((a, b) =>
      spec.higherIsBetter ? b.raw - a.raw : a.raw - b.raw
    );

    return {
      id: spec.id,
      host: spec.host,
      label: spec.label,
      pillar: spec.pillar,
      measures: spec.measures,
      field: `${spec.pillarKey}.${spec.valueKey}`,
      unit: spec.unit,
      coverage: present.length,
      verified,
      documented,
      seed,
      freshest,
      examples: ordered.slice(0, 3).map((e) => ({
        vendor: e.vendor,
        value: spec.format(e.raw),
      })),
    };
  }).filter((s) => s.coverage > 0);

  return {
    sources,
    vendorCount: rows.length,
    provenance: repRes.data?.provenance ?? null,
    asOf: repRes.data?.asOf ?? null,
    lane: repRes.lane,
  };
}

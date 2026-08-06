// Provider status: are the labs up right now?
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/today.ts, commit b9bb51c), which is
// read-only from here and was not modified. The status-page list, the
// two-schema parser and the safe-fail behaviour are carried across; editorial
// punctuation was adapted to the house rule.
//
// Server-only. Every provider carries the page it was read from.
//
// THE RULE THAT MATTERS. A source we cannot read renders nothing. It does not
// render "operational", it does not render a stale value, and it does not
// render an error card that a reader learns to ignore. Two status schemas are
// in the wild and a provider could adopt a third tomorrow; when that happens
// the row silently disappears rather than silently lying, which is the right
// failure for a panel whose whole claim is "this is true right now".
//
// This is a genuinely live source, so it carries the LIVE lane. The round trip
// happens on the request.

export interface SourceRef {
  name: string;
  url: string;
}

export interface StatusRow {
  provider: string;
  /** The status page's own words, never our paraphrase. */
  description: string;
  operational: boolean;
  source: SourceRef;
}

// Official provider status pages. Two schemas are in the wild:
//   Atlassian Statuspage v2:  { status: { indicator, description } }
//   Instatus:                 { page: { status: "UP" | "HASISSUES" | ... } }
// Google Cloud is a third case: it publishes an incidents ARRAY rather than a
// summary object, so it is parsed separately rather than being forced through
// a reader that would misread it as unrecognisable and drop it.
const STATUS_PAGES = [
  {
    provider: "OpenAI",
    api: "https://status.openai.com/api/v2/summary.json",
    page: "https://status.openai.com",
  },
  {
    provider: "Anthropic",
    api: "https://status.claude.com/api/v2/summary.json",
    page: "https://status.claude.com",
  },
  {
    provider: "Google Cloud",
    api: "https://status.cloud.google.com/incidents.json",
    page: "https://status.cloud.google.com",
    kind: "gcp" as const,
  },
  {
    provider: "Cohere",
    api: "https://status.cohere.com/api/v2/summary.json",
    page: "https://status.cohere.com",
  },
  {
    provider: "Groq",
    api: "https://groqstatus.com/api/v2/summary.json",
    page: "https://groqstatus.com",
  },
  {
    provider: "DeepSeek",
    api: "https://status.deepseek.com/api/v2/summary.json",
    page: "https://status.deepseek.com",
  },
];

/** How many providers we attempt, so a partial read can say so honestly. */
export const STATUS_SOURCE_COUNT = STATUS_PAGES.length;

/** Fifteen minutes. An incident that started 14 minutes ago is still news;
 *  polling six status pages on every render is not courteous to them. */
const STATUS_REVALIDATE = 900;

interface StatusJson {
  status?: { indicator?: string; description?: string }; // Statuspage v2
  page?: { status?: string }; // Instatus
  activeIncidents?: unknown[]; // Instatus
}

/** Parse either schema into (operational, description), or null if neither
 *  applies. Null means the row does not render at all. */
function readStatus(
  j: StatusJson
): { operational: boolean; description: string } | null {
  if (typeof j.status?.indicator === "string") {
    return {
      operational: j.status.indicator === "none",
      description: j.status.description ?? "status unavailable",
    };
  }
  if (typeof j.page?.status === "string") {
    const up = j.page.status === "UP";
    return {
      operational: up,
      description: up ? "All Systems Operational" : j.page.status.toLowerCase(),
    };
  }
  return null;
}

export async function fetchStatuses(): Promise<StatusRow[]> {
  const out = await Promise.all(
    STATUS_PAGES.map(async (s): Promise<StatusRow | null> => {
      try {
        const res = await fetch(s.api, {
          next: { revalidate: STATUS_REVALIDATE },
        });
        if (!res.ok) return null;

        // Google Cloud publishes an incidents array, not a summary object. An
        // incident with no `end` is still open.
        if ("kind" in s && s.kind === "gcp") {
          const incidents = (await res.json()) as {
            end?: string | null;
            begin?: string;
          }[];
          const open =
            Array.isArray(incidents) && incidents.some((i) => i && i.end == null);
          return {
            provider: s.provider,
            description: open ? "active incident" : "All Systems Operational",
            operational: !open,
            source: { name: `${s.provider} status`, url: s.page },
          };
        }

        const parsed = readStatus((await res.json()) as StatusJson);
        if (!parsed) return null;
        return {
          provider: s.provider,
          description: parsed.description,
          operational: parsed.operational,
          source: { name: `${s.provider} status`, url: s.page },
        };
      } catch {
        // A dark source stays dark.
        return null;
      }
    })
  );
  return out.filter((x): x is StatusRow => x !== null);
}

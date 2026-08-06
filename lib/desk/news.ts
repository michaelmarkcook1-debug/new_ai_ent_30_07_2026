// The live feed: five real sources, not one.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/news.ts, commit b9bb51c), read-only
// and unmodified at source. The feed list, the four signal filters, the
// tolerant RSS parser and the ranking are carried across; editorial
// punctuation was adapted to the house rule.
//
// Why not one source. A developer-community feed on its own lets a small
// launch outrank a breach as "the thing that matters today" for a CIO. This
// pulls the vendors' OWN newsrooms, which are primary sources and the house
// standard, and real security press alongside the community signal, then
// filters each for what this product is actually about: enterprise and
// security.
//
// Deliberately absent, and absent rather than faked:
//   Anthropic publishes no public RSS feed. Every path 404s.
//   BleepingComputer sits behind a bot challenge. Working around bot detection
//   is not something we do, so it is left out rather than fetched by
//   pretending to be a browser.
//
// Any source that fails simply drops. A dark source stays dark.

export type NewsKind = "vendor" | "security" | "community";

export interface DeskNewsItem {
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  ageHours: number;
  security: boolean;
  kind: NewsKind;
}

interface Feed {
  name: string;
  url: string;
  site: string;
  kind: Exclude<NewsKind, "community">;
}

const FEEDS: Feed[] = [
  {
    name: "OpenAI newsroom",
    url: "https://openai.com/news/rss.xml",
    site: "https://openai.com/news",
    kind: "vendor",
  },
  {
    name: "Google AI blog",
    url: "https://blog.google/technology/ai/rss/",
    site: "https://blog.google/technology/ai/",
    kind: "vendor",
  },
  {
    name: "The Hacker News",
    url: "https://feeds.feedburner.com/TheHackersNews",
    site: "https://thehackernews.com",
    kind: "security",
  },
  {
    name: "Dark Reading",
    url: "https://www.darkreading.com/rss.xml",
    site: "https://www.darkreading.com",
    kind: "security",
  },
];

/** Named on screen so a thin feed reads as a quiet day rather than a bug. */
export const NEWS_SOURCE_COUNT = FEEDS.length + 1; // the feeds, plus Hacker News

const NEWS_REVALIDATE = 900;

// Is this about AI at all? Security press covers everything, and only the
// AI-relevant slice belongs here: a generic ransomware story is not this
// product's beat.
const AI_SIGNAL =
  /\b(AI|A\.I\.|artificial intelligence|LLM|GPT|ChatGPT|Claude|Gemini|OpenAI|Anthropic|Copilot|chatbot|machine learning|generative|deepfake|prompt injection|agentic|AI agent)\b/i;

// Does a vendor post actually matter to a business buyer? This filters
// consumer announcements out of the vendors' own feeds.
const ENTERPRISE_SIGNAL =
  /\b(enterprise|business|security|privacy|compliance|API|developer|data|agent|availability|incident|outage|GDPR|SOC ?2|admin|deprecat|pricing|regulat|government|procurement)\b/i;

// Marketing dressed as news. Security press runs a lot of it, and it is not a
// story.
const NOISE =
  /\b(webinar|sponsored|podcast|whitepaper|e-?book|newsletter|subscribe|advertorial)\b/i;

// Security and data integrity: the beat this feed leads with.
const SECURITY_SIGNAL =
  /\b(security|breach|breached|vulnerab|CVE|exploit|exploited|zero.?day|ransomware|malware|phish|hack|hacked|leak|leaked|exposed|exfiltrat|backdoor|supply.?chain|misconfig|prompt.?injection|jailbreak|data.?poison|model.?poison|data.?integrity|hallucinat|privacy|GDPR|compliance|encryption|credential|unauthor)\b/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tagOf(block: string, name: string): string {
  const m = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
  );
  return m ? decode(m[1]) : "";
}

/** Tolerant RSS and Atom item extraction, handling CDATA and namespaced feeds. */
function parseFeed(
  xml: string
): { title: string; link: string; pubDate: string; desc: string }[] {
  const blocks = [
    ...xml.matchAll(
      /<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi
    ),
  ].map((m) => m[1]);
  return blocks
    .map((b) => {
      let link = tagOf(b, "link");
      if (!link) link = b.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1] ?? ""; // Atom
      return {
        title: tagOf(b, "title"),
        link,
        pubDate:
          tagOf(b, "pubDate") || tagOf(b, "updated") || tagOf(b, "published"),
        desc: tagOf(b, "description") || tagOf(b, "summary"),
      };
    })
    .filter((x) => x.title && x.link);
}

function ageHoursFrom(pubDate: string, now: number): number | null {
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 3_600_000));
}

/** The same story from two sources should not take two slots. */
function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

async function fetchFeed(f: Feed, now: number): Promise<DeskNewsItem[]> {
  try {
    const res = await fetch(f.url, { next: { revalidate: NEWS_REVALIDATE } });
    if (!res.ok) return [];
    const xml = await res.text();
    // A bot-challenge page is HTML, not a feed. Drop it rather than parsing
    // rubbish out of it.
    if (!xml.includes("<item") && !xml.includes("<entry")) return [];
    return parseFeed(xml)
      .map((r) => {
        const hay = `${r.title} ${r.desc}`;
        const age = ageHoursFrom(r.pubDate, now);
        if (age === null || age > 24 * 14) return null; // stale or undated is not news
        if (NOISE.test(r.title)) return null;
        const security = SECURITY_SIGNAL.test(hay);
        // Security press must be AI-relevant; a vendor feed must matter to a
        // business.
        const keep =
          f.kind === "security"
            ? AI_SIGNAL.test(hay)
            : ENTERPRISE_SIGNAL.test(hay) || security;
        if (!keep) return null;
        return {
          title: r.title,
          url: r.link,
          source: f.name,
          sourceUrl: f.site,
          ageHours: age,
          security,
          kind: f.kind,
        } as DeskNewsItem;
      })
      .filter((x): x is DeskNewsItem => x !== null);
  } catch {
    return [];
  }
}

// The community signal, kept, but now one voice among five.
const HN_VENDOR_OR_BIZ =
  /\b(OpenAI|Anthropic|Claude|GPT|Gemini|Google|DeepMind|Nvidia|xAI|Grok|Mistral|Cohere|DeepSeek|Meta AI|Llama|Copilot|AI)\b/i;
const HN_BIZ_SIGNAL =
  /\b(acquir|acquisition|raises|funding|IPO|valuation|partnership|deal|launch|releases|pricing|price|deprecat|antitrust|regulat|lawsuit|enterprise)\b/i;

async function fetchHN(now: number): Promise<DeskNewsItem[]> {
  try {
    const res = await fetch(
      "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50",
      { next: { revalidate: NEWS_REVALIDATE } }
    );
    if (!res.ok) return [];
    const j = (await res.json()) as {
      hits?: {
        title?: string;
        url?: string | null;
        points?: number;
        created_at_i?: number;
        objectID?: string;
      }[];
    };
    return (j.hits ?? [])
      .filter(
        (h) =>
          !!h.title &&
          HN_VENDOR_OR_BIZ.test(h.title) &&
          (SECURITY_SIGNAL.test(h.title) || HN_BIZ_SIGNAL.test(h.title))
      )
      .map((h) => ({
        title: h.title!,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        source: "Hacker News",
        sourceUrl: "https://news.ycombinator.com",
        ageHours: Math.max(
          0,
          Math.round((now / 1000 - (h.created_at_i ?? now / 1000)) / 3600)
        ),
        security: SECURITY_SIGNAL.test(h.title!),
        kind: "community" as const,
      }));
  } catch {
    return [];
  }
}

/** All sources merged. Security and data integrity first, then primary vendor
 *  and press over community chatter, then freshest. Deduped. */
export async function fetchDeskNews(limit = 6): Promise<DeskNewsItem[]> {
  const now = Date.now();
  const batches = await Promise.all([
    ...FEEDS.map((f) => fetchFeed(f, now)),
    fetchHN(now),
  ]);
  const all = batches.flat();

  const seen = new Set<string>();
  const deduped = all.filter((n) => {
    const k = normTitle(n.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Primary sources lead over community chatter at equal security weight.
  const kindRank: Record<NewsKind, number> = {
    vendor: 0,
    security: 0,
    community: 1,
  };
  deduped.sort(
    (a, b) =>
      Number(b.security) - Number(a.security) ||
      kindRank[a.kind] - kindRank[b.kind] ||
      a.ageHours - b.ageHours
  );
  return deduped.slice(0, limit);
}

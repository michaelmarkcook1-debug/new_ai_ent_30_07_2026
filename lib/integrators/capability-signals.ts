import type { NewsItemRaw } from "@/lib/analyst/insight";

// Live capability signal for an integrator, from the news feed we already pull.
//
// WHY NOT A CURATED LIST OF LINKS. The obvious way to "track integrator
// capability" is a hand-written table of each firm's AI-platform page. I tried
// it and stopped, because it fails on both honesty and maintenance.
//
// Honesty: of ten candidate URLs, three answered 200, three answered 403 to a
// non-browser client, and four were 404 because I had guessed the path. A
// register carrying a URL I could not open is a fabricated citation, and
// guessing "/services/artificial-intelligence" and shipping it is exactly the
// failure this product exists to avoid.
//
// Maintenance: those pages get restructured constantly, so a hand-curated table
// rots silently and nothing fails when it does.
//
// WHAT IS ACTUALLY LIVE AND VERIFIABLE. Two things we already hold:
//
//   The provider's own domain, on every record in the BoardRadar catalogue.
//   Not guessed, not constructed, and it is the one link that will not move.
//
//   The AI Enterprise news feed, refreshed nightly, which carries the signal
//   that actually moves an integrator's AI capability: who they have partnered
//   with. "IBM and OpenAI Announce Strategic Partnership" and "Cognizant and
//   Anthropic expand partnership" are both in today's feed, and a new frontier
//   partnership is the single most informative public event about what an
//   integrator can now deliver.
//
// COVERAGE IS THIN AND SAYS SO. Six of the 48 integrators appear across 500
// items. That is a real limit on this signal, not a finding that the other 42
// are quiet, and the panel states it rather than rendering an empty box that
// reads as "nothing is happening here".

export interface CapabilitySignal {
  title: string;
  publishedAt: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  /** Where the integrator was named: the headline, or the source's summary. */
  matchedIn: "headline" | "summary";
  /** The AI vendors this item names alongside them, if any. */
  alongside: string[];
}

// Frontier vendors worth naming when an integrator appears beside one. A
// partnership with a model provider is the capability signal; a mention next to
// a random company is not.
const FRONTIER = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Microsoft",
  "NVIDIA",
  "AWS",
  "Meta",
  "Mistral",
  "Cohere",
  "IBM",
];

/** Word-boundary match, so "IBM" does not fire inside another token. */
function names(text: string, needle: string): boolean {
  return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
    text
  );
}

/**
 * Recent items naming this integrator.
 *
 * Both the headline and the source's summary are searched, and the result says
 * which matched. An integrator named only in the summary is a weaker signal
 * than one in the headline, and collapsing the two would hide that.
 */
export function capabilitySignals(
  items: NewsItemRaw[],
  integratorNames: string[],
  limit = 4
): CapabilitySignal[] {
  const out: CapabilitySignal[] = [];
  for (const it of items) {
    const title = it.title ?? "";
    const summary = it.whyItMatters ?? "";
    const inTitle = integratorNames.some((n) => names(title, n));
    const inSummary = !inTitle && integratorNames.some((n) => names(summary, n));
    if (!inTitle && !inSummary) continue;

    out.push({
      title,
      publishedAt: it.publishedAt ?? null,
      sourceName: it.sourceName ?? null,
      sourceUrl: it.sourceUrl ?? null,
      matchedIn: inTitle ? "headline" : "summary",
      alongside: FRONTIER.filter(
        (f) =>
          !integratorNames.some((n) => n.toLowerCase() === f.toLowerCase()) &&
          names(title, f)
      ),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Stated when the feed reaches nobody, so an empty box is never read as quiet. */
export const NO_SIGNAL_NOTE =
  "No item in the current feed names this integrator. The feed is a market news feed rather than a services-industry one, so it reaches six of the 48 integrators; silence here is our coverage, not theirs.";

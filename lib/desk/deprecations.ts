// Firm model retirements.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/watch-data.ts, commit b9bb51c),
// read-only and unmodified at source.
//
// Transcribed from each vendor's own deprecation page on 13 July 2026. These
// are RETIREMENTS of already-deprecated models, which is the actionable kind:
// after the date the calls fail. Announcements of future deprecation are not
// here, because "we intend to retire this eventually" is not a date anybody
// can plan against.
//
// The repository's own model inventory carries one dated deprecation across
// the whole catalogue (`lib/aie/model-inventory/seed.ts`), which is not enough
// to answer "does anything I run stop working soon". That is why this list is
// ported rather than derived from what was already here.
//
// Retirement dates in the past are filtered out at read time rather than
// deleted, so the list stays a faithful transcription of what the vendor pages
// said on the verification date.

export const DEPRECATIONS_VERSION = "2026-07-13";

export interface Deprecation {
  model: string;
  vendor: string;
  /** ISO date the model stops answering. */
  retire: string;
  replacement: string;
  source: { name: string; url: string };
}

const ANTHROPIC_SRC = {
  name: "Anthropic model deprecations",
  url: "https://platform.claude.com/docs/en/about-claude/model-deprecations",
};
const OPENAI_SRC = {
  name: "OpenAI deprecations",
  url: "https://developers.openai.com/api/docs/deprecations",
};

export const DEPRECATIONS: Deprecation[] = [
  {
    model: "gpt-4o-mini-tts-2025-03-20",
    vendor: "OpenAI",
    retire: "2026-07-23",
    replacement: "gpt-4o-mini-tts-2025-12-15",
    source: OPENAI_SRC,
  },
  {
    model: "gpt-5-chat-latest",
    vendor: "OpenAI",
    retire: "2026-07-23",
    replacement: "gpt-5.5",
    source: OPENAI_SRC,
  },
  {
    model: "claude-opus-4-1-20250805",
    vendor: "Anthropic",
    retire: "2026-08-05",
    replacement: "claude-opus-4-8",
    source: ANTHROPIC_SRC,
  },
  {
    model: "gpt-3.5-turbo-0125",
    vendor: "OpenAI",
    retire: "2026-10-23",
    replacement: "gpt-5.4-mini",
    source: OPENAI_SRC,
  },
  {
    model: "gpt-4-0613",
    vendor: "OpenAI",
    retire: "2026-10-23",
    replacement: "gpt-5.5",
    source: OPENAI_SRC,
  },
  {
    model: "o1-2024-12-17",
    vendor: "OpenAI",
    retire: "2026-10-23",
    replacement: "gpt-5.5",
    source: OPENAI_SRC,
  },
  {
    model: "gpt-5-2025-08-07",
    vendor: "OpenAI",
    retire: "2026-12-11",
    replacement: "gpt-5.5",
    source: OPENAI_SRC,
  },
];

/** Retirements still ahead of `today`, soonest first. */
export function upcomingDeprecations(
  today: Date
): (Deprecation & { daysAway: number })[] {
  const t = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return DEPRECATIONS.map((d) => {
    const [y, m, day] = d.retire.split("-").map(Number);
    return {
      ...d,
      daysAway: Math.round((Date.UTC(y, m - 1, day) - t) / 86_400_000),
    };
  })
    .filter((d) => d.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway);
}

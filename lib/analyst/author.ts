import { authored, llmAvailable, type Authorship } from "./llm";
import type { AnalystInsightData } from "./insight";
import type { PulseJudgement } from "@/lib/pulse/judgement";
import type { ToolKey } from "@/lib/ui/tools";

// Opus 5 writing the analyst voice, over figures the deterministic builders
// computed and it may not change.
//
// Every function here takes an already-computed object, asks the model to
// rewrite only its prose, and returns the original untouched if the model is
// unavailable, slow, malformed, or caught inventing a figure. So the worst
// case for any surface is exactly what shipped before this file existed.
//
// What the model is allowed to change: wording, emphasis, which of several
// true things to lead with, and the judgement about what a figure means for a
// buyer. What it cannot change: any number, any vendor name, the recommended
// action, the evidence block, or the tools a recommendation points at. Those
// travel around it.

export interface Written<T> {
  value: T;
  authorship: Authorship;
}

const asComputed = <T>(value: T): Written<T> => ({
  value,
  authorship: "computed",
});

/** Only what the model is permitted to see, and therefore to reuse. */
function factSheet(lines: (string | null | undefined)[]): string {
  return lines.filter(Boolean).join("\n");
}

// ------------------------------------------------------- the insight panel

interface InsightDraft {
  headline: string;
  summary: string;
  implications: string[];
}

/**
 * The Analyst Insight on every tab except Your Pulse.
 *
 * The recommended action is deliberately not up for rewriting. It is derived
 * from thresholds the product can defend, and letting a model choose between
 * Accelerate and Pause would move the one element of the panel that reads as a
 * decision rather than a description.
 */
export async function authorInsight(
  computed: AnalystInsightData,
  context: string
): Promise<Written<AnalystInsightData>> {
  if (!llmAvailable() || computed.insufficient) return asComputed(computed);

  const facts = factSheet([
    `Page context: ${context}`,
    `Computed headline: ${computed.headline}`,
    `Computed summary: ${computed.summary}`,
    `Computed implications: ${computed.implications.join(" | ")}`,
    `Recommended action (fixed, do not change): ${computed.action}`,
    `Evidence: ${computed.evidence.count} records from ${computed.evidence.sources.join(", ")}${
      computed.evidence.lastUpdated
        ? `, last updated ${computed.evidence.lastUpdated}`
        : ""
    }`,
    computed.news
      ? `Dated item: "${computed.news.title}" (${computed.news.sourceName ?? "source not stated"}, ${computed.news.publishedAt ?? "date not stated"})`
      : "No dated item bears on this page.",
  ]);

  const draft = await authored<InsightDraft>(
    `insight:${context}`,
    facts,
    `Rewrite this analyst reading for a CIO.

Return JSON: {"headline": string, "summary": string, "implications": [string, string, string]}

- headline: one sentence, under 15 words, carrying a judgement rather than a measurement. Not a restatement of the numbers.
- summary: 90 to 140 words. What the figures mean for someone buying, and what they should be sceptical of. Reuse only the figures above.
- implications: exactly three, each one short sentence, each a distinct consequence for a buyer. No number needs to appear in these.

The computed versions above are a floor, not a template. Say something a reader could not have got by reading the numbers themselves.`,
    900
  );

  if (!draft?.headline || !draft?.summary) return asComputed(computed);

  return {
    value: {
      ...computed,
      headline: draft.headline,
      summary: draft.summary,
      implications: Array.isArray(draft.implications)
        ? draft.implications.slice(0, 3)
        : computed.implications,
    },
    authorship: "written",
  };
}

// ---------------------------------------------------------- Today's Pulse

/**
 * The hero on Your Pulse. Same contract: the model may write the sentence,
 * the counts stay as computed.
 */
export async function authorPulse(
  computed: PulseJudgement,
  extra: { movers: string | null; asOf: string | null }
): Promise<Written<PulseJudgement>> {
  if (!llmAvailable()) return asComputed(computed);

  const facts = factSheet([
    `Computed headline: ${computed.headline}`,
    `Computed judgement: ${computed.judgement}`,
    extra.movers ? `Named movement: ${extra.movers}` : null,
    extra.asOf ? `Data as of: ${extra.asOf}` : null,
  ]);

  const draft = await authored<{ headline: string; judgement: string }>(
    "pulse-hero",
    facts,
    `Write today's market read for a CIO scanning before a board meeting.

Return JSON: {"headline": string, "judgement": string}

- headline: one sentence, under 14 words. The single thing that is true of this market today. It may use a figure from the data, but a headline that is only a figure is a wasted headline.
- judgement: 2 to 3 sentences. What the movement means and what a buyer should do differently because of it. Reuse only the figures above.

This is the most-read text in the product. If it could have been written last month, it is wrong.`,
    600
  );

  if (!draft?.headline || !draft?.judgement) return asComputed(computed);

  return {
    value: { ...computed, headline: draft.headline, judgement: draft.judgement },
    authorship: "written",
  };
}

// ------------------------------------------------- Since you last looked

export interface SinceNarrative {
  headline: string;
  body: string;
}

/**
 * The returning-reader panel. Given the changes recorded since their last
 * visit, say what is worth their attention now.
 */
export async function authorSince(
  facts: {
    lastSeen: string | null;
    watchedCount: number;
    changes: string[];
  }
): Promise<Written<SinceNarrative> | null> {
  if (!llmAvailable() || facts.changes.length === 0) return null;

  const sheet = factSheet([
    facts.lastSeen ? `Reader last looked: ${facts.lastSeen}` : "First visit.",
    `Vendors on their watchlist: ${facts.watchedCount}`,
    "Changes recorded since then:",
    ...facts.changes.map((c) => `- ${c}`),
  ]);

  const draft = await authored<SinceNarrative>(
    "pulse-since",
    sheet,
    `Tell a returning reader what changed since they were last here.

Return JSON: {"headline": string, "body": string}

- headline: one sentence, under 12 words. The thing they would most want to know first.
- body: 2 to 3 sentences. Which of these changes actually matters and why, and which is noise. Reuse only the figures above.

Do not list the changes back: they are already rendered beneath this. Say which one deserves their attention.`,
    500
  );

  if (!draft?.headline || !draft?.body) return null;
  return { value: draft, authorship: "written" };
}

// ------------------------------------------------------ Do these 3 things

export interface ActionDraft {
  action: string;
  detail: string;
}

/**
 * The three actions on Your Pulse. The model rewrites the wording; the horizon,
 * the lane, the tools each action points at and the number of actions all stay
 * as computed.
 */
export async function authorActions(
  computed: { action: string; detail: string; tools?: ToolKey[] }[],
  context: string
): Promise<Written<{ action: string; detail: string }[]>> {
  if (!llmAvailable() || computed.length === 0) return asComputed(computed);

  const facts = factSheet([
    `Market context: ${context}`,
    "Computed actions:",
    ...computed.map((a, i) => `${i + 1}. ${a.action} — ${a.detail}`),
  ]);

  const draft = await authored<{ actions: ActionDraft[] }>(
    "pulse-actions",
    facts,
    `Rewrite these ${computed.length} actions for a CIO who has to act this quarter.

Return JSON: {"actions": [{"action": string, "detail": string}, ...]} with exactly ${computed.length} entries, in the same order and covering the same subjects.

- action: an imperative under 6 words. What to do, not what to consider.
- detail: 1 to 2 sentences saying why now, and what happens if it waits. Reuse only the figures above.

These are the only things on the page a reader is meant to act on. Vague advice here costs more than none.`,
    800
  );

  const actions = draft?.actions;
  if (!Array.isArray(actions) || actions.length !== computed.length) {
    return asComputed(computed);
  }
  if (!actions.every((a) => a?.action && a?.detail)) return asComputed(computed);

  return {
    value: computed.map((c, i) => ({
      ...c,
      action: actions[i].action,
      detail: actions[i].detail,
    })),
    authorship: "written",
  };
}

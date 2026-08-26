import { authored, llmAvailable, type Authorship } from "./llm";
import {
  actionIntent,
  claimsFrom,
  intentViolation,
  type ActionIntent,
} from "./canonical";
import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
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

// Every vendor the product knows. Used only as the guard's roster: a name in
// here that is not in the page's own facts means the model reached past its
// data for a vendor it happens to know about, which is a fabricated claim
// assembled from real words.
const ROSTER: readonly string[] = VENDOR_DIRECTORY.map((v) => v.name);

/** Only what the model is permitted to see, and therefore to reuse. */
function factSheet(lines: (string | null | undefined)[]): string {
  return lines.filter(Boolean).join("\n");
}

// ------------------------------------------------------- the insight panel

interface InsightDraft {
  headline: string;
  summary: string;
  implications: string[];
  /**
   * The two halves of the decision packet the model is allowed to touch.
   *
   * Everything else in the packet travels around it: the action, both evidence
   * arrays, the trigger, the do-not and the strength are deterministic and are
   * never sent back through the model. The model may say the instruction
   * better; it may not decide what the instruction is.
   */
  instruction?: string;
  whyNow?: string;
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
  context: string,
  /**
   * The vendors and models this page's data actually covers. Supplied so the
   * reading can name them: an analyst who says "two providers lead" when the
   * data names them is withholding the useful half of the sentence.
   */
  entities: readonly string[] = [],
  /**
   * Facts about a specific subject the reading should be about, rather than
   * about the market in general. Used by Your AI Position, where the question
   * is what this market means for the company the reader named, not what the
   * market is doing on its own.
   */
  subject: { label: string; facts: string[] } | null = null
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
    entities.length > 0
      ? `Vendors and models this page covers, and the only ones you may name: ${entities.join(", ")}`
      : null,
    // The decision packet, as grounding. The action, the evidence, the trigger
    // and the do-not are stated as fixed so the model has them for context and
    // knows it is not being asked to choose them.
    computed.decision
      ? `Computed instruction (you may rewrite the wording, not the instruction): ${computed.decision.instruction}`
      : null,
    computed.decision
      ? `Computed why now (you may rewrite the wording, not the reason): ${computed.decision.whyNow}`
      : null,
    computed.decision && computed.decision.evidenceFor.length > 0
      ? `Evidence for (fixed, do not change): ${computed.decision.evidenceFor.map((e) => `${e.claim} [${e.source}, ${e.basis}]`).join(" | ")}`
      : null,
    computed.decision && computed.decision.evidenceAgainst.length > 0
      ? `Evidence against (fixed, do not change, and do not drop from your reasoning): ${computed.decision.evidenceAgainst.map((e) => `${e.claim} [${e.source}, ${e.basis}]`).join(" | ")}`
      : null,
    computed.decision
      ? `Strength of this recommendation (fixed): ${computed.decision.strength}`
      : null,
    computed.decision?.trigger
      ? `Trigger (fixed, do not change): ${computed.decision.trigger}`
      : null,
    computed.decision?.doNotDo
      ? `Do not do (fixed, do not change): ${computed.decision.doNotDo}`
      : null,
    subject ? `\nTHE SUBJECT OF THIS READING: ${subject.label}` : null,
    ...(subject?.facts ?? []).map((f) => `- ${f}`),
  ]);

  const draft = await authored<InsightDraft>(
    `insight:${context}`,
    facts,
    `Write the analyst reading for this page, for a CIO.

Return JSON: {"headline": string, "summary": string, "implications": [string, string, string]${computed.decision ? ', "instruction": string, "whyNow": string' : ""}}

- headline: one sentence, under 15 words, carrying a judgement rather than a measurement. Not a restatement of the numbers.
- summary: 90 to 140 words, and it must do all three of the things in your brief: what this data shows as a judgement, what changes for this reader's buying decision, and what this is an instance of in the wider market. Reuse only the figures above.
- implications: exactly three, each one short sentence, each a distinct consequence for a buyer. No number needs to appear in these.

The summary is the paragraph that has to earn the page. A reader who already
looked at the chart should still learn something from it. If your draft reads
as a description of what is on screen, or as an account of how much data sits
behind it, you have written the wrong paragraph: what does this pattern usually
mean, and what should they do differently this quarter because of it?

Name the specific vendors and models the data covers wherever it sharpens the point. "Two providers lead on agentic capability" is worth far less to a buyer than naming which two. You may only name entities from the list above; naming any other company, including one you know of, causes the answer to be discarded.

${
      subject
        ? `\nThis reading is about ${subject.label}, not about the market in general. Every sentence should connect what the market data shows to what it means for them specifically: where their position is exposed, where it is defensible, and what they should do about it. A paragraph that would read identically for any company has failed. Where the retrieved facts about them are thin, say what cannot be judged rather than filling it.\n`
        : ""
    }
${
      computed.decision
        ? `
- instruction: one sentence under 30 words. The specific thing this reader should do. It must ask for the SAME thing the computed instruction asks for: you are rewriting how it is said, not what it is. An instruction that merely repeats the action label ("investigate alternatives") is a failure; name the thing, the comparison or the deadline.
- whyNow: one sentence. The change or combination of evidence that makes this relevant now, drawn only from the evidence above.

The evidence, the trigger and the do-not are fixed and are rendered separately. Do not restate them, do not contradict them, and do not drop the evidence against: a recommendation that reads as certain when the evidence above is contested is the one failure here that matters more than being dull.
`
        : ""
    }
The computed versions above are a floor, not a template. Say something a reader could not have got by reading the numbers themselves.`,
    // 900 truncated the longest fact sheets mid-JSON, which read as a silent
    // failure rather than as the over-long answer it was.
    1400,
    ROSTER,
    {
      // The computed headline and summary are the canonical statement of what
      // this page found. Any direction they state plainly is a direction the
      // written version may explain and may not reverse.
      claims: claimsFrom(
        `${computed.headline} ${computed.summary}${computed.decision ? ` ${computed.decision.instruction} ${computed.decision.whyNow}` : ""}`
      ),
      // Where the page declared what it covers, that is the boundary for
      // naming. Where it did not, the guard stays scoped to the fact prose.
      entities,
    }
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
      // The packet is rebuilt from the computed one, not taken from the draft.
      // Only two fields can come from the model, and only after the rewritten
      // instruction is checked against the canonical action. Everything else
      // (the action, both evidence arrays, the trigger, the do-not and the
      // strength) is copied across untouched, so there is no path by which a
      // model response can reach them at all.
      decision: mergeDecision(computed.decision, draft),
    },
    authorship: "written",
  };
}

/**
 * The packet the reader gets, built from the computed one.
 *
 * TWO FIELDS IN, EVERYTHING ELSE COPIED. The action, both evidence arrays, the
 * trigger, the do-not and the strength are read off `computed` and are never
 * sourced from the draft, so there is no path by which a model response
 * reaches them. That is a structural guarantee rather than a validated one:
 * the check for "did the model drop the contradictory evidence" is that the
 * model was never holding it.
 *
 * Exported so that guarantee is testable directly rather than inferred from
 * the absence of an assignment.
 */
export function mergeDecision(
  computed: AnalystInsightData["decision"],
  draft: { instruction?: string; whyNow?: string } | null | undefined
): AnalystInsightData["decision"] {
  if (!computed) return null;
  return {
    ...computed,
    instruction: usableInstruction(computed, draft?.instruction),
    whyNow:
      typeof draft?.whyNow === "string" && draft.whyNow.trim().length > 0
        ? draft.whyNow
        : computed.whyNow,
  };
}

/**
 * The rewritten instruction, or the computed one where the rewrite cannot
 * stand in for it.
 *
 * Three ways a rewrite is refused, each falling back rather than failing:
 *
 *   empty        nothing to use
 *   contradicts  the rewrite asks for the opposite of the canonical action, or
 *                commits where the action only asked the reader to look. Same
 *                rule the Pulse actions run under, and the same reasoning.
 *   label only   the rewrite has collapsed back into the action word and says
 *                nothing the action did not. That is the exact failure this
 *                whole packet exists to fix, so accepting it would be worse
 *                than not authoring at all.
 */
function usableInstruction(
  decision: NonNullable<AnalystInsightData["decision"]>,
  written: string | undefined
): string {
  if (typeof written !== "string" || written.trim().length === 0) {
    return decision.instruction;
  }
  const canonical = actionIntent(decision.action);
  if (intentViolation(canonical, written)) {
    console.warn(
      `[analyst-llm] discarded instruction: canonical action ${decision.action} rewritten as "${written}"`
    );
    return decision.instruction;
  }
  if (!isSpecific(written, decision.action)) {
    console.warn(
      `[analyst-llm] discarded instruction: "${written}" restates the action label`
    );
    return decision.instruction;
  }
  return written;
}

/**
 * Whether an instruction says more than its action label does.
 *
 * Deliberately a floor rather than a judgement of quality: enough words to
 * carry a specific, and something in it beyond the action word itself. This is
 * the same check the deterministic packets are held to in
 * tests/analyst-decision.test.ts, applied to the written version so the model
 * cannot undo the thing the packet exists for.
 */
export function isSpecific(instruction: string, action: string): boolean {
  const words = instruction.trim().split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const withoutAction = instruction
    .toLowerCase()
    .replace(action.toLowerCase(), "")
    .trim();
  return withoutAction.split(/\s+/).filter(Boolean).length >= 5;
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

Name the vendors that moved, where the data names them. A reader wants to know who, not how many. You may only name vendors that appear above.

This is the most-read text in the product. If it could have been written last month, it is wrong.`,
    600,
    ROSTER,
    {
      // pulseJudgement() states direction outright: which vendors are gaining
      // and which slipping, and whether the largest tracked move went up or
      // down. This is the most-read text in the product and it was the easiest
      // place in it to reverse a finding while quoting every figure correctly.
      claims: claimsFrom(
        `${computed.headline} ${computed.judgement} ${extra.movers ?? ""}`
      ),
    }
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

Name the vendors involved, using only the names that appear above.

Do not list the changes back: they are already rendered beneath this. Say which one deserves their attention.`,
    500,
    ROSTER,
    { claims: claimsFrom(facts.changes.join(". ")) }
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
 * the lane, the tools each action points at, the number of actions and now the
 * INTENT of each action all stay as computed.
 *
 * The intent is the part that matters. Until this check existed the model was
 * handed both fields and could return anything for either, so a computed
 * "Clear open risks before widening" could come back as "Widen scope now" and
 * pass every guard in the product: no figure had moved, no vendor had been
 * named, and the reader was told to do the opposite of what the data supports.
 *
 * The whole set is discarded on a single violation rather than the offending
 * entry alone. Three actions written together are one argument, and keeping two
 * thirds of an argument whose conclusion was rejected is not a safer product
 * than falling back to the computed three.
 */
export async function authorActions(
  computed: {
    action: string;
    detail: string;
    tools?: ToolKey[];
    /**
     * What this action asks the reader to do, declared by the builder that
     * knows. Declared rather than inferred because inferring it from our own
     * imperative would make the safety of the check depend on the same
     * classifier it is guarding against: "Clear open risks before widening"
     * reads as advance to a word list and means the opposite.
     */
    intent?: ActionIntent;
  }[],
  context: string
): Promise<Written<{ action: string; detail: string }[]>> {
  if (!llmAvailable() || computed.length === 0) return asComputed(computed);

  const facts = factSheet([
    `Market context: ${context}`,
    "Computed actions:",
    ...computed.map((a, i) => `${i + 1}. ${a.action}: ${a.detail}`),
  ]);

  const draft = await authored<{ actions: ActionDraft[] }>(
    "pulse-actions",
    facts,
    `Rewrite these ${computed.length} actions for a CIO who has to act this quarter.

Return JSON: {"actions": [{"action": string, "detail": string}, ...]} with exactly ${computed.length} entries, in the same order and covering the same subjects.

- action: an imperative under 6 words. What to do, not what to consider.
- detail: 1 to 2 sentences saying why now, and what happens if it waits. Reuse only the figures above.

Where the context names a vendor or model, name it. You may only name entities that appear above.

Each rewritten action must ask for the same thing as the one it replaces. You may sharpen how it is said and why it matters now. You may not turn a pause into an expansion, a review into a commitment, or a caution into an encouragement. An answer that changes what the reader is being asked to do is discarded in full.

These are the only things on the page a reader is meant to act on. Vague advice here costs more than none.`,
    800,
    ROSTER,
    {
      claims: claimsFrom(
        computed.map((c) => `${c.action}. ${c.detail}`).join(" ")
      ),
    }
  );

  const actions = draft?.actions;
  if (!Array.isArray(actions) || actions.length !== computed.length) {
    return asComputed(computed);
  }
  if (!actions.every((a) => a?.action && a?.detail)) return asComputed(computed);

  // The canonical semantics, enforced. Anything the builder did not declare is
  // classified from its own text as a fallback, which is weaker than a
  // declaration and still far stronger than the nothing that was here before.
  for (let i = 0; i < computed.length; i++) {
    const canonical = computed[i].intent ?? actionIntent(computed[i].action);
    const violation = intentViolation(canonical, actions[i].action);
    if (violation) {
      console.warn(
        `[analyst-llm] discarded pulse-actions: "${computed[i].action}" (${canonical}) rewritten as "${actions[i].action}", which is a ${violation}`
      );
      return asComputed(computed);
    }
  }

  return {
    value: computed.map((c, i) => ({
      ...c,
      action: actions[i].action,
      detail: actions[i].detail,
    })),
    authorship: "written",
  };
}

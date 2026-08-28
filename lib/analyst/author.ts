import { authored, llmAvailable, type Authorship } from "./llm";
import {
  actionIntent,
  claimsFrom,
  intentViolation,
  restrictedVocabulary,
  strongestTemporal,
  temporalFromText,
  urgencyViolations,
  type ActionIntent,
  type TemporalLicence,
} from "./canonical";
import { priorsBlock, resolveTheses } from "./priors";
import { synthesisBlock, type Synthesis } from "./synthesis";
import { canCreateUrgency } from "./freshness";
import { POPULATION_LABEL, temporalClass, type Signal } from "./signals";
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
 * What the model may claim, derived from what the intelligence layer knows.
 *
 * THE POINT OF THIS FUNCTION is that the two restrictions the deterministic
 * layer already enforces on itself were being enforced on nothing else. It
 * refuses to write a trend off one observation and refuses to build a why now
 * on a reading past its refresh window, and then handed the model a prose blob
 * in which neither restriction was visible or checkable. Both shipped as
 * defects: a state published as "keeps climbing", and a suppressed aging
 * finding restored as the reason to act.
 *
 * Exported so the contract can be asserted directly rather than inferred from
 * the behaviour of a model call.
 */
export function authoringContract(
  computed: AnalystInsightData,
  cross: { signals: readonly Signal[]; synthesis: readonly Synthesis[] } | null
): {
  temporal: TemporalLicence;
  urgency: { field: string; restricted: string[]; allowed: boolean };
  /** Findings barred from grounding a why now, for labelling the prompt. */
  barred: Synthesis[];
} {
  // The temporal licence, taken from the findings the model is actually shown.
  //
  // NOT from every signal the page computed, which was the first attempt and
  // was wrong in a way worth recording. Price / Performance holds a movement
  // reading carrying two observations, so the strongest signal on the page is
  // a change; but movement fires no rule there, never enters the prompt, and
  // the model cannot cite it. Licensing trend vocabulary off evidence the
  // model was never shown grants it words for claims it has no basis to make.
  //
  // `Synthesis.temporal` is already `jointTemporal()` of that finding's own
  // inputs, which is the weakest of them, so this reuses the classifier rather
  // than running a second one beside it. Where no finding reached the prompt,
  // the canonical prose governs: the same move `claimsFrom()` makes for
  // direction, and a page whose own text describes a change may have that
  // change described back to it.
  const canonical = `${computed.headline} ${computed.summary} ${computed.decision?.whyNow ?? ""}`;
  const shown = cross?.synthesis ?? [];
  const temporal: TemporalLicence =
    shown.length > 0
      ? strongestTemporal(shown.map((s) => s.temporal))
      : temporalFromText(canonical);

  // A finding may not ground a why now when it is too old to establish the
  // present, or when it argues against the recommendation. Both rules are the
  // deterministic layer's own, taken from `enrichWithSynthesis()` so the two
  // cannot disagree about which findings were suppressed.
  const barred = (cross?.synthesis ?? []).filter(
    (s) => s.bearing === "against" || !canCreateUrgency(s.freshness)
  );

  // What may legitimately ground one: the computed sentence itself, and the
  // supporting evidence that is not one of the barred findings. Deliberately
  // narrower than the whole fact sheet. The headline and summary are
  // interpretation rather than evidence, and letting them licence vocabulary
  // would hand back the words this exists to withhold.
  const barredText = new Set(barred.map((s) => s.finding));
  const permitted = [
    computed.decision?.whyNow ?? "",
    ...(computed.decision?.evidenceFor ?? [])
      .map((e) => e.claim)
      .filter((c) => !barredText.has(c)),
  ];

  return {
    temporal,
    urgency: {
      field: "whyNow",
      restricted: restrictedVocabulary([...barredText], permitted),
      // Nothing in the packet may assert immediacy unless something in it is
      // current enough to say so. A page resting entirely on an aging capture
      // may still recommend; it may not say the reader must move this week.
      allowed:
        (cross?.synthesis ?? []).some(
          (s) => s.bearing === "supports" && canCreateUrgency(s.freshness)
        ) || (cross?.synthesis.length ?? 0) === 0,
    },
    barred,
  };
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
  subject: { label: string; facts: string[] } | null = null,
  /**
   * Cross-signal findings and the signals behind them, where the page computed
   * any. Supplied by pages that call enrichWithSynthesis().
   *
   * Two things ride on this. The findings go into the prompt as fixed text the
   * model may explain and may not restate, and the signals decide which
   * analyst priors are allowed to appear at all: a claim this product can
   * check is only stated where this page's own data has just checked it.
   */
  cross: {
    signals: readonly Signal[];
    synthesis: readonly Synthesis[];
  } | null = null
): Promise<Written<AnalystInsightData>> {
  if (!llmAvailable() || computed.insufficient) return asComputed(computed);

  // What this packet licenses, worked out before the prompt is built so the
  // prompt can state it and the guard can check it against the same values.
  const contract = authoringContract(computed, cross);
  const barredFindings = new Set(contract.barred.map((b) => b.finding));

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
    // Each item carries the ROLE it may play, not just its prose. A finding
    // the deterministic layer barred from grounding a why now is still real
    // evidence and is still shown; what changes is that the model is told
    // which it is, and the guard checks the answer against the same list.
    computed.decision && computed.decision.evidenceFor.length > 0
      ? `Evidence for (fixed, do not change). The role tag on each item says what it may be used for:\n${computed.decision.evidenceFor
          .map(
            (e) =>
              `- [${barredFindings.has(e.claim) ? "AGING SUPPORT: may inform the reading and may NOT be the reason to act now" : "CURRENT: may ground the reason to act now"}] ${e.claim} [${e.source}, ${e.basis}]`
          )
          .join("\n")}`
      : null,
    computed.decision && computed.decision.evidenceAgainst.length > 0
      ? `Evidence against (fixed, do not change, and do not drop from your reasoning): ${computed.decision.evidenceAgainst.map((e) => `${e.claim} [${e.source}, ${e.basis}]`).join(" | ")}`
      : null,
    // Stated, and then checked. The check is the protection; this is here so
    // the model has a chance of passing it rather than being failed blind.
    computed.decision
      ? `WHY NOW MAY ONLY REST ON EVIDENCE TAGGED CURRENT. Evidence tagged AGING SUPPORT is real and you may use it anywhere else in the reading, including to say what should be investigated. It may not be the reason this is happening now, because nobody has re-read it inside its own refresh window.${contract.urgency.allowed ? "" : " Nothing in this packet is current enough to say the reader must move immediately, so do not say it."}`
      : null,
    contract.temporal === "state"
      ? `TEMPORAL LIMIT: every reading here is a single observation. You may say what IS true. You may not say anything is rising, falling, climbing, widening, narrowing, continuing, still moving, gaining momentum or accelerating, because no prior reading is held and there is no sequence to describe.`
      : contract.temporal === "change"
        ? `TEMPORAL LIMIT: the readings here carry two observations, so a change may be described. You may not say the rate of change is itself growing or that anything is accelerating.`
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
    // Cross-signal findings, and the priors this page's data actually
    // supports. Both empty on a page with no signals, which is the common
    // case and leaves the prompt exactly as it was.
    cross && cross.synthesis.length > 0 ? `\n${synthesisBlock(cross.synthesis)}` : null,
    cross
      ? `\n${priorsBlock(resolveTheses(cross.signals, new Date().toISOString().slice(0, 10)))}`
      : null,
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
      // Only where cross-signal findings are actually in the prompt. A page
      // with no synthesis has nothing to turn into a causal claim, and turning
      // the check on everywhere would reject ordinary prose ("due to" appears
      // in perfectly sound sentences) for no protection.
      forbidCausal: (cross?.synthesis.length ?? 0) > 0,
      // The two contracts the deterministic layer already holds itself to,
      // now checked against the answer rather than stated and hoped for.
      temporal: contract.temporal,
      urgency: contract.urgency,
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
      // The second check on why now. The guard above rejects and retries at
      // the model boundary; this refuses and falls back at the assembly
      // boundary, so an unsafe sentence cannot reach a reader by any route.
      decision: mergeDecision(computed.decision, draft, contract.urgency),
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
  draft: { instruction?: string; whyNow?: string } | null | undefined,
  /**
   * What the rewritten why now may rest on, where the caller computed it.
   *
   * Omitted leaves the previous behaviour, which is what every caller outside
   * this module still does. Supplied, it is the second of two checks: the
   * guard in `generate()` rejects and retries at the model boundary, and this
   * refuses and falls back at the assembly boundary, so a caller that forgets
   * to declare the contract loses the rewrite rather than the protection.
   */
  urgency?: { restricted: readonly string[]; allowed: boolean }
): AnalystInsightData["decision"] {
  if (!computed) return null;
  return {
    ...computed,
    instruction: usableInstruction(computed, draft?.instruction),
    whyNow: usableWhyNow(computed, draft?.whyNow, urgency),
  };
}

/**
 * The rewritten why now, or the computed one where the rewrite cannot stand in.
 *
 * Why now is the case for acting NOW, and the deterministic layer has already
 * decided what may make that case: `canCreateUrgency()` admits current
 * evidence only, and `enrichWithSynthesis()` keeps everything else out of the
 * computed sentence. The model was then handed the barred finding as ordinary
 * evidence and put it back, which is the defect this exists to close.
 */
function usableWhyNow(
  decision: NonNullable<AnalystInsightData["decision"]>,
  written: string | undefined,
  urgency?: { restricted: readonly string[]; allowed: boolean }
): string {
  if (typeof written !== "string" || written.trim().length === 0) {
    return decision.whyNow;
  }
  if (!urgency) return written;
  const bad = urgencyViolations(written, urgency.restricted, urgency.allowed);
  if (bad.length > 0) {
    console.warn(
      `[analyst-llm] discarded why now: "${written}" rests on evidence that cannot establish now (${bad.join(", ")})`
    );
    return decision.whyNow;
  }
  return written;
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
  extra: {
    movers: string | null;
    asOf: string | null;
    /**
     * The tracked ecosystem, as the same normalised signals every other
     * surface reasons over.
     *
     * WHY THIS ARGUMENT EXISTS. Today's Pulse is the most-read text in the
     * product and was the thinnest-fed: a four-line sheet carrying its own
     * computed sentence back to itself, four vendor names and a date. It was
     * being asked for a read on the enterprise AI market while being shown
     * almost none of it, so it could only restate the movers and reach for
     * generic market prose. Everything below was already computed on the page
     * that calls this and simply never travelled.
     *
     * No new fetch, no new dataset and no second model call: `signalsFromMetrics()`
     * reads the MarketMetrics the page already loaded, and the price reading
     * comes off the benchmark capture it already holds.
     */
    signals?: readonly Signal[];
  }
): Promise<Written<PulseJudgement>> {
  if (!llmAvailable()) return asComputed(computed);

  const signals = extra.signals ?? [];
  // Stated with the population each reading was taken over, because the
  // spread across 43 suppliers and the spread across the frontier cohort are
  // different facts about different markets and the difference between them
  // is itself the story on some days.
  const ecosystem = signals.map(
    (x) =>
      `- [${
        // Labelled with what may be claimed about it, not only what it says.
        // A spread measured once is narrow; it has not converged, because
        // there is no earlier reading it converged from. Stating which is
        // which here is what lets the model write the stronger sentence where
        // the evidence carries it and the weaker one where it does not.
        temporalClass(x) === "state"
          ? "SNAPSHOT, one observation: describe as a state, never as having changed"
          : "classified against a previous reading: a change may be described"
      }] ${x.dimension} across ${POPULATION_LABEL[x.population]}: ${x.state}${
        typeof x.magnitude === "number" ? ` (${x.magnitude})` : ""
      }. ${x.evidence.claim} [${x.evidence.source}, ${x.evidence.basis}]`
  );

  const facts = factSheet([
    `Computed headline: ${computed.headline}`,
    `Computed judgement: ${computed.judgement}`,
    extra.movers ? `Named movement: ${extra.movers}` : null,
    extra.asOf ? `Data as of: ${extra.asOf}` : null,
    ecosystem.length > 0
      ? `\nTHE TRACKED ECOSYSTEM, as measured this period:\n${ecosystem.join("\n")}`
      : null,
  ]);

  const draft = await authored<{ headline: string; judgement: string }>(
    "pulse-hero",
    facts,
    `Write today's read on the enterprise AI market for a CIO scanning before a board meeting.

Return JSON: {"headline": string, "judgement": string}

You are writing at the level of a research VP publishing a market pulse: a
named judgement about where this market has got to, argued from the readings
below. Not a summary of them.

- headline: one sentence, under 14 words, carrying a JUDGEMENT rather than a measurement. "Five vendors gained and three slipped" is the data restated and is a wasted headline; what that pattern means for a buyer is a headline.
- judgement: 3 to 4 sentences. Read the ecosystem as a whole: what shape this market is in, what that shape does to a buyer's leverage, and what follows for how they should be contracting this quarter. Reuse only the figures above.

WHAT MAKES THIS GOOD RATHER THAN COMPETENT. The readings above are separate
measurements of one market: how far apart the field is on capability, what the
top tier costs against an adequate alternative, how concentrated a typical
category is, what governance load is open, how reputation is spread. The value
is in what they say TOGETHER that none says alone. Lead with the reading that
most changes what a buyer should do, and say why the others do not change it.

Name the vendors and categories the data names. "Two providers lead" is worth
far less than naming them. You may only name entities that appear above.

DO NOT explain our data pipeline. Whether a prior reading exists, whether a
figure is published this period, what our refresh cadence is: these are facts
about us, not about the market. Where a reading cannot be taken, say what
cannot be judged in the reader's language and move to what can.

EVERY READING MARKED SNAPSHOT IS A STATE, NOT A CHANGE. Most of the readings
above were measured once. A spread of 10.6 points IS narrow; it has not
"converged", "narrowed" or "tightened", because there is no earlier reading it
moved from and this product does not hold one. Write "capability is narrow
across the frontier cohort", never "capability has converged". This is not a
stylistic preference: a claim that something changed, over a figure measured
once, is the single most common way this panel has been wrong, and an answer
containing one is discarded in full and the reader gets plainer text instead.
The judgement you want is available without it. "The field is close enough
together that the model tier is no longer where the money should go" is a
stronger sentence than "capability has converged" and it is one the evidence
actually carries.

DO NOT hedge into meaninglessness. "Buyers should monitor developments" is not
a judgement. If the evidence supports a firmer line, take it; if it does not,
say plainly what would be needed to take one.

This is the most-read text in the product. If it could have been written last
month, or about a different market, it is wrong.`,
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
      // Movement is classified against a previous reading, so where movers are
      // named a change may be described. Where none are, this is a set of
      // snapshots and the trend verbs are not available. Declared from what
      // the panel holds rather than inferred from its prose, because the
      // prose is the thing being checked.
      //
      // FROM THE READINGS THEMSELVES where the page supplies them, because
      // they know how many observations each rests on and the movers line does
      // not. Widening this sheet to the whole ecosystem handed the model a set
      // of single-observation spreads, and a licence taken from the presence
      // of movers let it write "frontier capability has converged" over a
      // spread nobody has measured twice.
      temporal:
        signals.length > 0
          ? strongestTemporal(signals.map(temporalClass))
          : extra.movers
            ? "change"
            : "state",
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
    {
      claims: claimsFrom(facts.changes.join(". ")),
      // Every line here is a recorded difference between two captures, which
      // is exactly what licenses "change" and nothing beyond it. No dataset in
      // this product carries the third reading acceleration would need.
      temporal: "change",
    }
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
      // Read off the computed actions themselves. An action written from a
      // snapshot may not be rewritten as a trend, and one already describing a
      // movement may keep it.
      temporal: temporalFromText(
        computed.map((c) => `${c.action}. ${c.detail}`).join(" ") + " " + context
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

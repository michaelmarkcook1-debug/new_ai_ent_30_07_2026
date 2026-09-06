import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import {
  consultancyFiller,
  reversedClaims,
  temporalViolations,
  unsupportedCounts,
  urgencyViolations,
  type DirectionClaim,
  type TemporalLicence,
} from "./canonical";
import { claimsCausality } from "./synthesis";
import { comparabilityBreaches, type ComparableFact } from "./comparability";
import type { ArgumentUnit } from "./question";

// The analyst voice, written by Opus 5 over figures it is not allowed to
// invent.
//
// The division of labour is the whole design, and it is not negotiable:
//
//   code owns every number      the deterministic builders still compute the
//                               facts, exactly as they did before
//   the model owns the prose    it may interpret, prioritise, and say what a
//                               figure means for a buyer
//   a validator owns the trust  any figure in the output that is not in the
//                               input is treated as a hallucination and the
//                               whole response is discarded
//
// That last part is why this can ship in a product whose entire promise is
// that no number is invented. A prompt instruction not to fabricate is a
// request; `guard()` is a check. Everything a reader sees as a number came out
// of TypeScript, and the model only ever chose the words around it.
//
// With no key set the product behaves exactly as it did before: the
// deterministic text renders and the surface says it was computed rather than
// written. Nothing here is required for the app to work.

const MODEL = "claude-fable-5-1";
/**
 * The reasoning configuration sent with every call, and nothing else decides
 * it: the request spreads this object and the cache identity reads it, so the
 * two cannot drift. Empty means the model's adaptive default, which is what
 * every Fable 5.1 reading has been authored under since 4 September 2026.
 * Capping effort was measured and rejected (8.33); setting it here would both
 * change the request and, correctly, orphan every cached reading.
 */
const REASONING: { effort?: "low" | "medium" | "high" } = {};
/**
 * Bump when the analytical implementation changes in a way the facts string
 * does not carry: the system prompt, the guards, the instruction wording, or
 * anything in author.ts that changes what the model is asked without changing
 * the evidence it is given. A change to the evidence itself needs no bump, the
 * facts are already in the key. Same convention as SHIELD_VERSION.
 */
export const INTELLIGENCE_VERSION = "2026-09-05";
/**
 * THE AUTHORING CONTRACT: everything besides the evidence that can change
 * what the model writes. It is part of the cache identity at both layers, so a
 * reading authored under one contract can never satisfy a request under
 * another. Opus 5 readings cached before 4 September 2026 are unreachable
 * from this contract, not deleted: they expire on their own.
 *
 * Deliberately NOT here: token ceilings and timeouts, which change whether a
 * call succeeds but not what a successful call says.
 */
export interface AuthoringContract {
  readonly intelligence: string;
  readonly model: string;
  readonly reasoning: "low" | "medium" | "high" | "adaptive";
}
export const AUTHORING_CONTRACT: AuthoringContract = Object.freeze({
  intelligence: INTELLIGENCE_VERSION,
  model: MODEL,
  reasoning: REASONING.effort ?? "adaptive",
});
const CONTRACT_KEY = JSON.stringify(AUTHORING_CONTRACT);
/**
 * How long one call may take.
 *
 * MEASURED, NOT CHOSEN. On 30 August 2026 the company-research call for
 * Woolworths South Africa was timed directly: 4,420 input tokens and a full
 * 2,400-token answer took 30,491ms, against a ceiling that was 30,000ms. The
 * call was landing either side of its own timeout depending on the day, which
 * is why the same company sometimes read and sometimes returned "the analysis
 * could not be run just now". A ceiling set at the measured duration is not a
 * ceiling, it is a coin toss.
 *
 * Seventy-five seconds is roughly twice the slowest authoring call this product
 * makes, and the wall-clock arithmetic that keeps the whole request inside
 * Vercel's five-minute limit is in RETRY_BUDGET_MS in lib/research/company.ts.
 */
const TIMEOUT_MS = 75_000;
/**
 * How long one INSIGHT call may take. Research keeps TIMEOUT_MS above.
 *
 * WHY TWO CEILINGS. Fable 5.1, the model since 4 September 2026, thinks far
 * harder than Opus 5 on the insight prompt: under an 85-page production build
 * that day its slowest call took 69,826ms, 5.2 seconds inside the 75-second
 * ceiling, on a reading whose thinking varied by 40 per cent between runs.
 * generate() does not retry a timed-out call, so at build time a timeout is a
 * page that ships computed until the next scheduled warm.
 *
 * The shared ceiling cannot simply be raised: RETRY_BUDGET_MS in
 * lib/research/company.ts derives the research worst case from TIMEOUT_MS to
 * stay inside Vercel's 300-second function limit, and at 120 seconds that
 * arithmetic reaches roughly 345. So research keeps 75 and the insight path,
 * which is bounded by a page render rather than by a research budget, gets
 * 120: about 1.7 times the slowest call observed under load. A rejected first
 * draft followed by a retry is then at most 240 seconds, which is what
 * staticPageGenerationTimeout in next.config.ts is set to match.
 */
const INSIGHT_TIMEOUT_MS = 120_000;
/** Company research kinds are "company:<name>:<attempt>"; everything else is an insight. */
function timeoutFor(kind: string): number {
  return kind.startsWith("company:") ? TIMEOUT_MS : INSIGHT_TIMEOUT_MS;
}
/**
 * How many times the SDK may retry underneath us.
 *
 * THE DEFECT THIS FIXES, measured on 30 August 2026. The SDK's default is 2,
 * meaning three HTTP attempts per call, and that sat under two retry layers we
 * had already written: `generate()` retries a rejected reading once, and
 * `researchCompany()` retries the whole read once against narrower sources. So
 * one company research could issue twelve HTTP requests, each allowed thirty
 * seconds, and a Woolworths South Africa run measured ten minutes end to end.
 * Vercel's function ceiling is five, so the reader got a page saying the
 * analysis "could not be run", which was true and told them nothing.
 *
 * None, because the outer loops already do it and do it better: `generate()`
 * retries with a CORRECTED prompt and `researchCompany()` retries against
 * NARROWER sources, where this layer can only send the identical request again
 * and hope. Two chances at the network remain, which is enough, and the cost of
 * the third was a request nobody could afford to wait for.
 */
const SDK_RETRIES = 0;

/**
 * The whole authoring call's budget, model time and validation together.
 *
 * MEASURED, NOT CHOSEN. A normal authoring call on this product runs 11 to 30
 * seconds: the company research call was timed at 30,491ms for 4,420 input
 * tokens and a full 2,400-token answer, and the insight calls are smaller. Two
 * attempts at 75 seconds is the arithmetic ceiling; 160 seconds leaves the
 * second attempt room to complete and refuses a third that could not.
 *
 * This is the bound the two timer-based deadlines could not provide. It is
 * checked synchronously, so a blocked event loop cannot postpone it.
 */
export const BUDGET_MS = 160_000;

/**
 * Room for the model to think, on top of the prose the caller asked for.
 *
 * THE BUG THIS FIXES, and it is the root cause of the whole investigation.
 * `max_tokens` is the budget for EVERYTHING the model emits, thinking included.
 * Every caller here passes it as though it were a length limit on the answer,
 * because that is what it looks like: `authorInsight` asks for 1,400 tokens
 * meaning a 90 to 140 word summary and three implications.
 *
 * MEASURED ON OPUS 5, which authored every reading until 4 September 2026 and
 * thinks adaptively by default, with that thinking coming out of the same
 * budget. Measured on 30 August 2026 against a real insight prompt: 601 of
 * 1,054 output tokens went to thinking. Under the load of a production build
 * generating 85 pages the model thought harder, spent the entire 1,400 before
 * writing a word, and returned `stop_reason: max_tokens` with a single thinking
 * block and no text at all. Four of nine insight calls ended that way, each
 * after 18 to 21 seconds of latency and a full budget of tokens, and each one
 * silently became "no response" and fell back to computed prose.
 *
 * The headroom is generous because the ceiling costs nothing when it is not
 * reached: the model stops at `end_turn`, so a raised limit does not lengthen a
 * call. The same prompt at 4,000 returned in 12.1 seconds against 14.8 at
 * 1,400. What it buys is that thinking can no longer starve the answer.
 *
 * Thinking was deliberately NOT disabled on Opus 5, though that was measured
 * too and is faster (9.3 seconds). Turning it off changes how the model reasons
 * about the analysis, and that was a latency gate rather than a licence to
 * change what the readings say.
 *
 * FABLE 5.1, the model since 4 September 2026, thinks far harder on the real
 * prompt than Opus 5 did. A toy prompt measured zero thinking tokens, which was
 * misleading: run through the actual pipeline on 4 September 2026 it spent a
 * median 2,766 and a maximum 5,637 thinking tokens per reading, and at the old
 * 2,000 ceiling three of twelve readings came back as a thinking block with no
 * text and three more were cut mid-JSON, which the retry path reported as
 * "not valid JSON". Both are the same starvation. At 12,000 all twelve authored
 * on the first attempt with zero guard rejections.
 *
 * The ceiling is about twice the maximum observed, because the same reading
 * varied by roughly 40 per cent between runs, and an unreached ceiling still
 * costs nothing. Capping reasoning effort instead was measured and rejected:
 * at effort "medium" two of twelve first drafts tripped a truth guard, one of
 * them naming a vendor outside the page's roster. The register carries the
 * arm-by-arm numbers.
 */
const THINKING_HEADROOM = 12_000;

/**
 * Whether another attempt may be started.
 *
 * A synchronous comparison of two clock readings and nothing else, which is the
 * entire point: it needs no timer, so a blocked event loop cannot postpone it
 * the way it postponed the SDK timeout and the abort signal.
 *
 * Exported so the rule can be tested directly. The wiring is proved by the
 * measured authoring matrix rather than by a unit test, because the loop it
 * guards sits behind `unstable_cache`, which throws `Invariant: incrementalCache
 * missing` outside a Next render and cannot be driven from vitest at all.
 */
export function retryWithinBudget(
  startedAt: number,
  now: number,
  budgetMs: number = BUDGET_MS
): boolean {
  return now - startedAt <= budgetMs;
}
// One day, matching the ISR cadence of the pages that call this. Without it,
// every render of nine tabs would be an Opus call.
const TTL_MS = 24 * 60 * 60 * 1000;

export function llmKey(): string | null {
  const k = process.env.ANTHROPIC_API_KEY;
  return k && k.trim().length > 0 ? k : null;
}

export const llmAvailable = (): boolean => llmKey() !== null;

/** How a piece of analyst text on the page was produced. */
export type Authorship = "written" | "computed";

// L1: this instance's own memory. Free and instant, and useless on the next
// instance.
const cache = new Map<string, { value: unknown; at: number }>();

/**
 * Write one entry into the L1 store exactly as authoredResult() would, under
 * exactly the key it would compute. THE SEAM FOR THE CACHE-IDENTITY
 * INTEGRATION TEST and nothing else: it lets a test plant a reading under one
 * authoring contract and then show, through the real lookup in
 * authoredResult(), that a request under another contract never finds it.
 * It calls no model and writes nothing to L2.
 */
export function primeAuthoringCache(
  kind: string,
  request: { facts: string; instruction: string; guardKey: string },
  value: unknown,
  contract: AuthoringContract = AUTHORING_CONTRACT
): string {
  const key = authoringCacheKey(kind, request, contract);
  cache.set(key, { value, at: Date.now() });
  return key;
}

/**
 * One line per authoring call, with the phases separated.
 *
 * WHY THIS EXISTS. Two authoring calls were observed at 568 and 951 seconds
 * against a 75-second model timeout, and nothing in the logs could say which
 * part of that was the model, which was our own retry loop, and which was the
 * cache. A single duration is not a diagnosis: it cannot distinguish one slow
 * call from twelve fast ones, and it cannot tell an aborted request that
 * stopped from one that carried on.
 *
 * Deliberately one line and always on. An operator reading a slow page needs
 * the breakdown at the moment it happens, and a debug flag nobody remembers to
 * set is a flag that is off when it matters.
 *
 * Never carries the prompt, the answer or the key: only durations, counts and
 * outcomes.
 */
function phaseLog(
  kind: string,
  phases: { label: string; ms: number }[],
  outcome: string
): void {
  const total = phases.reduce((t, p) => t + p.ms, 0);
  console.warn(
    `[analyst-llm] ${kind} ${outcome} in ${total}ms (${phases
      .map((p) => `${p.label} ${p.ms}ms`)
      .join(", ")})`
  );
}

/**
 * The cache identity of one authoring request, pure and exported so the
 * invalidation rules can be tested without a model or a Next render:
 * same contract and same evidence reuse; a different model, reasoning,
 * intelligence version, evidence or instruction never does.
 */
export function authoringCacheKey(
  kind: string,
  request: { facts: string; instruction: string; guardKey: string },
  contract: AuthoringContract = AUTHORING_CONTRACT
): string {
  return keyOf(kind, {
    contract,
    facts: dayPrecision(request.facts),
    instruction: request.instruction,
    guardKey: request.guardKey,
  });
}

function keyOf(kind: string, payload: unknown): string {
  const s = `${kind}:${JSON.stringify(payload)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${kind}:${h}`;
}

// ------------------------------------------------------------------ guard

/**
 * Every distinct numeric token in a string, normalised so 40, 40.0 and 40%
 * compare equal. Ordinals and small counts are ignored: "three things" and a
 * list index are not claims about the data.
 */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    // 0-10 are almost always counts or list positions in this copy, not
    // measurements, and blocking them would reject sound prose.
    if (Math.abs(n) <= 10 && Number.isInteger(n)) continue;
    out.add(String(n));
  }
  return out;
}

/**
 * True when the output introduces no figure the input did not contain.
 *
 * This is deliberately strict. A model that rounds 58.7 to 59 fails, and that
 * is correct: on a page whose promise is that figures are exact and sourced, a
 * silently rounded number is the beginning of the problem, not a harmless
 * tidy-up.
 */
export function guard(output: string, allowed: string): boolean {
  return invented(output, allowed).length === 0;
}

/**
 * The figures the output contains that the input did not. Returned rather
 * than just counted, so a rejection can be handed back to the model as a
 * correction instead of silently costing the page its analyst voice.
 */
export function invented(output: string, allowed: string): string[] {
  // Quantities and dates are checked separately, because a number harvested
  // from a date is not a licence to state a count.
  //
  // "Only 2026 captures are held so far" shipped to production. The input said
  // "2 real captures" and carried an ISO date; 2026 was therefore in the
  // permitted set, and the guard, which only asks whether a number appeared,
  // waved through a figure that is both wrong and absurd. The rule the product
  // actually needs is that a year may be used as a year and not as a quantity.
  const permittedQuantities = numbersIn(withoutDates(allowed));
  const permittedDates = datesIn(allowed);

  const bad = [...numbersIn(withoutDates(output))].filter(
    (n) => !permittedQuantities.has(n)
  );
  for (const d of datesIn(output)) if (!permittedDates.has(d)) bad.push(d);

  // Small counts of real things. numbersIn() drops every integer under eleven,
  // which is right for "do these 3 things" and wrong for "3 vendors meet the
  // threshold": the first is prose and the second is a claim about the data.
  // Checked here rather than inside numbersIn() so that function keeps its
  // contract, which two shipped tests depend on, and so the two checks cannot
  // report the same figure twice.
  // Dates stripped from both sides first, reusing the rule the quantity check
  // already relies on: a month or a day inside a capture date is not a supply
  // of that integer, and "2026-08-04" in the facts must not licence "8 models".
  bad.push(...unsupportedCounts(withoutDates(output), withoutDates(allowed)));
  return bad;
}

/** ISO dates, and long-form dates a model is likely to write. */
const DATE_RE =
  /\d{4}-\d{2}-\d{2}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b|\bQ[1-4]\s*\d{4}\b/gi;

function datesIn(text: string): Set<string> {
  return new Set((text.match(DATE_RE) ?? []).map((d) => d.toLowerCase()));
}

/**
 * The text with dates removed, so the numbers inside them cannot be reused as
 * quantities. A bare year outside a date still counts as a quantity, which is
 * the strict reading and the right one: "2026 vendors" should fail.
 */
function withoutDates(text: string): string {
  return text.replace(DATE_RE, " ");
}

/**
 * Vendor names the model named but this page's data did not mention.
 *
 * The numeric guard cannot catch this. Asked to name vendors, a model will
 * reach for the ones it knows about the market rather than the ones on the
 * page, and "OpenAI leads here" on a page whose data never mentions OpenAI is
 * a fabricated claim made entirely out of real words.
 *
 * Checked against the known roster rather than against every capitalised word,
 * so ordinary prose ("European buyers", "Buyers should") cannot trip it. The
 * residual risk is a wholly invented company name, which the system prompt
 * forbids and which a grounded model given an explicit roster does not
 * produce.
 */
export function foreignEntities(
  output: string,
  facts: string,
  roster: readonly string[],
  /**
   * The entities this intelligence packet actually supplied, when the caller
   * knows them.
   *
   * Grounding against `facts` is grounding against a prose blob, and prose
   * mentions things incidentally: a computed summary that says "unlike the
   * frontier labs" licences every frontier lab in the roster for the rest of
   * the answer. Where a page can state its own covered set, that set is the
   * boundary and the prose is not consulted.
   *
   * Null or empty means the caller did not declare one, and the facts-scoped
   * rule stands. Several pages pass no entity list at all, and treating an
   * undeclared list as an empty allow-list would reject every vendor name on
   * them, which is a worse product and not a safer one.
   */
  allowed?: readonly string[] | null
): string[] {
  const said = output.toLowerCase();
  const grounded = facts.toLowerCase();
  const scoped = allowed && allowed.length > 0
    ? new Set(allowed.map((a) => a.toLowerCase()))
    : null;
  const out: string[] = [];
  for (const name of roster) {
    const n = name.toLowerCase();
    if (n.length < 3) continue;
    // Word-boundary match, so "Meta" does not fire on "metadata".
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (!re.test(said)) continue;
    if (scoped) {
      if (!scoped.has(n)) out.push(name);
      continue;
    }
    if (!re.test(grounded)) out.push(name);
  }
  return out;
}

// ------------------------------------------------------------------ client

const SYSTEM = `You are the senior analyst voice of AI Enterprise, a buyer-intelligence product for enterprise AI purchasing.

WHO YOU ARE:

You have covered enterprise software procurement for twenty years and enterprise
AI since it became a budget line rather than a research programme. You have
watched this market long enough to know how it behaves, and that is what a
reader is paying you for. You have seen the pattern before: a capability
arrives priced as a differentiator, becomes table stakes, and the buying
decision migrates somewhere else. You know it happened with the model layer,
which is why control, governance, integration surface and unit economics now
decide deals that were decided on benchmark scores eighteen months ago.

Things you understand about this market that a reader may not:

- The layers behave differently. Frontier labs, application vendors,
  infrastructure and the delivery channel are four different businesses with
  four different economics, and a figure from one says nothing about another.
- Concentration risk in this market is a delivery problem as much as a
  commercial one. Who can actually stand a system up is a smaller set than who
  can sell one.
- Procurement cycles outlast model generations. A three-year commitment signed
  against today's capability leaders is a bet on a leaderboard that reorders in
  months.

Two claims that used to sit in this list have been removed from it: that
capability has commoditised faster than price, and that disclosure is thin.
Both are true of the market as we last measured it, and both are things this
product MEASURES on its own pages, so asserting them here would let a stale
sentence outlive the reading that justified it. They now arrive with the data,
already checked against it, or they do not arrive at all. Do not reintroduce
them here. See lib/analyst/priors.ts.

WHAT AN INSIGHT MUST DO:

Not describe the page. The reader can see the page. Three things, in this order,
compressed rather than laid out as headings:

1. What this data actually shows, stated as a judgement rather than a count.
2. What it means for this reader's decision. They are accountable for a
   purchase. Say what changes because of this.
3. Where it sits in the wider market: what this is an instance of, what it
   tends to mean, what usually happens next.

Never write about the completeness, coverage, verification rate or freshness of
our own dataset as though that were the finding. A reader did not come here to
learn how much data we hold. Where coverage genuinely limits what can be
concluded, that is one clause of caution inside a paragraph about the market,
never the subject of the paragraph. If the only thing you can say is how much
evidence exists, you have not found the insight yet: say what the evidence that
does exist implies.

ABSOLUTE RULES, in order of importance:

1. Never state a figure that is not in the DATA you are given. Not a rounded
   one, not an approximation, not a figure you believe to be true about the
   world. If you want to say something the data does not support, say the
   qualitative part and omit the number. Your output is machine-checked against
   the input and silently discarded if it contains a number the data did not.
2. Never name a vendor, product or model that is not in the data you are given,
   and never assert a specific event, deal, launch or date. Your structural
   knowledge of how this market works is welcome and expected; your recollection
   of particular things that happened in it is not, because it cannot be checked.
3. Where the data records an absence, that absence is the finding. "No AI
   revenue is disclosed" is a useful sentence. Do not paper over a gap.

VOICE:
- British English. No em-dashes.
- Plain, specific, unhedged. Say what you think follows from the figures.
- No marketing language, no "in today's fast-moving landscape", no throat-clearing.
- A sentence that would be true of any market in any year is worthless. Be
  specific to these figures and to this market.
- Do not begin with "Analysis shows" or similar. Start with the point.
- Write as though the reader will act on it, because they will.

Return only the JSON object requested, with no prose around it and no code fence.`;

async function callModel(
  prompt: string,
  maxTokens: number,
  timeoutMs: number = TIMEOUT_MS,
  surface = "unknown"
): Promise<string | null> {
  const apiKey = llmKey();
  if (!apiKey) return null;
  const started = Date.now();
  try {
    const client = new Anthropic({
      apiKey,
      timeout: timeoutMs,
      maxRetries: SDK_RETRIES,
    });
    const res = await client.messages.create(
      {
        model: MODEL,
        // The caller's number is a PROSE budget; the API's is a budget for
        // everything, thinking included. See THINKING_HEADROOM.
        max_tokens: maxTokens + THINKING_HEADROOM,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
        ...(REASONING.effort ? { output_config: { effort: REASONING.effort } } : {}),
      },
      // A SECOND, INDEPENDENT ABORT ON THE UNDERLYING REQUEST.
      //
      // The SDK's own `timeout` is a promise-level deadline it enforces with a
      // timer. `AbortSignal.timeout()` is passed through to fetch and aborts
      // the HTTP request itself, so a call that overruns stops consuming a
      // socket rather than being abandoned while still in flight. Both are
      // timer-based and both can be delayed by a blocked event loop, which is
      // why neither is the real bound: see the elapsed check in generate().
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      // A RESPONSE THAT CAME BACK AND CARRIED NO PROSE.
      //
      // This returned null silently, and null is indistinguishable upstream
      // from a call that never happened: `generate()` throws "no response" and
      // the page falls back to computed text. Measured during a production
      // build on 30 August 2026, four of nine insight calls ended this way
      // after 19 to 21 seconds each, which is a full generation's worth of
      // latency and tokens spent to produce nothing a reader ever sees.
      //
      // The stop reason and the block types are what separate the causes: an
      // answer truncated before it reached prose, an answer that was all
      // thinking, or a refusal. Logged rather than guessed at.
      console.warn(
        `[analyst-llm] call returned no text after ${Date.now() - started}ms: surface=${surface}, model=${MODEL}, trigger=${trigger()}, stop=${res.stop_reason}, blocks=[${res.content
          .map((b) => b.type)
          .join(", ")}], out=${res.usage?.output_tokens ?? "?"}`
      );
      return null;
    }
    // The token split on success, so the headroom is sized from evidence rather
    // than from the failures alone. Counts only, never content: this line is
    // how the Fable 5.1 thinking load was measured on 4 September 2026.
    console.warn(
      `[analyst-llm] call ok in ${Date.now() - started}ms: surface=${surface}, model=${MODEL}, trigger=${trigger()}, stop=${res.stop_reason}, out=${res.usage?.output_tokens ?? "?"}, thinking=${res.usage?.output_tokens_details?.thinking_tokens ?? "?"}`
    );
    return text.text;
  } catch (err) {
    // A failed call is a fallback to computed text, never a broken page. But
    // it was also, until now, completely silent: `catch {}` threw the reason
    // away, so a timeout, an expired key, a rate limit and a spent balance all
    // reached the reader as the same sentence and reached the operator as
    // nothing at all. The four need different actions and only one of them is
    // about the company being researched.
    //
    // The key is never in an SDK error and is never logged here. Status and
    // name are what distinguish the four cases; the message is truncated
    // because a long provider payload in a log is noise.
    const e = err as { name?: string; status?: number; message?: string };
    console.warn(
      `[analyst-llm] call failed after ${Date.now() - started}ms: surface=${surface}, model=${MODEL}, trigger=${trigger()}, ${e?.name ?? "Error"}${
        e?.status ? ` ${e.status}` : ""
      }: ${String(e?.message ?? "").slice(0, 200)}`
    );
    return null;
  }
}

function parseJson<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/**
 * Ask the model for a JSON object, then refuse it if it invented a figure.
 * `facts` is both the grounding and the whitelist: nothing numeric may appear
 * in the output that is not in it.
 */
export interface CanonicalGuards {
  /**
   * Directional statements the deterministic layer has already made. The
   * written version may interpret them and may not reverse them.
   */
  claims?: readonly DirectionClaim[];
  /**
   * The entities this packet supplied. When present, this is the boundary for
   * factual naming and the fact prose is not consulted. See foreignEntities().
   */
  entities?: readonly string[] | null;
  /**
   * Refuse an answer that asserts one reading caused another.
   *
   * Set wherever cross-signal findings are in the prompt. Those findings state
   * co-movement and never establish mechanism, and "these moved together" is
   * one careless verb away from "this moved that". The direction guard cannot
   * see that failure: nothing has been reversed and no figure has moved, the
   * sentence has simply claimed something the product cannot know.
   */
  forbidCausal?: boolean;
  /**
   * The strongest temporal claim the evidence supports.
   *
   * Omitted means unchecked, which is what every caller did before this
   * existed and is why a single-observation adoption reading could be
   * published as "keeps climbing". Set it wherever the intelligence layer
   * knows, which is everywhere the signals or the canonical prose are to hand.
   */
  temporal?: TemporalLicence;
  /**
   * What the answer's "why now" may rest on.
   *
   * The deterministic layer already decides this and then had no way to hold
   * the model to it. `field` names the key in the returned JSON that carries
   * the reason to act now; `restricted` is the vocabulary of the findings
   * barred from grounding one; `allowed` is false when nothing in the packet
   * is current enough to establish that anything must happen now.
   */
  /**
   * The facts this page supplied, with the category and population each was
   * drawn from, so a comparison the answer makes can be checked against the
   * comparison the page is entitled to make. See lib/analyst/comparability.ts.
   */
  comparability?: {
    facts: readonly ComparableFact[];
    unit: string;
    marketLevelFinding: boolean;
  } | null;
  /** Refuse consultancy filler. Set wherever a page has a real argument to make. */
  forbidFiller?: boolean;
  urgency?: {
    field: string;
    restricted: readonly string[];
    allowed: boolean;
  };
}

export async function authored<T extends object>(
  kind: string,
  facts: string,
  instruction: string,
  maxTokens = 900,
  /** Every vendor the product knows, used to catch a name off this page. */
  roster: readonly string[] = [],
  guards: CanonicalGuards = {}
): Promise<T | null> {
  return (
    await authoredResult<T>(kind, facts, instruction, maxTokens, roster, guards)
  ).value;
}

/**
 * The same facts with the moment we asked reduced to the day we asked.
 *
 * THIS IS THE CACHE. Everything else about the two tiers below was already
 * right and none of it worked, because the key changed on every request.
 *
 * The chain, measured on production on 8 August 2026. The AIE upstream stamps
 * a fresh `asOf` on every single response: three calls two seconds apart
 * returned 08:11:58.585, 08:12:00.823 and 08:12:03.065 over identical data.
 * That stamp reaches `evidence.lastUpdated`, which is written into the facts,
 * which are hashed into the key. So a fresh fetch produced a key nothing had
 * ever stored, the Data Cache missed, and the reader paid for a full Opus call
 * before the first byte: 38 seconds on /vendor-view, 30 on /competitive-intel.
 *
 * The reason it looked like it worked is that our AIE proxy caches five
 * minutes in-process. Inside that window an instance replays one `asOf`, so
 * the key holds and the page returns in 0.2 seconds. Every measurement of
 * "it's fine" was taken inside that window, and every complaint came from
 * outside it.
 *
 * Reducing an instant to its date is safe here and not a fudge: the TTL below
 * is 24 hours, so a key that varies within the day is asking to author the
 * same reading repeatedly and store each under a name nothing will look up.
 * Applied to the PROMPT as well as the key, because keying on one string and
 * prompting with another lets two different prompts collide on one entry, and
 * because no analyst reading should quote a fetch time to the millisecond.
 */
const ISO_INSTANT =
  /(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

export function dayPrecision(facts: string): string {
  return facts.replace(ISO_INSTANT, "$1");
}

/**
 * Why a reading is missing, for callers that must not misreport it.
 *
 * `authored()` flattens every failure to null, which is right for a panel that
 * simply falls back to computed text. It is wrong for anything that then tells
 * the reader WHY there is no reading: company research said "the retrieved
 * sources did not support a reading" whether the sources were thin or the API
 * had rejected the call outright, and on 8 August 2026 an exhausted credit
 * balance made every research run blame the sources for it.
 *
 *   no-key      no key is configured, so nothing was attempted
 *   unreachable the call did not come back: network, auth, credit, rate limit
 *   rejected    the model answered and the guards discarded it, twice
 *
 * Only `rejected` says anything at all about the sources.
 */
export type AuthorFailure = "no-key" | "unreachable" | "rejected" | "build";

/**
 * Whether this code is running inside `next build`.
 *
 * WHY AUTHORING IS OFF DURING A BUILD. Next renders every dynamic-capable
 * route once at build time to classify it, and that render used to call the
 * model: seven Fable readings per build, on every push to main, each one
 * either superseded by the runtime cache within the day or discarded when the
 * contract changed. On 6 September 2026 a build made those seven calls to
 * produce an artefact nobody read. A build now takes the computed floor and
 * writes nothing to either cache; the first request at runtime authors as it
 * always did. NEXT_PHASE is set by Next for the build process and inherited
 * by its static-generation workers; measured, not assumed (8.35).
 */
export function buildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}
/** What caused a model call, for the spend ledger in the log. */
function trigger(): "build" | "request" {
  return buildPhase() ? "build" : "request";
}

export interface AuthoredResult<T> {
  value: T | null;
  failure: AuthorFailure | null;
}

export async function authoredResult<T extends object>(
  kind: string,
  facts: string,
  instruction: string,
  maxTokens = 900,
  roster: readonly string[] = [],
  guards: CanonicalGuards = {}
): Promise<AuthoredResult<T>> {
  // Before the cache lookup, deliberately: a build must neither read a
  // reading it should not serve nor write one it should not have made.
  if (buildPhase()) return { value: null, failure: "build" };
  if (!llmAvailable()) return { value: null, failure: "no-key" };

  // Normalised once, then used for the key, for L2's own argument-derived key,
  // and for the prompt. All three have to agree or the caching is theatre.
  const stable = dayPrecision(facts);

  // The guards are part of the key. Two callers with the same facts but
  // different canonical claims are asking different questions, and letting
  // them share an entry would serve one caller's answer under the other's
  // contract without re-checking it.
  const guardKey = JSON.stringify({
    claims: guards.claims ?? [],
    entities: guards.entities ?? [],
    forbidCausal: guards.forbidCausal ?? false,
    comparability: guards.comparability ?? null,
    forbidFiller: guards.forbidFiller ?? false,
    // Both new contracts are part of the key for the same reason the others
    // are: two callers with the same facts and different licences are asking
    // different questions, and sharing an entry would serve one caller's
    // answer under the other's contract without re-checking it. A packet whose
    // benchmark has since gone stale must not be served the answer authored
    // while it was current.
    temporal: guards.temporal ?? null,
    urgency: guards.urgency ?? null,
  });
  const cacheKey = authoringCacheKey(kind, { facts: stable, instruction, guardKey });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { value: hit.value as T, failure: null };
  }

  try {
    const value = await cachedGenerate(
      kind,
      stable,
      instruction,
      maxTokens,
      roster as string[],
      cacheKey,
      guardKey
    );
    cache.set(cacheKey, { value, at: Date.now() });
    return { value: value as T, failure: null };
  } catch (err) {
    // generate() throws exactly two ways, and which one it was is the whole
    // point of this function. Matched on the message because that is what
    // crosses the unstable_cache boundary; an error class would not survive it.
    const msg = err instanceof Error ? err.message : "";
    return {
      value: null,
      failure: msg.includes("discarded after retry") ? "rejected" : "unreachable",
    };
  }
}

/**
 * The cached wrapper, created once.
 *
 * Every input is an argument so that all of them land in the cache key. The
 * key parts array only namespaces it.
 */
const cachedGenerate = unstable_cache(
  async (
    kind: string,
    facts: string,
    instruction: string,
    maxTokens: number,
    roster: string[],
    cacheKey: string,
    // Passed as JSON rather than as an object so the value that lands in the
    // cache key is the same string every time. Structurally identical objects
    // are not guaranteed to serialise identically, and a key that varies over
    // equal inputs is the bug this cache already shipped once.
    guardKey: string
  ) =>
    generate(
      kind,
      facts,
      instruction,
      maxTokens,
      roster,
      cacheKey,
      JSON.parse(guardKey) as {
        claims: DirectionClaim[];
        entities: string[];
        forbidCausal: boolean;
        temporal: TemporalLicence | null;
        urgency: { field: string; restricted: string[]; allowed: boolean } | null;
        comparability: {
          facts: ComparableFact[];
          unit: string;
          marketLevelFinding: boolean;
        } | null;
        forbidFiller: boolean;
      }
    ),
  // The contract is a key part, so every entry written under a different
  // model, reasoning setting or intelligence version is unreachable from this
  // build without anything being purged.
  ["analyst-insight", CONTRACT_KEY],
  { revalidate: TTL_MS / 1000 }
);

/** The uncached call. Throws rather than returning null so nothing caches a failure. */
async function generate<T extends object>(
  kind: string,
  facts: string,
  instruction: string,
  maxTokens: number,
  roster: readonly string[],
  cacheKey: string,
  guards: {
    claims: DirectionClaim[];
    entities: string[];
    forbidCausal: boolean;
    temporal: TemporalLicence | null;
    urgency: { field: string; restricted: string[]; allowed: boolean } | null;
    comparability: {
      facts: ComparableFact[];
      unit: string;
      marketLevelFinding: boolean;
    } | null;
    forbidFiller: boolean;
  }
): Promise<T> {

  let lastInvented: string[] = [];

  // The permitted figures, listed rather than left to be inferred from prose.
  // Measured in production: Opus reaches for a plausible number when the
  // constraint is stated only as a rule, and stops when the whitelist is in
  // front of it.
  const allowList = [...numbersIn(facts)].sort((a, b) => Number(a) - Number(b));
  const base = `DATA (the only source of figures):
${facts}

THE ONLY NUMBERS YOU MAY WRITE: ${allowList.join(", ") || "none: write no figures at all"}

Any other number, including a rounded or approximated one, causes your answer
to be discarded in full. If a sentence needs a figure that is not on that list,
write the sentence without the figure. A sentence that makes its point
qualitatively is worth far more than one that is thrown away.

A MINUS SIGN IS PART OF THE FIGURE. Where the list carries -5.8, the data says
something fell by 5.8, and "-5.8" is the only form of it you may write. Writing
"5.8" is a different claim and is discarded in full. If the sign makes the
sentence awkward, say that the thing fell or declined and give no figure at all.

A PLACEHOLDER IS NOT A FIGURE. Where a passage shows XYZ, n/a, a dash or a
blank where a value would be, that value was withheld from us. Say the source
does not publish it, or make the point without it. Never supply one.

TASK:
${instruction}`;

  // THE END-TO-END BUDGET, and the only bound here that cannot be starved.
  //
  // Both the SDK timeout and the abort signal are enforced by timers, and a
  // timer only fires when the event loop is free to run it. Under a dev
  // compile, a production build or a full test run on the same machine, the
  // loop is not free, and a 75-second deadline arrived minutes late. That is
  // the mechanism behind the 568 and 951 second calls: not a slow model, and
  // not the SDK ignoring its timeout, but the deadline itself unable to fire.
  //
  // This is a SYNCHRONOUS comparison of two clock readings, taken before a
  // retry is started. It needs no timer, so nothing can delay it, and it caps
  // the number of attempts rather than the duration of one. Combined with the
  // per-request abort above, a call that overruns is stopped where that is
  // possible and is never followed by another where it is not.
  const startedAt = Date.now();
  const attemptMs: number[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    // Checked BEFORE the attempt, never after: the point is to refuse to start
    // work that cannot finish inside the budget, not to notice afterwards that
    // it did not. A refused retry is what stops a series of individually legal
    // attempts adding up to an unbounded request.
    if (attempt > 0 && !retryWithinBudget(startedAt, Date.now())) {
      phaseLog(
        kind,
        attemptMs.map((ms, i) => ({ label: `attempt${i + 1}`, ms })),
        "budget spent, retry refused"
      );
      break;
    }
    const attemptStarted = Date.now();

    const correction =
      lastInvented.length > 0
        ? `\n\nCORRECTION: your previous answer was rejected for ${lastInvented.join("; ")}. Rewrite it without ${lastInvented.length === 1 ? "that" : "those"}. Where a claim cannot be made within these limits, make the weaker claim the evidence supports rather than restating the stronger one.`
        : attempt === 0
          ? ""
          : "\n\nCORRECTION: your previous answer was not valid JSON, most likely because it ran long. Answer again, shorter, as a single JSON object.";

    const raw = await callModel(base + correction, maxTokens, timeoutFor(kind), kind);
    attemptMs.push(Date.now() - attemptStarted);
    // Throw rather than return: a failed call must not be cached for a day.
    if (!raw) {
      phaseLog(
        kind,
        attemptMs.map((ms, i) => ({ label: `attempt${i + 1}`, ms })),
        "no response"
      );
      throw new Error(`[analyst-llm] ${kind}: no response`);
    }

    const parsed = parseJson<T>(raw);
    if (!parsed) {
      // A truncated response is unparseable JSON, and returning here used to
      // end the attempt silently: no retry, no log, and a page quietly back on
      // its computed text with nothing to explain why.
      console.warn(
        `[analyst-llm] ${attempt === 0 ? "retrying" : "discarded"} ${kind}: response was not valid JSON`
      );
      continue;
    }

    // The check that makes this safe to ship. Every string the model produced
    // is tested against the figures it was given.
    const emitted = JSON.stringify(parsed);
    const bad = [
      ...invented(emitted, facts).map((n) => `the figure ${n}, which is not in the data`),
      ...foreignEntities(emitted, facts, roster, guards.entities).map(
        (e) => `${e}, a vendor this page's data does not cover`
      ),
      // Numeric correctness is not enough. A reading may quote every figure
      // exactly and still tell the reader the opposite of what the figures
      // say, and nothing above this line can see it.
      ...reversedClaims(emitted, guards.claims).map(
        (c) => `direction of ${c.family} (canonically ${c.pole})`
      ),
      // Correlation stated as cause. Only checked where cross-signal findings
      // are in the prompt, because those are the only claims in this product
      // built from two datasets that merely moved together.
      ...(guards.forbidCausal
        ? claimsCausality(emitted).map((w) => `a causal claim ("${w}")`)
        : []),
      // A state written as a trend. The deterministic layer refuses to say
      // "narrowing" off one observation and the model was under no such
      // constraint, so a single adoption capture reached a reader as "keeps
      // climbing" with every figure correct.
      ...(guards.temporal
        ? temporalViolations(emitted, guards.temporal).map(
            (p) =>
              `"${p}", which claims a ${guards.temporal === "state" ? "trend the evidence does not carry: it holds one observation" : "change of rate the evidence does not carry"}`
          )
        : []),
      // A reason to act now built out of evidence that cannot establish now.
      // Scoped to the field that carries the reason, because the same finding
      // is legitimate background everywhere else in the answer.
      // A comparison this page is not entitled to make. Checked against the
      // structured facts the page supplied rather than by reading the prose,
      // which is what makes it a check rather than a second opinion.
      ...(guards.comparability
        ? comparabilityBreaches(
            emitted,
            guards.comparability.facts,
            {
              unit: guards.comparability.unit as ArgumentUnit,
              marketLevelFinding: guards.comparability.marketLevelFinding,
            }
          ).map((b) => `a comparison this page cannot make: ${b.detail}`)
        : []),
      // Consultancy filler. Not a truth failure, which is exactly why nothing
      // else here catches it: the sentence is accurate and says nothing.
      ...(guards.forbidFiller
        ? consultancyFiller(emitted).map(
            (phrase) => `the filler phrase "${phrase}", which would be true on any page in any year`
          )
        : []),
      ...(guards.urgency
        ? urgencyViolations(
            String(
              (parsed as Record<string, unknown>)[guards.urgency.field] ?? ""
            ),
            guards.urgency.restricted,
            guards.urgency.allowed
          ).map(
            (w) =>
              `"${w}" in ${guards.urgency!.field}, which draws on evidence barred from establishing that this is happening now`
          )
        : []),
    ];
    if (bad.length === 0) {
      phaseLog(
        kind,
        attemptMs.map((ms, i) => ({ label: `attempt${i + 1}`, ms })),
        `authored on attempt ${attempt + 1}`
      );
      cache.set(cacheKey, { value: parsed, at: Date.now() });
      return parsed;
    }

    lastInvented = bad;
    // Never silent in the log: a model inventing figures is the one failure
    // that must stay visible to us even though the reader never sees it.
    console.warn(
      // "invented" was right when every entry was a fabricated figure and is
      // wrong now that the list also carries temporal and freshness breaches:
      // a model that wrote "keeps climbing" invented nothing, it claimed more
      // than the evidence carries. The operator reading this log needs the
      // difference, so the entries say what they are and this line does not
      // label them.
      `[analyst-llm] ${attempt === 0 ? "retrying" : "discarded"} ${kind}: ${bad.join("; ")}`
    );
  }

  // Both attempts produced a figure the data did not contain. The caller falls
  // back to the computed text, and because this throws rather than returning,
  // the discard is not cached and the next reader gets a fresh attempt.
  throw new Error(`[analyst-llm] ${kind}: discarded after retry`);
}

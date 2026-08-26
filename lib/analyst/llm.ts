import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";
import {
  reversedClaims,
  unsupportedCounts,
  type DirectionClaim,
} from "./canonical";
import { claimsCausality } from "./synthesis";

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

const MODEL = "claude-opus-5";
const TIMEOUT_MS = 30_000;
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
  maxTokens: number
): Promise<string | null> {
  const apiKey = llmKey();
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.find((b) => b.type === "text");
    return text && text.type === "text" ? text.text : null;
  } catch {
    // A failed call is a fallback to computed text, never a broken page.
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
export type AuthorFailure = "no-key" | "unreachable" | "rejected";

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
  });
  const cacheKey = keyOf(kind, { facts: stable, instruction, guardKey });
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
      }
    ),
  ["analyst-insight"],
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

TASK:
${instruction}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const correction =
      lastInvented.length > 0
        ? `\n\nCORRECTION: your previous answer used ${lastInvented.join(", ")}, which ${lastInvented.length === 1 ? "is" : "are"} not in the data. Rewrite it without ${lastInvented.length === 1 ? "that" : "those"}.`
        : attempt === 0
          ? ""
          : "\n\nCORRECTION: your previous answer was not valid JSON, most likely because it ran long. Answer again, shorter, as a single JSON object.";

    const raw = await callModel(base + correction, maxTokens);
    // Throw rather than return: a failed call must not be cached for a day.
    if (!raw) throw new Error(`[analyst-llm] ${kind}: no response`);

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
      ...invented(emitted, facts),
      ...foreignEntities(emitted, facts, roster, guards.entities),
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
    ];
    if (bad.length === 0) {
      cache.set(cacheKey, { value: parsed, at: Date.now() });
      return parsed;
    }

    lastInvented = bad;
    // Never silent in the log: a model inventing figures is the one failure
    // that must stay visible to us even though the reader never sees it.
    console.warn(
      `[analyst-llm] ${attempt === 0 ? "retrying" : "discarded"} ${kind}: invented ${bad.join(", ")}`
    );
  }

  // Both attempts produced a figure the data did not contain. The caller falls
  // back to the computed text, and because this throws rather than returning,
  // the discard is not cached and the next reader gets a fresh attempt.
  throw new Error(`[analyst-llm] ${kind}: discarded after retry`);
}

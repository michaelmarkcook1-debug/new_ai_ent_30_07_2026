import Anthropic from "@anthropic-ai/sdk";

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
  const permitted = numbersIn(allowed);
  for (const n of numbersIn(output)) {
    if (!permitted.has(n)) return false;
  }
  return true;
}

// ------------------------------------------------------------------ client

const SYSTEM = `You are the senior analyst voice of AI Enterprise, a buyer-intelligence product for enterprise AI purchasing.

Your reader is a CIO or a senior buyer. They are short of time, they are accountable for the decision, and they can tell when they are being sold to.

ABSOLUTE RULES, in order of importance:

1. Never state a figure that is not in the DATA you are given. Not a rounded one, not an approximation, not a figure you believe to be true about the world. If you want to say something the data does not support, say the qualitative part and omit the number. Your output is machine-checked against the input and silently discarded if it contains a number the data did not.
2. Never invent a vendor, product, event or date.
3. Where the data records an absence, that absence is the finding. "No AI revenue is disclosed" is a useful sentence. Do not paper over a gap.

VOICE:
- British English. No em-dashes.
- Plain, specific, unhedged. Say what you think follows from the figures.
- No marketing language, no "in today's fast-moving landscape", no throat-clearing.
- A sentence that would be true of any market in any year is worthless. Be specific to these figures.
- Do not begin with "Analysis shows" or similar. Start with the point.

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
export async function authored<T extends object>(
  kind: string,
  facts: string,
  instruction: string,
  maxTokens = 900
): Promise<T | null> {
  if (!llmAvailable()) return null;

  const cacheKey = keyOf(kind, { facts, instruction });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  const raw = await callModel(
    `DATA (the only figures you may use):\n${facts}\n\nTASK:\n${instruction}`,
    maxTokens
  );
  if (!raw) return null;

  const parsed = parseJson<T>(raw);
  if (!parsed) return null;

  // The check that makes this safe to ship. Every string the model produced is
  // tested against the figures it was given.
  const emitted = JSON.stringify(parsed);
  if (!guard(emitted, facts)) {
    // Silent by design at render time, but never silent in the log: a model
    // inventing figures is the one failure that must be visible to us.
    console.warn(
      `[analyst-llm] discarded ${kind}: output contained a figure absent from the data`
    );
    return null;
  }

  cache.set(cacheKey, { value: parsed, at: Date.now() });
  return parsed;
}

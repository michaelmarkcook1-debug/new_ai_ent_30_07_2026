import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  authoredResult,
  primeAuthoringCache,
  AUTHORING_CONTRACT,
  llmAvailable,
} from "@/lib/analyst/llm";

// The old model's cache cannot satisfy the new model's request, PROVEN THROUGH
// THE REAL LOOKUP rather than by comparing key strings.
//
// WHY A PRIMED ENTRY RATHER THAN A SEEDED ONE. The release simulation on
// 5 September 2026 tried to seed a genuine Opus 5 reading by pinning the
// model and rendering /peer-insights. The call was refused by Anthropic in
// 321ms with HTTP 400 "credit balance is too low": no message, no draft,
// nothing cached, the page fell back to computed. Fable got the same 400 on
// the next two requests, so it was the account, not the contract. Seeding
// through the runtime depends on the account being able to author, and a
// proof of cache identity should not. So this plants the entry directly, in
// the real L1 store, under the real key, and then asks the real lookup.
//
// WHAT THE L2 LAYER DOES. unstable_cache builds its key from the callback
// source, the key parts and the arguments; the authoring contract is a key
// part (lib/analyst/llm.ts, cachedGenerate). Outside a Next render it throws
// its incrementalCache invariant when invoked, which is exactly what a miss
// here falls through to. That throw is the evidence the request went PAST the
// planted entry rather than finding it.

const facts =
  "Across 13 judged categories, 2 carry a lead of 0.5 or more and 7 sit inside 0.15. Captured 2026-09-05T09:00:00.000Z.";
const instruction = "Answer: does capability still separate this market?";
// authoredResult() builds this from empty guards; the primed key must match it.
const guardKey = JSON.stringify({
  claims: [],
  entities: [],
  forbidCausal: false,
  comparability: null,
  forbidFiller: false,
  temporal: null,
  urgency: null,
});
const OPUS_READING = { headline: "written by claude-opus-5", marker: "opus" };
const FABLE_READING = { headline: "written by claude-fable-5-1", marker: "fable" };

async function request(kind: string, f: string = facts) {
  return authoredResult<{ marker: string }>(kind, f, instruction, 1400, [], {});
}

describe("an Opus 5 cache entry is unreachable from a Fable 5.1 request", () => {
  beforeAll(() => {
    // A placeholder so authoredResult() gets past its no-key early return and
    // reaches the cache lookup. Nothing here can reach the network: a miss
    // falls into unstable_cache, which throws before any model call.
    vi.stubEnv("ANTHROPIC_API_KEY", "test-placeholder-never-sent");
    expect(llmAvailable()).toBe(true);
  });
  afterAll(() => vi.unstubAllEnvs());

  it("control: an entry under the live Fable contract is found and returned", async () => {
    primeAuthoringCache("insight:market:control", { facts, instruction, guardKey }, FABLE_READING);
    const r = await request("insight:market:control");
    expect(r.failure).toBeNull();
    expect(r.value?.marker).toBe("fable");
  });

  it("an entry under model = claude-opus-5, same intelligence version, same evidence, is passed by", async () => {
    primeAuthoringCache(
      "insight:market:opus",
      { facts, instruction, guardKey },
      OPUS_READING,
      { ...AUTHORING_CONTRACT, model: "claude-opus-5" }
    );
    const r = await request("insight:market:opus");
    // Not the Opus reading. The lookup missed L1 and fell through to L2,
    // which cannot run here, so the honest answer is "unreachable", never a
    // reading written by another model.
    expect(r.value).toBeNull();
    expect(r.failure).toBe("unreachable");
  });

  it("an entry under a different intelligence version is passed by", async () => {
    primeAuthoringCache(
      "insight:market:version",
      { facts, instruction, guardKey },
      FABLE_READING,
      { ...AUTHORING_CONTRACT, intelligence: "2026-09-04" }
    );
    const r = await request("insight:market:version");
    expect(r.value).toBeNull();
    expect(r.failure).toBe("unreachable");
  });

  it("an entry under capped reasoning effort is passed by", async () => {
    primeAuthoringCache(
      "insight:market:effort",
      { facts, instruction, guardKey },
      FABLE_READING,
      { ...AUTHORING_CONTRACT, reasoning: "medium" }
    );
    const r = await request("insight:market:effort");
    expect(r.value).toBeNull();
    expect(r.failure).toBe("unreachable");
  });

  it("an entry for different evidence is passed by, and same-day timestamps are the same evidence", async () => {
    primeAuthoringCache("insight:market:evidence", { facts, instruction, guardKey }, FABLE_READING);
    const changed = facts.replace("7 sit inside", "8 sit inside");
    const miss = await request("insight:market:evidence", changed);
    expect(miss.value).toBeNull();
    expect(miss.failure).toBe("unreachable");
    const laterToday = facts.replace("09:00:00", "18:30:00");
    const hit = await request("insight:market:evidence", laterToday);
    expect(hit.value?.marker).toBe("fable");
  });
});

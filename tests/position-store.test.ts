import { describe, it, expect, beforeEach } from "vitest";
import type { CompanyResearch } from "@/lib/research/company";

// The saved position: Your AI Position's outcome, carried to the Decision Desk.
//
// Two things here can be wrong in a way nobody notices. The first is the name
// match: attach the wrong company's research and the Decision Desk answers
// confidently about an organisation the reader never asked about. The second is
// the opening line, which is written INTO the reader's own input box, so a bug
// there puts words in their mouth. Both get the most attention below.
//
// The store lives in localStorage, which does not exist in Node, so a minimal
// in-memory stand-in is installed before the module is imported. jsdom would do
// the same job and this project keeps its dependency list short on purpose.

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();

// A minimal event target alongside the storage stand-in. The store notifies
// listeners on every write so a panel showing a position can drop it when it
// goes, and without these the stub window could not hear that. It is also the
// environment that exposed the real defect: dispatching inside the same try as
// the setItem meant a window without dispatchEvent reported a successful write
// as a failure.
const listeners = new Map<string, Set<() => void>>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  addEventListener(type: string, fn: () => void) {
    const set = listeners.get(type) ?? new Set();
    set.add(fn);
    listeners.set(type, set);
  },
  removeEventListener(type: string, fn: () => void) {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent(evt: { type: string }) {
    for (const fn of listeners.get(evt.type) ?? []) fn();
    return true;
  },
};
// The store constructs `new Event(...)`, which Node has only from v15 as a
// global. Provided explicitly so the test does not depend on that.
if (typeof (globalThis as { Event?: unknown }).Event === "undefined") {
  (globalThis as { Event?: unknown }).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

const {
  normaliseName,
  matchPosition,
  savePosition,
  listPositions,
  latestPosition,
  removePosition,
  isSaved,
  toPosition,
  toContext,
  openingLine,
  POSITIONS_CHANGED,
} = await import("@/lib/position/store");

const position = (name: string, savedAt = "2026-08-08T10:00:00.000Z") => ({
  key: normaliseName(name),
  query: name,
  name,
  what: "an online grocery retailer",
  industry: "Online grocery retail and technology",
  sectorTag: "retail_consumer",
  aiFindings: ["Uses AI for demand forecasting."],
  findings: ["Operates several automated warehouses."],
  recommendations: ["Ask who delivers the model."],
  savedAt,
});

beforeEach(() => storage.clear());

describe("names are reduced only as far as is safe", () => {
  it("ignores case, punctuation and legal suffix", () => {
    expect(normaliseName("Ocado Retail Ltd.")).toBe("ocado retail");
    expect(normaliseName("  OCADO   retail  ")).toBe("ocado retail");
    expect(normaliseName("Barclays PLC")).toBe("barclays");
  });

  it("keeps a subsidiary distinct from its parent", () => {
    // Collapsing these would let a position saved for one answer a question
    // about the other, which is a wrong answer delivered confidently.
    expect(normaliseName("Ocado Retail")).not.toBe(normaliseName("Ocado"));
  });
});

describe("matching a situation to a saved company", () => {
  it("finds the company the reader named", () => {
    savePosition(position("Ocado Retail"));
    const hit = matchPosition("We are Ocado Retail and want agentic AI in support.");
    expect(hit?.name).toBe("Ocado Retail");
  });

  it("does not fire on a longer word that merely contains the name", () => {
    savePosition(position("Apple"));
    expect(matchPosition("We make pineapple drinks.")).toBeNull();
    expect(matchPosition("Our applesauce line is growing.")).toBeNull();
  });

  it("still fires on a standalone common word, which is a known limit", () => {
    // "apple juice" contains "apple" as a whole word, so a position saved for
    // Apple attaches. String matching cannot tell the company from the fruit,
    // and guessing from context would be a worse failure than this one because
    // it would be silent. The mitigation is on screen instead: the interface
    // names the position it attached and offers to drop it, so a wrong match
    // is visible and one click from being undone.
    savePosition(position("Apple"));
    expect(matchPosition("We sell apple juice across Europe.")).toBeTruthy();
  });

  it("prefers the longest name when two could match", () => {
    savePosition(position("Ocado"));
    savePosition(position("Ocado Retail"));
    expect(matchPosition("A question about Ocado Retail.")?.name).toBe(
      "Ocado Retail"
    );
  });

  it("ignores names too short to be distinctive", () => {
    // Two-letter initialisms collide with ordinary words far too often.
    savePosition(position("BP"));
    expect(matchPosition("We need a bp check on this.")).toBeNull();
  });

  it("returns null when nothing is saved or nothing matches", () => {
    expect(matchPosition("We are a European bank.")).toBeNull();
    savePosition(position("Ocado Retail"));
    expect(matchPosition("We are a European bank.")).toBeNull();
  });

  it("matches through a legal suffix the reader typed and we did not", () => {
    savePosition(position("Barclays"));
    expect(matchPosition("Barclays PLC is our employer.")?.name).toBe("Barclays");
  });
});

describe("the line written into the reader's input box", () => {
  it("stops before the part only the reader knows", () => {
    // It must be PART of a situation. A complete one gets submitted unread and
    // the finding answers a question nobody asked.
    const line = openingLine(position("Ocado Retail"));
    expect(line).toBe("We are Ocado Retail, an online grocery retailer. ");
    expect(line.endsWith(" ")).toBe(true);
    expect(line).not.toMatch(/\?/);
  });

  it("keeps an initialism capitalised", () => {
    const p = { ...position("Acme"), what: "UK energy supplier" };
    expect(openingLine(p)).toBe("We are Acme, UK energy supplier. ");
  });

  it("names the company alone when the sources described nothing", () => {
    const p = { ...position("Acme"), what: "" };
    expect(openingLine(p)).toBe("We are Acme. ");
  });

  it("survives a round trip through the matcher", () => {
    // The prefill has to match itself, or a reader who accepts the offer and
    // types nothing else gets no research attached.
    const p = position("Ocado Retail");
    savePosition(p);
    expect(matchPosition(openingLine(p) + "Should we buy Copilot?")?.name).toBe(
      "Ocado Retail"
    );
  });
});

describe("saving, listing and removing", () => {
  it("round-trips a saved position", () => {
    expect(savePosition(position("Ocado Retail"))).toBe(true);
    expect(isSaved("ocado retail ltd")).toBe(true);
    expect(listPositions().length).toBe(1);
    removePosition(normaliseName("Ocado Retail"));
    expect(listPositions()).toEqual([]);
  });

  it("replaces rather than duplicates the same company", () => {
    savePosition(position("Ocado Retail", "2026-08-01T00:00:00.000Z"));
    savePosition(position("Ocado Retail", "2026-08-08T00:00:00.000Z"));
    const all = listPositions();
    expect(all.length).toBe(1);
    expect(all[0].savedAt).toBe("2026-08-08T00:00:00.000Z");
  });

  it("offers the most recently saved company first", () => {
    savePosition(position("Alpha Group", "2026-08-01T00:00:00.000Z"));
    savePosition(position("Beta Group", "2026-08-08T00:00:00.000Z"));
    expect(latestPosition()?.name).toBe("Beta Group");
  });

  it("keeps the store bounded", () => {
    for (let i = 0; i < 12; i++) {
      savePosition(position(`Company Number ${i}`, `2026-08-0${(i % 9) + 1}T00:00:00.000Z`));
    }
    expect(listPositions().length).toBeLessThanOrEqual(8);
  });
});

describe("what is carried, and what is deliberately not", () => {
  const research = {
    query: "Ocado",
    profile: {
      name: "Ocado Retail",
      what: "an online grocery retailer",
      industry: "Online grocery retail",
      sector: { tag: "retail_consumer" },
    },
    metrics: [],
    findings: [{ statement: "Operates automated warehouses.", sourceIndex: 0 }],
    aiFindings: [{ statement: "Uses AI for forecasting.", sourceIndex: 1 }],
    recommendations: ["Ask who delivers the model."],
    sources: [],
    absence: null,
    written: true,
  } as unknown as CompanyResearch;

  it("builds a position from a finished run", () => {
    const p = toPosition(research)!;
    expect(p.name).toBe("Ocado Retail");
    expect(p.aiFindings).toEqual(["Uses AI for forecasting."]);
    expect(p.sectorTag).toBe("retail_consumer");
  });

  it("refuses a run that never named the company", () => {
    // Saving an empty shell would put a company on the Decision Desk that the
    // sources never described.
    const none = { ...research, profile: null } as CompanyResearch;
    expect(toPosition(none)).toBeNull();
  });

  it("clamps hard before anything reaches a prompt", () => {
    const p = position("Ocado Retail");
    const long = { ...p, what: "x".repeat(999), aiFindings: Array(20).fill("y".repeat(999)) };
    const ctx = toContext(long);
    expect(ctx.what.length).toBe(400);
    expect(ctx.aiFindings.length).toBe(6);
    expect(ctx.aiFindings.every((f) => f.length <= 400)).toBe(true);
  });

  it("does not carry citations into the other tool", () => {
    // Source indexes are meaningless away from the page that holds the sources
    // they point at, so statements travel and citations stay put.
    const ctx = toContext(toPosition(research)!);
    expect(JSON.stringify(ctx)).not.toContain("sourceIndex");
  });
});

describe("the change notification", () => {
  it("never turns a successful write into a reported failure", () => {
    // The dispatch sat inside the same try as the setItem. A window without
    // dispatchEvent threw there, the catch returned false, and the save button
    // told the reader it had not saved something it had just saved.
    const original = window.dispatchEvent;
    window.dispatchEvent = () => {
      throw new Error("no dispatchEvent here");
    };
    try {
      expect(savePosition(position("Ocado Retail"))).toBe(true);
      expect(listPositions().map((p) => p.name)).toContain("Ocado Retail");
    } finally {
      window.dispatchEvent = original;
    }
  });

  it("fires on save and on remove, so a stale panel can refresh itself", () => {
    let heard = 0;
    const onChange = () => (heard += 1);
    window.addEventListener(POSITIONS_CHANGED, onChange);
    try {
      savePosition(position("Ocado Retail"));
      expect(heard).toBe(1);
      removePosition("ocado retail");
      expect(heard).toBe(2);
    } finally {
      window.removeEventListener(POSITIONS_CHANGED, onChange);
    }
  });
});

// A component that shows the store has to follow the store.
//
// THE BUG THIS PINS. `SavedPositions` read `listPositions()` once on mount and
// never again, so clearing the company from the context bar emptied the store
// and left the saved list on Your AI Position still naming it, on the very page
// the list lives on. The store said nothing was saved and the screen said
// Fortnum & Mason was. `SavePosition` had the same gap and went on saying "is
// saved" beside it.
//
// The event already existed and was already tested to fire; what was missing
// was that two of the four components reading the store had not subscribed to
// it. There is no DOM environment in this suite, so this is asserted at source
// level rather than by mounting: crude, and it would have caught the defect,
// which is the bar a regression test has to clear.
describe("every component that reads the position store subscribes to it", () => {
  const READS = /\b(listPositions|latestPosition|isSaved)\s*\(/;

  it("registers POSITIONS_CHANGED wherever it reads", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "lib/position";
    const components = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(components.length).toBeGreaterThan(0);

    for (const file of components) {
      const src = readFileSync(`${dir}/${file}`, "utf8");
      if (!READS.test(src)) continue;
      expect(
        src.includes("addEventListener(POSITIONS_CHANGED"),
        `${file} reads the position store but never listens for POSITIONS_CHANGED, so it will keep showing a position after another component removes it`
      ).toBe(true);
      expect(
        src.includes("removeEventListener(POSITIONS_CHANGED"),
        `${file} subscribes to POSITIONS_CHANGED without unsubscribing`
      ).toBe(true);
    }
  });

  it("covers the two that were missed", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/position/save-position.tsx", "utf8");
    // Both components live in this file and both were reading once on mount.
    expect(src.match(/addEventListener\(POSITIONS_CHANGED/g) ?? []).toHaveLength(2);
  });
});

// Carrying a company forward has to actually carry it.
//
// THE BUG THIS PINS. "Take this to the Decision Desk" was a bare link to
// /decision-desk. The desk opens on `latestPosition()`, the most recently
// SAVED company, so a reader who researched Boots and pressed a button saying
// "take this" arrived at a box prefilled with whichever company they had saved
// weeks earlier. Measured on the running product: saved was ["Fortnum &
// Mason"], the desk opened on Fortnum, and nothing on screen said the handoff
// had not happened.
//
// The desk's own prefill was never broken. Seeding a saved Boots position made
// it open on Boots correctly. What was missing was the save.
describe("the Decision Desk handoff", () => {
  it("opens on the company most recently carried, not the one saved first", () => {
    // The ordering the whole handoff rests on: the newest save wins, so
    // carrying a second company forward replaces the first as what the desk
    // offers rather than queueing behind it.
    savePosition(position("Fortnum & Mason", "2026-08-08T10:00:00.000Z"));
    savePosition(position("Boots", "2026-08-28T22:00:00.000Z"));
    expect(latestPosition()?.name).toBe("Boots");
  });

  it("saves before it navigates, rather than linking and hoping", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    // Scanned across the directory rather than pinned to one file: the control
    // moved into its own client module the first time this was enforced, and a
    // test that breaks when correct code is relocated teaches people to delete
    // the test.
    const dir = "app/(ai-ent)/company-view/components";
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => ({ f, src: readFileSync(`${dir}/${f}`, "utf8") }));

    const handoff = sources.filter((x) =>
      /Take this to the Decision Desk/.test(x.src)
    );
    expect(handoff.length, "the Decision Desk handoff has gone").toBeGreaterThan(0);

    for (const { f, src } of handoff) {
      expect(
        /savePosition\(/.test(src),
        `${f} offers to take the company to the Decision Desk without saving it, so the desk will open on whatever was saved previously`
      ).toBe(true);
      expect(
        /<Link\s+href="\/decision-desk"/.test(src),
        `${f} carries the company with a bare link again, which carries nothing`
      ).toBe(false);
    }
  });

  it("gives every saved company a way back to its research", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/position/save-position.tsx", "utf8");
    // The page renders whatever ?company= names and the sidebar link carries
    // no query, so a plain-text list left the reader retyping the name to see
    // an analysis they had already paid for.
    expect(
      /company-view\?company=\$\{encodeURIComponent\(p\.query\)\}/.test(src),
      "the saved list no longer links back to each company's research"
    ).toBe(true);
  });
});

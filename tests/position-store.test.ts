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
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

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

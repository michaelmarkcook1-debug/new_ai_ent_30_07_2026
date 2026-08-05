import { describe, it, expect } from "vitest";
import { groundingBlock, searchProvider } from "@/lib/research/search";
import { researchCompany } from "@/lib/research/company";

// The research path replaces a fixture with retrieval, so the thing worth
// testing is what it does when retrieval is not possible. The failure mode
// this product cannot have is a confident profile assembled from a model's
// memory of a company.

describe("grounding", () => {
  it("keeps every passage attached to the URL it came from", () => {
    const block = groundingBlock([
      {
        title: "Acme results",
        url: "https://example.com/a",
        snippet: "Revenue was 12.4 million.",
        publishedAt: "2026-01-02",
      },
      {
        title: "Acme profile",
        url: "https://example.com/b",
        snippet: "Acme employs people.",
        publishedAt: null,
      },
    ]);
    expect(block).toContain("[1]");
    expect(block).toContain("https://example.com/a");
    expect(block).toContain("Revenue was 12.4 million.");
    expect(block).toContain("[2]");
    expect(block).toContain("https://example.com/b");
    // A passage with no date must not acquire one.
    expect(block).not.toContain("(null)");
  });
});

describe("researchCompany without a provider", () => {
  // No key is the state this ships in, so it is the state that must behave.
  it("says why rather than returning an empty profile", async () => {
    const r = await researchCompany("Some Company Ltd");
    if (searchProvider() !== "none") return; // keyed environment, not this case
    expect(r.profile).toBeNull();
    expect(r.findings).toEqual([]);
    expect(r.sources).toEqual([]);
    expect(r.written).toBe(false);
    expect(r.absence).toMatch(/no web search provider/i);
    // The remedy is named, so the gap is actionable rather than mysterious.
    expect(r.absence).toMatch(/TAVILY_API_KEY|BRAVE_SEARCH_API_KEY/);
  });

  it("refuses a query too short to be a company", async () => {
    const r = await researchCompany(" ");
    expect(r.profile).toBeNull();
    expect(r.absence).toMatch(/enter a company/i);
  });

  it("never invents a profile when nothing was retrieved", async () => {
    // Named so a model drawing on memory would have plenty to say.
    const r = await researchCompany("Microsoft");
    if (searchProvider() !== "none") return;
    expect(r.profile).toBeNull();
    expect(r.written).toBe(false);
  });
});

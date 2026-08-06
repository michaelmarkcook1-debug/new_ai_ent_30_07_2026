import { describe, it, expect } from "vitest";
import { normaliseWorkforce } from "@/lib/research/workforce";
import type { SearchHit } from "@/lib/research/search";

// The half that decides what reaches a reader.
//
// A published headcount is worth showing precisely because it is checkable, so
// the citation has to be real. A figure whose source index points past the end
// of the list opens nothing when clicked, which is indistinguishable from an
// assertion, and an assertion dressed as a disclosure is the failure this
// product exists to avoid.

const hits: SearchHit[] = [
  { title: "Annual Report 2026", url: "https://example.com/ar", snippet: "", publishedAt: null },
  { title: "Newsroom", url: "https://example.com/news", snippet: "", publishedAt: null },
];

describe("a stated total", () => {
  it("is kept with its date and its source", () => {
    const w = normaliseWorkforce(
      { total: { value: "606,000", asOf: "March 2026", source: 1 } },
      hits,
      "Acme"
    );
    expect(w.total).toEqual({
      value: "606,000",
      asOf: "March 2026",
      sourceIndex: 0,
    });
    expect(w.absence).toBeNull();
  });

  it("drops a citation that points past the sources we hold", () => {
    // Source 9 of 2 is the shape a hallucinated citation takes.
    const w = normaliseWorkforce(
      { total: { value: "606,000", asOf: "2026", source: 9 } },
      hits,
      "Acme"
    );
    expect(w.total).toBeNull();
    expect(w.absence).toContain("No retrieved source states a headcount");
  });

  it("treats an unstated date as absent rather than printing the words", () => {
    const w = normaliseWorkforce(
      { total: { value: "350,000", asOf: "not stated", source: 2 } },
      hits,
      "Acme"
    );
    expect(w.total?.asOf).toBeNull();
    expect(w.total?.sourceIndex).toBe(1);
  });
});

describe("published splits", () => {
  it("keeps the company's own wording and drops uncited rows", () => {
    const w = normaliseWorkforce(
      {
        total: null,
        splits: [
          { label: "IT services", value: "400,000", source: 1 },
          { label: "Consulting", value: "80,000", source: 5 }, // uncited
          { label: "", value: "1", source: 1 }, // no label
        ],
      },
      hits,
      "Acme"
    );
    expect(w.splits).toHaveLength(1);
    expect(w.splits[0]).toEqual({
      label: "IT services",
      value: "400,000",
      sourceIndex: 0,
    });
  });

  it("caps the list so one panel cannot become a report", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      label: `Segment ${i}`,
      value: `${i}00`,
      source: 1,
    }));
    expect(normaliseWorkforce({ splits: many }, hits, "Acme").splits).toHaveLength(6);
  });
});

describe("publishing nothing is a normal state", () => {
  it("says so rather than returning an empty panel", () => {
    const w = normaliseWorkforce({ total: null, splits: [] }, hits, "Acme");
    expect(w.total).toBeNull();
    expect(w.splits).toEqual([]);
    expect(w.absence).toContain("Private companies rarely publish one");
  });

  it("prefers the model's own sentence when it gave one", () => {
    const w = normaliseWorkforce(
      { total: null, splits: [], none: "Acme is privately held and states no headcount." },
      hits,
      "Acme"
    );
    expect(w.absence).toBe("Acme is privately held and states no headcount.");
  });

  it("does not claim an absence when a figure survived", () => {
    const w = normaliseWorkforce(
      { total: { value: "12,000", asOf: "2026", source: 1 }, none: "nothing found" },
      hits,
      "Acme"
    );
    expect(w.absence).toBeNull();
  });
});

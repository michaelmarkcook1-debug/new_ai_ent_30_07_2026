import { describe, it, expect } from "vitest";
import modelsJson from "@/lib/model-fit/data/models.json";
import {
  AXES,
  axisView,
  axisById,
  axisDenominator,
  markFrontier,
  pickLabels,
  type PricePoint,
} from "@/lib/model-fit/price-performance";
import type { ModelRecord } from "@/lib/model-fit/engine";

const MODELS = (
  Array.isArray(modelsJson) ? modelsJson : Object.values(modelsJson)
) as ModelRecord[];

const pt = (
  modelId: string,
  price: number,
  score: number | null
): PricePoint => ({ modelId, vendor: "v", price, score, frontier: false });

describe("axis coverage", () => {
  // The denominators printed on the chart. If one of these moves, the label
  // is lying about how much of the market the axis covers.
  it("matches the catalogue", () => {
    expect(axisView(MODELS, "intelligence").scored.length).toBe(330);
    expect(axisView(MODELS, "gpqa").scored.length).toBe(56);
    expect(axisView(MODELS, "briefcase").scored.length).toBe(44);
    expect(axisView(MODELS, "throughput").scored.length).toBe(262);
    // CAP-11, live in axes-and-calibration.json and scored on more models
    // than either GPQA or Briefcase, had no tab until 5 August 2026. A
    // benchmark the catalogue holds and does not show is one nobody can use.
    expect(axisView(MODELS, "accuracy").scored.length).toBe(145);
    expect(axisView(MODELS, "intelligence").total).toBe(330);
  });

  it("keeps every unscored model rather than dropping it", () => {
    const v = axisView(MODELS, "briefcase");
    expect(v.unscored.length).toBe(286);
    expect(v.scored.length + v.unscored.length).toBe(v.total);
    // They are kept because they have a real price to plot against.
    expect(v.unscored.every((p) => p.price > 0)).toBe(true);
    expect(v.unscored.every((p) => p.score === null)).toBe(true);
  });

  it("prints the denominator the way the axis label needs it", () => {
    expect(axisDenominator(axisView(MODELS, "briefcase"))).toBe(
      "Agentic: 44 of 330 scored"
    );
  });

  it("ships coding as a named gap, not a hidden one", () => {
    const coding = axisById("coding");
    expect(coding?.status).toBe("identified");
    expect(coding?.field).toBeNull();
    expect(coding?.gap).toContain("Artificial Analysis");
    // Present in the tab list, so it renders disabled rather than absent.
    expect(AXES.some((a) => a.id === "coding")).toBe(true);
    expect(axisView(MODELS, "coding").scored.length).toBe(0);
  });
});

describe("the frontier", () => {
  // The catalogue's own frontier flag was computed against intelligence, so
  // agreeing with it on that axis proves the Pareto logic is right.
  it("reproduces the catalogue's 10 on-frontier models on intelligence", () => {
    const mine = axisView(MODELS, "intelligence")
      .scored.filter((p) => p.frontier)
      .map((p) => p.modelId)
      .sort();
    const theirs = MODELS.filter((m) => m.frontier === "On frontier")
      .map((m) => m.model_id)
      .sort();
    expect(theirs.length).toBe(10);
    expect(mine).toEqual(theirs);
  });

  // The reason it is recomputed rather than read off the record: the two
  // frontiers are genuinely different sets. Reusing the stored flag on the
  // agentic chart would mark Grok 4.5 as undominated when a cheaper model
  // beats it there, and would miss four models that actually are undominated.
  it("does not carry the intelligence frontier onto another axis", () => {
    const agentic = axisView(MODELS, "briefcase");
    const onAgentic = new Set(
      agentic.scored.filter((p) => p.frontier).map((p) => p.modelId)
    );
    const stored = new Set(
      MODELS.filter((m) => m.frontier === "On frontier").map((m) => m.model_id)
    );

    const grok = "Grok 4.5 (high)";
    expect(stored.has(grok)).toBe(true);
    expect(onAgentic.has(grok)).toBe(false);

    // Undominated on agentic, and nowhere near the intelligence frontier.
    for (const m of [
      "Claude Sonnet 5 (Adaptive Reasoning, Max Effort)",
      "GLM-5.2 (max)",
      "MiniMax-M3",
      "gpt-oss-20b (high)",
    ]) {
      expect(onAgentic.has(m)).toBe(true);
      expect(stored.has(m)).toBe(false);
    }
  });

  it("excludes anything a cheaper model matches or beats", () => {
    const marked = markFrontier([
      pt("cheap-weak", 1, 10),
      pt("mid-strong", 2, 40),
      pt("dear-weak", 5, 30),
      pt("dear-tie", 9, 40),
    ]);
    const on = marked.filter((p) => p.frontier).map((p) => p.modelId);
    expect(on).toEqual(["cheap-weak", "mid-strong"]);
  });

  it("keeps only the best model at a tied price", () => {
    const marked = markFrontier([pt("a", 3, 20), pt("b", 3, 55)]);
    expect(marked.filter((p) => p.frontier).map((p) => p.modelId)).toEqual(["b"]);
  });
});

describe("the worked example", () => {
  // The story told in the demo, which has to stay true of shipped data.
  it("has Opus 5 on the frontier and Fable 5 dominated at double the price", () => {
    const v = axisView(MODELS, "intelligence");
    const opus = v.scored.find((p) =>
      p.modelId.startsWith("Claude Opus 5 (Adaptive Reasoning, Max Effort)")
    );
    const fable = v.scored.find((p) =>
      p.modelId.startsWith("Claude Fable 5")
    );
    expect(opus?.score).toBe(60.7);
    expect(opus?.price).toBe(5);
    expect(opus?.frontier).toBe(true);

    expect(fable?.score).toBe(59.9);
    expect(fable?.price).toBe(10);
    expect(fable?.frontier).toBe(false);

    // Lower score, double the price. That is the whole point of the chart.
    expect(fable!.score! < opus!.score!).toBe(true);
    expect(fable!.price).toBe(opus!.price * 2);
  });
});

describe("direct labels", () => {
  it("labels the two cheapest frontier models and the top scorer", () => {
    const labels = axisView(MODELS, "intelligence").labelled;
    expect(labels.length).toBe(3);
    expect(labels[0].price).toBe(0.02);
    expect(labels[1].price).toBe(0.03);
    expect(labels[2].score).toBe(60.7);
  });

  it("never labels the whole plot", () => {
    for (const id of ["intelligence", "gpqa", "briefcase", "throughput"]) {
      const v = axisView(MODELS, id);
      expect(v.labelled.length).toBeLessThanOrEqual(3);
      expect(v.labelled.length).toBeLessThan(v.scored.length);
    }
  });

  it("does not name the top scorer twice when it is also cheapest", () => {
    const labels = pickLabels(
      markFrontier([pt("best-and-cheapest", 1, 90), pt("dearer", 5, 20)])
    );
    expect(labels.map((p) => p.modelId)).toEqual(["best-and-cheapest"]);
  });
});

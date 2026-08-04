import type { ModelRecord } from "./engine";

// Price against capability, on whichever capability you ask for.
//
// Four axes have data and one does not, and the one that does not is the most
// asked-for. That asymmetry is the whole design problem here: a switcher that
// quietly drops Coding looks complete and is not, and a switcher that fakes it
// is worse. Coding ships as a disabled tab carrying the reason.
//
// Two things this does that a naive version would get wrong.
//
// The frontier is recomputed per axis. models.json carries a `frontier` field,
// but that field was computed against intelligence: Claude Opus 5 is on the
// intelligence frontier and has no briefcase score at all. Reusing it on the
// agentic axis would draw intelligence conclusions in agentic clothing, so it
// is used only to cross-check the intelligence axis and never to render
// another one.
//
// Unscored models are kept, not dropped. When an axis covers 44 of 330, the
// other 286 are real products at real prices whose capability simply has not
// been measured. Dropping them would make the axis look like the whole market;
// they are returned separately so the caller can render them in a gutter.

export type AxisStatus = "live" | "identified";

export interface Axis {
  id: string;
  label: string;
  cap: string;
  /** Where the score lives on a ModelRecord. null when nothing is ingested. */
  field: string | null;
  /** benchmarks.<field>, or a top-level field on the record. */
  location: "benchmarks" | "root";
  status: AxisStatus;
  unit: string;
  /** Why the tab is dark, shown on hover. Only set when status is not live. */
  gap?: string;
}

export const AXES: Axis[] = [
  {
    id: "intelligence",
    label: "General intelligence",
    cap: "CAP-01",
    field: "intelligence",
    location: "benchmarks",
    status: "live",
    unit: "Intelligence Index v4.1",
  },
  {
    id: "gpqa",
    label: "Multi-step reasoning",
    cap: "CAP-02",
    field: "gpqa",
    location: "benchmarks",
    status: "live",
    unit: "GPQA Diamond",
  },
  {
    id: "briefcase",
    label: "Agentic",
    cap: "CAP-05",
    field: "briefcase",
    location: "benchmarks",
    status: "live",
    unit: "BriefcaseBench",
  },
  {
    id: "throughput",
    label: "Latency and speed",
    cap: "CAP-13",
    field: "throughput_tokens_per_sec",
    location: "root",
    status: "live",
    unit: "output tokens/sec",
  },
  {
    id: "coding",
    label: "Coding",
    cap: "CAP-04",
    field: null,
    location: "benchmarks",
    status: "identified",
    unit: "",
    // A named gap is a roadmap. A hidden one is a lie.
    gap: "No data in the catalogue. CAP-04 is status: identified — source known (Artificial Analysis: Coding Index, SciCode, Terminal-Bench), nothing ingested yet.",
  },
];

export function axisById(id: string): Axis | null {
  return AXES.find((a) => a.id === id) ?? null;
}

export interface PricePoint {
  modelId: string;
  vendor: string;
  price: number;
  /** null on an unscored model: it has a price but no measurement here. */
  score: number | null;
  /** Pareto-optimal on THIS axis: nothing cheaper scores at least as well. */
  frontier: boolean;
}

export interface AxisView {
  axis: Axis;
  scored: PricePoint[];
  /** Real products at real prices whose capability is unmeasured on this axis. */
  unscored: PricePoint[];
  total: number;
  /** Direct labels, kept to three so the plot stays readable. */
  labelled: PricePoint[];
}

function readScore(m: ModelRecord, axis: Axis): number | null {
  if (!axis.field) return null;
  const raw =
    axis.location === "benchmarks"
      ? m.benchmarks?.[axis.field]
      : (m as unknown as Record<string, unknown>)[axis.field];
  return typeof raw === "number" ? raw : null;
}

/**
 * Pareto frontier: a model is on it when no cheaper-or-equal model scores at
 * least as well. Ties on price are resolved by score, so only the best model
 * at a given price can be on the frontier.
 */
export function markFrontier(points: PricePoint[]): PricePoint[] {
  const sorted = [...points].sort(
    (a, b) => a.price - b.price || (b.score ?? 0) - (a.score ?? 0)
  );
  let best = -Infinity;
  const onFrontier = new Set<string>();
  for (const p of sorted) {
    if (p.score === null) continue;
    if (p.score > best) {
      best = p.score;
      onFrontier.add(p.modelId);
    }
  }
  return points.map((p) => ({ ...p, frontier: onFrontier.has(p.modelId) }));
}

/**
 * The two cheapest frontier models and the top scorer. Labelling every point
 * on a 330-model scatter renders an unreadable wall of text, and labelling
 * none makes the chart undiscussable.
 */
export function pickLabels(scored: PricePoint[]): PricePoint[] {
  const frontier = scored
    .filter((p) => p.frontier)
    .sort((a, b) => a.price - b.price);
  const top = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const picks: PricePoint[] = [...frontier.slice(0, 2)];
  if (top && !picks.some((p) => p.modelId === top.modelId)) picks.push(top);
  return picks;
}

export function axisView(models: ModelRecord[], axisId: string): AxisView {
  const axis = axisById(axisId) ?? AXES[0];

  const priced = models.filter(
    (m) => typeof m.cost_input_per_1m === "number" && m.cost_input_per_1m > 0
  );

  const all: PricePoint[] = priced.map((m) => ({
    modelId: m.model_id,
    vendor: m.vendor ?? "",
    price: m.cost_input_per_1m as number,
    score: readScore(m, axis),
    frontier: false,
  }));

  const scored = markFrontier(all.filter((p) => p.score !== null));
  const unscored = all.filter((p) => p.score === null);

  return {
    axis,
    scored,
    unscored,
    total: all.length,
    labelled: pickLabels(scored),
  };
}

/** "Agentic — 44 of 330 scored", for the y-axis label. */
export function axisDenominator(view: AxisView): string {
  return `${view.axis.label} — ${view.scored.length} of ${view.total} scored`;
}

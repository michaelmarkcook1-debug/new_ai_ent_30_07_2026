import modelsJson from "./data/models.json";
import { AXES } from "./price-performance";
import type { ModelRecord } from "./engine";

// The slice of the model catalogue the price/performance chart needs.
//
// models.json is 134KB and carries fields no chart reads. This keeps the four
// scored axes, the price and the name: enough for axisView() to run in the
// browser, so switching axes is instant and does not round-trip.
//
// Deliberately ModelRecord-shaped rather than a bespoke compact tuple, so the
// same axisView() runs over it on both sides of the boundary and there is no
// second code path to keep honest.

const ALL = (
  Array.isArray(modelsJson) ? modelsJson : Object.values(modelsJson)
) as ModelRecord[];

const SCORED_FIELDS = AXES.filter(
  (a) => a.status === "live" && a.location === "benchmarks" && a.field
).map((a) => a.field as string);

export function priceModels(): ModelRecord[] {
  return ALL.filter(
    (m) => typeof m.cost_input_per_1m === "number" && m.cost_input_per_1m > 0
  ).map((m) => {
    const benchmarks: Record<string, number | null> = {};
    for (const f of SCORED_FIELDS) {
      const v = m.benchmarks?.[f];
      benchmarks[f] = typeof v === "number" ? v : null;
    }
    return {
      model_id: m.model_id,
      vendor: m.vendor ?? null,
      benchmarks,
      cost_input_per_1m: m.cost_input_per_1m,
      throughput_tokens_per_sec:
        typeof m.throughput_tokens_per_sec === "number"
          ? m.throughput_tokens_per_sec
          : null,
    };
  });
}

import { authored, llmAvailable } from "@/lib/analyst/llm";
import {
  webSearch,
  groundingBlock,
  searchAvailable,
  type SearchHit,
} from "./search";

// What a company publishes about the size and shape of its workforce.
//
// This exists because the exposure panel can say which work AI has reached but
// not how much of that work an employer actually has. Large listed companies
// answer the first half of that themselves: total headcount is in nearly every
// annual report, and some publish a split by segment or function. Private
// companies publish nothing, and that is the normal case rather than a gap.
//
// Kept as its own search and its own model call rather than folded into
// researchCompany. Twelve passages in one grounding block already produced
// truncated JSON once, and the fix was to narrow the ask. Adding a third topic
// to that call would walk straight back into it, so this runs alongside with
// four passages of its own and a number-space the guard can check cheaply.
//
// THE FIGURE THIS DELIBERATELY DOES NOT PRODUCE: headcount multiplied by
// exposure. "180,000 roles exposed" is arithmetic on a real number and a real
// number, and it is still an invention: it assumes the employer's role mix
// matches the library's sector archetype, which nobody has measured. The two
// figures are shown side by side and never multiplied.

export interface WorkforceSplit {
  /** The company's own wording for the group. */
  label: string;
  /** The figure exactly as stated. */
  value: string;
  sourceIndex: number;
}

export interface WorkforceDisclosure {
  /** Total headcount, as a source states it. */
  total: { value: string; asOf: string | null; sourceIndex: number } | null;
  /** Splits the company publishes, by segment, function or geography. */
  splits: WorkforceSplit[];
  sources: SearchHit[];
  /** Why there is nothing, when there is nothing. */
  absence: string | null;
}

export interface Draft {
  total?: { value?: string; asOf?: string; source?: number } | null;
  splits?: { label?: string; value?: string; source?: number }[];
  none?: string;
}

const NOTHING = (absence: string, sources: SearchHit[] = []): WorkforceDisclosure => ({
  total: null,
  splits: [],
  sources,
  absence,
});

/** The search half, kept separate so the read can overlap the main reading. */
export async function searchWorkforce(name: string) {
  if (!searchAvailable()) return null;
  return webSearch(
    `${name} total number of employees headcount annual report workforce`,
    4
  );
}

/**
 * Read retrieved passages for what the company states about its workforce.
 *
 * Everything here is a quotation of a published figure. Nothing is converted,
 * summed across sources, or carried forward from one year to another, because
 * a headcount that has been arithmetically adjusted is no longer the company's
 * disclosure and cannot be cited as one.
 */
export async function readWorkforce(
  name: string,
  hits: SearchHit[]
): Promise<WorkforceDisclosure> {
  if (hits.length === 0) {
    return NOTHING(
      `Nothing was retrieved about ${name}'s workforce, so no headcount is shown.`
    );
  }
  if (!llmAvailable()) {
    return NOTHING(
      "Sources were retrieved but no analyst model is configured to read them.",
      hits
    );
  }

  const draft = await authored<Draft>(
    `workforce:${name.toLowerCase()}`,
    groundingBlock(hits),
    `Read these passages and report only what they state about ${name}'s workforce size.

Return JSON:
{"total": {"value": string, "asOf": string, "source": number} | null,
 "splits": [{"label": string, "value": string, "source": number}],
 "none": string}

- total: the company's total headcount, exactly as a passage states it ("606,000", "approximately 350,000"). asOf is the date or period the passage attaches to it, or "not stated". Null if no passage states a total.
- splits: up to 6 breakdowns a passage actually publishes, by business segment, function or geography. Label is the company's own wording for the group. Value is the figure as stated. Never derive a split by subtracting one figure from another, and never distribute a total across groups.
- none: when no passage states a headcount at all, one sentence saying so. Empty string otherwise.

Rules that matter more than completeness here:

Quote, do not compute. A headcount you arrived at by adding, subtracting or scaling is not a disclosure and must not be returned. If a passage gives a percentage of the workforce rather than a count, report the percentage in the label and value as given.

Do not carry a figure across dates. A 2024 headcount is not this year's, and if that is all a passage offers, say so in asOf rather than presenting it as current.

If two passages state different totals, return the one whose date is most recent and state the date. Different dates are not a contradiction.

Return null and a "none" sentence rather than reaching for a figure you know about this company from anywhere other than these passages.`,
    900
  );

  if (!draft) {
    return NOTHING(
      "The retrieved sources did not support a workforce reading that passed our checks.",
      hits
    );
  }
  return normaliseWorkforce(draft, hits, name);
}

/**
 * Keep only what cites a passage we actually retrieved.
 *
 * Separated from the model call so it can be tested without one. This is the
 * half that decides what reaches a reader, and every rule in it exists because
 * the alternative is a figure with nothing behind it: a headcount whose
 * citation points past the end of the source list opens nothing when clicked,
 * which is indistinguishable from an assertion.
 */
export function normaliseWorkforce(
  draft: Draft,
  hits: SearchHit[],
  name: string
): WorkforceDisclosure {
  const inRange = (n: unknown): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= hits.length;

  const total =
    draft.total &&
    typeof draft.total.value === "string" &&
    draft.total.value.trim().length > 0 &&
    inRange(draft.total.source)
      ? {
          value: draft.total.value.trim(),
          asOf:
            typeof draft.total.asOf === "string" &&
            draft.total.asOf.trim().length > 0 &&
            draft.total.asOf.trim().toLowerCase() !== "not stated"
              ? draft.total.asOf.trim()
              : null,
          sourceIndex: draft.total.source - 1,
        }
      : null;

  const splits: WorkforceSplit[] = (draft.splits ?? [])
    .filter(
      (s): s is { label: string; value: string; source: number } =>
        typeof s?.label === "string" &&
        s.label.trim().length > 0 &&
        typeof s?.value === "string" &&
        s.value.trim().length > 0 &&
        inRange(s.source)
    )
    .slice(0, 6)
    .map((s) => ({
      label: s.label.trim(),
      value: s.value.trim(),
      sourceIndex: s.source - 1,
    }));

  return {
    total,
    splits,
    sources: hits,
    absence:
      total || splits.length > 0
        ? null
        : typeof draft.none === "string" && draft.none.trim().length > 0
          ? draft.none.trim()
          : `No retrieved source states a headcount for ${name}. Private companies rarely publish one, and this is the normal case rather than a gap in the search.`,
  };
}

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

/** A headcount somebody other than the company arrived at. */
export interface WorkforceEstimate {
  value: string;
  /** Who published it, so a reader can weigh it. */
  publisher: string;
  asOf: string | null;
  sourceIndex: number;
}

export interface WorkforceDisclosure {
  /**
   * Total headcount where the COMPANY states it: an annual report, a filing,
   * its own newsroom. Never a third party's count of it.
   */
  total: { value: string; asOf: string | null; sourceIndex: number } | null;
  /** Splits the company publishes, by segment, function or geography. */
  splits: WorkforceSplit[];
  /**
   * Third-party estimates, kept in their own lane and never promoted into
   * `total`.
   *
   * This separation is the whole point of the module. Searching a private
   * company's headcount returns four aggregators with four different numbers
   * and no disclosure behind any of them: Anthropic publishes nothing and the
   * open web will still offer 2,500, 3,000, 3,830 and 5,000. Rendering any of
   * those under "what this company publishes" would be a fabricated
   * disclosure assembled from real sources, which is the exact failure the
   * disclosure ladder exists to prevent for revenue.
   *
   * The spread is also the finding. Four estimates a factor of two apart say
   * the number is not known, which is more useful than any one of them.
   */
  estimates: WorkforceEstimate[];
  sources: SearchHit[];
  /** Why there is nothing, when there is nothing. */
  absence: string | null;
}

export interface Draft {
  total?: { value?: string; asOf?: string; source?: number } | null;
  splits?: { label?: string; value?: string; source?: number }[];
  estimates?: {
    value?: string;
    publisher?: string;
    asOf?: string;
    source?: number;
  }[];
  none?: string;
}

const NOTHING = (absence: string, sources: SearchHit[] = []): WorkforceDisclosure => ({
  total: null,
  splits: [],
  estimates: [],
  sources,
  absence,
});

/** The search half, kept separate so the read can overlap the main reading. */
export async function searchWorkforce(name: string) {
  if (!searchAvailable()) return null;
  // Weighted toward the company's own filings, because the open web answers
  // this question mostly with data vendors. It does not get us primary sources
  // on its own, which is why the read classifies every figure it finds by who
  // published it rather than trusting the query to have filtered them out.
  return webSearch(
    `${name} number of employees annual report investor relations "as of"`,
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
    `Read these passages and report what they say about ${name}'s workforce size.

The single thing that matters here is WHO said a number. A company stating its
own headcount and a data vendor estimating it are different kinds of fact and
must never be mixed.

Return JSON:
{"total": {"value": string, "asOf": string, "source": number} | null,
 "splits": [{"label": string, "value": string, "source": number}],
 "estimates": [{"value": string, "publisher": string, "asOf": string, "source": number}],
 "none": string}

- total: ONLY where the passage attributes the figure to the company itself: its annual report, a regulatory filing, its own newsroom, or an executive quoted directly. Value exactly as stated. Null when no passage carries a company-stated figure, which is the normal case for a private company.
- splits: up to 6 breakdowns the COMPANY publishes, by segment, function or geography. Company-stated only, same rule.
- estimates: up to 5 headcounts attributed to anyone else. A data platform, a research firm, a news outlet's own count, a recruiting profile. publisher is who arrived at the figure. These are never the company's disclosure, however confident the passage sounds.
- none: one sentence when no passage carries any headcount at all. Empty string otherwise.

Rules, in order of importance:

Attribution decides the field. Not recency, not confidence, not how round the number looks. A 2024 figure in an annual report is a company disclosure; a 2026 figure on a data platform is an estimate. If a passage does not say where its number came from, it is an estimate.

Quote, do not compute. A headcount you arrived at by adding, subtracting or scaling is not in these passages. Never derive a split by subtraction and never distribute a total across groups.

Do not reconcile estimates. Where several sources give different numbers, return all of them with their publishers. The disagreement is the finding, and averaging it into one number destroys the only useful thing about it.

Carry the date. A figure from an earlier year keeps that year in asOf rather than being presented as current. Use "not stated" where a passage gives none.

Return nothing rather than reaching for a figure you know about this company from outside these passages.`,
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

  const estimates: WorkforceEstimate[] = (draft.estimates ?? [])
    .filter(
      (e): e is { value: string; publisher: string; asOf?: string; source: number } =>
        typeof e?.value === "string" &&
        e.value.trim().length > 0 &&
        typeof e?.publisher === "string" &&
        e.publisher.trim().length > 0 &&
        inRange(e.source)
    )
    .slice(0, 5)
    .map((e) => ({
      value: e.value.trim(),
      publisher: e.publisher.trim(),
      asOf:
        typeof e.asOf === "string" &&
        e.asOf.trim().length > 0 &&
        e.asOf.trim().toLowerCase() !== "not stated"
          ? e.asOf.trim()
          : null,
      sourceIndex: e.source - 1,
    }));

  return {
    total,
    splits,
    estimates,
    sources: hits,
    absence: absenceFor(name, total, splits.length, estimates, draft.none),
  };
}

/**
 * What to say when the company itself has said nothing.
 *
 * Three different states, and collapsing them would lose the useful one. No
 * figures at all is a thin search. Estimates with no disclosure behind them is
 * a private company, which is normal and worth saying plainly. Estimates that
 * disagree widely is the strongest reading available: the number is not known,
 * and the spread proves it.
 */
function absenceFor(
  name: string,
  total: WorkforceDisclosure["total"],
  splitCount: number,
  estimates: WorkforceEstimate[],
  none: string | undefined
): string | null {
  if (total || splitCount > 0) return null;
  if (estimates.length > 0) {
    const who = [...new Set(estimates.map((e) => e.publisher))];
    return `${name} does not state a headcount in any retrieved source. The ${
      estimates.length === 1 ? "figure" : `${estimates.length} figures`
    } below ${estimates.length === 1 ? "is" : "are"} ${who.length === 1 ? "one third party's estimate" : `${who.length} third parties' estimates`}, shown as such rather than as a disclosure${
      estimates.length > 1
        ? ", and where they disagree the spread is the finding rather than a number to pick from"
        : ""
    }.`;
  }
  return typeof none === "string" && none.trim().length > 0
    ? none.trim()
    : `No retrieved source carries a headcount for ${name}. Private companies rarely publish one, and this is the normal case rather than a gap in the search.`;
}

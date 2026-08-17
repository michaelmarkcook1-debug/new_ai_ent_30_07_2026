import type { JurisdictionFilter } from "./shortlist";
import type {
  ShortlistPayload,
  ShortlistCategoryPayload,
} from "./shortlist-payload";

// Reading the shortlist payload, on the client.
//
// WHY THIS IS ITS OWN FILE. It is one line, and it used to live in
// shortlist-payload.ts beside the builder. That was fine until the shortlist
// began reading the category assessment, which reaches the filesystem: the
// client component imported this selector as a value, webpack followed the
// import into shortlist-payload, then shortlist, then category-rankings, then
// node:fs, and the production build failed with UnhandledSchemeError.
//
// The build is the only thing that catches this. Vitest resolves node:fs
// happily, so the whole suite passed and the deploy failed, which is exactly
// how this class of bug reaches production in this repo. It is the same
// boundary that lib/model-fit/workforce-payload.ts documents.
//
// So the rule the codebase already follows, restated: a client component may
// import TYPES from a server module, because types are erased, but never a
// value. This file holds the one value the client needs and imports nothing
// but types.

export type { ShortlistPayload, ShortlistCategoryPayload };

/**
 * The shortlist for a filter and category.
 *
 * Falls back to the unfiltered variant, because the payload is sparse: a
 * variant is stored only where the filter changed something, so a miss means
 * "identical to all" rather than "no such category".
 */
export function shortlistFor(
  payload: ShortlistPayload,
  filter: JurisdictionFilter,
  category: string
): ShortlistCategoryPayload | undefined {
  return payload.byFilter[filter]?.[category] ?? payload.byFilter.all[category];
}

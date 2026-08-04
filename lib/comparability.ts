// Comparability rule, applied everywhere the product ranks or compares
// vendors.
//
// Vendors are ranked WITHIN a market category, never across one. A chip
// foundry, a cloud platform and a CRM assistant do not share a yardstick:
// putting them in one ordered list implies a comparison the evidence cannot
// support.
//
// The taxonomy is the ranking engine's own. MARKET_CATEGORIES defines the 13
// categories and MARKET_SHARE_ESTIMATES defines which vendors compete in
// each, so both the boundary and the membership come from the dataset rather
// than from an editorial choice made here. A vendor legitimately competes in
// several categories at once (Microsoft in seven, Google in five), and is
// ranked separately in each against that category's real competitors.
//
// Thin categories are called out rather than hidden: where a category holds
// only one or two placements, the order is a tier, not a rank.

import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import {
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  INTELLIGENCE_VENDORS,
} from "@/lib/aie";

export interface MarketCategory {
  id: string;
  name: string;
  description: string;
}

export const MARKET_CATEGORY_LIST: MarketCategory[] = MARKET_CATEGORIES.map(
  (c) => ({ id: c.id, name: c.name, description: c.description })
);

const CATEGORY_BY_ID = new Map(MARKET_CATEGORY_LIST.map((c) => [c.id, c]));
const CATEGORY_INDEX = new Map(
  MARKET_CATEGORY_LIST.map((c, i) => [c.id, i] as const)
);

// Vendor membership, straight from the dataset's own category placements.
const CATEGORIES_BY_VENDOR = new Map<string, string[]>();
const VENDORS_BY_CATEGORY = new Map<string, string[]>();
for (const e of MARKET_SHARE_ESTIMATES) {
  const cats = CATEGORIES_BY_VENDOR.get(e.vendorId) ?? [];
  if (!cats.includes(e.categoryId)) cats.push(e.categoryId);
  CATEGORIES_BY_VENDOR.set(e.vendorId, cats);

  const vendors = VENDORS_BY_CATEGORY.get(e.categoryId) ?? [];
  if (!vendors.includes(e.vendorId)) vendors.push(e.vendorId);
  VENDORS_BY_CATEGORY.set(e.categoryId, vendors);
}

// Below this count the order is a tier, not a precise rank.
export const THIN_CATEGORY_THRESHOLD = 3;

export const COMPARABILITY_NOTE =
  "Vendors are ranked within a market category, never across one. Scores from different categories are not comparable: a chip maker and a CRM assistant are not competing for the same budget on the same yardstick. A vendor that competes in several categories is ranked separately in each.";

export const THIN_CATEGORY_NOTE =
  "Only a small number of tracked vendors compete in this category, so treat the order as a tier rather than a precise rank.";

export const UNPLACED_NOTE =
  "These vendors are tracked but the dataset places them in no market category, so they are listed rather than ranked. Ranking them against a category they do not compete in would be a false comparison.";

export interface CategoryGroup<T> {
  category: MarketCategory;
  rows: T[];
  thin: boolean;
}

export function categoryById(id: string): MarketCategory | null {
  return CATEGORY_BY_ID.get(id) ?? null;
}

export function categoryIdsForVendor(vendorId: string): string[] {
  return CATEGORIES_BY_VENDOR.get(vendorId) ?? [];
}

export function categoryNamesForVendor(vendorId: string): string[] {
  return categoryIdsForVendor(vendorId)
    .map((id) => CATEGORY_BY_ID.get(id)?.name)
    .filter((n): n is string => Boolean(n));
}

// Places each row into every market category its vendor competes in, then
// orders rows inside each category. A row may appear in several groups; it is
// never ordered against a vendor from another category.
export function placeByCategory<T extends { id: string }>(
  rows: T[],
  compare?: (a: T, b: T) => number
): CategoryGroup<T>[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const groups: CategoryGroup<T>[] = [];
  for (const category of MARKET_CATEGORY_LIST) {
    const members = (VENDORS_BY_CATEGORY.get(category.id) ?? [])
      .map((vid) => byId.get(vid))
      .filter((r): r is T => Boolean(r));
    if (members.length === 0) continue;
    groups.push({
      category,
      rows: compare ? [...members].sort(compare) : members,
      thin: members.length < THIN_CATEGORY_THRESHOLD,
    });
  }
  return groups;
}

// Tracked rows the dataset places in no market category: surfaced honestly
// rather than dropped or forced into a category they do not compete in.
export function unplaced<T extends { id: string }>(rows: T[]): T[] {
  return rows.filter((r) => categoryIdsForVendor(r.id).length === 0);
}

// Market categories in which at least one of the given vendors competes.
export function categoriesPresent(vendorIds: string[]): MarketCategory[] {
  const ids = new Set<string>();
  for (const vid of vendorIds) {
    for (const cid of categoryIdsForVendor(vid)) ids.add(cid);
  }
  return [...ids]
    .sort((a, b) => (CATEGORY_INDEX.get(a) ?? 99) - (CATEGORY_INDEX.get(b) ?? 99))
    .map((id) => CATEGORY_BY_ID.get(id))
    .filter((c): c is MarketCategory => Boolean(c));
}

export function vendorIdsInCategory(categoryId: string): string[] {
  return VENDORS_BY_CATEGORY.get(categoryId) ?? [];
}

// Display name lookup, for surfaces that only carry vendor ids.
const VENDOR_NAME = new Map(VENDOR_DIRECTORY.map((v) => [v.id, v.name]));

export function vendorName(id: string): string {
  return VENDOR_NAME.get(id) ?? id;
}

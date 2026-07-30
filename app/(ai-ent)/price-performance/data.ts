import { TOKEN_PRICING, TOKEN_PRICING_CAPTURED_AT } from "@/lib/aie";
import type { TokenPrice } from "@/lib/aie";

// Module data adapter: the pricing side is the AIE dataset token-pricing
// table, passed through untouched. The performance side has no benchmark
// dataset in the AIE repo, so the page renders an honest empty state
// instead of inventing results.

export interface PricingDataset {
  rows: TokenPrice[];
  capturedAtIso: string;
  capturedAtDisplay: string;
  vendorCount: number;
  verifiedRowCount: number;
  unverifiedRowCount: number;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Deterministic en-GB long-date formatting for an ISO yyyy-mm-dd stamp,
// avoiding timezone-dependent Date parsing.
export function formatIsoDateGb(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function loadPricingDataset(): PricingDataset {
  const verified = TOKEN_PRICING.filter(
    (r) => r.inputPerM !== null || r.outputPerM !== null
  ).length;
  return {
    rows: TOKEN_PRICING,
    capturedAtIso: TOKEN_PRICING_CAPTURED_AT,
    capturedAtDisplay: formatIsoDateGb(TOKEN_PRICING_CAPTURED_AT),
    vendorCount: new Set(TOKEN_PRICING.map((r) => r.vendorName)).size,
    verifiedRowCount: verified,
    unverifiedRowCount: TOKEN_PRICING.length - verified,
  };
}

import { INTELLIGENCE_VENDORS } from "@/lib/aie";
import { manifestForVendor } from "@/lib/aie/sourcing/manifest";
import type { PrivateVendorCard, ProbedTicker } from "./types";

// Module data adapter. The live section is fetched client-side through the
// /api/br proxy (see components/live-tickers.tsx); this file holds the
// probed ticker roster and the AIE-derived private-company card data.

// Probed LIVE against the BoardRadar financial-snapshot endpoints
// (DATA_COVERAGE.md, 30 July 2026). META and NVDA are financials only:
// they are not in the wider BoardRadar company universe.
export const PROBED_TICKERS: ProbedTicker[] = [
  { ticker: "MSFT", name: "Microsoft", financialsOnly: false },
  { ticker: "GOOGL", name: "Alphabet", financialsOnly: false },
  { ticker: "AMZN", name: "Amazon", financialsOnly: false },
  { ticker: "IBM", name: "IBM", financialsOnly: false },
  { ticker: "ORCL", name: "Oracle", financialsOnly: false },
  { ticker: "CRM", name: "Salesforce", financialsOnly: false },
  { ticker: "NOW", name: "ServiceNow", financialsOnly: false },
  { ticker: "SAP", name: "SAP", financialsOnly: false },
  { ticker: "ADBE", name: "Adobe", financialsOnly: false },
  { ticker: "CSCO", name: "Cisco", financialsOnly: false },
  { ticker: "DELL", name: "Dell", financialsOnly: false },
  { ticker: "BABA", name: "Alibaba", financialsOnly: false },
  { ticker: "META", name: "Meta", financialsOnly: true },
  { ticker: "NVDA", name: "NVIDIA", financialsOnly: true },
];

// Private AI companies shown as disclosed-figures-only cards. No financial
// figures are rendered for these vendors, only the locked empty state, the
// AIE seed tagline, and the curated outbound source links.
const PRIVATE_VENDOR_IDS = [
  "anthropic",
  "openai",
  "xai",
  "mistral",
  "cohere",
  "databricks",
  "together",
];

export function privateVendorCards(): PrivateVendorCard[] {
  return PRIVATE_VENDOR_IDS.map((id) => {
    const seed = INTELLIGENCE_VENDORS.find((v) => v.id === id);
    // The sourcing manifest keys vendors as "vendor_<id>".
    const sources = manifestForVendor(`vendor_${id}`).map((entry) => ({
      label: entry.label,
      url: entry.url,
      category: entry.category,
    }));
    return {
      id,
      name: seed?.name ?? id,
      tagline: seed?.description ?? null,
      sources,
    };
  });
}

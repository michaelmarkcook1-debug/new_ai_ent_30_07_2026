import { readFileSync } from "node:fs";
import path from "node:path";

// The one place a vendor's figures come from.
//
// Until now the app carried two of everything. lib/aie/intelligence/ is a port
// of the ranking engine taken on 8 July 2026 and frozen into TypeScript, and
// fixtures/aie-live/ is the same source re-fetched daily. Six tabs rendered
// both vintages on one page, and Vendor View printed the ported figure under
// the field name the live one uses:
//
//   Anthropic overallScore   88   (ported, 8 July)   68.3   (live, 4 August)
//
// Every one of the 37 overlapping vendors was higher in the port, by a mean of
// 18.4 points and by as much as 46 for Microsoft. A gap that size, in one
// direction on every vendor without exception, is a different scale rather
// than drift, so no reconciliation was possible: one of the two had to go, and
// the one that is still being published wins.
//
// The port keeps only what upstream does not publish at all. Anything upstream
// carries is read from here.

export interface LiveVendor {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  headquarters: string | null;
  ownershipType: string | null;
  overallScore: number | null;
  confidenceScore: number | null;
  marketPosition: string | null;
  strategy: string | null;
  productCapabilities: string[];
  enterpriseControls: string[];
  agenticCapability: string | null;
  riskProfile: string[];
  analystInterpretation: string | null;
  supportedIndustries: string[];
  supportedUseCases: string[];
  supportedEcosystems: string[];
  deploymentOptions: string[];
  roleTags: string[];
  industryStrength: { industry: string; score: number; note?: string }[];
  lastUpdated: string | null;
}

export interface LiveCapability {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
}

export interface LiveVendorCapability {
  vendorId: string;
  capabilityId: string;
  status: string | null;
  maturityScore: number | null;
  evidenceGrade: string | null;
  lastVerified: string | null;
  notes: string | null;
}

// The port renamed five vendors, so a join on id silently dropped them rather
// than failing loudly: alibaba-qwen never matched alibaba, and the panel
// showed a vendor with no live figures instead of an error. Kept as data so
// the next rename is one line, and so the old ids keep working in any URL a
// reader has already saved.
export const VENDOR_ID_ALIASES: Record<string, string> = {
  "alibaba-qwen": "alibaba",
  "fireworks-ai": "fireworks",
  "moonshot-kimi": "moonshot",
  "together-ai": "together",
  "zhipu-glm": "zai",
};

export function canonicalVendorId(id: string): string {
  return VENDOR_ID_ALIASES[id] ?? id;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

function readFixture<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), "fixtures", "aie-live", name), "utf8")
    ) as T;
  } catch {
    return fallback;
  }
}

let vendorCache: LiveVendor[] | null = null;

export function liveVendors(): LiveVendor[] {
  if (vendorCache) return vendorCache;
  const raw = readFixture<{ vendors?: Record<string, unknown>[] }>(
    "vendors.json",
    {}
  );
  vendorCache = (raw.vendors ?? []).map((v) => ({
    id: String(v.id ?? ""),
    name: String(v.name ?? v.id ?? ""),
    slug: String(v.slug ?? v.id ?? ""),
    category: str(v.category),
    description: str(v.description),
    headquarters: str(v.headquarters),
    ownershipType: str(v.ownershipType),
    overallScore: num(v.overallScore),
    confidenceScore: num(v.confidenceScore),
    marketPosition: str(v.marketPosition),
    strategy: str(v.strategy),
    productCapabilities: arr(v.productCapabilities),
    enterpriseControls: arr(v.enterpriseControls),
    agenticCapability: str(v.agenticCapability),
    riskProfile: arr(v.riskProfile),
    analystInterpretation: str(v.analystInterpretation),
    supportedIndustries: arr(v.supportedIndustries),
    supportedUseCases: arr(v.supportedUseCases),
    supportedEcosystems: arr(v.supportedEcosystems),
    deploymentOptions: arr(v.deploymentOptions),
    roleTags: arr(v.roleTags),
    industryStrength: Array.isArray(v.industryStrength)
      ? (v.industryStrength as { industry: string; score: number; note?: string }[])
      : [],
    lastUpdated: str(v.lastUpdated),
  }));
  return vendorCache;
}

export function liveVendor(id: string): LiveVendor | null {
  const want = canonicalVendorId(id);
  return liveVendors().find((v) => v.id === want) ?? null;
}

let capCache: {
  capabilities: LiveCapability[];
  vendorCapabilities: LiveVendorCapability[];
} | null = null;

function capData() {
  if (capCache) return capCache;
  const raw = readFixture<{
    capabilities?: Record<string, unknown>[];
    vendorCapabilities?: Record<string, unknown>[];
  }>("capabilities.json", {});
  capCache = {
    capabilities: (raw.capabilities ?? []).map((c) => ({
      id: String(c.id ?? ""),
      name: String(c.name ?? c.id ?? ""),
      category: str(c.category),
      description: str(c.description),
    })),
    // maturityScore arrives as a string on some rows and a number on others,
    // so it is coerced once here rather than at every call site.
    vendorCapabilities: (raw.vendorCapabilities ?? []).map((c) => ({
      vendorId: String(c.vendorId ?? ""),
      capabilityId: String(c.capabilityId ?? ""),
      status: str(c.status),
      maturityScore: num(c.maturityScore),
      evidenceGrade: str(c.evidenceGrade),
      lastVerified: str(c.lastVerified),
      notes: str(c.notes),
    })),
  };
  return capCache;
}

export const liveCapabilities = (): LiveCapability[] => capData().capabilities;

/** One vendor's capability row per capability, in the catalogue's order. */
export function liveVendorCapabilities(id: string): LiveVendorCapability[] {
  const want = canonicalVendorId(id);
  const order = new Map(liveCapabilities().map((c, i) => [c.id, i]));
  return capData()
    .vendorCapabilities.filter((c) => c.vendorId === want)
    .sort((a, b) => (order.get(a.capabilityId) ?? 99) - (order.get(b.capabilityId) ?? 99));
}

/** The capture the figures came from, for the page to date itself against. */
export function liveVendorsAsOf(): string | null {
  const raw = readFixture<{ asOf?: string }>("vendors.json", {});
  return raw.asOf ?? null;
}

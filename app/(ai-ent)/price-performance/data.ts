import { TOKEN_PRICING, TOKEN_PRICING_CAPTURED_AT } from "@/lib/aie";
import {
  TOKEN_PRICING_VERIFIED,
  TOKEN_PRICING_VERIFIED_AT,
  VERIFIED_VENDOR_IDS,
} from "@/lib/aie/model-inventory/token-pricing-verified";
import type { TokenPrice } from "@/lib/aie";
import costCapability from "@/fixtures/aie-live/cost-capability.json";

// Module data adapter: the pricing side is the AIE dataset token-pricing
// table, passed through untouched. The performance side has no benchmark
// dataset in the AIE repo, so the page renders an honest empty state
// instead of inventing results.

export interface PricingRow extends TokenPrice {
  /** True when this row was read off the vendor's own page on the check date. */
  recheckedAt: string | null;
}

export interface PricingDataset {
  rows: PricingRow[];
  capturedAtIso: string;
  capturedAtDisplay: string;
  vendorCount: number;
  verifiedRowCount: number;
  unverifiedRowCount: number;
  /** Date the overlay vendors were last read from their own pricing pages. */
  recheckedAtDisplay: string;
  recheckedVendors: string[];
  recheckedRowCount: number;
  /** Rows still carrying only the older snapshot. */
  snapshotRowCount: number;
  snapshotVendorCount: number;
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

// ---------- Cost versus capability ----------
// Third-party benchmark scores (Artificial Analysis Intelligence Index)
// paired with published list prices, captured from the AI Enterprise model
// inventory. The efficiency frontier is computed here from the data, so the
// derivation drawer can state exactly how it was produced.

export interface CostCapabilityModel {
  model: string;
  intelligence: number;
  inputPerM: number;
  throughput: number | null;
  frontier: boolean;
  // Model builder, read off the model name rather than supplied by the
  // source. See PROVIDER_RULES for the mapping and the derivation drawer for
  // the caveat: it is a label for grouping, not a corporate ownership claim.
  provider: string;
}

export interface CostCapabilityProvider {
  name: string;
  count: number;
  frontierCount: number;
}

export interface CostCapabilityView {
  models: CostCapabilityModel[];
  providers: CostCapabilityProvider[];
  count: number;
  frontierCount: number;
  benchmarkSource: string;
  provenance: string;
  capturedAtDisplay: string;
  freshestBenchmarkDisplay: string;
  /**
   * The capture date as the dataset states it, unformatted.
   *
   * The display strings above are for a reader. Freshness has to compare
   * against a clock, and parsing a formatted date back into one is how a
   * "31 July 20" bug gets made twice.
   */
  capturedAt: string;
}

// Ordered longest-match-first where prefixes could collide. Every entry is a
// model family whose builder is unambiguous from the name itself.
const PROVIDER_RULES: [string, string][] = [
  ["claude", "Anthropic"],
  ["gpt-", "OpenAI"],
  ["o1", "OpenAI"],
  ["o3", "OpenAI"],
  ["o4", "OpenAI"],
  ["gemini", "Google"],
  ["gemma", "Google"],
  ["llama", "Meta"],
  ["grok", "xAI"],
  ["deepseek", "DeepSeek"],
  ["qwen", "Alibaba"],
  ["qwq", "Alibaba"],
  ["kimi", "Moonshot"],
  ["glm", "Zhipu"],
  ["mistral", "Mistral"],
  ["mixtral", "Mistral"],
  ["magistral", "Mistral"],
  ["devstral", "Mistral"],
  ["codestral", "Mistral"],
  ["ministral", "Mistral"],
  ["nova", "Amazon"],
  ["command", "Cohere"],
  ["phi-", "Microsoft"],
  ["minimax", "MiniMax"],
  ["ernie", "Baidu"],
  ["sonar", "Perplexity"],
  ["reka", "Reka"],
  ["jamba", "AI21"],
  ["granite", "IBM"],
  ["solar", "Upstage"],
  ["exaone", "LG"],
  ["apriel", "ServiceNow"],
  ["hunyuan", "Tencent"],
  ["step-", "StepFun"],
  ["seed", "ByteDance"],
  ["doubao", "ByteDance"],
  ["nemotron", "NVIDIA"],
  ["arcee", "Arcee"],
  ["afm", "Arcee"],
];

function providerOf(model: string): string {
  const n = model.toLowerCase();
  for (const [needle, name] of PROVIDER_RULES) {
    if (n.includes(needle)) return name;
  }
  // Honest bucket: a name the rules do not recognise is labelled as such
  // rather than guessed into a provider it may not belong to.
  return "Unattributed";
}

// ---------- Frontier model face-off ----------
// Each frontier-lab vendor's single highest-rated model, compared on
// identical fields so the comparison is like for like.
//
// The vendor set is the frontier_model_api market category from the ranking
// engine's own taxonomy, not an editorial pick here, and the count is
// whatever that category actually supports rather than a fixed "top four".

export interface FaceOffEntry {
  provider: string;
  model: string;
  intelligence: number;
  inputPerM: number;
  throughput: number | null;
  frontier: boolean;
  /** Intelligence points behind the leader; 0 for the leader itself. */
  behindLeader: number;
}

export interface FaceOffView {
  entries: FaceOffEntry[];
  leader: FaceOffEntry | null;
  /** Leader's margin over the runner-up, null when fewer than two qualify. */
  leadGap: number | null;
  benchmarkSource: string;
  capturedAtDisplay: string;
  freshestBenchmarkDisplay: string;
  /** Category vendors with no priced and scored model, named honestly. */
  absent: string[];
}

// Frontier-category vendor ids mapped to the provider labels providerOf()
// produces from model names. Ids come from the dataset's own taxonomy.
const FRONTIER_VENDOR_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  meta: "Meta",
  mistral: "Mistral",
  cohere: "Cohere",
  deepseek: "DeepSeek",
  alibaba: "Alibaba",
  moonshot: "Moonshot",
  zai: "Zhipu",
  minimax: "MiniMax",
  ai21: "AI21",
  snowflake: "Snowflake",
};

export function loadFrontierFaceOff(): FaceOffView {
  const view = loadCostCapability();
  const wanted = new Set(Object.values(FRONTIER_VENDOR_LABELS));

  const best = new Map<string, CostCapabilityModel>();
  for (const m of view.models) {
    if (!wanted.has(m.provider)) continue;
    const held = best.get(m.provider);
    if (!held || m.intelligence > held.intelligence) best.set(m.provider, m);
  }

  const ranked = [...best.values()].sort(
    (a, b) => b.intelligence - a.intelligence
  );
  const top = ranked[0]?.intelligence ?? 0;

  const entries: FaceOffEntry[] = ranked.map((m) => ({
    provider: m.provider,
    model: m.model,
    intelligence: m.intelligence,
    inputPerM: m.inputPerM,
    throughput: m.throughput,
    frontier: m.frontier,
    behindLeader: Math.round((top - m.intelligence) * 10) / 10,
  }));

  return {
    entries,
    leader: entries[0] ?? null,
    leadGap:
      entries.length > 1
        ? Math.round((entries[0].intelligence - entries[1].intelligence) * 10) /
          10
        : null,
    benchmarkSource: view.benchmarkSource,
    capturedAtDisplay: view.capturedAtDisplay,
    freshestBenchmarkDisplay: view.freshestBenchmarkDisplay,
    absent: [...wanted].filter((label) => !best.has(label)).sort(),
  };
}

/**
 * The price spread the analyst reading quotes, computed rather than pasted.
 *
 * These two figures were literals on the page: `ratio: 25, adequate: 29`.
 * Both were correct for the capture they were written against, which is the
 * problem. A number computed once by hand and pasted into a render does not
 * become wrong loudly; it stays on screen reading as live while the dataset
 * moves underneath it, and this one sits in a sentence about what a buyer
 * should do before renewal.
 *
 * Derived here from the same view the chart plots, so the sentence and the
 * chart cannot disagree.
 *
 * `adequate` counts models within 80 per cent of the top benchmark score, and
 * `ratio` is what the top model costs against the cheapest of those, on input
 * pricing only. Models with no price or no score are excluded rather than
 * treated as zero.
 */
export function priceSpread(view: CostCapabilityView): {
  models: number;
  vendors: number;
  adequate: number;
  ratio: number | null;
} {
  const priced = view.models.filter(
    (m) =>
      typeof m.intelligence === "number" &&
      typeof m.inputPerM === "number" &&
      m.inputPerM > 0
  );
  if (priced.length === 0) {
    return { models: 0, vendors: view.providers.length, adequate: 0, ratio: null };
  }
  const top = priced.reduce((a, b) => (b.intelligence > a.intelligence ? b : a));
  const adequate = priced.filter((m) => m.intelligence >= top.intelligence * 0.8);
  const cheapest = adequate.reduce((a, b) => (b.inputPerM < a.inputPerM ? b : a));
  return {
    models: priced.length,
    vendors: view.providers.length,
    adequate: adequate.length,
    ratio:
      cheapest.inputPerM > 0
        ? Math.round((top.inputPerM / cheapest.inputPerM) * 10) / 10
        : null,
  };
}

export function loadCostCapability(): CostCapabilityView {
  // Static import keeps this a build-time read: the figures are a dated
  // capture, not a per-request pull.
  const raw = costCapability as {
    models: Omit<CostCapabilityModel, "provider">[];
    count: number;
    frontierCount: number;
    benchmarkSource: string;
    provenance: string;
    capturedAt: string;
    freshestBenchmark: string;
  };
  const models = raw.models.map((m) => ({ ...m, provider: providerOf(m.model) }));

  const tally = new Map<string, CostCapabilityProvider>();
  for (const m of models) {
    const row = tally.get(m.provider) ?? {
      name: m.provider,
      count: 0,
      frontierCount: 0,
    };
    row.count += 1;
    if (m.frontier) row.frontierCount += 1;
    tally.set(m.provider, row);
  }
  // Most-plotted first, so the legend leads with the families that dominate
  // the chart; the honest bucket always sorts last.
  const providers = [...tally.values()].sort((a, b) =>
    a.name === "Unattributed"
      ? 1
      : b.name === "Unattributed"
        ? -1
        : b.count - a.count || a.name.localeCompare(b.name)
  );

  return {
    models,
    providers,
    count: raw.count,
    frontierCount: raw.frontierCount,
    benchmarkSource: raw.benchmarkSource,
    provenance: raw.provenance,
    capturedAtDisplay: formatIsoDateGb(raw.capturedAt),
    freshestBenchmarkDisplay: formatIsoDateGb(raw.freshestBenchmark),
    // The freshest BENCHMARK rather than the capture, because that is the
    // reading the price multiple actually rests on and it is the older of the
    // two. Taking the capture date would make the signal look a week fresher
    // than the evidence behind it.
    capturedAt: raw.freshestBenchmark || raw.capturedAt,
  };
}

export function loadPricingDataset(): PricingDataset {
  // Where a vendor has been re-read from its own pricing page, the overlay
  // replaces that vendor's snapshot rows outright rather than sitting beside
  // them. Keeping both would show Claude Opus 4.8 twice at two dates and leave
  // a reader to work out which one to believe.
  const rechecked = new Set<string>(VERIFIED_VENDOR_IDS);
  const snapshotRows = TOKEN_PRICING.filter((r) => !rechecked.has(r.vendorId));

  const rows: PricingRow[] = [
    ...TOKEN_PRICING_VERIFIED.map((r) => ({
      ...r,
      recheckedAt: TOKEN_PRICING_VERIFIED_AT,
    })),
    ...snapshotRows.map((r) => ({ ...r, recheckedAt: null })),
  ];

  const priced = rows.filter(
    (r) => r.inputPerM !== null || r.outputPerM !== null
  ).length;

  return {
    rows,
    capturedAtIso: TOKEN_PRICING_CAPTURED_AT,
    capturedAtDisplay: formatIsoDateGb(TOKEN_PRICING_CAPTURED_AT),
    vendorCount: new Set(rows.map((r) => r.vendorName)).size,
    verifiedRowCount: priced,
    unverifiedRowCount: rows.length - priced,
    recheckedAtDisplay: formatIsoDateGb(TOKEN_PRICING_VERIFIED_AT),
    recheckedVendors: [
      ...new Set(TOKEN_PRICING_VERIFIED.map((r) => r.vendorName)),
    ],
    recheckedRowCount: TOKEN_PRICING_VERIFIED.length,
    snapshotRowCount: snapshotRows.length,
    snapshotVendorCount: new Set(snapshotRows.map((r) => r.vendorName)).size,
  };
}

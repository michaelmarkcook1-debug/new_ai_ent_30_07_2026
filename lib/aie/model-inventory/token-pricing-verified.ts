import type { TokenPrice } from "./token-pricing";

// Token pricing checked directly against each vendor's own pricing page.
//
// WHY THIS FILE EXISTS. The ported table in token-pricing.ts is a snapshot
// captured 2026-06-02, and the upstream AIE pricing API still serves that same
// capture: its payload carries capturedAt 2026-06-02 whatever date you ask it.
// Re-pulling does not refresh it. Two months on, the prices it lists are still
// correct for the models it lists, but the model list is a generation behind:
// no Claude Opus 5 or Sonnet 5, no GPT-5.6, no Gemini 3.x.
//
// The snapshot is deliberately not edited in place. It is labelled with its
// capture date and traceable to the ranking-engine repo, and quietly rewriting
// dated rows would destroy that. These rows are an overlay instead, carrying
// their own check date, and the table shows which is which.
//
// SCOPE. Three vendors, checked by reading their published pricing pages on
// 2 August 2026. The other fourteen vendors in the snapshot are untouched and
// still shown as a June capture, because guessing at their current prices
// would be worse than saying plainly when they were last confirmed.

export const TOKEN_PRICING_VERIFIED_AT = "2026-08-02";

/** Vendors whose rows below supersede the June snapshot entirely. */
export const VERIFIED_VENDOR_IDS = ["openai", "anthropic", "google"] as const;

const ANTHROPIC_SRC =
  "https://platform.claude.com/docs/en/about-claude/pricing";
const OPENAI_SRC = "https://developers.openai.com/api/docs/pricing";
const GOOGLE_SRC = "https://ai.google.dev/gemini-api/docs/pricing";

const anthropicNote =
  "Cache read is 0.1x base input; 5m cache write 1.25x, 1h write 2x. Batch API is 50 per cent lower on both directions.";

export const TOKEN_PRICING_VERIFIED: TokenPrice[] = [
  // ─── Anthropic ─────────────────────────────────────────────────
  { id: "tpv_anthropic_fable5", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Fable 5", inputPerM: 10, outputPerM: 50, cachedInputPerM: 1, note: anthropicNote, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_mythos5", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Mythos 5", inputPerM: 10, outputPerM: 50, cachedInputPerM: 1, note: `Limited availability. ${anthropicNote}`, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_opus5", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 5", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: `Fast mode available at 10/50 per 1M. ${anthropicNote}`, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_opus48", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 4.8", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: `Fast mode available at 10/50 per 1M. ${anthropicNote}`, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_opus47", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 4.7", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: anthropicNote, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_opus46", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 4.6", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: anthropicNote, sourceUrl: ANTHROPIC_SRC },
  // The one genuinely time-limited price in the set, and the one worth acting
  // on: it rises by half on 1 September 2026.
  { id: "tpv_anthropic_sonnet5", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Sonnet 5", inputPerM: 2, outputPerM: 10, cachedInputPerM: 0.2, note: `Introductory pricing to 31 August 2026, then 3.00 input and 15.00 output. ${anthropicNote}`, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_sonnet46", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Sonnet 4.6", inputPerM: 3, outputPerM: 15, cachedInputPerM: 0.3, note: anthropicNote, sourceUrl: ANTHROPIC_SRC },
  { id: "tpv_anthropic_haiku45", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Haiku 4.5", inputPerM: 1, outputPerM: 5, cachedInputPerM: 0.1, note: anthropicNote, sourceUrl: ANTHROPIC_SRC },

  // ─── OpenAI ────────────────────────────────────────────────────
  { id: "tpv_openai_gpt56sol", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.6 Sol", inputPerM: 5, outputPerM: 30, cachedInputPerM: 0.5, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt56terra", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.6 Terra", inputPerM: 2, outputPerM: 12, cachedInputPerM: 0.2, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt56luna", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.6 Luna", inputPerM: 0.2, outputPerM: 1.2, cachedInputPerM: 0.02, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt55", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.5", inputPerM: 5, outputPerM: 30, cachedInputPerM: 0.5, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt55pro", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.5 Pro", inputPerM: 30, outputPerM: 180, cachedInputPerM: null, note: "No cached input tier published for the Pro line.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt54", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.4", inputPerM: 2.5, outputPerM: 15, cachedInputPerM: 0.25, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt54mini", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.4-mini", inputPerM: 0.75, outputPerM: 4.5, cachedInputPerM: 0.075, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },
  { id: "tpv_openai_gpt54nano", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.4-nano", inputPerM: 0.2, outputPerM: 1.25, cachedInputPerM: 0.02, note: "Standard API pricing; cached input priced separately.", sourceUrl: OPENAI_SRC },

  // ─── Google DeepMind ───────────────────────────────────────────
  { id: "tpv_google_g36flash", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 3.6 Flash", inputPerM: 1.5, outputPerM: 7.5, cachedInputPerM: 0.15, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g35flash", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 3.5 Flash", inputPerM: 1.5, outputPerM: 9, cachedInputPerM: 0.15, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g35flashlite", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 3.5 Flash-Lite", inputPerM: 0.3, outputPerM: 2.5, cachedInputPerM: 0.03, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g31pro", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 3.1 Pro (preview)", inputPerM: 2, outputPerM: 12, cachedInputPerM: 0.2, note: "Prices shown are the 200k-token-and-under tier; above 200k it is 4.00 input and 18.00 output.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g31flashlite", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 3.1 Flash-Lite", inputPerM: 0.25, outputPerM: 1.5, cachedInputPerM: 0.025, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g25pro", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Pro", inputPerM: 1.25, outputPerM: 10, cachedInputPerM: 0.125, note: "Prices shown are the 200k-token-and-under tier; above 200k it is 2.50 input and 15.00 output.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g25flash", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Flash", inputPerM: 0.3, outputPerM: 2.5, cachedInputPerM: 0.03, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
  { id: "tpv_google_g25flashlite", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Flash-Lite", inputPerM: 0.1, outputPerM: 0.4, cachedInputPerM: 0.01, note: "Paid tier.", sourceUrl: GOOGLE_SRC },
];

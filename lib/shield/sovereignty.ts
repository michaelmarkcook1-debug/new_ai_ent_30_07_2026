// The Sovereignty Lens: whose government can compel access.
//
// ORIGIN. Ported 5 August 2026 from the-desk/lib/sovereignty.ts (commit
// b9bb51c), read-only and unmodified at source. Editorial punctuation was
// adapted to the house rule; the quoted spans are the vendors' own and are
// pinned by tests/shield-quotes.test.ts along with the rest of the ledger.
//
// Derived entirely from the Shield's own verified marks in ./data.ts, never a
// second dataset that could diverge from it. Residency answers "where is my
// data", and this answers the question a residency mark alone cannot: which
// legal system reaches the company holding it. A vendor can host in Singapore
// and still sit under a parent subject to another country's law, and a buyer
// who reads only the residency row will miss that.
//
// Two evidence classes, kept apart on purpose:
//
//   Vendor's own document. The residency and retention marks already fetched
//   and cited in the Shield, reused here with the same receipt.
//
//   Public record. The vendor's country of incorporation or parent-company
//   headquarters. This is uncontested public-record fact for named,
//   well-documented companies (state of incorporation, headquarters address),
//   not a modelled estimate and not a vendor claim, so it carries no vendor
//   citation. Where the Shield already fetched a parent-company fact (the
//   Chinese-parent flags on Alibaba, Z.ai and Moonshot, or DeepSeek's own
//   admission that it stores in the PRC), that fetched fact is the one shown
//   rather than a re-derived one.

import { SHIELD, type Mark, type MarkState } from "./data";

export type SovereigntyFlag = "hard-stop" | "consideration" | "none";

export interface JurisdictionInfo {
  slug: string;
  /** Country or bloc of incorporation, or parent headquarters. */
  hqJurisdiction: string;
  flag: SovereigntyFlag;
  /** Why, grounded in the Shield's own fetched facts where one exists. */
  flagNote: string;
}

const JURISDICTIONS: Record<string, JurisdictionInfo> = {
  "openai-api": {
    slug: "openai-api",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  "anthropic-api": {
    slug: "anthropic-api",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  "google-gemini": {
    slug: "google-gemini",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated (Alphabet Inc.). No foreign-jurisdiction flag.",
  },
  "mistral-la-plateforme": {
    slug: "mistral-la-plateforme",
    hqJurisdiction: "France / EU",
    flag: "none",
    flagNote:
      "EU-incorporated, and its own terms default your data to EU hosting.",
  },
  "meta-llama": {
    slug: "meta-llama",
    hqJurisdiction: "United States (self-hosted, so you choose)",
    flag: "none",
    flagNote:
      "US-incorporated licensor, but structurally irrelevant: self-hosted weights mean you control the jurisdiction, not Meta.",
  },
  deepseek: {
    slug: "deepseek",
    hqJurisdiction: "China",
    flag: "hard-stop",
    flagNote:
      "DeepSeek's own privacy policy: “we directly collect, process and store your Personal Data in People's Republic of China”, with no residency choice offered.",
  },
  cohere: {
    slug: "cohere",
    hqJurisdiction: "Canada",
    flag: "none",
    flagNote:
      "Canada-incorporated, and offers VPC, on-premises and any-cloud deployment. No foreign-jurisdiction flag.",
  },
  "xai-grok": {
    slug: "xai-grok",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated, so no foreign-jurisdiction flag, though residency itself is unverified. See the Shield.",
  },
  "ai21-jamba": {
    slug: "ai21-jamba",
    hqJurisdiction: "Israel",
    flag: "none",
    flagNote:
      "Israel-incorporated, and its own terms list Israel among disclosed hosting regions. No adversarial-jurisdiction flag.",
  },
  "ibm-granite": {
    slug: "ibm-granite",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  "alibaba-qwen": {
    slug: "alibaba-qwen",
    hqJurisdiction: "China (hosting stated as Singapore)",
    flag: "consideration",
    flagNote:
      "⚠ Chinese-parented (Alibaba Group), which is a sovereignty consideration under PRC law even though the international product's documented hosting is Singapore rather than mainland China.",
  },
  "zai-glm": {
    slug: "zai-glm",
    hqJurisdiction: "China (hosting stated as Singapore)",
    flag: "consideration",
    flagNote:
      "⚠ Chinese-parented (Zhipu, Beijing). The Singapore-registered entity's parent is subject to PRC law even though stated hosting is Singapore.",
  },
  "moonshot-kimi": {
    slug: "moonshot-kimi",
    hqJurisdiction: "China (hosting stated as Singapore)",
    flag: "consideration",
    flagNote:
      "⚠ Chinese-parented (Moonshot AI, Beijing). The same Singapore-hosting against PRC-parent gap as Alibaba and Z.ai.",
  },
  reka: {
    slug: "reka",
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "Reka's own terms: “The Services are controlled and offered by Reka from its facilities in the United States”. No foreign-jurisdiction flag.",
  },
};

export interface SovereigntyRow {
  slug: string;
  vendor: string;
  hqJurisdiction: string;
  flag: SovereigntyFlag;
  flagNote: string;
  residency: Mark;
  retention: Mark;
}

const FLAG_ORDER: Record<SovereigntyFlag, number> = {
  "hard-stop": 0,
  consideration: 1,
  none: 2,
};

export const FLAG_LABEL: Record<SovereigntyFlag, string> = {
  "hard-stop": "Hard stop",
  consideration: "Consideration",
  none: "No flag",
};

/** One row per Shield vendor, grouped by flag severity and then alphabetical.
 *  A pure projection of SHIELD and JURISDICTIONS, making no new claim. */
export function sovereigntyRows(): SovereigntyRow[] {
  return SHIELD.map((v) => {
    const j = JURISDICTIONS[v.slug];
    return {
      slug: v.slug,
      vendor: v.vendor,
      hqJurisdiction: j?.hqJurisdiction ?? "Not established",
      flag: j?.flag ?? "none",
      flagNote: j?.flagNote ?? "No jurisdiction fact established yet.",
      residency: v.marks.residency,
      retention: v.marks.retention,
    };
  }).sort(
    (a, b) =>
      FLAG_ORDER[a.flag] - FLAG_ORDER[b.flag] ||
      a.vendor.localeCompare(b.vendor)
  );
}

/** Counts for the summary line, so the panel can state its own shape rather
 *  than leaving a reader to tally rows. */
export function sovereigntyCounts(): Record<SovereigntyFlag, number> {
  const out: Record<SovereigntyFlag, number> = {
    "hard-stop": 0,
    consideration: 0,
    none: 0,
  };
  for (const r of sovereigntyRows()) out[r.flag] += 1;
  return out;
}

export type { MarkState };

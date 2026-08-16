// Where the other thirty vendors are incorporated.
//
// WHY THIS IS A SECOND FILE RATHER THAN MORE ROWS IN THE LENS. The Sovereignty
// Lens projects SHIELD, and SHIELD is a ledger of documents we actually fetched
// and quoted. It reaches 14 vendors. Adding thirty rows to it would mean
// claiming we had fetched thirty more privacy policies, which we have not, and
// the Shield's whole value is that every mark in it has a receipt.
//
// So this register sits beside it and carries a weaker, clearly labelled claim.
// The lens already names the two evidence classes it works in, and this is
// entirely the second one:
//
//   Vendor's own document  the Shield. A fetched, quoted, dated policy.
//   Public record          this file. Country of incorporation or headquarters.
//
// Public record is uncontested fact for named, well-documented companies, not a
// modelled estimate and not a vendor claim. It is genuinely weaker than a
// fetched policy, because it answers "which legal system reaches this company"
// and says nothing about where the data physically sits. A US company can host
// you in Frankfurt; a Singapore-hosted service can have a Beijing parent. Where
// the Shield has fetched the residency answer, the Shield wins, and
// jurisdictionFor() reads it first for exactly that reason.
//
// WHAT THIS CLOSES. Before it, the jurisdiction filter reached 13 of 43 scored
// vendors, and a vendor it had not reached was passed through the filter
// unflagged, deliberately: silence is not clearance. That is the right default
// and it had one bad consequence. MiniMax is a Shanghai-headquartered frontier
// lab and it was in the unassessed two thirds, so a reader who asked to exclude
// Chinese providers was shown it anyway. The default was not wrong. The
// coverage was too thin for the default to be safe.
//
// HOW THE FLAGS WERE SET. Verified 16 August 2026.
//
//   China          consideration, matching the Shield's own treatment of
//                  Alibaba, Z.ai and Moonshot.
//   UAE and Saudi  consideration. Both are state-owned or state-chaired, and
//                  neither jurisdiction holds an EU or UK adequacy decision.
//   Everywhere     none. US, UK, EU, Japan, Canada and Israel all hold an
//   else           adequacy decision, the US only for organisations certified
//                  under the Data Privacy Framework.
//
// The adequacy list was read at the time of writing and covers Andorra,
// Argentina, Canada for commercial organisations under PIPEDA, the Faroe
// Islands, Guernsey, Israel, the Isle of Man, Japan, Jersey, New Zealand, the
// Republic of Korea, Switzerland, Uruguay, the United Kingdom and the United
// States under the EU-US Data Privacy Framework.
//
// A flag here is a statement that a question is open, not a verdict on a
// country. Each note carries the facts it rests on so a reader can accept the
// facts and reject the inference.

import type { SovereigntyFlag } from "./sovereignty";

export interface HqRecord {
  /** Country or bloc of incorporation, or parent headquarters. */
  hqJurisdiction: string;
  flag: SovereigntyFlag;
  /** The facts the flag rests on, stated so a reader can check them. */
  flagNote: string;
}

/**
 * Keyed by AIE vendor id, not Shield slug, because none of these vendors has a
 * Shield entry to hang a slug off.
 */
export const HQ_REGISTER: Record<string, HqRecord> = {
  // Flagged.

  minimax: {
    hqJurisdiction: "China (listed parent in the Cayman Islands)",
    flag: "consideration",
    flagNote:
      "Chinese-headquartered. MiniMax is based in Shanghai with research subsidiaries in Shanghai and Beijing; the listed parent, MiniMax Group Inc., is Cayman-incorporated and trades in Hong Kong. The corporate wrapper is offshore, the operating company is in the PRC. Its hosting is not established, because we have not fetched its policy.",
  },
  g42: {
    hqJurisdiction: "United Arab Emirates",
    flag: "consideration",
    flagNote:
      "UAE-incorporated (Group 42 Holding Ltd, Abu Dhabi), chaired by a member of the ruling family who is the UAE national security advisor, and backed by the state investment company Mubadala. The UAE holds no EU or UK adequacy decision. Falcon is developed with the Technology Innovation Institute, an Abu Dhabi government research body.",
  },
  humain: {
    hqJurisdiction: "Saudi Arabia",
    flag: "consideration",
    flagNote:
      "Saudi-incorporated (Riyadh), wholly owned by the Public Investment Fund and chaired by the Crown Prince, so the controlling shareholder is the state itself. Saudi Arabia holds no EU or UK adequacy decision.",
  },

  // Not flagged, and not silicon.

  aws: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated (Amazon Web Services, Inc., a subsidiary of Amazon.com, Inc.). No foreign-jurisdiction flag.",
  },
  microsoft: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  oracle: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  salesforce: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  servicenow: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  snowflake: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  databricks: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  coreweave: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  lambda: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  together: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  fireworks: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  groq: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  glean: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  hebbia: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  harvey: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  rogo: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  perplexity: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  writer: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  moveworks: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote: "US-incorporated. No foreign-jurisdiction flag.",
  },
  nscale: {
    hqJurisdiction: "United Kingdom",
    flag: "none",
    flagNote:
      "UK-incorporated: Nscale Limited, company number 16925886, England and Wales, registered office in London. Taken from its own published privacy policy rather than a directory. No foreign-jurisdiction flag.",
  },
  sap: {
    hqJurisdiction: "Germany / EU",
    flag: "none",
    flagNote:
      "EU-incorporated (SAP SE, Walldorf, Germany), so an EU buyer's data stays inside its own legal system. No foreign-jurisdiction flag.",
  },
  sakana: {
    hqJurisdiction: "Japan",
    flag: "none",
    flagNote:
      "Japan-incorporated (Sakana AI, Tokyo). Japan holds an EU adequacy decision. No foreign-jurisdiction flag.",
  },

  // Silicon. Flagged none for a structural reason rather than a geographic one,
  // the same way the lens treats Meta's self-hosted weights: the lens asks
  // whose government can compel access to your data, and a chip supplier never
  // holds it. Naming the jurisdiction anyway, so a reader who wants the supply
  // chain fact is not left to guess it.

  nvidia: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated, and a hardware supplier rather than a processor of your data. No foreign-jurisdiction flag.",
  },
  amd: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated, and a hardware supplier rather than a processor of your data. No foreign-jurisdiction flag.",
  },
  broadcom: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated, and a hardware supplier rather than a processor of your data. No foreign-jurisdiction flag.",
  },
  cerebras: {
    hqJurisdiction: "United States",
    flag: "none",
    flagNote:
      "US-incorporated, and sells compute rather than a service that holds your data. No foreign-jurisdiction flag.",
  },
  tsmc: {
    hqJurisdiction: "Taiwan",
    flag: "none",
    flagNote:
      "Taiwan-incorporated (Hsinchu). Taiwan holds no EU or UK adequacy decision, but that question does not arise through this vendor: a foundry fabricates silicon and never holds your data. Left unflagged for that reason, not because the jurisdiction was cleared.",
  },
};

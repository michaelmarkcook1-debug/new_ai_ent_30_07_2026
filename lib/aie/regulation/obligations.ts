// Dated AI regulatory obligations, researched first-party.
//
// Trust Rank held two regulatory events. A page whose job is to tell a buyer
// what is coming cannot run on two, and the two it had were both already in
// force, so nothing on the page was ever ahead of the reader.
//
// This is a first-party set, deliberately separate from
// lib/aie/market-signals/seed.ts. That file is ported from the ranking engine
// and tracked in AIE_REUSE_MAP; mixing our own research into it would make it
// impossible to say later which rows came from where.
//
// RESEARCHED 5 AUGUST 2026. Every row carries the source it was read from and
// the date that source was published. Where two sources disagreed the conflict
// is recorded on the row rather than silently resolved — see Colorado, where
// two trackers still described a law that had been repealed three months
// earlier.
//
// The field that matters most here is `binds`. Most AI regulation lands on the
// deployer, not the model provider: a buyer reading "high-risk obligations
// apply" needs to know whether that is their vendor's problem or theirs, and
// almost every tracker in this market elides it.

export type Binds = "provider" | "deployer" | "both";

/** A-E, as used by the catalogue source register. */
export type EvidenceClass = "A" | "B" | "C" | "D" | "E";

export interface ObligationSource {
  name: string;
  url: string;
  /** When the source was published, not when we read it. */
  published: string;
  evidenceClass: EvidenceClass;
}

export interface Obligation {
  id: string;
  jurisdiction: string;
  regime: string;
  /** The specific provision, where one governs. */
  provision: string | null;
  /** What it requires, in one line a buyer can act on. */
  requires: string;
  /** ISO date the obligation bites. */
  effectiveDate: string;
  /** Who carries it: the model provider, the organisation deploying, or both. */
  binds: Binds;
  /** What it means for the reader. The Desk's idiom, and the point of the row. */
  soWhat: string;
  /** Vendors in our set that the obligation lands on directly. May be empty. */
  affectedVendorIds: string[];
  source: ObligationSource;
  /** Set when a date moved, so a reader who planned to the old one sees why. */
  moved?: { from: string; by: string };
  /** Anything genuinely unsettled. Absence means we found nothing unsettled. */
  caveat?: string;
}

/** The frontier model providers in our vendor set, for GPAI-style duties. */
const FRONTIER = ["openai", "anthropic", "googl", "msft", "meta", "mistral", "xai"];

export const OBLIGATIONS: Obligation[] = [
  // ─────────────────────────────────────────────────── European Union
  {
    id: "eu_ai_act_prohibitions",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Article 5",
    requires:
      "Eight categories of AI practice are banned outright, including social scoring and untargeted facial-image scraping.",
    effectiveDate: "2025-02-02",
    binds: "both",
    soWhat:
      "The only part of the Act with no compliance path: a prohibited use is not a risk to manage, it is a use to stop. Check nothing in your estate falls inside the eight before you spend on anything else.",
    affectedVendorIds: [],
    source: {
      name: "Regulation (EU) 2024/1689 (EU AI Act), Article 113",
      url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      published: "2024-07-12",
      evidenceClass: "A",
    },
  },
  {
    id: "eu_ai_act_gpai",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Chapter V (Articles 51–56)",
    requires:
      "General-purpose AI model providers must publish training-data summaries, technical documentation and a copyright policy.",
    effectiveDate: "2025-08-02",
    binds: "provider",
    soWhat:
      "This one lands on your vendor, not on you. It is why frontier providers now publish model documentation you can ask for — request it in procurement rather than accepting a datasheet written for marketing.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "Regulation (EU) 2024/1689 (EU AI Act), Chapter V",
      url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      published: "2024-07-12",
      evidenceClass: "A",
    },
  },
  {
    id: "eu_digital_omnibus_in_force",
    jurisdiction: "European Union",
    regime: "Digital Omnibus on AI — Regulation (EU) 2026/1744",
    provision: null,
    requires:
      "Amends the AI Act: defers the standalone high-risk deadline, defers product-embedded high-risk, and adds two prohibited practices.",
    effectiveDate: "2026-07-27",
    binds: "both",
    soWhat:
      "The AI Act is no longer the 2024 text. Any readiness plan written before August 2026 is planning to dates that have moved — reread it against the amended timetable rather than assuming your deadline held.",
    affectedVendorIds: [],
    source: {
      name: "Orrick, 'EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes'",
      url: "https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes",
      published: "2026-07-29",
      evidenceClass: "B",
    },
    caveat:
      "Published in the Official Journal 24 July 2026, in force 27 July 2026. Commentary written before that date describes the deferral as pending and should not be relied on.",
  },
  {
    id: "eu_ai_act_transparency",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Article 50",
    requires:
      "Users must be told when they are interacting with an AI system, and synthetic content must be disclosed as such.",
    effectiveDate: "2026-08-02",
    binds: "deployer",
    soWhat:
      "Already live, and it binds you rather than your vendor. Every customer-facing assistant, generated image and synthetic voice in your estate needs a disclosure — this is the obligation most likely to be quietly breached today.",
    affectedVendorIds: [],
    source: {
      name: "Regulation (EU) 2024/1689, Article 50, as amended",
      url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      published: "2024-07-12",
      evidenceClass: "A",
    },
  },
  {
    id: "eu_ai_act_marking_grace",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Article 50(2)",
    requires:
      "Machine-readable marking of AI-generated content, for systems already on the market before 2 August 2026.",
    effectiveDate: "2026-12-02",
    binds: "provider",
    soWhat:
      "A grace period, not an exemption. If you shipped a generative feature before August, watermarking is a December deliverable and needs to be in this quarter's plan.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "Orrick, 'EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes'",
      url: "https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes",
      published: "2026-07-29",
      evidenceClass: "B",
    },
  },
  {
    id: "eu_ai_act_new_prohibitions",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Article 5, as amended",
    requires:
      "Two further prohibited practices: AI generating child sexual abuse material, and AI producing non-consensual intimate images.",
    effectiveDate: "2026-12-02",
    binds: "both",
    soWhat:
      "Added by the Omnibus. If you run image or video generation, the safety controls that prevent these outputs stop being a policy choice and become a legal requirement in December.",
    affectedVendorIds: [],
    source: {
      name: "Orrick, 'EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes'",
      url: "https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes",
      published: "2026-07-29",
      evidenceClass: "B",
    },
  },
  {
    id: "eu_ai_act_legacy_gpai",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Article 111(3)",
    requires:
      "GPAI models placed on the market before 2 August 2025 must be brought into compliance.",
    effectiveDate: "2027-08-02",
    binds: "provider",
    soWhat:
      "The older model you standardised on is the one at risk here. Ask any provider whose model predates August 2025 what their compliance path is before you renew on it.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "Regulation (EU) 2024/1689, Article 111(3)",
      url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      published: "2024-07-12",
      evidenceClass: "A",
    },
  },
  {
    id: "eu_ai_act_high_risk_annex_iii",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Annex III (standalone high-risk)",
    requires:
      "Risk management, data governance, technical documentation, human oversight, conformity assessment and post-market monitoring for standalone high-risk systems — hiring, credit, education, law enforcement.",
    effectiveDate: "2027-12-02",
    binds: "both",
    soWhat:
      "The heaviest obligation in the Act, and the one most often mis-dated. It moved sixteen months, which is time to build rather than permission to stop: notified-body capacity is limited and organisations that wait until late 2027 will queue.",
    affectedVendorIds: [],
    moved: { from: "2026-08-02", by: "Digital Omnibus, Regulation (EU) 2026/1744" },
    source: {
      name: "Orrick, 'EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes'",
      url: "https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes",
      published: "2026-07-29",
      evidenceClass: "B",
    },
  },
  {
    id: "eu_ai_act_high_risk_annex_i",
    jurisdiction: "European Union",
    regime: "EU AI Act",
    provision: "Annex I (product-embedded high-risk)",
    requires:
      "The same high-risk obligations, for AI embedded as a safety component in products already regulated by EU harmonisation law — medical devices, machinery, vehicles.",
    effectiveDate: "2028-08-02",
    binds: "both",
    soWhat:
      "Only bites if you build AI into a regulated product. If you do, your conformity assessment now has two regimes to satisfy rather than one.",
    affectedVendorIds: [],
    moved: { from: "2027-08-02", by: "Digital Omnibus, Regulation (EU) 2026/1744" },
    source: {
      name: "Orrick, 'EU AI Act Update: Digital Omnibus Finalizes 8 Compliance Changes'",
      url: "https://www.orrick.com/en/Insights/2026/07/EU-AI-Act-Update-Digital-Omnibus-Finalizes-8-Compliance-Changes",
      published: "2026-07-29",
      evidenceClass: "B",
    },
  },

  // ─────────────────────────────────────────────────── United States
  {
    id: "us_ca_sb53_frontier",
    jurisdiction: "United States — California",
    regime: "Transparency in Frontier AI Act (SB 53)",
    provision: null,
    requires:
      "Frontier-model developers must publish a safety framework, report safety incidents, and protect whistleblowers.",
    effectiveDate: "2026-01-01",
    binds: "provider",
    soWhat:
      "Your frontier vendor now publishes a safety framework by law. Read it — it is the first document in this market that a provider is legally exposed for misstating.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "us_ca_ab2013_training_data",
    jurisdiction: "United States — California",
    regime: "Generative AI Training Data Transparency (AB 2013)",
    provision: null,
    requires:
      "Generative AI developers must publish a summary of the datasets used to train each system.",
    effectiveDate: "2026-01-01",
    binds: "provider",
    soWhat:
      "Gives you a documented answer to the training-data question your legal team asks in every AI procurement. Ask for the published summary by name rather than accepting a verbal assurance.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "us_tx_traiga",
    jurisdiction: "United States — Texas",
    regime: "TRAIGA (HB 149)",
    provision: null,
    requires:
      "Intent-based prohibitions on manipulation and unlawful discrimination, with most compliance duties limited to government use. Substantial compliance with the NIST AI RMF is a safe harbour.",
    effectiveDate: "2026-01-01",
    binds: "deployer",
    soWhat:
      "The safe harbour is the useful part: adopting the NIST AI Risk Management Framework satisfies Texas and most of what the other states ask for. One framework, several jurisdictions.",
    affectedVendorIds: [],
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "us_il_hb3773_employment",
    jurisdiction: "United States — Illinois",
    regime: "HB 3773 (Illinois Human Rights Act amendment)",
    provision: null,
    requires:
      "No AI-driven employment discrimination, and notice to candidates when AI is used in employment decisions.",
    effectiveDate: "2026-01-01",
    binds: "deployer",
    soWhat:
      "Squarely yours, not your vendor's. If AI touches sifting, scoring or scheduling in hiring, the notice requirement applies now and the discrimination exposure sits with you as employer.",
    affectedVendorIds: [],
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "us_co_sb189_admt",
    jurisdiction: "United States — Colorado",
    regime: "SB 26-189 (automated decision-making technology)",
    provision: null,
    requires:
      "Developers must give deployers intended uses, harmful uses, training-data categories and oversight instructions. Individuals get access, correction and meaningful human review of adverse automated decisions.",
    effectiveDate: "2027-01-01",
    binds: "both",
    soWhat:
      "Much narrower than the law it replaced: the duty of care, impact assessments and mandatory risk programmes are gone. If you built a Colorado AI Act programme in 2025, most of it is no longer required — check before you spend another quarter on it.",
    affectedVendorIds: [],
    moved: { from: "2026-06-30", by: "SB 189, signed 14 May 2026, repealing SB 24-205" },
    source: {
      name: "Hunton, 'Colorado AI Act Amended and Effective Date Delayed'",
      url: "https://www.hunton.com/privacy-and-cybersecurity-law-blog/colorado-ai-act-amended-and-effective-date-delayed",
      published: "2026-05-14",
      evidenceClass: "B",
    },
    caveat:
      "Two public trackers still described the original SB 24-205 as taking effect 30 June 2026 when this was researched in August 2026. It was repealed before it ever applied. Check the date on any Colorado guidance you are given.",
  },
  {
    id: "us_ny_raise_act",
    jurisdiction: "United States — New York",
    regime: "RAISE Act",
    provision: null,
    requires:
      "Safety and transparency obligations on large frontier AI developers: documentation, internal controls, accountability and anti-retaliation protection.",
    effectiveDate: "2027-01-01",
    binds: "provider",
    soWhat:
      "New York following California means frontier-model transparency is becoming the US default rather than one state's experiment. Expect the published safety framework to become a standard procurement artefact.",
    affectedVendorIds: FRONTIER,
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "us_ca_ccpa_admt",
    jurisdiction: "United States — California",
    regime: "CCPA automated decision-making regulations",
    provision: null,
    requires:
      "Full ADMT provisions: pre-use notices and consumer opt-outs, on top of the risk-assessment duties already live since January 2026.",
    effectiveDate: "2027-01-01",
    binds: "deployer",
    soWhat:
      "The opt-out is the operationally hard part. A consumer right to refuse automated decisioning has to be built into the product, not bolted on as a policy, so this belongs in a roadmap now rather than in a compliance review in 2027.",
    affectedVendorIds: [],
    source: {
      name: "White & Case, AI Watch: Global regulatory tracker — United States",
      url: "https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-united-states",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },

  // ─────────────────────────────────────────────────── United Kingdom
  //
  // There is no UK AI Act, and that is a policy choice rather than a gap
  // waiting to be filled: existing regulators apply existing law within their
  // remits. So the UK obligations that bite are data-protection ones, and they
  // land on the deployer almost without exception. A buyer told "the UK has
  // not regulated AI yet" has been misled — three duties came into force in
  // the first half of 2026.
  {
    id: "uk_duaa_s80_adm",
    jurisdiction: "United Kingdom",
    regime: "Data (Use and Access) Act 2025, section 80",
    provision: "UK GDPR Articles 22A\u201322D",
    requires:
      "Replaces UK GDPR Article 22 on automated decision-making, setting new conditions and safeguards for decisions taken about people without meaningful human involvement.",
    effectiveDate: "2026-02-05",
    binds: "deployer",
    soWhat:
      "The live UK AI obligation today, and it is yours. Any automated decision affecting a person \u2014 credit, hiring, pricing, eligibility \u2014 now runs under a rewritten Article 22, so a lawful basis established before February 2026 needs rechecking.",
    affectedVendorIds: [],
    source: {
      name: "Bratby Law, 'Is There a UK AI Act? UK AI Regulation in 2026'",
      url: "https://bratby.law/uk-ai-regulation-what-the-law-says",
      published: "2026-07-01",
      evidenceClass: "B",
    },
  },
  {
    id: "uk_si_2026_425_ico_code",
    jurisdiction: "United Kingdom",
    regime: "DPA 2018 (Code of Practice on AI and ADM) Regulations 2026, SI 2026/425",
    provision: null,
    requires:
      "Places a statutory duty on the Information Commissioner to prepare a code of practice covering personal data in AI development and use, automated decision-making, and children's data.",
    effectiveDate: "2026-05-12",
    binds: "deployer",
    soWhat:
      "The duty is in force; the code is not written. Watch for it rather than plan against it \u2014 when it lands it becomes the benchmark the ICO measures you by, and it is expected to reach past data protection into how AI is built.",
    affectedVendorIds: [],
    source: {
      name: "Vorp Labs, UK AI regulatory tracker \u2014 SI 2026/425",
      url: "https://vorplabs.com/ai-regulatory-updates/united-kingdom",
      published: "2026-07-22",
      evidenceClass: "C",
    },
    caveat:
      "Made 16 April 2026, in force 12 May 2026. The code itself is unpublished and expected in 2027; ICO final guidance on automated decision-making was expected in summer 2026 after a consultation that closed 29 May 2026.",
  },
  {
    id: "uk_dpa_s164a_complaints",
    jurisdiction: "United Kingdom",
    regime: "Data Protection Act 2018, section 164A",
    provision: null,
    requires:
      "A statutory complaint-handling duty on controllers, with a route for data subjects to complain directly and a duty to respond.",
    effectiveDate: "2026-06-19",
    binds: "deployer",
    soWhat:
      "An operational duty, not a paperwork one. If an AI-driven decision goes against someone they now have a statutory complaint route into you, so somebody has to own the response path before the first one arrives.",
    affectedVendorIds: [],
    source: {
      name: "1Digit, 'The 2026 AI Regulation Map: EU & UK'",
      url: "https://1digit.co.uk/insights/the-2026-ai-regulation-map",
      published: "2026-07-01",
      evidenceClass: "C",
    },
  },
];

/** In force as of `asOf`, most recent first. */
export function inForce(asOf: Date): Obligation[] {
  const iso = asOf.toISOString().slice(0, 10);
  return OBLIGATIONS.filter((o) => o.effectiveDate <= iso).sort((a, b) =>
    b.effectiveDate.localeCompare(a.effectiveDate)
  );
}

/** Not yet in force, soonest first — the countdown list. */
export function upcoming(asOf: Date): Obligation[] {
  const iso = asOf.toISOString().slice(0, 10);
  return OBLIGATIONS.filter((o) => o.effectiveDate > iso).sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate)
  );
}

/**
 * Whole days until an obligation bites. Negative once it has.
 *
 * Deliberately takes `asOf` rather than reading the clock, so a server render
 * and a test agree and nothing depends on when it happened to run.
 */
export function daysUntil(o: Obligation, asOf: Date): number {
  const then = Date.parse(`${o.effectiveDate}T00:00:00Z`);
  const now = Date.parse(`${asOf.toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((then - now) / 86_400_000);
}

/** The obligations that land on a vendor the reader actually watches. */
export function forWatchlist(vendorIds: string[]): Obligation[] {
  if (vendorIds.length === 0) return [];
  const watched = new Set(vendorIds);
  return OBLIGATIONS.filter((o) =>
    o.affectedVendorIds.some((v) => watched.has(v))
  );
}

export const OBLIGATIONS_RESEARCHED_AT = "2026-08-05";

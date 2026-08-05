// Shared regulatory grid content used by both Trust Rank views (Company
// View tab and the vendor-oriented Vendor Assessment page). Seeded from the
// AIE legislation and market-signals material where flagged aieSource: true
// (badge "AIE dataset"); the remaining rows are demo SAMPLE content and are
// badged accordingly. No row states an invented figure.

export interface RegulatoryRow {
  jurisdiction: string;
  regime: string;
  status: string;
  note: string;
  aieSource: boolean;
}

export interface VendorRuling {
  vendor: string;
  item: string;
  note: string;
  aieSource: boolean;
}

export const REGULATORY_GRID: RegulatoryRow[] = [
  // Corrected 5 August 2026. This said high-risk requirements "phase in
  // through 2026 and 2027", which was the pre-Omnibus timetable and had been
  // wrong since 27 July. Regulation (EU) 2026/1744 moved standalone Annex III
  // high-risk to 2 December 2027 and product-embedded Annex I to 2 August
  // 2028. A buyer planning to August 2026 was planning to a date that had
  // moved sixteen months. Dates now live in lib/aie/regulation/obligations.ts,
  // each with its source, so there is one place to correct rather than several.
  { jurisdiction: "European Union", regime: "EU AI Act", status: "In force, phased application", note: "General-purpose AI obligations have applied since August 2025 and Article 50 transparency since 2 August 2026. High-risk requirements were deferred by the Digital Omnibus (Regulation (EU) 2026/1744, in force 27 July 2026): standalone Annex III systems now 2 December 2027, product-embedded Annex I systems 2 August 2028. Safety-critical industrial use cases likely qualify as high-risk.", aieSource: true },
  { jurisdiction: "United Kingdom", regime: "Principles-based, regulator-led approach", status: "Guidance", note: "No horizontal statute; sector regulators apply five cross-cutting principles. Financial trading AI falls under existing conduct rules.", aieSource: false },
  { jurisdiction: "United States (federal)", regime: "Executive action plus sector rules", status: "Evolving", note: "No comprehensive federal statute; export controls on advanced chips shape infrastructure choices. Sector agencies police claims and safety.", aieSource: true },
  { jurisdiction: "California", regime: "State AI statutes", status: "In force, partial", note: "Transparency and safety-disclosure obligations for large model developers affect vendor selection more than deployment.", aieSource: false },
  { jurisdiction: "Colorado", regime: "Colorado AI Act", status: "Enacted, applying 2026", note: "Duties on deployers of high-risk AI systems in consequential decisions; relevant to HR and customer-facing uses.", aieSource: false },
  { jurisdiction: "Texas", regime: "State AI governance act", status: "Enacted", note: "Government-use focused with narrower private-sector duties.", aieSource: false },
  { jurisdiction: "New York", regime: "Automated employment decision rules", status: "In force", note: "Bias audit duties for automated hiring tools; applies to talent workflows.", aieSource: false },
  { jurisdiction: "Germany", regime: "EU AI Act plus national supervision", status: "In force via EU", note: "National market surveillance authorities enforce; works councils add co-determination duties for workplace AI.", aieSource: false },
  { jurisdiction: "France", regime: "EU AI Act plus CNIL guidance", status: "In force via EU", note: "Data protection authority active on AI and personal data; relevant to customer analytics.", aieSource: false },
  { jurisdiction: "India", regime: "Advisory-led, DPDP Act adjacent", status: "Guidance", note: "No horizontal AI statute; data protection law and sector advisories govern.", aieSource: false },
];

export const VENDOR_RULINGS: VendorRuling[] = [
  { vendor: "Frontier labs (general)", item: "EU general-purpose AI obligations", note: "Documentation and transparency duties sit with model providers; deployers inherit downstream duties. Confidence-labelled from the AIE legislation material.", aieSource: true },
  { vendor: "US chip export controls", item: "Advanced compute restrictions", note: "Shapes where sovereign and regional AI capacity can be built; a supply-chain consideration for global deployment. Seeded from the AIE market signals dataset.", aieSource: true },
];

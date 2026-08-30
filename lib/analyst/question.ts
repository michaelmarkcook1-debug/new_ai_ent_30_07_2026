// One page, one analytical question.
//
// THE DEFECT THIS EXISTS FOR. Nothing in the code said what a page was for, so
// a builder wandered across whatever the dataset held. Live Vendor View, 30
// August 2026, in a single paragraph: SAP's workflow automation lead, then
// Salesforce, then Cloud AI platform, then Databricks against Google, then
// AMD and Groq's open risks, then how many vendors have a momentum reading.
// Seven findings, four populations, no argument. Every sentence was true.
//
// A page that answers everything answers nothing, and the reader cannot tell
// which of seven observations they were meant to act on. So the question is
// written down, the builder is held to it, and the authored version is told
// what it is being asked before it is told what the data says.
//
// THIS IS NOT A PROMPT STRING. It is the contract three layers read: the
// deterministic builder shapes its argument to `mustAddress`, the prompt states
// the question, and lib/analyst/comparability.ts uses `unit` and `population`
// to decide whether a comparison the model wrote was one this page is allowed
// to make.

/** Every surface that renders an Analyst Insight. */
export type PageId =
  | "pulse"
  | "vendor-view"
  | "competitive-intel"
  | "price-performance"
  | "market-watch"
  | "financial-snapshot"
  | "reputation-tracker"
  | "alliances"
  | "peer-insights"
  | "news-feed"
  | "governance"
  | "workflows"
  | "position";

/**
 * What the argument on this page is ABOUT.
 *
 * This is the field that decides whether naming two vendors from different
 * categories is analysis or incoherence. On a `category` page it is
 * incoherence unless the page says why they belong together. On a `market`
 * page a category is an EXAMPLE of the market finding, and naming two is how
 * you show a pattern holds in more than one place.
 */
export type ArgumentUnit =
  /** The tracked market as a whole. Categories appear as evidence for a pattern. */
  | "market"
  /** One category at a time. Cross-category comparison needs stating and earning. */
  | "category"
  /** A named set of models rather than vendors. */
  | "model-set"
  /** The delivery and partner ecosystem rather than the products. */
  | "ecosystem"
  /** The company the reader named, against the market. */
  | "subject";

export interface PageQuestion {
  id: PageId;
  /** The one question. Stated to the model, verbatim, before anything else. */
  question: string;
  unit: ArgumentUnit;
  /**
   * The set every comparison on this page is drawn from, in the reader's
   * words. Rendered into the prompt so a comparison has to declare its own
   * population, and used by the comparability guard.
   */
  population: string;
  /**
   * What a good answer has to engage with. Concepts rather than sentences: a
   * test asserting exact copy is a test that breaks on every edit and checks
   * nothing about the thinking.
   */
  mustAddress: string[];
  /**
   * The neighbouring pages' jobs. Stated so this page stops doing them: the
   * complaint that Market Watch reads like News, and that Vendor View reads
   * like Competitive Intelligence, is this field being absent.
   */
  outOfScope: string[];
}

export const PAGE_QUESTIONS: Readonly<Record<PageId, PageQuestion>> = {
  pulse: {
    id: "pulse",
    question:
      "What materially changed in enterprise AI that an executive should care about now?",
    unit: "market",
    population: "every tracked enterprise AI vendor",
    mustAddress: [
      "whether anything structural actually changed, or whether the market is stable",
      "what any change does to buyer economics, competitive structure or governance",
      "why it deserves executive attention this quarter rather than generally",
    ],
    outOfScope: [
      "a vendor leaderboard, which is Vendor View's job",
      "narrating which individual vendors moved up or down",
    ],
  },
  "vendor-view": {
    id: "vendor-view",
    question:
      "Where does meaningful differentiation exist in the vendor landscape, where does it not, and what does that mean for vendor selection?",
    unit: "market",
    population: "the tracked vendor set, scored within market categories",
    mustAddress: [
      "whether differentiation is broad or confined to a few categories",
      "whether an apparent lead is large enough to survive diligence",
      "what the structure means for how a shortlist should be built",
    ],
    outOfScope: [
      "who is ranked first, which the table already says",
      "reciting scores row by row",
    ],
  },
  "competitive-intel": {
    id: "competitive-intel",
    question:
      "Where is vendor differentiation real, where is the market converging, and which apparent leads actually matter?",
    unit: "market",
    population: "vendors carrying an assessed capability score",
    mustAddress: [
      "whether capability separation is widening or collapsing",
      "which leads are inside the margin the evidence can carry",
      "what convergence does to switching cost",
    ],
    outOfScope: ["rank narration", "restating the heatmap cell by cell"],
  },
  "price-performance": {
    id: "price-performance",
    question:
      "Where is enterprise AI capability becoming economically substitutable, and where does a premium remain defensible?",
    unit: "model-set",
    population: "models carrying both a published price and a benchmark score",
    mustAddress: [
      "whether capability at a given price point has become interchangeable",
      "what that does to workload routing and commitment length",
      "where a premium is still buying something measurable",
    ],
    outOfScope: ["vendor rankings", "capability scores without their price"],
  },
  "market-watch": {
    id: "market-watch",
    question: "How is market structure changing buyer leverage?",
    unit: "market",
    population: "categories carrying enough share estimates to judge",
    mustAddress: [
      "concentration, and whether alternatives are real or nominal",
      "what that does to renewal and negotiation position",
    ],
    outOfScope: [
      "reporting the news, which is News Feed's job",
      "vendor capability, which is Competitive Intelligence's job",
    ],
  },
  "financial-snapshot": {
    id: "financial-snapshot",
    question:
      "What can an enterprise buyer legitimately conclude about vendors' commercial durability and AI footing?",
    unit: "market",
    population: "tracked public vendors with filings",
    mustAddress: [
      "what disclosure does and does not establish",
      "how a buyer should treat an unaudited commercial claim",
    ],
    outOfScope: [
      "treating absence of disclosure as evidence of weakness",
      "valuing or rating the vendors",
    ],
  },
  "reputation-tracker": {
    id: "reputation-tracker",
    question:
      "Does external customer and employee evidence materially strengthen or weaken the market story around a vendor?",
    unit: "market",
    population: "vendors carrying a reputation reading",
    mustAddress: [
      "whether reputation confirms or contradicts the capability picture",
      "what reputation can and cannot decide in a selection",
    ],
    outOfScope: ["narrating review counts or scores vendor by vendor"],
  },
  alliances: {
    id: "alliances",
    question:
      "How does the delivery ecosystem change the practical choice of technology and vendor?",
    unit: "ecosystem",
    population: "recorded partner and dependency links",
    mustAddress: [
      "delivery breadth, and whether a second source exists",
      "where a dependency concentrates risk the product choice does not show",
    ],
    outOfScope: ["vendor capability ranking"],
  },
  "peer-insights": {
    id: "peer-insights",
    question:
      "What does actual enterprise behaviour tell us about what is becoming proven, and what remains experimental?",
    unit: "market",
    population: "catalogued workflows and the segments that run them",
    mustAddress: [
      "which workflows have moved from experiment to routine",
      "what a buyer can safely conclude from other enterprises' behaviour",
    ],
    outOfScope: [
      "extrapolating broad adoption from one or two examples",
      "vendor selection advice",
    ],
  },
  "news-feed": {
    id: "news-feed",
    question:
      "Which of the period's developments actually bear on an enterprise buying decision?",
    unit: "market",
    population: "items retrieved in the current window",
    mustAddress: ["which items change a decision and which are noise"],
    outOfScope: ["summarising every item"],
  },
  governance: {
    id: "governance",
    question:
      "What does the regulatory and assurance picture require of a buyer before signature?",
    unit: "market",
    population: "tracked obligations and vendor assurance evidence",
    mustAddress: ["what binds, where, and what evidence closes it"],
    outOfScope: ["vendor ranking"],
  },
  workflows: {
    id: "workflows",
    question:
      "Which AI workflows are ready to be trusted with real work, and what does readiness depend on?",
    unit: "market",
    population: "the catalogued workflow library",
    mustAddress: ["what separates a ready workflow from an unready one"],
    outOfScope: ["vendor selection"],
  },
  position: {
    id: "position",
    question:
      "What does the state of the enterprise AI market mean for this specific company?",
    unit: "subject",
    population: "the tracked market, read against one company",
    mustAddress: [
      "where this company's position is exposed and where it is defensible",
      "what it should do differently because of the market reading",
    ],
    outOfScope: ["a general market summary that would read the same for anyone"],
  },
};

export function pageQuestion(id: PageId): PageQuestion {
  return PAGE_QUESTIONS[id];
}

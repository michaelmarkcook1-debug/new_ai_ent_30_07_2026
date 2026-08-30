import { describe, it, expect } from "vitest";
import rolesJson from "@/lib/model-fit/data/roles.json";
import { rolesFor, allArchetypes } from "@/lib/position/role-fit";
import { opportunitiesFor } from "@/lib/position/opportunities";
import type { Opportunity } from "@/lib/position/opportunities";
import type { SavedPosition } from "@/lib/position/store";

// Three columns, three accountabilities, and preferably three different people.
//
// THE DEFECT THIS FIXES. The columns were ranked independently, so a data
// workflow whose business owner and build owner both scored the Chief Data
// Officer got the CDO twice. Live Tesco and live Salesforce both did. Two
// thirds of a three-role model naming one person is not a recommendation about
// ownership, and it quietly removes the challenge function the third column
// exists to provide.
//
// Distinctness is a preference and not a fabrication rule: a small organisation
// genuinely does combine accountabilities. But this recommends ARCHETYPES
// rather than reading an org chart, so where the role library offers a credible
// alternative it should be used, and where it does not the repeat has to be
// deliberate rather than accidental.

const LIBRARY = new Set(
  Object.values(rolesJson as Record<string, { name: string }>).map((r) => r.name)
);

const area = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: "x",
  label: "A workflow",
  category: "Operations",
  riskTier: "low",
  reliabilityRequirement: 3,
  autonomyDefault: "advisory_only",
  regulatoryFlags: [],
  basis: "sector",
  evidenceStatus: null,
  evidence: null,
  evidenceWhy: null,
  companyEvidence: [],
  derivedSignals: [],
  whyThisCompany: null,
  valueMechanism: null,
  keyConstraint: null,
  priority: "LOW",
  priorityWhy: "LOW priority.",
  reliability: { score: 2, meaning: "m", basis: "b" },
  marketIds: [],
  ...over,
});

const picked = (a: Opportunity) => {
  const r = rolesFor(a);
  return [
    r.businessOwner.recommended.role,
    r.deliveryOwner.recommended.role,
    r.governanceOwner.recommended.role,
  ];
};

// -------------------------------------------------- PART 18: the test matrix

const MATRIX: [string, Opportunity][] = [
  [
    "data-heavy",
    area({
      label: "Data Analysis & BI Copilot",
      category: "Data",
      marketIds: ["rag_enterprise_search"],
      riskTier: "medium",
      reliabilityRequirement: 4,
    }),
  ],
  [
    "customer service",
    area({
      label: "Customer Service Agent",
      category: "Customer",
      riskTier: "high",
      reliabilityRequirement: 4,
      autonomyDefault: "supervised_agent",
      regulatoryFlags: ["GDPR", "CCPA"],
      marketIds: ["agent_platform"],
    }),
  ],
  [
    "fraud",
    area({
      label: "Transaction Fraud Detection",
      category: "Financial Services",
      riskTier: "critical",
      reliabilityRequirement: 5,
      autonomyDefault: "supervised_agent",
      regulatoryFlags: ["PCI_DSS", "FINRA"],
      marketIds: ["agent_platform"],
    }),
  ],
  [
    "supply chain",
    area({
      label: "Supplier Risk & Resilience Monitoring",
      category: "Supply Chain",
      riskTier: "medium",
      reliabilityRequirement: 4,
      marketIds: ["agent_platform"],
    }),
  ],
  [
    "high regulation",
    area({
      label: "Policy & Compliance Q&A",
      category: "Legal",
      riskTier: "high",
      reliabilityRequirement: 5,
      regulatoryFlags: ["EU_AI_Act", "GDPR", "SOX"],
      marketIds: ["rag_enterprise_search"],
    }),
  ],
  [
    "low risk",
    area({
      label: "Meeting Notes & Action Tracker",
      category: "Productivity",
      riskTier: "low",
      reliabilityRequirement: 2,
      marketIds: [],
    }),
  ],
];

describe("the role test matrix", () => {
  it("gives every workflow three distinct default owners", () => {
    for (const [name, a] of MATRIX) {
      const three = picked(a);
      expect(new Set(three).size, `${name} collapsed onto ${three.join(" / ")}`).toBe(3);
    }
  });

  it("names nobody outside the Model Engine role library", () => {
    for (const [name, a] of MATRIX) {
      const r = rolesFor(a);
      for (const col of Object.values(r)) {
        for (const c of [col.recommended, ...col.alternatives]) {
          expect(LIBRARY.has(c.role), `${name}: ${c.role} is not in roles.json`).toBe(true);
        }
      }
    }
  });

  it("checks against a library that actually loaded", () => {
    expect(LIBRARY.size).toBeGreaterThan(200);
  });

  it("gives unlike workflows unlike profiles", () => {
    const keys = MATRIX.map(([, a]) => picked(a).join("|"));
    expect(new Set(keys).size).toBeGreaterThan(3);
  });

  it("still escalates governance with risk", () => {
    const at = (riskTier: Opportunity["riskTier"]) =>
      rolesFor(area({ riskTier })).governanceOwner.recommended.role;
    expect(at("low")).toBe("Compliance Officer");
    expect(at("medium")).toBe("AI Governance Lead");
    expect(at("high")).toBe("Chief Risk Officer");
    expect(at("critical")).toBe("Chief Risk Officer");
  });

  it("still routes the named regime to its own owner", () => {
    const r = rolesFor(area({ regulatoryFlags: ["PCI_DSS"], riskTier: "critical" }));
    const gov = [
      r.governanceOwner.recommended.role,
      ...r.governanceOwner.alternatives.map((x) => x.role),
    ];
    expect(gov).toContain("Chief Information Security Officer");
    expect(gov).toContain("Chief Risk Officer");
  });
});

// ------------------------------------------ PART 13/14: how the pick is made

describe("distinctness is achieved by assignment, not by deletion", () => {
  it("hands the business column its best candidate first", () => {
    // A data workflow's outcome belongs with the CDO. Handing it to the COO
    // because delivery took the CDO first would be the worse answer.
    const r = rolesFor(area({ category: "Data", marketIds: ["rag_enterprise_search"] }));
    expect(r.businessOwner.recommended.role).toBe("Chief Data Officer");
    expect(r.deliveryOwner.recommended.role).not.toBe("Chief Data Officer");
  });

  it("gives the displaced column its own next-best rather than nothing", () => {
    const r = rolesFor(area({ category: "Data", marketIds: ["rag_enterprise_search"] }));
    // Not a blank, not a fabrication: the next role that column actually ranked.
    expect(r.deliveryOwner.recommended.role).toBe("Chief Information Officer");
    expect(r.deliveryOwner.recommended.why.length).toBeGreaterThan(20);
  });

  it("keeps a taken role available as an alternative elsewhere", () => {
    // PART 17. The reader may know their organisation combines the two, and
    // deduplication governs the RECOMMENDATION, never the reader's choice.
    const r = rolesFor(area({ category: "Data", marketIds: ["rag_enterprise_search"] }));
    const deliveryOptions = [
      r.deliveryOwner.recommended.role,
      ...r.deliveryOwner.alternatives.map((x) => x.role),
    ];
    expect(deliveryOptions).toContain("Chief Data Officer");
  });

  it("is deterministic", () => {
    const a = area({ category: "Data", riskTier: "high", regulatoryFlags: ["GDPR"] });
    expect(JSON.stringify(rolesFor(a))).toBe(JSON.stringify(rolesFor(a)));
  });

  it("produces nothing outside the declared archetype set", () => {
    const declared = new Set(allArchetypes());
    for (const [, a] of MATRIX) {
      for (const col of Object.values(rolesFor(a))) {
        for (const c of [col.recommended, ...col.alternatives]) {
          expect(declared.has(c.role), `${c.role} produced but not declared`).toBe(true);
        }
      }
    }
  });
});

// --------------------------------- roles must not leak the classification

describe("ownership does not depend on how well evidenced the area is", () => {
  it("gives the same three owners whatever the classification", () => {
    // A role recommendation that changed with the badge would imply the area is
    // better founded than it is. Roles come from the WORKFLOW: its category,
    // its regulator, its risk and its assurance bar.
    const base = area({ category: "Customer", riskTier: "high", regulatoryFlags: ["GDPR"] });
    const asSector = picked({ ...base, basis: "sector" });
    const asDerived = picked({ ...base, basis: "derived", whyThisCompany: "because" });
    const asEvidenced = picked({ ...base, basis: "evidenced", evidenceStatus: "deployed" });
    expect(asDerived).toEqual(asSector);
    expect(asEvidenced).toEqual(asSector);
  });
});

// ---------------------------------------------- through the real pipeline

describe("through a real position", () => {
  const p: SavedPosition = {
    key: "co", query: "Co", name: "Co", what: "a company", industry: "x",
    sectorTag: "retail_consumer",
    aiFindings: ["The retailer runs a large contact centre handling customer enquiries."],
    findings: [],
    recommendations: [],
    evidence: {
      sources: [{ url: "https://www.reuters.com/x", evidenceType: "primary_reporting" }],
      statements: [
        { text: "The retailer runs a large contact centre handling customer enquiries.", sourceIndex: 0 },
      ],
      financials: [],
    },
    savedAt: "2026-08-30",
  };

  it("gives every area on a live-shaped position three distinct owners", () => {
    const opp = opportunitiesFor(p)!;
    expect(opp.areas.length).toBeGreaterThan(0);
    for (const a of opp.areas) {
      const three = picked(a);
      expect(new Set(three).size, `${a.label} collapsed onto ${three.join(" / ")}`).toBe(3);
    }
  });
});

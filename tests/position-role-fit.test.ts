import { describe, it, expect } from "vitest";
import rolesJson from "@/lib/model-fit/data/roles.json";
import { allArchetypes, rolesFor, COLUMN_LABEL } from "@/lib/position/role-fit";
import type { Opportunity } from "@/lib/position/opportunities";

// Who would own an AI opportunity, and the one guarantee that matters.
//
// The product names a role archetype per column and preselects it. The risk is
// obvious: a plausible-sounding job title nobody in the library has, offered to
// a reader as though the product knew their organisation. So every archetype
// the module can ever produce is checked here against the Model Engine's own
// 297-role library, which is the same library ModelEngine ranks against.
//
// It is checked HERE rather than at the point of use because roles.json is
// 697 KB and, per ARCHITECTURE section 5, must not reach the browser, while
// role-fit.ts is client-reachable through the research runner. Holding the
// names in the module and proving them in the test keeps the guarantee without
// shipping the library.

const LIBRARY: string[] = Object.values(
  rolesJson as Record<string, { name: string }>
).map((r) => r.name);

const area = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: "x",
  label: "A workflow",
  category: "Operations",
  riskTier: "low",
  reliabilityRequirement: 3,
  autonomyDefault: "advisory_only",
  regulatoryFlags: [],
  basis: "sector",
  evidence: null,
  marketIds: [],
  ...over,
});

describe("every archetype is a role the library actually holds", () => {
  it("names nobody the Model Engine does not know", () => {
    const known = new Set(LIBRARY);
    const invented = allArchetypes().filter((r) => !known.has(r));
    expect(
      invented,
      `these archetypes are not in lib/model-fit/data/roles.json, so the product would be offering a job title it invented: ${invented.join(", ")}`
    ).toEqual([]);
  });

  it("checks against a library that actually loaded", () => {
    // Guards the guard: an empty library would make the check above vacuous.
    expect(LIBRARY.length).toBeGreaterThan(200);
    expect(LIBRARY).toContain("Chief Information Security Officer");
  });

  it("never produces a role outside the declared archetype set", () => {
    const declared = new Set(allArchetypes());
    const cases: Opportunity[] = [
      area(),
      area({ category: "Customer", riskTier: "low" }),
      area({ category: "Finance", riskTier: "critical", regulatoryFlags: ["SOX"] }),
      area({ category: "Data", marketIds: ["rag_enterprise_search"] }),
      area({ riskTier: "high", regulatoryFlags: ["EU_AI_Act", "GDPR"] }),
      area({ autonomyDefault: "supervised_agent", reliabilityRequirement: 5 }),
    ];
    for (const c of cases) {
      const r = rolesFor(c);
      for (const col of Object.values(r)) {
        for (const cand of [col.recommended, ...col.alternatives]) {
          expect(declared.has(cand.role), `${cand.role} is produced but not declared`).toBe(true);
        }
      }
    }
  });
});

describe("the three columns answer three different questions", () => {
  const fraud = rolesFor(
    area({
      label: "Transaction Fraud Detection",
      category: "Financial Services",
      riskTier: "critical",
      reliabilityRequirement: 5,
      autonomyDefault: "supervised_agent",
      regulatoryFlags: ["PCI_DSS", "FINRA"],
      marketIds: ["agent_platform"],
    })
  );
  const voice = rolesFor(
    area({
      label: "Voice of Customer Analysis",
      category: "Customer",
      riskTier: "low",
      reliabilityRequirement: 2,
      autonomyDefault: "advisory_only",
      regulatoryFlags: ["GDPR"],
      marketIds: ["rag_enterprise_search"],
    })
  );

  it("gives each column a distinct recommendation", () => {
    for (const r of [fraud, voice]) {
      const picked = [
        r.businessOwner.recommended.role,
        r.deliveryOwner.recommended.role,
        r.governanceOwner.recommended.role,
      ];
      expect(new Set(picked).size, `columns collapsed onto ${picked.join(" / ")}`).toBe(3);
    }
  });

  // THE REQUIREMENT THIS FEATURE EXISTS FOR. Two workflows that are both "AI"
  // must not receive the same ownership profile.
  it("does not hand two unlike workflows the same profile", () => {
    const asKey = (r: ReturnType<typeof rolesFor>) =>
      [
        r.businessOwner.recommended.role,
        r.deliveryOwner.recommended.role,
        r.governanceOwner.recommended.role,
      ].join("|");
    expect(asKey(fraud)).not.toBe(asKey(voice));
  });

  it("puts fraud detection under a security or risk owner, not general compliance", () => {
    expect(["Chief Information Security Officer", "Chief Risk Officer"]).toContain(
      fraud.governanceOwner.recommended.role
    );
    expect(fraud.governanceOwner.recommended.role).not.toBe("Compliance Officer");
  });

  it("puts a low-risk personal-data workflow under privacy, not enterprise risk", () => {
    expect(voice.governanceOwner.recommended.role).toBe("Privacy Counsel");
  });

  it("routes business accountability by what the work is for", () => {
    expect(fraud.businessOwner.recommended.role).toBe("Chief Financial Officer");
    expect(voice.businessOwner.recommended.role).toBe("Customer Operations Director");
  });
});

describe("risk influences the governance column", () => {
  const at = (riskTier: Opportunity["riskTier"]) =>
    rolesFor(area({ riskTier })).governanceOwner;

  it("escalates as the stakes rise", () => {
    expect(at("low").recommended.role).toBe("Compliance Officer");
    expect(at("medium").recommended.role).toBe("AI Governance Lead");
    expect(at("high").recommended.role).toBe("Chief Risk Officer");
    expect(at("critical").recommended.role).toBe("Chief Risk Officer");
  });

  it("keeps the named regime's owner when risk escalates, rather than replacing it", () => {
    // A critical workflow under PCI DSS still has a security control owner.
    // Escalation adds the enterprise risk owner, it does not displace the
    // regime the workflow is actually bound by.
    const r = rolesFor(area({ riskTier: "critical", regulatoryFlags: ["PCI_DSS"] }));
    const all = [r.governanceOwner.recommended.role, ...r.governanceOwner.alternatives.map((a) => a.role)];
    expect(all).toContain("Chief Information Security Officer");
    expect(all).toContain("Chief Risk Officer");
  });

  it("treats an unsupervised workflow as a control question whatever its tier", () => {
    const r = rolesFor(area({ riskTier: "low", autonomyDefault: "supervised_agent" }));
    const all = [r.governanceOwner.recommended.role, ...r.governanceOwner.alternatives.map((a) => a.role)];
    expect(all).toContain("Operational Risk Manager");
  });
});

describe("what it does when the evidence is thin", () => {
  it("prefers a broad defensible role over inventing specificity", () => {
    const r = rolesFor(area({ category: "Something Uncatalogued" }));
    expect(r.businessOwner.recommended.role).toBe("Chief Operating Officer");
    expect(r.deliveryOwner.recommended.role).toBe("Chief Information Officer");
    expect(r.governanceOwner.recommended.role).toBe("Compliance Officer");
  });

  it("always offers the broad role as an override even when a specialist wins", () => {
    const r = rolesFor(area({ category: "Finance", regulatoryFlags: ["SOX"] }));
    const gov = [r.governanceOwner.recommended.role, ...r.governanceOwner.alternatives.map((a) => a.role)];
    expect(gov).toContain("Compliance Officer");
  });

  it("gives every recommendation a reason in the reader's language", () => {
    const r = rolesFor(area({ riskTier: "high", regulatoryFlags: ["GDPR"] }));
    for (const col of Object.values(r)) {
      expect(col.recommended.why.length).toBeGreaterThan(25);
      // No taxonomy identifiers leaked into prose.
      expect(col.recommended.why).not.toMatch(/[A-Z]{2,}_[A-Z]/);
    }
  });

  it("is deterministic", () => {
    const a = area({ category: "Customer", riskTier: "high", regulatoryFlags: ["GDPR"] });
    expect(JSON.stringify(rolesFor(a))).toBe(JSON.stringify(rolesFor(a)));
  });

  it("labels the three columns for a reader", () => {
    expect(COLUMN_LABEL.businessOwner).toBe("Business owner");
    expect(COLUMN_LABEL.deliveryOwner).toBe("Technology / delivery");
    expect(COLUMN_LABEL.governanceOwner).toBe("Governance / control");
  });
});

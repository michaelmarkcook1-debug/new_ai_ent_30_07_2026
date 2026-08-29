import type { Opportunity } from "./opportunities";

// Who would own an AI opportunity, if this company took it forward.
//
// THREE OWNERS, BECAUSE THAT IS HOW ONE OF THESE ACTUALLY GETS DONE. A
// workflow needs someone accountable for the outcome, someone accountable for
// building and running it, and someone accountable for challenging it. Naming
// only the first produces a business case nobody can implement; naming only the
// second produces a project with no sponsor and no brake.
//
// ROLE ARCHETYPES, NEVER PEOPLE, AND NEVER AN ORG CHART. This product knows
// what the workflow is, what it is regulated by and how much damage it can do.
// It does not know how this company is organised, whether it has a Chief Data
// Officer, or who reports to whom. So the output is the archetype that would
// own this KIND of work, offered as a starting point the reader overrides,
// and the wording throughout is "the role that would own this" rather than
// "your Chief Risk Officer".
//
// EVERY NAME HERE EXISTS IN THE MODEL ENGINE'S ROLE LIBRARY. That is not a
// convention, it is asserted: tests/position-role-fit.test.ts reads the 297
// roles in lib/model-fit/data/roles.json and fails if any archetype below is
// not one of them. The library itself is 697 KB and, per ARCHITECTURE section
// 5, must never reach the browser, and this module is client-reachable through
// the research runner. So the names are held here and their existence is
// checked there, which keeps the guarantee without shipping the library.
//
// DETERMINISTIC. No model call. The inputs are the workflow's own category,
// regulatory flags, risk tier and reliability requirement, all of which the
// catalogue already carries.

/** Which of the three questions a column answers. */
export type RoleColumn = "businessOwner" | "deliveryOwner" | "governanceOwner";

export interface RoleCandidate {
  /** The archetype, exactly as the role library names it. */
  role: string;
  /** Why it is ranked where it is, in the reader's language. */
  why: string;
}

export interface ColumnFit {
  /** Highest ranked. Preselected, and overridable. */
  recommended: RoleCandidate;
  /** The rest of the ranking, offered in the dropdown. */
  alternatives: RoleCandidate[];
}

export type OpportunityRoles = Record<RoleColumn, ColumnFit>;

export const COLUMN_LABEL: Readonly<Record<RoleColumn, string>> = {
  businessOwner: "Business owner",
  deliveryOwner: "Technology / delivery",
  governanceOwner: "Governance / control",
};

export const COLUMN_TOOLTIP: Readonly<Record<RoleColumn, string>> = {
  businessOwner:
    "The role accountable for the outcome this workflow is supposed to produce. Ranked from the workflow's business category.",
  deliveryOwner:
    "The role accountable for building the capability and running it afterwards. Ranked from what the workflow is technically made of.",
  governanceOwner:
    "The role accountable for challenging it. Ranked from what regulates this workflow and how much damage it can do, so a critical workflow does not get the same answer as a low-risk one.",
};

// ------------------------------------------------------------------ scoring
//
// A candidate is a role and the reason it applies. Scores are only used to
// order the column, never shown: a number beside a role would read as a
// confidence this cannot support.

interface Scored extends RoleCandidate {
  score: number;
}

const add = (into: Map<string, Scored>, role: string, score: number, why: string) => {
  const held = into.get(role);
  // The strongest reason wins the explanation, not the last one to arrive.
  if (!held || score > held.score) into.set(role, { role, score, why });
};

const rank = (m: Map<string, Scored>, fallback: RoleCandidate): ColumnFit => {
  const ordered = [...m.values()].sort(
    (a, b) => b.score - a.score || a.role.localeCompare(b.role)
  );
  if (ordered.length === 0) return { recommended: fallback, alternatives: [] };
  const [top, ...rest] = ordered;
  // The broader fallback stays available even when something scored, because a
  // reader who disagrees with a specialist pick needs the general one to hand.
  const alternatives = rest.map(({ role, why }) => ({ role, why }));
  if (!ordered.some((x) => x.role === fallback.role)) alternatives.push(fallback);
  return { recommended: { role: top.role, why: top.why }, alternatives };
};

// -------------------------------------------------------- business owner
//
// Keyed on the workflow's own category, which is the catalogue's statement of
// what kind of work this is. Where a category has no distinct owner the COO
// stands in, which is the defensible broad answer rather than a guess at a
// specialist this company may not employ.

const BUSINESS_BY_CATEGORY: Record<string, string[]> = {
  Customer: ["Customer Operations Director", "Chief Commercial Officer"],
  Revenue: ["Chief Commercial Officer"],
  Marketing: ["Chief Marketing Officer", "Chief Commercial Officer"],
  Finance: ["Chief Financial Officer"],
  "Financial Services": ["Chief Financial Officer", "Chief Risk Officer"],
  Procurement: ["Chief Procurement Officer"],
  "Supply Chain": ["Chief Supply Chain Officer", "Chief Operating Officer"],
  HR: ["Chief Human Resources Officer"],
  Legal: ["General Counsel"],
  Risk: ["Chief Risk Officer"],
  Security: ["Chief Information Security Officer"],
  Engineering: ["Chief Technology Officer", "Chief Operating Officer"],
  IT: ["Chief Information Officer"],
  Data: ["Chief Data Officer"],
  Operations: ["Chief Operating Officer"],
  Manufacturing: ["Chief Operating Officer", "Chief Supply Chain Officer"],
  Health: ["Chief Operating Officer"],
  "Public Sector": ["Chief Operating Officer"],
  Education: ["Chief Operating Officer"],
  Productivity: ["Chief Operating Officer", "Chief Human Resources Officer"],
};

/** The broad answer, used where nothing more specific is supportable. */
const BUSINESS_FALLBACK: RoleCandidate = {
  role: "Chief Operating Officer",
  why: "The catalogue does not place this workflow in a function with a distinct owner, so the broad operational accountability applies.",
};

// ------------------------------------------------------- delivery owner
//
// What the thing is made of, rather than what it is for. A workflow whose
// markets are data and model platforms is a data build; one that sits inside
// enterprise applications is an IT build. Where neither is clear the CIO is the
// broad answer.

const DELIVERY_FALLBACK: RoleCandidate = {
  role: "Chief Information Officer",
  why: "Nothing in the workflow points at a specialist build owner, so the broad technology accountability applies.",
};

// ---------------------------------------------------- governance owner
//
// THE COLUMN THAT MUST NOT BE THE SAME EVERY TIME. What governs a workflow is
// what it is regulated by and how much damage it can do, and those differ
// sharply between two workflows that are both "AI". Transaction fraud
// detection carries payment and market-conduct obligations and can decline a
// legitimate customer; a meeting summariser carries none and cannot.
//
// Flags are the primary signal because they are a fact about the workflow.
// Risk tier escalates rather than selects: it raises the enterprise risk owner
// as the stakes rise, without displacing the specialist the regulation names.

const FLAG_GOVERNANCE: Record<string, { role: string; why: string }> = {
  PCI_DSS: {
    role: "Chief Information Security Officer",
    why: "PCI DSS applies, which is a security control regime before it is a policy one.",
  },
  ISO_27001: {
    role: "Chief Information Security Officer",
    why: "ISO 27001 applies, so the control owner is the security function.",
  },
  SOC2: {
    role: "Chief Information Security Officer",
    why: "SOC 2 applies, so the control owner is the security function.",
  },
  GDPR: {
    role: "Privacy Counsel",
    why: "GDPR applies, so personal data handling is the binding constraint.",
  },
  CCPA: {
    role: "Privacy Counsel",
    why: "CCPA applies, so personal data handling is the binding constraint.",
  },
  HIPAA: {
    role: "Privacy Counsel",
    why: "HIPAA applies, so protected health information governs the design.",
  },
  SOX: {
    role: "Chief Audit Executive",
    why: "SOX applies, so this sits inside the financial reporting control environment.",
  },
  FINRA: {
    role: "Chief Risk Officer",
    why: "FINRA applies, so market conduct obligations attach to the outcome.",
  },
  MiFID_II: {
    role: "Chief Risk Officer",
    why: "MiFID II applies, so market conduct obligations attach to the outcome.",
  },
  BASEL_III: {
    role: "Chief Risk Officer",
    why: "Basel III applies, so this falls under the prudential risk framework.",
  },
  EU_AI_Act: {
    role: "AI Governance Lead",
    why: "The EU AI Act applies, which regulates the system itself rather than only its data.",
  },
  FDA_21CFR11: {
    role: "Compliance Officer",
    why: "FDA 21 CFR Part 11 applies, so validated-systems compliance governs it.",
  },
  FERPA: {
    role: "Privacy Counsel",
    why: "FERPA applies, so student record handling is the binding constraint.",
  },
};

/** The broad answer where nothing specific is named. */
const GOVERNANCE_FALLBACK: RoleCandidate = {
  role: "Compliance Officer",
  why: "No specific regime is flagged against this workflow and its risk tier is not elevated, so general compliance oversight is the defensible answer.",
};

/**
 * The three owners this workflow implies, ranked.
 *
 * Pure and deterministic: the same opportunity always produces the same
 * ranking, which is what lets the recommendation be tested rather than
 * inspected.
 */
export function rolesFor(a: Opportunity): OpportunityRoles {
  // ---- business
  const business = new Map<string, Scored>();
  for (const [i, role] of (BUSINESS_BY_CATEGORY[a.category] ?? []).entries()) {
    add(business, role, 100 - i * 10, `${a.category} work, so accountability sits with this function.`);
  }

  // ---- delivery
  const delivery = new Map<string, Scored>();
  const markets = a.marketIds.join(" ").toLowerCase();
  if (/data|analytic|rag|search/.test(markets) || a.category === "Data") {
    add(delivery, "Chief Data Officer", 100, "The build is a data and retrieval problem before it is an application one.");
  }
  if (/agent|automation|workflow/.test(markets)) {
    add(delivery, "Chief Information Officer", 90, "It runs as automation inside existing systems, so the operating owner builds it.");
  }
  if (/frontier|model|coding|developer/.test(markets) || a.category === "Engineering") {
    add(delivery, "Chief Technology Officer", 85, "It is built against model and developer platforms rather than configured in an application.");
  }
  if (a.category === "IT") {
    add(delivery, "Chief Information Officer", 95, "It is IT work, so the build and the run sit in the same place.");
  }
  // A workflow allowed to act without a human needs the function that owns
  // production operations, whatever it is made of.
  if (a.autonomyDefault === "supervised_agent" || a.reliabilityRequirement >= 4) {
    add(delivery, "Chief Information Officer", 92, "It is trusted to act with little supervision, so whoever runs production has to own it.");
  }
  if (/silicon|compute|cloud|neocloud|infrastructure/.test(markets)) {
    add(delivery, "Chief Technology Officer", 80, "It depends on infrastructure choices rather than on an application configuration.");
  }

  // ---- governance
  const governance = new Map<string, Scored>();
  for (const flag of a.regulatoryFlags) {
    const g = FLAG_GOVERNANCE[flag];
    if (g) add(governance, g.role, 100, g.why);
  }
  // Risk escalates. It does not displace a named regime: a critical workflow
  // under PCI DSS still has a security control owner, and now also has the
  // enterprise risk owner in the list above the general one.
  if (a.riskTier === "critical") {
    add(governance, "Chief Risk Officer", 95, "The workflow is rated critical risk, so enterprise risk ownership applies whatever else governs it.");
    add(governance, "AI Governance Lead", 70, "A critical-risk model decision needs a named owner for the model itself.");
  } else if (a.riskTier === "high") {
    add(governance, "Chief Risk Officer", 80, "The workflow is rated high risk, so enterprise risk ownership applies.");
    add(governance, "AI Governance Lead", 65, "A high-risk model decision needs a named owner for the model itself.");
  } else if (a.riskTier === "medium") {
    add(governance, "AI Governance Lead", 60, "Medium risk, so the model itself needs an owner even where no regime is flagged.");
  }
  // Something allowed to act unsupervised is a control question regardless of
  // its tier, because the control is the supervision that is not there.
  if (a.autonomyDefault === "supervised_agent") {
    add(governance, "Operational Risk Manager", 55, "It is allowed to act with limited supervision, so the operational control has to be designed rather than assumed.");
  }

  return {
    businessOwner: rank(business, BUSINESS_FALLBACK),
    deliveryOwner: rank(delivery, DELIVERY_FALLBACK),
    governanceOwner: rank(governance, GOVERNANCE_FALLBACK),
  };
}

/** Every archetype this module can ever name, for the library check. */
export function allArchetypes(): string[] {
  const out = new Set<string>([
    BUSINESS_FALLBACK.role,
    DELIVERY_FALLBACK.role,
    GOVERNANCE_FALLBACK.role,
    "Chief Data Officer",
    "Chief Information Officer",
    "Chief Technology Officer",
    "Chief Risk Officer",
    "AI Governance Lead",
    "Operational Risk Manager",
  ]);
  for (const list of Object.values(BUSINESS_BY_CATEGORY)) for (const r of list) out.add(r);
  for (const g of Object.values(FLAG_GOVERNANCE)) out.add(g.role);
  return [...out].sort();
}

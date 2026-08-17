import type { BrProvider } from "@/app/(ai-ent)/ecosystem-navigator/types";

// Which providers in the BoardRadar catalogue actually deliver AI programmes.
//
// THE PROBLEM. The catalogue holds 66 providers across 20 segments, and the
// delivery-layer panel offered all of them. Its own heading says "the
// integrators who would deliver your AI programme", and the list included ADP
// (payroll), Broadridge (financial technology), Amdocs (telecom billing) and
// Dell (enterprise infrastructure). None of those integrates AI for anybody.
//
// It showed on the data as well as in the copy. Picking Broadridge, Amdocs,
// Dell, NICE or Concentrix returned zero platform rows, so the reader chose a
// provider and got an empty panel with no explanation.
//
// THE RULE. `sector`, not `segment`. Segment has 20 values and splits hairs
// ("Digital Engineering Services" against "Cloud & Digital Engineering");
// sector has five and draws the line the buyer cares about:
//
//   global-si          43   Systems integrators. Accenture, TCS, Infosys,
//                           Capgemini, Cognizant, Wipro, HCLTech, EPAM.
//   consulting          7   Big-4 and consultancies with delivery practices.
//                           Deloitte, EY, KPMG, PwC, Caylent, Searce, Synechron.
//   contact-center     12   CX and BPO. They run contact centres and deploy AI
//                           inside them; they do not integrate AI across an
//                           enterprise estate, and the matrix has no platform
//                           data for them.
//   data-ai-platform    3   Dell, EXL, phData. A mix of infrastructure and
//                           analytics BPO rather than a delivery practice.
//   saas                1   ADP. A payroll platform.
//
// So global-si and consulting, 50 of the 66.
//
// WHY THIS MATCHES THE MARKET rather than only the data. Researched 17 August
// 2026: the recognised enterprise-AI integrator set is consistently described
// as global IT services (Accenture, Capgemini, IBM Consulting, Infosys, TCS,
// Cognizant, Wipro), the Big-4 advisory practices (Deloitte, EY, KPMG, PwC),
// the strategy houses (McKinsey QuantumBlack, BCG X, Bain Vector) and digital
// engineering specialists (EPAM, Thoughtworks, Persistent). That is exactly
// global-si plus consulting.
//
// The excluded sixteen are not judged to be poor. They are judged to be
// answering a different question, and the panel says so rather than dropping
// them silently.

/** The sectors whose providers deliver AI programmes for an enterprise. */
export const INTEGRATOR_SECTORS = ["global-si", "consulting"] as const;

// Sector alone is not enough: the catalogue over-assigns `global-si`. Three
// providers carry it whose own segment says otherwise, so the segment is
// checked too.
//
//   Financial Technology Services   Broadridge. A fintech product company. It
//                                   sells mission-critical infrastructure, it
//                                   does not integrate AI into your estate.
//   Enterprise BPO                  Capita. An outsourcer, and the matrix
//                                   returns nothing for it.
//
// Telecom IT Services is deliberately NOT excluded. Amdocs integrates for
// communications providers, which is vertical but real, and the matrix answers
// for it with fifteen platform rows. Excluding it would have been me trusting a
// first reading over the data: an earlier probe reported Amdocs and Broadridge
// at zero rows and both were wrong, at 15 and 4.
const NOT_INTEGRATION_SEGMENTS = new Set([
  "Financial Technology Services",
  "Enterprise BPO",
]);

export function isIntegrator(p: Pick<BrProvider, "sector" | "segment">): boolean {
  if (NOT_INTEGRATION_SEGMENTS.has(p.segment ?? "")) return false;
  return INTEGRATOR_SECTORS.includes(
    (p.sector ?? "") as (typeof INTEGRATOR_SECTORS)[number]
  );
}

/**
 * What the panel says about the ones it left out.
 *
 * Named rather than silently dropped, on the same rule the shortlist follows:
 * a list that quietly gets shorter is a decision made on the reader's behalf.
 */
export function excludedNote(total: number, shown: number): string | null {
  const dropped = total - shown;
  if (dropped <= 0) return null;
  return `${dropped} of the ${total} providers in the catalogue are not shown: contact-centre and BPO operators, a fintech product company, an infrastructure vendor and a payroll platform. They deliver AI inside their own service or sell it as a product, which is a different question from integrating it across your estate.`;
}

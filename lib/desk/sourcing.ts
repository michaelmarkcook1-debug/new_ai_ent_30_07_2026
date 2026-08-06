// The guided sourcing engine. Pure and deterministic.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/decide.ts, commit b9bb51c),
// read-only and unmodified at source.
//
// WHAT IT RANKS ON, AND WHAT IT REFUSES TO. This ranks vendors on the verified
// Privacy & IP Shield under the buyer's own weights, and on nothing else. It
// never invents a capability-fit score, because there is no honest one to
// invent: public benchmarks are gamed and rarely resemble a particular
// workload. That gap is stated on screen and answered by the pilot in
// ./pilot.ts, which is a method the buyer runs on their own data.
//
// TWO DELIBERATE DIFFERENCES FROM THE SOURCE.
//
//   No peer-adoption tiebreak. The Desk breaks ties on how many firms in your
//   industry have publicly disclosed adopting a vendor. This repository has no
//   server-side disclosed-adoption set to join on, and inventing that join
//   would put a number on a board pack that nothing supports. Peer adoption is
//   a real lens and it lives on Peer Insights, pulled live for the slice the
//   reader picks. Ties here break alphabetically, which is boring and
//   un-gameable.
//
//   The use-case list is The Desk's own. It is used to select the capability
//   probes in ./pilot.ts, which are keyed to it. This repository's 75-workflow
//   library (`lib/aie/use-cases.ts`) is larger and better tagged, and is the
//   taxonomy of record for Workflow Shortlist; the two are kept apart rather
//   than half-merged into a vocabulary that matches neither.

import {
  SHIELD,
  SHIELD_DIM_INFO,
  type MarkState,
  type ShieldDim,
  type ShieldWeights,
  type VendorShield,
} from "@/lib/shield/data";

export const SOURCING_VERSION = "2026-08-06";

// Cross-industry: the horizontal jobs almost every enterprise runs. A
// taxonomy, not a measurement. Naming one claims nothing about any vendor's
// ability to do it.
export const USE_CASES = [
  "Customer support automation",
  "Coding & developer tooling",
  "Knowledge & document search (RAG)",
  "Data analysis & reporting",
  "Agents & workflow automation",
  "Content generation & marketing",
  "Document processing & extraction",
  "Translation & localization",
  "Sales & CRM automation",
  "Fraud & risk detection",
  "Voice & transcription",
  "Legal & contract review",
  "HR & recruiting",
] as const;
export type UseCase = (typeof USE_CASES)[number];

export type { ShieldDim, ShieldWeights };
export const DIMS = SHIELD_DIM_INFO;

const MARK_VALUE: Record<MarkState, number> = {
  protective: 1,
  conditional: 0.5,
  adverse: 0,
  unverified: 0,
};

// The argue-with-it filters. A buyer who says "must not train on our data"
// should be able to make the tool prove it, and a vendor that drops out must
// say which requirement dropped it. A silent filter is indistinguishable from
// a bug.
export type Constraint =
  | "require_no_train"
  | "require_indemnity"
  | "require_residency"
  | "exclude_open_weights"
  | "open_weights_only";

export const CONSTRAINTS: { key: Constraint; label: string; blurb: string }[] =
  [
    {
      key: "require_no_train",
      label: "Must not train on our data",
      blurb: "Only vendors whose own terms make this protective, not opt-out.",
    },
    {
      key: "require_indemnity",
      label: "Must offer output indemnity",
      blurb: "Drops explicit refusals and anything we could not verify.",
    },
    {
      key: "require_residency",
      label: "Must commit to data residency",
      blurb: "Only a verified residency commitment counts.",
    },
    {
      key: "exclude_open_weights",
      label: "Hosted API only",
      blurb: "Rules out weights you would host yourself.",
    },
    {
      key: "open_weights_only",
      label: "Self-hosted / open weights only",
      blurb: "Rules out every hosted API.",
    },
  ];

export interface Ranked {
  vendor: VendorShield;
  /** Under the buyer's weights. */
  weightedScore: number;
  /** The total achievable under those same weights. */
  maxScore: number;
  passes: boolean;
  /** Why a constraint dropped it. Always set when `passes` is false. */
  failReason?: string;
}

function passesConstraints(
  v: VendorShield,
  cons: Constraint[]
): { ok: boolean; why?: string } {
  for (const c of cons) {
    if (c === "require_no_train" && v.marks.training.state !== "protective")
      return {
        ok: false,
        why: "training on customer data is not verified protective",
      };
    if (c === "require_indemnity" && v.marks.indemnity.state === "adverse")
      return { ok: false, why: "no output indemnity, explicitly excluded" };
    if (c === "require_indemnity" && v.marks.indemnity.state === "unverified")
      return { ok: false, why: "output indemnity not verified" };
    if (c === "require_residency" && v.marks.residency.state !== "protective")
      return { ok: false, why: "residency commitment not verified" };
    if (c === "exclude_open_weights" && v.kind === "open-weights")
      return { ok: false, why: "open weights, not a hosted API" };
    if (c === "open_weights_only" && v.kind !== "open-weights")
      return { ok: false, why: "hosted API, not self-hostable" };
  }
  return { ok: true };
}

/** Passing vendors first, then by weighted score, then alphabetically. */
export function rankVendors(
  weights: ShieldWeights,
  constraints: Constraint[]
): Ranked[] {
  const maxScore =
    weights.training + weights.retention + weights.indemnity + weights.residency;
  const rows: Ranked[] = SHIELD.map((v) => {
    const m = v.marks;
    const weightedScore =
      weights.training * MARK_VALUE[m.training.state] +
      weights.retention * MARK_VALUE[m.retention.state] +
      weights.indemnity * MARK_VALUE[m.indemnity.state] +
      weights.residency * MARK_VALUE[m.residency.state];
    const con = passesConstraints(v, constraints);
    return {
      vendor: v,
      weightedScore: Math.round(weightedScore * 100) / 100,
      maxScore,
      passes: con.ok,
      failReason: con.why,
    };
  });
  return rows.sort((a, b) => {
    if (a.passes !== b.passes) return a.passes ? -1 : 1;
    if (Math.abs(b.weightedScore - a.weightedScore) > 1e-9)
      return b.weightedScore - a.weightedScore;
    return a.vendor.vendor.localeCompare(b.vendor.vendor);
  });
}

/** The priorities the buyer actually raised above the others, for prose.
 *
 *  Null when they did not raise any: at equal weights, naming the first two
 *  dimensions would tell a reader that those were prioritised when nothing was.
 *  A board pack that says "ranked on residency and indemnity" when the buyer
 *  weighted all four the same is a small lie in a document written to be
 *  trusted, so this returns null and callers say "weighted equally" instead. */
export function topPriorities(weights: ShieldWeights): string | null {
  const live = DIMS.filter((d) => weights[d.key] > 0);
  if (live.length === 0) return null;
  const top = Math.max(...live.map((d) => weights[d.key]));
  const raised = live.filter((d) => weights[d.key] === top);
  // Everything that is on is on at the same level: no priority was expressed.
  if (raised.length === live.length) return null;
  return raised
    .slice(0, 2)
    .map((d) => d.label.toLowerCase())
    .join(" and ");
}

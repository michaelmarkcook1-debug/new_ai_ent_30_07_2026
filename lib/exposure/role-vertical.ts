import { ROLES, RUBRIC } from "@/lib/model-fit";
import pilot from "@/data/role-verticals/customer-operations.json";

// What a sector does to the same job.
//
// The role library carries ONE profile per cross-industry role, which its own
// specification records as a known gap: a customer care agent in investment
// banking does harder work than one in retail and the shared profile cannot see
// it. This is the first evidence-backed attempt to close that gap, scoped to the
// six Customer Operations & Service roles as a pilot.
//
// THE DATASET IS DELTAS, NOT PROFILES. A vertical entry says "this requirement
// moves from 70 to 90, here is the rule that says so". A requirement with no
// entry reads at its base value. That shape is deliberate: it makes the absence
// of evidence visible instead of burying it inside a plausible-looking full
// profile, and it keeps the base library the single source of the unlensed
// score.
//
// EVERY DELTA CARRIES ITS OWN EVIDENCE CLASS, not one class for the role. The
// research script this pilot follows, scripts/research-missing-industries.py,
// makes the same distinction, and its rule is the one that matters here:
// "Never fill a field from general knowledge alone."
//
//   A  statute or regulator rule that states the requirement
//   B  professional body framework, or a rule the requirement follows from
//   D  job descriptions
//   E  reasoned judgement, and nothing else
//
// The confidence of a lensed reading is the WORST class among the deltas that
// moved it, on the same principle as the lane badging everywhere else in this
// product: a reading is only as good as its weakest input.

export type EvidenceClass = "A" | "B" | "D" | "E";

/** Class order, worst last. Used for worst-wins. */
const CLASS_RANK: Record<EvidenceClass, number> = { A: 0, B: 1, D: 2, E: 3 };

export interface Source {
  title: string;
  cite: string;
  url: string | null;
  class: EvidenceClass;
}

export interface Delta {
  from: number;
  to: number;
  class: EvidenceClass;
  source?: string;
  why: string;
}

interface PilotFile {
  meta: {
    pilot: string;
    researched: string;
    method: string;
    note: string;
    roles: string[];
    verticalsResearched: number;
    verticalsUnresearched: string[];
  };
  sources: Record<string, Source>;
  verticals: Record<
    string,
    {
      label: string;
      regime: string;
      /**
       * Present where the app's sector bucket is WIDER than the evidence. UK261
       * is passenger aviation and the bucket is all transport and logistics;
       * General Condition C4 binds communications providers and the bucket
       * includes media. Without this the lens would quietly over-claim for a
       * freight forwarder or a broadcaster.
       */
      scopeNote?: string;
      deltas: Record<string, Record<string, Delta>>;
    }
  >;
  crossCutting: Record<string, unknown>;
}

const DATA = pilot as unknown as PilotFile;

export const PILOT_META = DATA.meta;
export const PILOT_SOURCES = DATA.sources;
export const PILOT_CROSS_CUTTING = DATA.crossCutting;

export interface LensedRequirement {
  cap: string;
  /** Requirement name from the rubric, so the caller never has to hold CAP ids. */
  name: string;
  base: number;
  lensed: number;
  moved: boolean;
  class: EvidenceClass;
  why: string;
  source: Source | null;
}

export interface LensedRole {
  roleId: string;
  name: string;
  vertical: string;
  verticalLabel: string;
  regime: string;
  /** Set where the evidence is narrower than the sector bucket it is filed under. */
  scopeNote: string | null;
  /** Every requirement, base and lensed, in CAP order. */
  requirements: LensedRequirement[];
  /** Only those the sector actually moved. */
  movedRequirements: LensedRequirement[];
  /** Worst evidence class among the deltas that moved something. Null if none did. */
  confidence: EvidenceClass | null;
}

function baseScore(roleId: string, cap: string): number | null {
  const role = ROLES[roleId] as
    | { profile?: Record<string, { score?: number }> }
    | undefined;
  const s = role?.profile?.[cap]?.score;
  return typeof s === "number" ? s : null;
}

export function verticalsCovered(): string[] {
  return Object.keys(DATA.verticals);
}

export function pilotRoleIds(): string[] {
  return DATA.meta.roles;
}

/**
 * The role as this sector requires it.
 *
 * Returns null rather than a fallback when the pilot has not researched the
 * sector or does not cover the role. An unlensed profile presented as a sector
 * reading would look like a fact about banking and be a fact about everything,
 * which is the failure this whole dataset exists to avoid.
 */
export function lensRole(roleId: string, vertical: string): LensedRole | null {
  const v = DATA.verticals[vertical];
  if (!v) return null;
  const deltas = v.deltas[roleId];
  if (!deltas) return null;

  const role = ROLES[roleId] as { name?: string } | undefined;
  if (!role) return null;

  const requirements: LensedRequirement[] = [];
  for (const cap of Object.keys(RUBRIC)) {
    const base = baseScore(roleId, cap);
    if (base === null) continue;
    const d = deltas[cap];
    // A delta whose `to` equals its `from` is a deliberate record, not a no-op:
    // it marks a requirement the sector governs by a rule that recently changed,
    // where the band happens to stay put. Ofcom's move from eight weeks to six
    // is the case this exists for.
    const moved = d ? d.to !== d.from : false;
    requirements.push({
      cap,
      name: RUBRIC[cap]?.name ?? cap,
      base,
      lensed: d ? d.to : base,
      moved,
      class: d?.class ?? "D",
      why: d?.why ?? "",
      source: d?.source ? (DATA.sources[d.source] ?? null) : null,
    });
  }

  // Anything the dataset speaks to, whether or not the band shifted, so a
  // recorded rule change is never invisible just because the score held.
  const movedRequirements = requirements.filter((r) => deltas[r.cap]);

  let confidence: EvidenceClass | null = null;
  for (const r of movedRequirements) {
    if (confidence === null || CLASS_RANK[r.class] > CLASS_RANK[confidence]) {
      confidence = r.class;
    }
  }

  return {
    roleId,
    name: role.name ?? roleId,
    vertical,
    verticalLabel: v.label,
    regime: v.regime,
    scopeNote: v.scopeNote ?? null,
    requirements,
    movedRequirements,
    confidence,
  };
}

export interface DriftFinding {
  vertical: string;
  roleId: string;
  cap: string;
  recorded: number;
  actual: number | null;
}

/**
 * Every place the dataset disagrees with the role library about a base score.
 *
 * This is the guard that stops the pilot rotting. Each delta records the value
 * it was scored against; if the library is later re-scored, a `from` that no
 * longer matches means the delta was reasoned from a profile that no longer
 * exists and the research has to be redone rather than silently reapplied.
 */
export function baseDrift(): DriftFinding[] {
  const out: DriftFinding[] = [];
  for (const [vertical, v] of Object.entries(DATA.verticals)) {
    for (const [roleId, deltas] of Object.entries(v.deltas)) {
      for (const [cap, d] of Object.entries(deltas)) {
        const actual = baseScore(roleId, cap);
        if (actual !== d.from) {
          out.push({ vertical, roleId, cap, recorded: d.from, actual });
        }
      }
    }
  }
  return out;
}

/** Source ids referenced by a delta but absent from the source table. */
export function danglingSources(): string[] {
  const out = new Set<string>();
  for (const v of Object.values(DATA.verticals)) {
    for (const deltas of Object.values(v.deltas)) {
      for (const d of Object.values(deltas)) {
        if (d.source && !DATA.sources[d.source]) out.add(d.source);
      }
    }
  }
  return [...out];
}

export interface CoverageRow {
  vertical: string;
  label: string;
  rolesCovered: number;
  deltas: number;
  byClass: Record<EvidenceClass, number>;
}

/** What the pilot actually produced, for reporting rather than for the UI. */
export function coverage(): CoverageRow[] {
  return Object.entries(DATA.verticals).map(([vertical, v]) => {
    const byClass: Record<EvidenceClass, number> = { A: 0, B: 0, D: 0, E: 0 };
    let deltas = 0;
    for (const roleDeltas of Object.values(v.deltas)) {
      for (const d of Object.values(roleDeltas)) {
        deltas++;
        byClass[d.class]++;
      }
    }
    return {
      vertical,
      label: v.label,
      rolesCovered: Object.values(v.deltas).filter(
        (d) => Object.keys(d).length > 0
      ).length,
      deltas,
      byClass,
    };
  });
}

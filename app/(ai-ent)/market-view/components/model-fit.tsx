"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  ASSURANCE_REQ,
  AXES,
  CAPABILITY_NAMES,
  CAP_IDS,
  CROSS_INDUSTRY,
  DATA_REQ,
  INDUSTRIES,
  INDUSTRY_GROUPS,
  MODALITY,
  MODELS,
  RUBRIC,
  SOURCES,
  SPEC_FIELD,
  SPEC_NUMERIC,
  functionCounts,
  functionsFor,
  industryLabel,
  loadEngine,
  roleById,
  rolesFor,
  shortName,
} from "@/lib/model-fit";
import type {
  Assessment,
  DutyOutcome,
  Elimination,
  ModelRecord,
  Profile,
  RankedModel,
  Recommendation,
  RequirementEntry,
  Role,
} from "@/lib/model-fit";
import { PriceCapabilityChart } from "./model-fit-chart";

// Workforce Model Fit: pick an industry, a function and a role, and the engine
// returns the cheapest model meeting that role's requirements, with the
// reasoning and the cost visible.
//
// The engine is lib/model-fit/engine.ts, a port of the integration package's
// reference implementation and checked against it role by role. This file is
// only the interface, and its one job beyond showing the answer is to keep the
// distinction the product rests on visible: the model catalogue is measured,
// the role requirements are authored judgement, and every capability threshold
// is a stated assumption nobody has measured yet. Eleven of eighteen
// requirements have a named benchmark axis with no ingested data, and they
// report as unassessed rather than passing quietly.
//
// Every control here is deliberate. The calibration offset, the burn toggle,
// the usage tier, the headcount and the output ratio are the assumptions; a
// tool that hides them while pricing a workforce is asserting a precision it
// does not have.

// Per MONTH, not per year: the engine multiplies this volume by twelve to reach
// the annual figure. These labels said "a year" and understated every cost on
// the panel by a factor of twelve.
const USAGE_LABEL: Record<string, string> = {
  light: "Light — occasional use, 2M input tokens per person per month",
  moderate: "Moderate — used through the working day, 10M per person per month",
  heavy: "Heavy — continuous use, 40M per person per month",
};
const USAGE_TOKENS: Record<string, string> = {
  light: "2M",
  moderate: "10M",
  heavy: "40M",
};

const OUT_MULTIPLE_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Vendor's own published ratio" },
  { value: "2", label: "2× input price" },
  { value: "3", label: "3× input price" },
  { value: "4", label: "4× input price" },
  { value: "6", label: "6× input price" },
];

const selectClass =
  "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px] " +
  "disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-muted";

type EvidenceKind = "measured" | "judgement" | "assumption";

const EVIDENCE_STYLE: Record<EvidenceKind, string> = {
  measured: "bg-good-bg text-good border-good/30",
  judgement: "bg-aie-bg text-aie border-aie/30",
  assumption: "bg-warn-bg text-warn border-warn/30",
};

const EVIDENCE_TITLE: Record<EvidenceKind, string> = {
  measured:
    "Someone else's published measurement, used as published and attributed. Never blended into a figure of ours.",
  judgement:
    "Authored against the requirement rubric by an assessor. No SME panel has reviewed it.",
  assumption:
    "A stated assumption, not a measurement. Adjustable in the controls above, because that is what makes an uncalibrated tool honest.",
};

/** The rubric's evidence classes, in its own words. */
const EVIDENCE_CLASS_LABEL: Record<string, string> = {
  A: "Regulatory or statutory: the duty is defined in law, regulation or a mandatory standard",
  B: "Professional body: a competency framework from a chartered or professional institute",
  C: "Occupational survey: O*NET or equivalent incumbent-rated data",
  D: "Labour market: convergent evidence from multiple current job descriptions",
  E: "Reasoned judgement: assessor inference from the role definition, no external source",
};

function EvidenceChip({ kind, label }: { kind: EvidenceKind; label?: string }) {
  return (
    <span
      title={EVIDENCE_TITLE[kind]}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${EVIDENCE_STYLE[kind]}`}
    >
      {label ?? kind}
    </span>
  );
}

function usd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-GB")}`;
  return `$${v.toFixed(2)}`;
}

function Field({
  label,
  children,
  disabled = false,
  note,
}: {
  label: string;
  children: React.ReactNode;
  /** Greys the label alongside its control, so the pair reads as one dead thing. */
  disabled?: boolean;
  /** The shape of the choice being made: how many options, and of what kind. */
  note?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${disabled ? "opacity-45" : ""}`}>
      <span className="micro-label">{label}</span>
      {children}
      {note ? (
        <span className="font-mono text-[10px] leading-snug text-muted">{note}</span>
      ) : null}
    </label>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="border-t border-base-300 px-4 py-3 sm:border-l sm:border-t-0">
      <p className="micro-label">{label}</p>
      <p className="mt-1 text-[15px] font-bold leading-tight">{value}</p>
      <p className="measure mt-0.5 text-[10.5px] leading-snug text-muted">{detail}</p>
    </div>
  );
}

function CostBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded border border-base-300 bg-base-200/40 p-3">
      <p className="micro-label">{label}</p>
      <p className="mt-1 font-mono text-[19px] font-bold leading-none">{value}</p>
      <p className="measure mt-1.5 text-[10.5px] leading-snug text-muted">{detail}</p>
    </div>
  );
}

const OUTCOME_STYLE: Record<string, string> = {
  supported: "bg-good-bg text-good border-good/40",
  qualified: "bg-good-bg text-good border-good/40",
  "partially supported": "bg-warn-bg text-warn border-warn/40",
  "best available": "bg-warn-bg text-warn border-warn/40",
  "not supported": "bg-bad-bg text-error border-error/40",
  "cannot assess": "bg-base-200 text-muted border-base-300",
};

/**
 * The output before there is one.
 *
 * A greyed skeleton of the real panel rather than a line of text, so the shape
 * of the answer is visible before it exists and the page does not jump when it
 * arrives. It states which step is outstanding rather than just sitting inert.
 */
function WaitingForCompute({
  industry,
  fn,
  roleId,
}: {
  industry: string;
  fn: string;
  roleId: string;
}) {
  const steps: [string, boolean][] = [
    ["Industry", Boolean(industry)],
    ["Function", Boolean(fn)],
    ["Role", Boolean(roleId)],
  ];
  const outstanding = steps.find(([, done]) => !done)?.[0];
  return (
    <div
      aria-live="polite"
      className="mt-4 select-none rounded-lg border border-dashed border-base-300 bg-base-200/40 p-4 opacity-60"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-5 w-40 rounded bg-base-300/70" aria-hidden />
        <span className="h-4 w-24 rounded bg-base-300/50" aria-hidden />
      </div>
      <div className="mt-3 h-3 w-3/4 rounded bg-base-300/50" aria-hidden />
      <div className="mt-1.5 h-3 w-1/2 rounded bg-base-300/50" aria-hidden />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded border border-base-300/70 p-3">
            <div className="h-2.5 w-2/3 rounded bg-base-300/60" aria-hidden />
            <div className="mt-2 h-4 w-1/2 rounded bg-base-300/70" aria-hidden />
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] font-medium text-base-content/70">
        {outstanding
          ? `Choose ${outstanding === "Industry" ? "an" : "a"} ${outstanding.toLowerCase()} to continue.`
          : "Press Compute to work out the answer."}
      </p>
      <p className="measure mt-1 text-[11px] text-muted">
        Nothing is calculated until all three are chosen. The engine is not
        guessing at a role while you are still picking one.
      </p>
    </div>
  );
}

/**
 * Every assumption currently in force, written out and rewritten as the
 * controls move.
 *
 * The panel already carries an ASSUMPTION chip, but a chip only says that
 * assumptions exist. This says which ones, in the buyer's own terms, and
 * changes when they do — so the reader can see the moment a number stops
 * being an assumption they accepted and becomes one they chose.
 */
function assumptionNarration(opts: {
  role: Role;
  seats: number;
  seatsOverridden: boolean;
  usage: string;
  burn: boolean;
  outMultiple: string;
  offset: number;
  hasPick: boolean;
}): string[] {
  const { role, seats, seatsOverridden, usage, burn, outMultiple, offset, hasPick } = opts;
  const lines: string[] = [];

  if (seatsOverridden) {
    lines.push(`Headcount is set to ${seats} because you set it.`);
  } else {
    const because = [role.seniority?.toLowerCase(), role.authority?.toLowerCase()]
      .filter(Boolean)
      .join(" role with ");
    lines.push(
      `Headcount defaults to ${seats}${because ? ` because this is ${/^[aeiou]/.test(because) ? "an" : "a"} ${because} authority` : ""}. Override it for your organisation.`
    );
  }

  lines.push(
    `${usage[0].toUpperCase()}${usage.slice(1)} use assumes ${USAGE_TOKENS[usage] ?? "?"} input tokens per person per month, billed over twelve months.`
  );

  if (!hasPick) {
    lines.push("No model qualifies for this role, so nothing is costed.");
  }

  lines.push(
    burn
      ? "Cost is adjusted for reasoning-token burn, inferred from each model's effort label rather than measured."
      : "Token burn is NOT adjusted for reasoning effort, so high-effort variants are understated."
  );

  lines.push(
    outMultiple
      ? `Output tokens are priced at ${outMultiple}× the input price on 15 per cent of volume, because the catalogue publishes no output price.`
      : "Output tokens are priced at the vendor's own published ratio on 15 per cent of volume, because the catalogue publishes no output price."
  );

  if (offset !== 0) {
    lines.push(
      `Every capability threshold is moved ${offset > 0 ? "up" : "down"} by ${Math.abs(offset)} per cent of its axis range, which you did.`
    );
  }

  lines.push(
    "Figures are in US dollars, matching the catalogue's own pricing, so no exchange rate is applied."
  );
  lines.push("Every one of these numbers is an assumption you can change.");
  return lines;
}

const OUTCOME_LABEL: Record<string, string> = {
  supported: "Supported",
  qualified: "Qualified",
  "partially supported": "Partially supported",
  "best available": "Best available",
  "not supported": "Not supported",
  "cannot assess": "Cannot assess",
};

export function ModelFit() {
  // Nothing is preselected, and each menu waits for the one above it. A role
  // arrived at by three deliberate choices is a question the buyer asked; a
  // role sitting there by default is one the tool answered on its own.
  const [industry, setIndustry] = useState<string>("");
  const [fn, setFn] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  // The role the answer on screen belongs to. Held separately from the
  // selection so that changing a menu retires the old answer rather than
  // silently replacing it with a new one.
  const [computedRoleId, setComputedRoleId] = useState<string | null>(null);
  const [usage, setUsage] = useState("moderate");
  const [burn, setBurn] = useState(true);
  const [offset, setOffset] = useState(0);
  const [outMultiple, setOutMultiple] = useState("");
  const [excludeCn, setExcludeCn] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [seatsText, setSeatsText] = useState<string | null>(null);
  const [showAllEliminations, setShowAllEliminations] = useState(false);

  const functions = useMemo(() => (industry ? functionsFor(industry) : []), [industry]);
  const roles = useMemo(
    () => (industry && fn ? rolesFor(industry, fn) : []),
    [industry, fn]
  );
  const counts = useMemo(
    () => (industry ? functionCounts(industry) : { specific: 0, common: 0 }),
    [industry]
  );
  const roleSplit = useMemo(
    () => ({
      specific: roles.filter((r) => !r.crossIndustry).length,
      common: roles.filter((r) => r.crossIndustry).length,
    }),
    [roles]
  );
  // Derived from the computed role, not the selected one: the panel below shows
  // the answer to the question that was asked, not the one being typed.
  const role: Role | undefined = useMemo(
    () => (computedRoleId ? roleById(computedRoleId) : undefined),
    [computedRoleId]
  );
  const ready = Boolean(industry && fn && roleId);
  // Any change to a menu clears the computed role, so this covers both "never
  // computed" and "computed, then the selection moved on".
  const needsCompute = ready && computedRoleId !== roleId;

  const vendors = useMemo(
    () =>
      Array.from(new Set(MODELS.map((m) => m.vendor).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b)
      ),
    []
  );

  const engine = useMemo(
    () =>
      loadEngine({
        usage,
        effort_adjust: burn,
        offset_pct: offset,
        out_multiple: outMultiple ? Number(outMultiple) : null,
        exclude_cn: excludeCn,
      }),
    [usage, burn, offset, outMultiple, excludeCn]
  );

  // The engine's own default when a role states no headcount is 60. A part-typed
  // or empty field falls back to the role's figure rather than to 1, so the cost
  // panel does not flicker through a nonsense number mid-keystroke.
  const roleSeats = role?.headcount === undefined ? 60 : role.headcount;
  const defaultSeats = typeof roleSeats === "number" && roleSeats >= 1 ? roleSeats : 1;
  const typedSeats = seatsText === null ? NaN : Number(seatsText);
  const seats =
    Number.isFinite(typedSeats) && typedSeats >= 1 ? Math.floor(typedSeats) : defaultSeats;

  const result: Assessment | null = useMemo(() => {
    if (!role) return null;
    // strict=false: a role that fails validation renders a data-fault notice
    // rather than taking the page down with it.
    return engine.assess({ ...role, headcount: seats }, { excluded_vendors: excluded }, false);
  }, [engine, role, seats, excluded]);

  // Choosing higher up the chain clears everything below it, because a function
  // from the last industry is not a valid choice in this one.
  function selectIndustry(next: string) {
    setIndustry(next);
    setFn("");
    setRoleId("");
    setComputedRoleId(null);
    setSeatsText(null);
  }

  function selectFunction(next: string) {
    setFn(next);
    setRoleId("");
    setComputedRoleId(null);
    setSeatsText(null);
  }

  function selectRole(next: string) {
    setRoleId(next);
    setComputedRoleId(null);
    setSeatsText(null);
  }

  function compute() {
    if (!ready) return;
    setComputedRoleId(roleId);
  }

  const detail =
    result && "pick" in result.detail
      ? (result.detail as Recommendation & { duties?: DutyOutcome[] })
      : null;
  const answer = result?.answer;
  const pick = detail?.pick ?? null;
  const nextUp: RankedModel | null = detail && detail.live.length > 1 ? detail.live[1] : null;

  // The intelligence threshold actually applied, read from the engine rather
  // than recomputed here, so the line on the chart is the line that eliminated.
  const intelligenceThreshold = useMemo(() => {
    if (!role || !detail) return { value: null as number | null, label: null as string | null };
    const meta = role.profile["CAP-01"];
    if (!meta || meta.critical !== "Mandatory") return { value: null, label: null };
    const applied = engine.appliedThreshold("CAP-01", meta.score, detail.shift);
    if (!applied) return { value: null, label: null };
    // Plain English on the chart. The band, the status and the arithmetic all
    // live in the requirements table below, where someone asking "why 60?" is
    // already looking; on the chart the only useful sentence is what the line
    // means.
    return {
      value: applied.value,
      label: `General intelligence needs ${applied.value.toFixed(0)}`,
    };
  }, [role, detail, engine]);

  // "Everyone gets the best": what the top-index model would cost for the same
  // people. The comparison the recommendation exists to beat. Same model the
  // engine would allocate under rule 10, by construction.
  const topModel = useMemo(() => engine.topRated(), [engine]);
  // The model the answer actually costed. Usually the pick; on the executive
  // fallback it is the allocated model, which is a real cost against a
  // recommendation that does not exist, and the caption has to say so.
  const chosen = useMemo(
    () =>
      answer?.model_id
        ? engine.allowed().find((m) => m.model_id === answer.model_id) ?? null
        : null,
    [answer?.model_id, engine]
  );
  const topCost = topModel ? engine.perSeatYear(topModel) : null;
  const chosenCost = chosen ? engine.perSeatYear(chosen) : null;
  const saving =
    topCost !== null && chosenCost !== null ? (topCost - chosenCost) * seats : null;

  const eliminatedBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of detail?.eliminated ?? []) {
      m.set(e.requirement, (m.get(e.requirement) ?? 0) + 1);
    }
    return m;
  }, [detail]);

  const eliminationsByRequirement = useMemo(() => {
    if (!detail) return [];
    const map = new Map<string, Elimination[]>();
    for (const e of detail.eliminated) {
      const list = map.get(e.requirement) ?? [];
      list.push(e);
      map.set(e.requirement, list);
    }
    return Array.from(map.entries())
      .map(([requirement, list]) => ({ requirement, list }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [detail]);

  const mandatoryCount = role
    ? Object.values(role.profile).filter((v) => v.critical === "Mandatory").length
    : 0;
  // Roles added after the package shipped carry their sources. Showing them is
  // the point: a profile a buyer can check is worth more than one they cannot,
  // and the 258 that came with the package cite none.
  const researched = role?.sources?.length ? role : null;
  const evidenceMix = useMemo(() => {
    if (!role) return null;
    const c: Record<string, number> = {};
    for (const v of Object.values(role.profile)) {
      const k = v.evidence_class ?? "E";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [role]);

  // What the catalogue filter costs, stated where the filter is. A toggle that
  // silently removes a third of the market is a toggle that lies by omission.
  const withheldByCn = useMemo(() => {
    if (!excludeCn) return null;
    const inPlay = new Set(engine.allowed().map((m) => m.model_id));
    const gone = MODELS.filter((m) => !inPlay.has(m.model_id));
    const frontierGone = gone.filter((m) => m.frontier === "On frontier").length;
    const frontierTotal = MODELS.filter((m) => m.frontier === "On frontier").length;
    return { gone: gone.length, total: MODELS.length, frontierGone, frontierTotal };
  }, [excludeCn, engine]);

  return (
    <section className="rounded-xl border border-primary/35 bg-primary/[0.04] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MicroLabel
            label="Workforce model fit"
            tooltip="For this role's requirements, which is the cheapest model that meets them. It does not recommend a deployment pattern, a prompt or an architecture."
          />
          <LaneBadge lane="derived" />
        </div>
        <p className="font-mono text-[10px] text-muted">
          258 roles · 29 industries · {MODELS.length} models
        </p>
      </div>

      {/* Three menus, stacked, each waiting for the one above it. Role id alone
          is sufficient for the engine; industry and function are how a human
          finds one, and asking for them in order is what makes the third menu
          short enough to read. */}
      <div className="mt-3 flex max-w-md flex-col gap-3">
        <Field
          label="1. Industry"
          note={`${INDUSTRIES.length - 1} industries in ${INDUSTRY_GROUPS.length} sectors, plus cross-industry`}
        >
          <select
            aria-label="Industry"
            value={industry}
            onChange={(e) => selectIndustry(e.target.value)}
            className={selectClass}
          >
            <option value="">Choose an industry…</option>
            {/* Cross-industry is not a sector, it is the 99 roles every sector
                has, so it sits above the grouping rather than inside it. */}
            <option value={CROSS_INDUSTRY}>{industryLabel(CROSS_INDUSTRY)}</option>
            {INDUSTRY_GROUPS.map((g) => (
              <optgroup key={g.macro} label={g.macro}>
                {g.industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field
          label="2. Function"
          disabled={!industry}
          note={
            !industry
              ? "waiting on an industry"
              : industry === CROSS_INDUSTRY
                ? `${functions.length} functions, common to every sector`
                : `${counts.specific} specific to this industry, ${counts.common} common`
          }
        >
          <select
            aria-label="Function"
            value={fn}
            disabled={!industry}
            onChange={(e) => selectFunction(e.target.value)}
            className={selectClass}
          >
            <option value="">
              {industry ? "Choose a function…" : "Choose an industry first"}
            </option>
            {functions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="3. Role"
          disabled={!fn}
          note={
            !fn
              ? "waiting on a function"
              : roleSplit.specific && roleSplit.common
                ? `${roleSplit.specific} specific to ${industry}, ${roleSplit.common} common`
                : roles.length === 1
                  ? "the only role profiled in this function"
                  : `${roles.length} roles profiled in this function`
          }
        >
          <select
            aria-label="Role"
            value={roleId}
            disabled={!fn}
            onChange={(e) => selectRole(e.target.value)}
            className={selectClass}
          >
            <option value="">
              {fn ? "Choose a role…" : "Choose a function first"}
            </option>
            {/* Specialist roles and common ones are two different claims, so
                they sit in labelled groups rather than one undifferentiated list. */}
            {roleSplit.specific > 0 ? (
              <optgroup label={`Specific to ${industryLabel(industry)}`}>
                {roles
                  .filter((r) => !r.crossIndustry)
                  .map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {roleSplit.common > 0 ? (
              <optgroup label="Common to every industry">
                {roles
                  .filter((r) => r.crossIndustry)
                  .map((r) => (
                    <option key={r.role_id} value={r.role_id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ) : null}
            {roleSplit.specific === 0 && roleSplit.common === 0
              ? roles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>
                    {r.name}
                  </option>
                ))
              : null}
          </select>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={compute}
            disabled={!ready}
            className="rounded bg-primary px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Compute
          </button>
          {needsCompute ? (
            <span className="text-[11.5px] text-warn">
              Ready. Press Compute to work it out.
            </span>
          ) : !ready ? (
            <span className="text-[11.5px] text-muted">
              Choose all three to enable.
            </span>
          ) : null}
        </div>
      </div>
      {industry === CROSS_INDUSTRY ? (
        <p className="measure mt-2 text-[11px] text-muted">
          Cross-industry roles carry one profile for every sector: a Financial Controller in
          banking and in retail return identical requirements. That is wrong, and the
          specification says so; it is not yet fixable from evidence, so it is labelled rather
          than hidden.
        </p>
      ) : null}

      {/* The catalogue filter, with its own consequence beside it. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-base-300 bg-base-100 px-3 py-2">
        <span className="micro-label">Catalogue</span>
        <label className="inline-flex items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={excludeCn}
            onChange={(e) => setExcludeCn(e.target.checked)}
            className="accent-[var(--ag-primary)]"
          />
          Exclude China-headquartered vendors
        </label>
        <span className="font-mono text-[10.5px] text-warn">
          {withheldByCn
            ? `${withheldByCn.gone} of ${withheldByCn.total} models withheld · ${withheldByCn.frontierGone} of the ${withheldByCn.frontierTotal} frontier models are among them`
            : `all ${MODELS.length} models in play`}
        </span>
      </div>

      {!role || !answer || !detail ? (
        <WaitingForCompute industry={industry} fn={fn} roleId={roleId} />
      ) : answer.outcome === "cannot assess" ? (
        <div className="mt-4 rounded border border-error/40 bg-bad-bg p-4">
          <p className="text-[13px] font-semibold text-error">
            This role cannot be assessed: {answer.reason}
          </p>
          <p className="measure mt-1 text-[11.5px] text-muted">
            The engine refuses bad input rather than guessing, because a silently wrong
            recommendation is worse than a visible refusal.
          </p>
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100">
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-extrabold leading-tight">{role.name}</h2>
                <span
                  className={`inline-flex rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${OUTCOME_STYLE[answer.outcome]}`}
                >
                  {OUTCOME_LABEL[answer.outcome]}
                </span>
                <span className="font-mono text-[10px] text-muted">
                  {role.role_id} · {role.function}
                  {role.seniority ? ` · ${role.seniority}` : ""}
                  {role.authority ? ` · ${role.authority} authority` : ""}
                </span>
              </div>
              {/* The model is the answer, so it gets the size and the colour.
                  The reasoning sits under it at reading size. */}
              {(() => {
                const h = headline(answer, detail, engine, role);
                return (
                  <>
                    {h.model ? (
                      <p className="mt-3">
                        <span className="micro-label block text-insight">
                          {answer.outcome === "best available"
                            ? "Allocated, not a fit"
                            : "Recommended model"}
                        </span>
                        {/* The recommendation is a name, not a paragraph, so
                            the figure carries the judgement colour rather
                            than the card around it. Purple, not the brand
                            navy: navy is also every link and button on the
                            page. */}
                        <span className="finding-figure mt-0.5 block break-words text-[32px] font-extrabold leading-[1.15] tracking-tight sm:text-[38px]">
                          {h.model}
                        </span>
                      </p>
                    ) : null}
                    <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed">
                      {h.sentence}
                    </p>
                  </>
                );
              })()}
              {researched ? (
                <div className="mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <MicroLabel
                      label="What this profile rests on"
                      tooltip="Regulation and mandatory standards first, then professional bodies, then current job descriptions. The evidence class is recorded per requirement, because the support genuinely differs within a role."
                    />
                    {evidenceMix
                      ? (["A", "B", "C", "D", "E"] as const)
                          .filter((k) => evidenceMix[k])
                          .map((k) => (
                            <span
                              key={k}
                              title={EVIDENCE_CLASS_LABEL[k]}
                              className="inline-flex rounded bg-base-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted"
                            >
                              {evidenceMix[k]} × class {k}
                            </span>
                          ))
                      : null}
                  </div>
                  <p className="measure mt-1.5 text-[11.5px] leading-relaxed">{role.note}</p>
                  <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                    {researched.sources!.slice(0, 4).map((u) => (
                      <li key={u}>
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] text-primary hover:underline"
                        >
                          {(() => {
                            try {
                              return new URL(u).hostname.replace(/^www\./, "");
                            } catch {
                              return u;
                            }
                          })()}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="measure mt-1.5 text-[10.5px] text-muted">
                    The 258 roles that shipped with the package cite no sources: they were
                    produced by a research pipeline whose evidence was not retained. These
                    were researched for this build and the sources kept, which is why they can
                    be checked and the others cannot. No subject-matter expert has reviewed
                    either set.
                  </p>
                </div>
              ) : null}
              {mandatoryCount === 0 && (answer.outcome === "supported" || answer.outcome === "qualified") ? (
                <p className="mt-3 border-l-[3px] border-warn bg-warn-bg/40 px-3 py-2 text-[12.5px] leading-relaxed">
                  <b>Read this one carefully.</b> No requirement in this profile is Mandatory,
                  so nothing could eliminate anything and the answer is simply the cheapest
                  model in the catalogue. Desirable requirements rank the survivors, they never
                  eliminate. Four of the 258 roles in the library sit in this position.
                </p>
              ) : null}
              {answer.outcome === "best available" ? (
                <p className="mt-3 border-l-[3px] border-warn bg-warn-bg/40 px-3 py-2 text-[12.5px] leading-relaxed">
                  <b>Executive allocation.</b> This role returned no qualifying model, so the
                  highest-capability option has been assigned. It does not meet{" "}
                  {answer.unmet_requirements?.length ?? 0} requirement
                  {answer.unmet_requirements?.length === 1 ? "" : "s"} (
                  {answer.unmet_requirements?.join(", ")}). Treat it as the best available
                  choice, not as a fit.
                </p>
              ) : null}
              {answer.outcome === "partially supported" ? (
                <p className="mt-3 border-l-[3px] border-warn bg-warn-bg/40 px-3 py-2 text-[12.5px] leading-relaxed">
                  <b>Counts of duties, not proportions of a job.</b> Duties differ in time and
                  importance and this dataset does not weight them. The blocked duties are the
                  more interesting half of the answer: they are where human judgement is
                  currently load-bearing.
                </p>
              ) : null}
              {answer.warnings && answer.warnings.length > 0 ? (
                <ul className="measure mt-3 list-disc space-y-0.5 pl-4 text-[11px] text-warn">
                  {answer.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Facts strip */}
            <dl className="grid grid-cols-1 border-t border-base-300 @xl:grid-cols-2 @4xl:grid-cols-5">
              <Fact
                label="Error consequence"
                value={`Tier ${detail.tier}`}
                detail={
                  detail.consequence_shift
                    ? "Raises every capability threshold one rubric band"
                    : "Cheapest that clears"
                }
              />
              <Fact
                label="Requirement breadth"
                value={`${detail.breadth} at 70+`}
                detail={
                  detail.breadth_shift
                    ? "Broad: one model must cover them at once, so it cannot be a specialist"
                    : "Focused enough that a specialist is not ruled out"
                }
              />
              <Fact
                label="Confidence"
                value={detail.confidence}
                detail={
                  detail.limited_by
                    ? `Limited by ${CAPABILITY_NAMES[detail.limited_by] ?? detail.limited_by}`
                    : "No single requirement set the limit"
                }
              />
              <Fact
                label="Mandatory requirements"
                value={`${mandatoryCount} of ${Object.keys(role.profile).length}`}
                detail={
                  mandatoryCount === 0
                    ? "Nothing can eliminate: the answer is the cheapest model in the catalogue"
                    : detail.unassessed.length
                      ? `${detail.unassessed.length} cannot be assessed at all`
                      : "All assessed"
                }
              />
              <Fact
                label="Next option up"
                value={nextUp ? shortName(nextUp.model_id) : "—"}
                detail={
                  nextUp && pick
                    ? `+${(
                        (engine.costPerMillion(nextUp) ?? 0) -
                        (engine.costPerMillion(pick) ?? 0)
                      ).toFixed(2)} per 1M — the price of headroom, shown rather than assumed`
                    : "Nothing above the recommendation"
                }
              />
            </dl>
          </div>

          {/* Cost */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel
                label="What this costs"
                tooltip="Input price times tokens times the burn multiplier, plus output estimated at the vendor's published ratio on 15 per cent of volume, times twelve months times headcount."
              />
              <div className="flex items-center gap-1.5">
                <EvidenceChip kind="measured" label="prices measured" />
                <EvidenceChip kind="assumption" label="volumes assumed" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-4">
              <CostBox
                label="Per person"
                value={usd(answer.cost_per_person_year_usd)}
                detail={
                  chosen
                    ? `per year at ${usage} use, ${shortName(chosen.model_id)}${
                        pick ? "" : ", allocated rather than fitted"
                      }`
                    : "no qualifying model"
                }
              />
              <CostBox
                label="For this role"
                value={usd(answer.cost_for_role_year_usd)}
                detail={`per year across ${seats} ${seats === 1 ? "person" : "people"}`}
              />
              <CostBox
                label="Everyone on the best model"
                value={usd(topCost !== null ? topCost * seats : null)}
                detail={
                  topModel
                    ? `${shortName(topModel.model_id)} for ${seats === 1 ? "this person" : `all ${seats}`}, regardless of need`
                    : "no scored model"
                }
              />
              <CostBox
                label="Difference"
                value={saving !== null && saving !== 0 ? usd(Math.abs(saving)) : "—"}
                detail={
                  saving === null
                    ? "no qualifying model to compare"
                    : saving === 0
                      ? "this role is already on the top model; nothing cheaper clears it"
                      : saving > 0
                        ? "a year, by matching the model to the requirement"
                        : "a year more than the top model, because the role needs it"
                }
              />
            </div>

            {/* The assumptions, as controls. Not decoration. */}
            <div className="mt-4 border-t border-base-300 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <MicroLabel
                  label="The assumptions, adjustable"
                  tooltip="No threshold here has been measured. Leaving these fixed would assert a precision the data does not have."
                />
                <EvidenceChip kind="assumption" />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 @xl:grid-cols-2 @5xl:grid-cols-4">
                <Field label="Usage tier">
                  <select
                    aria-label="Usage tier"
                    value={usage}
                    onChange={(e) => setUsage(e.target.value)}
                    className={selectClass}
                  >
                    {Object.entries(USAGE_LABEL).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="People in this role">
                  {/* Held as text while being typed. Coercing on every
                      keystroke made the field unusable: clearing it to type a
                      new number snapped it straight back to 1. */}
                  <input
                    aria-label="People in this role"
                    type="number"
                    min={1}
                    value={seatsText ?? String(seats)}
                    onChange={(e) => setSeatsText(e.target.value)}
                    onBlur={() => setSeatsText(String(seats))}
                    className={selectClass}
                  />
                </Field>
                <Field label="Output price">
                  <select
                    aria-label="Output price multiple"
                    value={outMultiple}
                    onChange={(e) => setOutMultiple(e.target.value)}
                    className={selectClass}
                  >
                    {OUT_MULTIPLE_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={`Calibration offset ${offset > 0 ? "+" : ""}${offset} per cent`}
                >
                  <input
                    aria-label="Calibration offset"
                    type="range"
                    min={-30}
                    max={30}
                    step={5}
                    value={offset}
                    onChange={(e) => setOffset(Number(e.target.value))}
                    className="mt-1.5 w-full accent-[var(--ag-primary)]"
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={burn}
                    onChange={(e) => setBurn(e.target.checked)}
                    className="accent-[var(--ag-primary)]"
                  />
                  Adjust for reasoning token burn
                  <span className="text-muted">
                    (inferred from effort labels; 37 per cent of the catalogue carries none)
                  </span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <span className="micro-label">Exclude a vendor</span>
                  <select
                    aria-label="Exclude a vendor"
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !excluded.includes(e.target.value)) {
                        setExcluded([...excluded, e.target.value]);
                      }
                    }}
                    className={selectClass}
                  >
                    <option value="">Add…</option>
                    {vendors
                      .filter((v) => !excluded.includes(v))
                      .map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                  </select>
                </label>
                {excluded.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setExcluded(excluded.filter((x) => x !== v))}
                    className="inline-flex items-center gap-1 rounded-full border border-base-300 px-2 py-0.5 text-[11px] hover:border-error hover:text-error"
                  >
                    {v} ✕
                  </button>
                ))}
              </div>
              {/* Every assumption in force right now, rewritten as they move. */}
              <p className="measure mt-3 text-[11px] leading-relaxed text-warn">
                {assumptionNarration({
                  role,
                  seats,
                  seatsOverridden: seatsText !== null && seatsText !== "",
                  usage,
                  burn,
                  outMultiple,
                  offset,
                  hasPick: Boolean(pick),
                }).join(" ")}
              </p>
              <p className="measure mt-2 text-[10.5px] text-muted">
                Buyer constraints eliminate first and are certain. Everything below them is
                judgement. The calibration offset moves every capability threshold together as a
                percentage of that axis&apos;s own range, so it means the same on an index
                topping out at {engine.axisMax("intelligence").toFixed(0)} as on an Elo topping
                out at {engine.axisMax("briefcase").toFixed(0)}. Thresholds are capped at the
                best score any model actually achieves, so the slider cannot demand something
                the market does not sell.
              </p>
            </div>
          </div>

          {/* Price against capability */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel
                label="Price against capability"
                tooltip="Every priced model in the catalogue with a published intelligence index, plotted against this role's join."
              />
              <LaneBadge lane="aie" />
            </div>
            <div className="mt-3">
              <PriceCapabilityChart
                models={engine.allowed()}
                survivors={detail.live}
                pick={pick}
                nextUp={nextUp}
                threshold={intelligenceThreshold.value}
                thresholdLabel={intelligenceThreshold.label}
              />
            </div>
          </div>

          {/* Duty decomposition, only when the role failed */}
          {"duties" in detail && detail.duties ? (
            <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <MicroLabel
                  label="Duty breakdown"
                  tooltip="Decomposition runs only when the role-level answer fails. Each duty is scored independently and run through the full join."
                />
                <span className="font-mono text-[10px] text-muted">
                  {answer.duties_supported} of {answer.duties_total} duties supported
                </span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {detail.duties.map((d) => (
                  <li
                    key={d.duty}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-base-300/60 pb-1.5 text-[12.5px]"
                  >
                    <span
                      className={`inline-flex w-[86px] shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${d.supported ? "bg-good-bg text-good" : "bg-bad-bg text-error"}`}
                    >
                      {d.supported ? "supported" : "blocked"}
                    </span>
                    <span className="flex-1">{d.duty}</span>
                    <span className="font-mono text-[10.5px] text-muted">
                      {d.supported ? d.model : `blocked by ${d.blocked_by.join(", ")}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="measure mt-2 text-[11px] text-muted">
                Supported means a model meets the stated requirements for that duty, with a
                human still accountable for the output. It does not mean the duty should be
                removed from a job.
              </p>
            </div>
          ) : null}

          {/* Requirements */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel
                label="What this role requires"
                tooltip="Eighteen requirements, each scored on the five-band rubric. A score states how much of one requirement the work involves. It is not a difficulty rating and there is no total."
              />
              <div className="flex items-center gap-1.5">
                <EvidenceChip kind="judgement" label="profile: judgement" />
                <EvidenceChip kind="assumption" label="thresholds: provisional" />
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-base-300 font-mono text-[9px] uppercase tracking-wider text-muted">
                    <th className="py-1.5 pr-2 font-medium">Requirement</th>
                    <th className="px-1 py-1.5 text-right font-medium">Level</th>
                    <th className="px-2 py-1.5 font-medium">Critical</th>
                    <th className="px-2 py-1.5 font-medium">Evidence</th>
                    <th className="px-2 py-1.5 font-medium">Benchmark axis</th>
                    <th className="px-2 py-1.5 font-medium">Applied</th>
                    <th className="py-1.5 pl-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {CAP_IDS.filter((c) => role.profile[c]).map((cap) => {
                    const meta = role.profile[cap];
                    const rubric = RUBRIC[cap];
                    const axis = AXES[cap];
                    const isSpec = cap in SPEC_FIELD;
                    const unassessed = detail.unassessed.includes(cap);
                    const decided = detail.deciding.includes(cap);
                    // Specifications are never band-shifted, so the stated level
                    // is the level applied; capabilities take theirs from the
                    // engine, overflow and ceiling included.
                    const appliedCapability = isSpec
                      ? null
                      : engine.appliedThreshold(cap, meta.score, detail.shift);
                    const level = appliedCapability?.level ?? meta.score;
                    const shifted = !isSpec && level !== meta.score && !unassessed;
                    const applied = isSpec
                      ? specRequirement(cap, meta.score)
                      : appliedCapability
                        ? `≥ ${appliedCapability.value.toFixed(1)} at level ${appliedCapability.level}`
                        : "no axis ingested";
                    // null from meets() means the question could not be put to
                    // the model at all: no axis, or no published value. That is
                    // not the same as clearing, and must never read like it.
                    const met = pick
                      ? checkRequirement(engine, pick, cap, meta, detail.shift)
                      : null;
                    // One question, asked of the recommended model: did this
                    // requirement test it, and did it pass. "Unassessed" and
                    // "not assessable" were two labels for the same fact, and
                    // "pick clears" was being awarded for requirements that
                    // asked for nothing.
                    const verdict = !pick
                      ? "not reached"
                      : met === "not-required"
                        ? "not required"
                        : met === "unchecked"
                          ? "not checked"
                          : met === "cleared"
                            ? "clears"
                            : meta.critical === "Mandatory"
                              ? "falls short"
                              : "desirable shortfall";
                    return (
                      <tr key={cap} className="border-b border-base-300/60 align-top">
                        <td className="py-1.5 pr-2">
                          <span
                            className="font-medium"
                            title={rubric ? rubric.measures : undefined}
                          >
                            {CAPABILITY_NAMES[cap]}
                          </span>
                          <span className="ml-1.5 font-mono text-[9px] text-muted">{cap}</span>
                          {rubric ? (
                            <p className="mt-0.5 max-w-[34ch] text-[10.5px] leading-snug text-muted">
                              {rubric.bands[String(meta.score)]}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-1 py-1.5 text-right font-mono text-[11px]">
                          {meta.score}
                          {shifted ? (
                            <span className="block text-[9px] text-warn">→ {level}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={
                              meta.critical === "Mandatory"
                                ? "font-semibold"
                                : "text-muted"
                            }
                          >
                            {meta.critical}
                          </span>
                        </td>
                        <td
                          className="px-2 py-1.5 font-mono text-[10px]"
                          title={EVIDENCE_CLASS_LABEL[meta.evidence_class ?? "E"]}
                        >
                          <span
                            className={
                              meta.evidence_class === "A" || meta.evidence_class === "B"
                                ? "text-good"
                                : meta.evidence_class === "E"
                                  ? "text-warn"
                                  : undefined
                            }
                          >
                            Class {meta.evidence_class}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-[10.5px] text-muted">
                          {axis?.axis ?? "None found"}
                          {axis?.status ? (
                            <span
                              className={`ml-1 font-mono text-[9px] uppercase ${axis.status === "live" ? "text-good" : "text-warn"}`}
                            >
                              {axis.status === "live" ? "ingested" : axis.status}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10.5px]">
                          {applied}
                          {/* Which requirement did the work is a different fact
                              from whether the pick passed it, so it sits beside
                              the threshold rather than replacing the verdict. */}
                          {decided ? (
                            <span
                              className="mt-0.5 block text-[9px] uppercase tracking-wider text-warn"
                              title="This requirement eliminated models from the catalogue."
                            >
                              eliminated {eliminatedBy.get(cap) ?? 0} models
                            </span>
                          ) : null}
                        </td>
                        <td className="py-1.5 pl-2">
                          <span
                            title={
                              verdict === "not checked"
                                ? "No benchmark axis has been ingested for this requirement, or the catalogue publishes no value for this model. Reported as unchecked rather than passed."
                                : verdict === "not required"
                                  ? "The role asks for nothing here, so there is no test to pass. Counting this as cleared would inflate the tally."
                                  : undefined
                            }
                            className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                              verdict === "not checked" || verdict === "not reached"
                                ? "bg-base-200 text-muted"
                                : verdict === "not required"
                                  ? "text-muted/70"
                                  : verdict === "desirable shortfall"
                                    ? "bg-warn-bg text-warn"
                                    : verdict === "falls short"
                                      ? "bg-bad-bg text-error"
                                      : "bg-good-bg text-good"
                            }`}
                          >
                            {verdict}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {detail.unassessed.length ? (
              <p className="mt-2 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
                <b>{detail.unassessed.length} of {Object.keys(role.profile).length} requirements
                cannot be assessed.</b>{" "}
                Each has a named benchmark axis with no ingested data, or no axis anywhere. They
                are reported as unassessed rather than passed quietly, and never mapped onto the
                general intelligence index as a proxy: that would eliminate specialists unfairly
                and recommend frontier models for work they cannot do.
              </p>
            ) : null}
          </div>

          {/* Eliminations */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel
                label="Why not the others"
                tooltip="Every elimination, with the requirement that caused it and the threshold actually applied."
              />
              <span className="font-mono text-[10px] text-muted">
                {detail.eliminated.length} eliminated · {detail.live.length} survive
              </span>
            </div>
            {eliminationsByRequirement.length === 0 ? (
              <p className="measure mt-2 text-[12px] text-muted">
                Nothing was eliminated: every model in the catalogue meets this role&apos;s
                mandatory requirements at the thresholds applied.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(showAllEliminations
                  ? eliminationsByRequirement
                  : eliminationsByRequirement.slice(0, 4)
                ).map(({ requirement, list }) => (
                  <li key={requirement} className="border-b border-base-300/60 pb-2">
                    <p className="text-[12.5px] font-semibold">
                      {CAPABILITY_NAMES[requirement] ??
                        (requirement === "buyer constraint"
                          ? "Buyer constraint"
                          : requirement)}
                      <span className="ml-2 font-mono text-[10px] font-normal text-muted">
                        {list.length} model{list.length === 1 ? "" : "s"} eliminated
                        {list[0].kind ? ` · ${list[0].kind}` : ""}
                      </span>
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {list.slice(0, 3).map((e) => (
                        <li key={e.model} className="text-[11px] text-muted">
                          <span className="font-mono">{shortName(e.model)}</span> — {e.reason}
                        </li>
                      ))}
                      {list.length > 3 ? (
                        <li className="text-[11px] text-muted">
                          and {list.length - 3} more on the same requirement
                        </li>
                      ) : null}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {eliminationsByRequirement.length > 4 ? (
              <button
                type="button"
                onClick={() => setShowAllEliminations((v) => !v)}
                className="mt-2 text-[11px] text-primary hover:underline"
              >
                {showAllEliminations
                  ? "Show fewer requirements"
                  : `Show all ${eliminationsByRequirement.length} requirements that eliminated something`}
              </button>
            ) : null}
          </div>

          {/* The disclosure that makes the rest legitimate */}
          <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <MicroLabel
                label="What is measured and what is not"
                tooltip="The engine's credibility rests on this distinction. Any integration that hides it breaks the product's central claim."
              />
              <LaneBadge lane="derived" />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[11.5px]">
                <caption className="sr-only">
                  Which parts of this recommendation are measured, which are authored
                  judgement, and which are stated assumptions
                </caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Component</th>
                    <th scope="col">Status</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Model prices, throughput, intelligence index", "measured", SOURCES.catalogue],
                      ["Factual reliability, graduate reasoning, agentic Elo", "measured", SOURCES.benchmarks],
                      ["Role requirement profiles", "judgement", "Authored against the rubric. Evidence class D, no SME review."],
                      ["Capability thresholds", "assumption", "Percentiles of observed distributions. None empirically measured."],
                      ["Reasoning token burn multipliers", "assumption", "Inferred from effort labels, not measured."],
                      ["Headcount defaults", "assumption", "Derived from seniority and decision authority."],
                    ] as [string, EvidenceKind, string][]
                  ).map(([what, kind, note]) => (
                    <tr key={what} className="border-b border-base-300/60 align-top">
                      <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                        {what}
                      </th>
                      <td className="py-1.5 pr-3">
                        <EvidenceChip kind={kind} />
                      </td>
                      <td className="py-1.5 text-[10.5px] text-muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="measure mt-3 text-[11.5px] leading-relaxed text-muted">
              {SOURCES.note} Twenty roles in the library return no qualifying model. That is a
              finding about the market, not a fault: no model combines frontier capability with
              top-tier factual reliability.
            </p>
            <div className="mt-3 border-t border-base-300 pt-2">
              <DerivationDrawer title="How the recommendation is derived">
                <p>
                  The engine runs eleven rules in a fixed order, and the order matters:
                  specifications are certain and cheap, so they filter first and frequently
                  decide the answer before any judgement is applied.
                </p>
                <ol className="list-decimal space-y-1 pl-4 text-muted">
                  <li>
                    Buyer constraints — excluded vendors and price ceiling — eliminate first.
                    Certain.
                  </li>
                  <li>
                    Consequence tier is the higher of the accuracy and risk-and-assurance
                    scores, read from the rubric rather than invented. Tier 70 or above shifts
                    every capability threshold up one rubric band.
                  </li>
                  <li>
                    Breadth counts capability requirements at level 70 or above. Seven or more
                    shifts up one further band: a role needing many things at once cannot use a
                    specialist.
                  </li>
                  <li>
                    At the top band, shifts add points rather than bands, because the rubric has
                    a ceiling and the market does not.
                  </li>
                  <li>
                    No threshold may exceed the best score any model actually achieves on that
                    axis.
                  </li>
                  <li>
                    Specification filters — context window, throughput, data handling, assurance,
                    input modalities — eliminate absolutely and need no calibration.
                  </li>
                  <li>
                    Capability filters apply the calibration threshold for the shifted level. A
                    model with no published score is eliminated only if that axis covers 60 per
                    cent or more of the catalogue; otherwise the requirement is reported
                    unassessed.
                  </li>
                  <li>
                    Desirable requirements rank, never eliminate. Survivors sort by count of
                    desirable shortfalls, then by cost.
                  </li>
                  <li>
                    Cost is input price times tokens times the burn multiplier, plus output
                    estimated at the vendor&apos;s published ratio on 15 per cent of volume,
                    times twelve months times headcount.
                  </li>
                  <li>
                    A role with Leader seniority and Strategic authority that returns nothing is
                    allocated the highest-capability model, labelled as an allocation and not a
                    fit, with the unmet requirements named.
                  </li>
                  <li>
                    Duty decomposition fires only when a role fails. Each duty runs the full join
                    separately, and the result is reported as counts of duties, never as
                    proportions of a job.
                  </li>
                </ol>
                <p>
                  Confidence is not averaged. It is the worst evidence class among the
                  requirements that actually did the eliminating, floored again by the
                  calibration status of the thresholds they used. Every threshold in this build
                  is provisional, so no answer here can rate higher than the requirement
                  evidence allows.
                </p>
                <p className="measure text-muted">
                  Benchmark values are never merged into a score of ours. They are compared
                  against a threshold and the comparison is reported, with the third-party
                  number and its source shown separately.
                </p>
              </DerivationDrawer>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Presentation helpers.
//
// Deliberately no band, overflow or ceiling arithmetic here: the engine exposes
// appliedThreshold() and topRated() and this file calls them. A second copy of
// those rules in the view is a copy that eventually disagrees with the answer
// it is captioning.
// ---------------------------------------------------------------------------

/**
 * What a specification requirement actually asks of a model. Specifications
 * need no calibration and are never band-shifted, so the stated level is the
 * level applied; showing the concrete demand is more use than showing a number
 * from a calibration table these requirements do not consult.
 */
function specRequirement(cap: string, level: number): string {
  if (cap in MODALITY) {
    return level <= 10 ? "not required" : `${MODALITY[cap]} input required`;
  }
  if (cap === "CAP-09") {
    const n = SPEC_NUMERIC["CAP-09"][level];
    return `≥ ${n >= 1000 ? `${n / 1000}k` : n} tokens`;
  }
  if (cap === "CAP-13") {
    const n = SPEC_NUMERIC["CAP-13"][level];
    return n > 0 ? `≥ ${n} tokens/sec` : "no minimum";
  }
  const need = (cap === "CAP-14" ? DATA_REQ : ASSURANCE_REQ)[level];
  return need.length ? need.join(", ").replace(/_/g, " ") : "no control required";
}

/**
 * Does the recommended model clear this requirement, judged by the threshold
 * the engine actually eliminated on?
 *
 * NOT the same question as Engine.meets(), and the difference matters. meets()
 * exists to rank desirable shortfalls and omits rule 4's overflow and rule 5's
 * ceiling, because the reference implementation omits them there. The filter
 * that decides who survives applies both. Asking meets() whether a model
 * "clears" a requirement can therefore disagree with the reason it survived.
 *
 * The engine is left alone — changing meets() would change the ranking and
 * break parity with the reference — and the display asks the elimination
 * question directly instead.
 *
 * null means the question could not be put: no axis, or no published value.
 */
/**
 * Four states, not three, and the fourth is the one that was wrong.
 *
 * A requirement scored at the bottom band asks for nothing: latency band 1 is
 * "days or weeks are acceptable", which the engine turns into a floor of zero
 * tokens per second; visual interpretation band 1 short-circuits before it
 * looks at the model at all; a capability threshold at band 1 is literally 0.
 * Nothing can fail these. Reporting them as "the pick clears" counted a test
 * that never took place, and inflated every tally built on top of it.
 *
 *   not-required  the role asks nothing here, so there is no test
 *   cleared       a real bar existed and the model met it
 *   short         a real bar existed and the model did not
 *   unchecked     a bar exists in principle, but no axis or no published value
 */
type Check = "not-required" | "cleared" | "short" | "unchecked";

function checkRequirement(
  engine: ReturnType<typeof loadEngine>,
  model: ModelRecord,
  cap: string,
  meta: { score: number },
  shift: number
): Check {
  if (cap in MODALITY) {
    if (meta.score <= 10) return "not-required";
    const have = model.input_modalities;
    if (have === null || have === undefined) return "unchecked";
    return have.includes(MODALITY[cap]) ? "cleared" : "short";
  }
  if (cap in SPEC_NUMERIC) {
    const need = SPEC_NUMERIC[cap][meta.score];
    if (!need) return "not-required";
    const have = (model as unknown as Record<string, number | null | undefined>)[
      SPEC_FIELD[cap]
    ];
    if (have === null || have === undefined) return "unchecked";
    return have >= need ? "cleared" : "short";
  }
  if (cap === "CAP-14" || cap === "CAP-15") {
    const need = (cap === "CAP-14" ? DATA_REQ : ASSURANCE_REQ)[meta.score];
    if (!need || need.length === 0) return "not-required";
    const have = (model as unknown as Record<string, string[] | null | undefined>)[
      SPEC_FIELD[cap]
    ];
    if (have === null || have === undefined) return "unchecked";
    return need.every((x) => have.includes(x)) ? "cleared" : "short";
  }
  const applied = engine.appliedThreshold(cap, meta.score, shift);
  const field = engine.cal(cap)?.model_field;
  if (!applied || !field) return "unchecked";
  if (applied.value <= 0) return "not-required";
  const have = (model.benchmarks ?? {})[field];
  if (have === null || have === undefined) return "unchecked";
  return have >= applied.value ? "cleared" : "short";
}

/** How the recommended model actually did, requirement by requirement. */
function scoreCard(
  engine: ReturnType<typeof loadEngine>,
  model: ModelRecord,
  profile: Profile,
  shift: number
): { cleared: number; short: string[]; unchecked: number; notRequired: number } {
  let cleared = 0;
  let unchecked = 0;
  let notRequired = 0;
  const short: string[] = [];
  for (const cap of Object.keys(profile)) {
    switch (checkRequirement(engine, model, cap, profile[cap] as RequirementEntry, shift)) {
      case "not-required":
        notRequired += 1;
        break;
      case "cleared":
        cleared += 1;
        break;
      case "short":
        short.push(cap);
        break;
      default:
        unchecked += 1;
    }
  }
  return { cleared, short, unchecked, notRequired };
}

/**
 * The answer, split so the model can be the thing the eye lands on.
 *
 * `model` is the name alone, rendered large and in the accent colour on its own
 * line; `sentence` is everything else. Where there is no single model — a role
 * decomposed into duties, or one nothing clears — `model` is null and the
 * sentence carries the whole answer, because inventing something to put in the
 * big type would be the one place this panel must not overstate.
 */
function headline(
  answer: NonNullable<Assessment["answer"]>,
  detail: Recommendation,
  engine: ReturnType<typeof loadEngine>,
  role: Role
): { model: string | null; sentence: string } {
  const total = Object.keys(role.profile).length;
  const u = detail.unassessed.length;
  // An unpriced model can end up the recommendation: the ranking sorts it last,
  // which decides nothing when it is the last model standing. Interpolating a
  // null price would read "at $null per 1M input tokens", so the clause is
  // dropped and the absence is stated instead.
  const cost = detail.pick ? engine.costPerMillion(detail.pick) : null;
  const at = cost === null ? "" : `, at $${cost} per 1M input tokens`;
  const unpriced =
    detail.pick && cost === null
      ? " The catalogue publishes no price for it, so it cannot be costed."
      : "";
  if (detail.pick && (answer.outcome === "supported" || answer.outcome === "qualified")) {
    // Counted against the recommended model itself, not against the catalogue.
    // The old wording read "clears all N requirements that can be checked
    // today", where N was every requirement minus the ones the CATALOGUE cannot
    // assess. That said nothing about this model, and was routinely false: a
    // model can survive because a mandatory axis is too thin to eliminate on,
    // while visibly falling short on the one axis that does cover the market.
    const card = scoreCard(engine, detail.pick, role.profile, detail.shift);
    const tested = card.cleared + card.short.length;
    const names = card.short.map((c) => CAPABILITY_NAMES[c] ?? c);
    const one = card.short.length === 1;
    const shortfall = card.short.length
      ? ` It falls short on ${names.join(", ")}, ${
          card.short.every((c) => role.profile[c].critical !== "Mandatory")
            ? one
              ? "which ranks but never eliminates"
              : "which rank but never eliminate"
            : one
              ? "which is mandatory, so this needs looking at"
              : "which are mandatory, so this needs looking at"
        }.`
      : "";
    // Both numbers are stated. A tally of what was tested means nothing without
    // the count of what could not be, and for most roles the second is larger.
    const rest = [
      card.unchecked ? `${card.unchecked} could not be checked against it` : "",
      card.notRequired ? `${card.notRequired} ask nothing of it` : "",
    ].filter(Boolean);
    const remainder = rest.length
      ? ` Of the ${total} requirements, ${rest.join(" and ")}.`
      : "";
    const lead =
      tested === 0
        ? `Nothing in this role could actually be tested against it${at}`
        : card.short.length === 0
          ? `Clears ${tested === 1 ? "the one requirement" : `all ${tested} requirements`} that actually tested it${at}`
          : `Clears ${card.cleared} of the ${tested} requirements that actually tested it${at}`;
    return {
      model: shortName(detail.pick.model_id),
      sentence: `${lead}.${shortfall}${remainder}${unpriced}`,
    };
  }
  if (answer.outcome === "best available") {
    return {
      model: answer.model ?? null,
      sentence: `No model meets this role in full. This is allocated as the highest-capability model available, and falls short on ${answer.unmet_requirements?.join(", ") || "one or more requirements"}.`,
    };
  }
  if (answer.outcome === "partially supported") {
    return {
      model: null,
      sentence: `No single model meets this role in full. ${answer.duties_supported} of ${answer.duties_total} duties are supported when each is run through the join on its own.`,
    };
  }
  return {
    model: null,
    sentence: `No model in the catalogue meets this role's requirements${
      answer.blocked_by?.length ? `. Blocked by ${answer.blocked_by.join(", ")}` : ""
    }. That is a real answer about the market, not a failure to find one.`,
  };
}

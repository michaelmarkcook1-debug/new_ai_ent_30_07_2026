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
  MODALITY,
  MODELS,
  RUBRIC,
  SOURCES,
  SPEC_FIELD,
  SPEC_NUMERIC,
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
  RankedModel,
  Recommendation,
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

const USAGE_LABEL: Record<string, string> = {
  light: "Light — 2M tokens a year",
  moderate: "Moderate — 10M tokens a year",
  heavy: "Heavy — 40M tokens a year",
};

const OUT_MULTIPLE_CHOICES: { value: string; label: string }[] = [
  { value: "", label: "Vendor's own published ratio" },
  { value: "2", label: "2× input price" },
  { value: "3", label: "3× input price" },
  { value: "4", label: "4× input price" },
  { value: "6", label: "6× input price" },
];

const selectClass =
  "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="micro-label">{label}</span>
      {children}
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
      <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{detail}</p>
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
      <p className="mt-1.5 text-[10.5px] leading-snug text-muted">{detail}</p>
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

const OUTCOME_LABEL: Record<string, string> = {
  supported: "Supported",
  qualified: "Qualified",
  "partially supported": "Partially supported",
  "best available": "Best available",
  "not supported": "Not supported",
  "cannot assess": "Cannot assess",
};

export function ModelFit() {
  const [industry, setIndustry] = useState<string>(CROSS_INDUSTRY);
  const [fn, setFn] = useState<string>(() => functionsFor(CROSS_INDUSTRY)[0] ?? "");
  const [roleId, setRoleId] = useState<string>(
    () => rolesFor(CROSS_INDUSTRY, functionsFor(CROSS_INDUSTRY)[0] ?? "")[0]?.role_id ?? ""
  );
  const [usage, setUsage] = useState("moderate");
  const [burn, setBurn] = useState(true);
  const [offset, setOffset] = useState(0);
  const [outMultiple, setOutMultiple] = useState("");
  const [excludeCn, setExcludeCn] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [seatsOverride, setSeatsOverride] = useState<number | null>(null);
  const [showAllEliminations, setShowAllEliminations] = useState(false);

  const functions = useMemo(() => functionsFor(industry), [industry]);
  const roles = useMemo(() => rolesFor(industry, fn), [industry, fn]);
  const role: Role | undefined = roleId ? roleById(roleId) : undefined;

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

  const seats = seatsOverride ?? role?.headcount ?? 60;

  const result: Assessment | null = useMemo(() => {
    if (!role) return null;
    // strict=false: a role that fails validation renders a data-fault notice
    // rather than taking the page down with it.
    return engine.assess({ ...role, headcount: seats }, { excluded_vendors: excluded }, false);
  }, [engine, role, seats, excluded]);

  function selectIndustry(next: string) {
    const nextFns = functionsFor(next);
    const nextFn = nextFns[0] ?? "";
    setIndustry(next);
    setFn(nextFn);
    setRoleId(rolesFor(next, nextFn)[0]?.role_id ?? "");
    setSeatsOverride(null);
  }

  function selectFunction(next: string) {
    setFn(next);
    setRoleId(rolesFor(industry, next)[0]?.role_id ?? "");
    setSeatsOverride(null);
  }

  const detail =
    result && "pick" in result.detail
      ? (result.detail as Recommendation & { duties?: DutyOutcome[] })
      : null;
  const answer = result?.answer;
  const pick = detail?.pick ?? null;
  const nextUp: RankedModel | null = detail && detail.live.length > 1 ? detail.live[1] : null;

  // The intelligence threshold actually applied, so the chart can draw the line
  // that did most of the eliminating.
  const intelligenceThreshold = useMemo(() => {
    if (!role || !detail) return { value: null as number | null, label: null as string | null };
    const meta = role.profile["CAP-01"];
    const cal = engine.cal("CAP-01");
    if (!meta || meta.critical !== "Mandatory" || !cal?.model_field) {
      return { value: null, label: null };
    }
    const level = shiftedLevel(meta.score, detail.shift);
    const raw = cal.thresholds[String(level)];
    if (raw === null || raw === undefined) return { value: null, label: null };
    const value = Math.min(raw + overflowPoints(level, detail.shift), engine.axisMax("intelligence"));
    return {
      value,
      label: `general intelligence, level ${level} · ${value.toFixed(1)} · provisional`,
    };
  }, [role, detail, engine]);

  // "Everyone gets the best": what the top-index model would cost for the same
  // people. The comparison the recommendation exists to beat.
  const topModel = useMemo(() => {
    const scored = engine.allowed().filter((m) => (m.benchmarks ?? {}).intelligence != null);
    return scored.length
      ? scored.reduce((a, b) =>
          (b.benchmarks!.intelligence as number) > (a.benchmarks!.intelligence as number) ? b : a
        )
      : null;
  }, [engine]);
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

      {/* Three dropdowns. Role id alone is sufficient for the engine; industry
          and function are how a human finds one. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Industry">
          <select
            aria-label="Industry"
            value={industry}
            onChange={(e) => selectIndustry(e.target.value)}
            className={selectClass}
          >
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {industryLabel(i)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Function">
          <select
            aria-label="Function"
            value={fn}
            onChange={(e) => selectFunction(e.target.value)}
            className={selectClass}
          >
            {functions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role">
          <select
            aria-label="Role"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setSeatsOverride(null);
            }}
            className={selectClass}
          >
            {roles.map((r) => (
              <option key={r.role_id} value={r.role_id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {industry === CROSS_INDUSTRY ? (
        <p className="mt-2 text-[11px] text-muted">
          Cross-industry roles carry one profile for every sector: a Financial Controller in
          banking and in retail return identical requirements. That is wrong, and the
          specification says so; it is not yet fixable from evidence, so it is labelled rather
          than hidden.
        </p>
      ) : null}

      {!role || !answer || !detail ? (
        <p className="mt-4 rounded border border-base-300 bg-base-100 p-4 text-[13px] text-muted">
          Pick a role to see the join.
        </p>
      ) : answer.outcome === "cannot assess" ? (
        <div className="mt-4 rounded border border-error/40 bg-bad-bg p-4">
          <p className="text-[13px] font-semibold text-error">
            This role cannot be assessed: {answer.reason}
          </p>
          <p className="mt-1 text-[11.5px] text-muted">
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
              <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed">
                {headline(answer, detail, engine, role)}
              </p>
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
                <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[11px] text-warn">
                  {answer.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Facts strip */}
            <dl className="grid grid-cols-1 border-t border-base-300 sm:grid-cols-2 lg:grid-cols-5">
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
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  <input
                    aria-label="People in this role"
                    type="number"
                    min={1}
                    value={seats}
                    onChange={(e) => setSeatsOverride(Math.max(1, Number(e.target.value) || 1))}
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
                  <input
                    type="checkbox"
                    checked={excludeCn}
                    onChange={(e) => setExcludeCn(e.target.checked)}
                    className="accent-[var(--ag-primary)]"
                  />
                  Exclude China-based vendors
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
              <p className="mt-2 text-[10.5px] text-muted">
                Buyer constraints eliminate first and are certain. Everything below them is
                judgement, and the calibration offset moves every capability threshold together
                as a percentage of its axis range, so you can see how much of the answer rests
                on numbers nobody has measured.
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
              <p className="mt-2 text-[11px] text-muted">
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
                    const cal = engine.cal(cap);
                    const isSpec = cap in SPEC_FIELD;
                    const unassessed = detail.unassessed.includes(cap);
                    const decided = detail.deciding.includes(cap);
                    const level = shiftedLevel(meta.score, detail.shift);
                    const shifted = !isSpec && level !== meta.score && !unassessed;
                    const applied = isSpec
                      ? specRequirement(cap, meta.score)
                      : cal?.model_field
                        ? appliedThreshold(cal.thresholds[String(level)], level, detail.shift)
                        : "no axis ingested";
                    // null from meets() means the question could not be put to
                    // the model at all: no axis, or no published value. That is
                    // not the same as clearing, and must never read like it.
                    const met = pick ? engine.meets(pick, cap, meta, detail.shift) : null;
                    const verdict = unassessed
                      ? "unassessed"
                      : decided
                        ? "decided the answer"
                        : !pick
                          ? "not reached"
                          : met === null
                            ? "not assessable"
                            : met
                              ? "pick clears"
                              : "pick falls short";
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
                        <td className="px-2 py-1.5 font-mono text-[10px]">
                          Class {meta.evidence_class}
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
                        <td className="px-2 py-1.5 font-mono text-[10.5px]">{applied}</td>
                        <td className="py-1.5 pl-2">
                          <span
                            title={
                              verdict === "not assessable"
                                ? "No benchmark axis has been ingested for this requirement, or the catalogue publishes no value for this model. Reported as unchecked rather than passed."
                                : undefined
                            }
                            className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                              verdict === "unassessed" || verdict === "not assessable"
                                ? "bg-base-200 text-muted"
                                : verdict === "decided the answer"
                                  ? "bg-warn-bg text-warn"
                                  : verdict === "pick falls short"
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
              <p className="mt-2 text-[12px] text-muted">
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
                      {CAPABILITY_NAMES[requirement] ?? requirement}
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
                      <td className="py-1.5 pr-3 font-medium">{what}</td>
                      <td className="py-1.5 pr-3">
                        <EvidenceChip kind={kind} />
                      </td>
                      <td className="py-1.5 text-[10.5px] text-muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
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
                <p className="text-muted">
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
// Presentation helpers. The band and overflow arithmetic mirrors the engine's
// so the table can show the level that was actually applied, not the stated one.
// ---------------------------------------------------------------------------

const BAND_LADDER = [10, 30, 50, 70, 90];
const OVERFLOW_POINTS = [0, 2, 4];

function shiftedLevel(level: number, steps: number): number {
  const i = BAND_LADDER.indexOf(level);
  return BAND_LADDER[Math.min(BAND_LADDER.length - 1, Math.max(0, (i === -1 ? 0 : i) + steps))];
}

function overflowPoints(level: number, steps: number): number {
  return level === 90 ? OVERFLOW_POINTS[Math.min(2, steps)] : 0;
}

function appliedThreshold(
  raw: number | null | undefined,
  level: number,
  steps: number
): string {
  if (raw === null || raw === undefined) return "—";
  const over = overflowPoints(level, steps);
  return `≥ ${(raw + over).toFixed(1)} at level ${level}${over ? ` +${over}` : ""}`;
}

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

function headline(
  answer: NonNullable<Assessment["answer"]>,
  detail: Recommendation,
  engine: ReturnType<typeof loadEngine>,
  role: Role
): string {
  const total = Object.keys(role.profile).length;
  const u = detail.unassessed.length;
  const priceLabel = "per 1M input tokens";
  if (answer.outcome === "supported" && detail.pick) {
    return `${shortName(detail.pick.model_id)} meets every requirement for this role at $${engine.costPerMillion(detail.pick)} ${priceLabel}.`;
  }
  if (answer.outcome === "qualified" && detail.pick) {
    return `${shortName(detail.pick.model_id)} clears all ${total - u} requirements that can be checked today, at $${engine.costPerMillion(detail.pick)} ${priceLabel}. ${u} more await benchmark data.`;
  }
  if (answer.outcome === "best available") {
    return `No model meets this role in full. ${answer.model} is allocated as the highest-capability model available, and falls short on ${answer.unmet_requirements?.join(", ") || "one or more requirements"}.`;
  }
  if (answer.outcome === "partially supported") {
    return `No single model meets this role in full. ${answer.duties_supported} of ${answer.duties_total} duties are supported when each is run through the join on its own.`;
  }
  return `No model in the catalogue meets this role's requirements${
    answer.blocked_by?.length ? `. Blocked by ${answer.blocked_by.join(", ")}` : ""
  }. That is a real answer about the market, not a failure to find one.`;
}

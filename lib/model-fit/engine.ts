// Workforce Model Fit — the join engine, ported from the integration package's
// reference implementation (pkg/02_engine/engine.py, 2 August 2026).
//
// The port is deliberately literal. The Python file is the reference and the two
// are checked against each other by tests/model-fit-parity.test.ts, which replays
// a dump of the Python engine's output for all 258 roles under several control
// settings. If the two disagree, that is a bug in this file.
//
// The eleven rules run in the order INTEGRATION.md sets out, and the order
// matters: specifications are certain and cheap, so they filter first and
// frequently decide the answer before any judgement is applied.
//
//   1. Buyer constraints eliminate first.
//   2. Consequence tier = max(accuracy, risk and assurance). Tier 70+ shifts a band.
//   3. Breadth = count of capability requirements at 70+. Seven or more shifts again.
//   4. Overflow: at the top band, shifts add points rather than bands.
//   5. Ceiling: no threshold exceeds the best score any model achieves on that axis.
//   6. Specification filters eliminate absolutely; no calibration needed.
//   7. Capability filters apply the shifted level's calibration threshold.
//   8. Desirable requirements rank, never eliminate.
//   9. Cost = input + output at the vendor ratio, burn-adjusted, annualised.
//  10. Executive fallback allocates rather than fits.
//  11. Duty decomposition fires only when a role fails.

export const BANDS = [10, 30, 50, 70, 90] as const;

// Requirements that join to a FACT about the model rather than a benchmark score.
// These need no calibration and filter absolutely.
export const SPEC_FIELD: Record<string, string> = {
  "CAP-09": "context_window_tokens",
  "CAP-13": "throughput_tokens_per_sec",
  "CAP-14": "data_handling",
  "CAP-15": "assurance",
  "CAP-16": "input_modalities",
  "CAP-17": "input_modalities",
};
export const MODALITY: Record<string, string> = { "CAP-16": "image", "CAP-17": "audio" };
export const SPEC_NUMERIC: Record<string, Record<number, number>> = {
  "CAP-09": { 10: 4_000, 30: 16_000, 50: 64_000, 70: 200_000, 90: 500_000 },
  "CAP-13": { 10: 0, 30: 0, 50: 20, 70: 50, 90: 100 },
};
export const DATA_REQ: Record<number, string[]> = {
  10: [],
  30: [],
  50: ["zero_retention_available"],
  70: ["zero_retention_available", "vpc_or_private"],
  90: ["zero_retention_available", "vpc_or_private", "residency_control"],
};
export const ASSURANCE_REQ: Record<number, string[]> = {
  10: [],
  30: [],
  50: ["audit_logging"],
  70: ["audit_logging", "certifications"],
  90: ["audit_logging", "certifications", "output_reproducibility"],
};

const CONSEQUENCE_SOURCES = ["CAP-11", "CAP-15"];
const CONSEQUENCE_POLICY: Record<number, [number, boolean]> = {
  10: [0, false],
  30: [0, false],
  50: [0, false],
  70: [1, true],
  90: [1, true],
};
const BREADTH_SKIP = new Set([
  "CAP-09",
  "CAP-13",
  "CAP-14",
  "CAP-15",
  "CAP-16",
  "CAP-17",
]);
const BREADTH_TRIGGER = 7;
const ABOVE_TOP = [0, 2, 4];
export const COVERAGE_GATE = 0.6;

const CLASS_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const STATUS_RANK: Record<string, number> = {
  measured: 3,
  provisional: 2,
  unavailable: 1,
};
const CONFIDENCE: Record<number, string> = {
  5: "High",
  4: "High",
  3: "Medium",
  2: "Low",
  1: "Very low",
};

// ASSUMPTION, not measurement. Reasoning effort changes tokens burned for the same
// task, so price per token is not comparable across effort levels. Cost-per-task
// data would replace this.
const EFFORT_TOKENS: Record<string, number> = {
  "non-reasoning": 0.5,
  low: 0.8,
  medium: 1.2,
  high: 2.0,
  xhigh: 3.0,
  max: 4.5,
  reasoning: 1.5,
};
const OUT_RATIO: Record<string, number> = {
  OpenAI: 6.0,
  Anthropic: 5.0,
  Google: 6.0,
  xAI: 2.0,
  DeepSeek: 2.0,
};
const OUT_DEFAULT = 3.0;
export const USAGE_TIERS: Record<string, number> = {
  light: 2_000_000,
  moderate: 10_000_000,
  heavy: 40_000_000,
};
const CN_VENDORS = new Set([
  "Alibaba",
  "DeepSeek",
  "MiniMax",
  "Moonshot",
  "Zhipu",
  "Z AI",
  "Xiaomi",
  "Tencent",
  "InclusionAI",
  "StepFun",
  "KwaiKAT",
  "Baidu",
  "ByteDance",
  "01.AI",
]);

const KNOWN_CAPS = new Set(
  Array.from({ length: 18 }, (_, i) => `CAP-${String(i + 1).padStart(2, "0")}`)
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequirementEntry {
  score: number;
  critical?: string;
  evidence_class?: string;
  [k: string]: unknown;
}

export type Profile = Record<string, RequirementEntry>;

export interface DutyRecord {
  duty: string;
  profile: Profile;
}

export interface Role {
  role_id?: string;
  name?: string;
  industry?: string;
  function?: string;
  profile: Profile;
  headcount?: number;
  seniority?: string;
  authority?: string;
  duties?: DutyRecord[];
  note?: string;
}

export interface ModelRecord {
  model_id: string;
  vendor?: string | null;
  benchmarks?: Record<string, number | null> | null;
  cost_input_per_1m?: number | null;
  cost_output_per_1m?: number | null;
  throughput_tokens_per_sec?: number | null;
  context_window_tokens?: number | null;
  data_handling?: string[] | null;
  assurance?: string[] | null;
  input_modalities?: string[] | null;
  frontier?: string | null;
}

/** A survivor carries the count of Desirable requirements it falls short on. */
export type RankedModel = ModelRecord & { _miss: number };

export interface CalibrationEntry {
  model_field: string | null;
  status: string;
  thresholds: Record<string, number | null>;
  axis?: string;
}

export type CalibrationTable = Record<string, CalibrationEntry>;

export interface Elimination {
  model: string;
  requirement: string;
  kind?: "spec" | "capability";
  reason: string;
  short_by?: number;
}

export interface Recommendation {
  pick: RankedModel | null;
  live: RankedModel[];
  eliminated: Elimination[];
  unassessed: string[];
  deciding: string[];
  tier: number;
  breadth: number;
  shift: number;
  consequence_shift: number;
  breadth_shift: number;
  confidence: string;
  limited_by: string | null;
}

export interface DutyOutcome {
  duty: string;
  supported: boolean;
  model: string | null;
  blocked_by: string[];
}

export interface Answer {
  outcome:
    | "supported"
    | "qualified"
    | "partially supported"
    | "not supported"
    | "best available"
    | "cannot assess";
  model?: string | null;
  model_id?: string;
  allocation_not_fit?: boolean;
  cost_per_million_usd?: number | null;
  cost_per_person_year_usd?: number | null;
  cost_for_role_year_usd?: number | null;
  headcount?: number;
  confidence?: string;
  unassessed?: string[];
  unmet_requirements?: string[];
  blocked_by?: string[];
  duties_supported?: number;
  duties_total?: number;
  note?: string;
  reason?: string;
  warnings?: string[];
}

export interface Assessment {
  role_id?: string;
  answer: Answer;
  detail: (Recommendation & { duties?: DutyOutcome[] }) | { error: string };
}

export interface AxisHealth {
  field: string;
  status?: string;
  models_with_data: number;
  coverage_pct: number;
  can_eliminate_on_absence: boolean;
}

export interface Health {
  models_total: number;
  models_allowed: number;
  models_unpriced: number;
  axes: Record<string, AxisHealth>;
  warnings: string[];
  verdict: string;
}

export interface EngineOptions {
  exclude_cn?: boolean;
  usage?: string;
  effort_adjust?: boolean;
  offset_pct?: number;
  out_multiple?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keep the variant tag: Opus 5 at max and at medium are different products. */
export function shortName(modelId: string): string {
  const m = /^([\s\S]*?)\s*\(([^)]*)\)\s*$/.exec(modelId);
  if (!m) return modelId.trim();
  let v = m[2].replace(/adaptive reasoning,?\s*/gi, "");
  v = v.replace(/\s*effort/gi, "");
  v = v.replace(/^reasoning,\s*/i, "").trim().toLowerCase();
  if (!v || v === "reasoning") {
    v = m[2].toLowerCase().includes("non-reasoning") ? "non-reasoning" : "reasoning";
  }
  return `${m[1].trim()} · ${v.split(",")[0].trim().slice(0, 14)}`;
}

/** null means the name carries no effort indicator, so burn is genuinely unknown. */
export function burnOf(modelId: string): number | null {
  const m = /\(([^)]*)\)\s*$/.exec(modelId);
  if (!m) return null;
  const v = m[1].toLowerCase();
  if (v.includes("non-reasoning")) return EFFORT_TOKENS["non-reasoning"];
  for (const k of ["xhigh", "max", "high", "medium", "low"]) {
    if (v.includes(k)) return EFFORT_TOKENS[k];
  }
  return v.includes("reasoning") ? EFFORT_TOKENS["reasoning"] : null;
}

/** Python's dict.get: a key present with a null value is null, not the default. */
function threshold(
  thresholds: Record<string, number | null> | undefined,
  key: string | number
): number | null {
  if (!thresholds) return null;
  const k = String(key);
  return Object.prototype.hasOwnProperty.call(thresholds, k) ? thresholds[k] : null;
}

function round(v: number, digits: number): number {
  return Number(v.toFixed(digits));
}

/**
 * Print a benchmark score the way the axis carries it.
 *
 * An axis whose published values are all whole numbers is an integer scale
 * (Briefcase Elo) and prints bare; an index scale prints its decimal, so a
 * model scoring exactly 55 on a decimal axis reads "55.0 against 58.0
 * required" rather than "55 against 58.0". Cosmetic, but elimination reasons
 * are read side by side and a column that drops its decimal looks like a
 * different measurement.
 */
function formatScore(v: number, integralAxis: boolean): string {
  if (integralAxis) return String(v);
  return Number.isInteger(v) ? v.toFixed(1) : String(v);
}

/**
 * A list of missing controls, rendered as the reference renders it.
 *
 * The reference interpolates a Python list into the reason string, so a model
 * short on assurance reads `missing ['audit_logging', 'certifications']`.
 * JSON.stringify produces double quotes and no spaces, which is a different
 * string. Nothing in the current catalogue reaches this line — data handling
 * and assurance are null for all 330 models — but it fires the day the
 * catalogue publishes those columns, which is the point of matching it now.
 */
function formatMissing(items: string[]): string {
  return `[${items.map((x) => `'${x}'`).join(", ")}]`;
}

// ---------------------------------------------------------------------------
// Validation. Silent wrong answers are worse than loud failures, so structural
// faults raise and recoverable ones are coerced with a recorded warning.
// ---------------------------------------------------------------------------

/** Raised when input data cannot be used without guessing what was meant. */
export class DataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataError";
  }
}

/**
 * Raise on structural faults, return warnings for anything coerced.
 *
 * The reference implementation coerces in place. Here the role is copied first,
 * because the catalogue and role library are imported modules shared by every
 * caller and repairing one caller's input must not alter the next one's.
 */
export function validateRole(input: unknown): { role: Role; warnings: string[] } {
  const warn: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DataError("role must be an object");
  }
  const src = input as Record<string, unknown>;
  const id = (src.role_id as string) ?? "?";
  const rawProfile = src.profile;
  if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
    throw new DataError(`role ${id} has no profile`);
  }
  const entries = Object.entries(rawProfile as Record<string, unknown>);
  if (entries.length === 0) {
    throw new DataError(
      `role ${id} has an empty profile; an unassessable role must not be reported as supported`
    );
  }
  const profile: Profile = {};
  for (const [cap, raw] of entries) {
    if (!KNOWN_CAPS.has(cap)) {
      throw new DataError(`unknown requirement id '${cap}' in role ${id}`);
    }
    if (!raw || typeof raw !== "object" || !("score" in (raw as object))) {
      throw new DataError(`${cap} in role ${id} has no score`);
    }
    const v = { ...(raw as RequirementEntry) };
    if (!(BANDS as readonly number[]).includes(v.score)) {
      throw new DataError(
        `${cap} score ${JSON.stringify(v.score)} is not a rubric band ${JSON.stringify(BANDS)}`
      );
    }
    if (v.critical !== "Mandatory" && v.critical !== "Desirable") {
      warn.push(`${cap} has no critical flag; derived from score`);
      v.critical = v.score >= 70 ? "Mandatory" : "Desirable";
    }
    if (!(v.evidence_class && v.evidence_class in CLASS_RANK)) {
      warn.push(`${cap} has no evidence class; treated as E, the weakest`);
      v.evidence_class = "E";
    }
    profile[cap] = v;
  }
  const role: Role = { ...(src as unknown as Role), profile };
  const hc = role.headcount;
  if (hc !== undefined && hc !== null && (typeof hc !== "number" || hc < 1)) {
    warn.push(`headcount ${JSON.stringify(hc)} is not a positive number; using 1`);
    role.headcount = 1;
  }
  const duties = role.duties ?? [];
  duties.forEach((d, i) => {
    const p = d && typeof d === "object" ? (d as DutyRecord).profile : undefined;
    if (!p || typeof p !== "object" || Object.keys(p).length === 0) {
      throw new DataError(`duty ${i} of role ${id} has no profile`);
    }
  });
  return { role, warnings: warn };
}

export function validateModels(models: ModelRecord[]): string[] {
  const warn: string[] = [];
  if (!models || models.length === 0) {
    warn.push("model catalogue is empty; nothing can be recommended");
  }
  const seen = new Set<string>();
  (models ?? []).forEach((m, i) => {
    const mid = m.model_id;
    if (!mid) throw new DataError(`model at index ${i} has no model_id`);
    if (seen.has(mid)) warn.push(`duplicate model_id '${mid}'`);
    seen.add(mid);
    const p = m.cost_input_per_1m;
    if (p === null || p === undefined) {
      warn.push(`${mid} has no input price and cannot be costed or ranked`);
    } else if (typeof p !== "number" || p <= 0) {
      warn.push(`${mid} has a non-positive price ${JSON.stringify(p)}`);
    }
    if (!m.benchmarks || typeof m.benchmarks !== "object") {
      m.benchmarks = {};
      warn.push(`${mid} has no benchmarks object; treated as unscored`);
    }
  });
  return warn;
}

export function validateCalibration(
  calibration: CalibrationTable,
  models: ModelRecord[]
): string[] {
  const warn: string[] = [];
  const fields = new Set<string>();
  for (const m of models ?? []) {
    for (const k of Object.keys(m.benchmarks ?? {})) fields.add(k);
  }
  for (const [cap, c] of Object.entries(calibration ?? {})) {
    if (!KNOWN_CAPS.has(cap)) {
      warn.push(`calibration references unknown requirement '${cap}'`);
      continue;
    }
    const f = c.model_field;
    if (!f) continue;
    const declaredUnavailable = c.status === "unavailable";
    if (!fields.has(f) && !declaredUnavailable) {
      warn.push(`${cap} calibrates on '${f}', which no model carries`);
    }
    if (declaredUnavailable) continue; // declared intent, not a fault
    const vals = BANDS.map((b) => threshold(c.thresholds, b));
    const present = vals.filter((v): v is number => v !== null);
    if (present.length !== vals.length) {
      warn.push(`${cap} is missing thresholds for some bands`);
    } else if (present.some((v, i) => i > 0 && present[i - 1] > v)) {
      warn.push(`${cap} thresholds are not monotonic: ${JSON.stringify(present)}`);
    }
    if (!(c.status in STATUS_RANK)) {
      warn.push(`${cap} has an unrecognised status ${JSON.stringify(c.status)}`);
    }
  }
  return warn;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

export class Engine {
  readonly warnings: string[] = [];
  readonly models: ModelRecord[];
  readonly calibration: CalibrationTable;
  readonly caps: Record<string, string>;
  readonly exclude_cn: boolean;
  readonly usage: string;
  readonly effort_adjust: boolean;
  readonly offset_pct: number;
  readonly out_multiple: number | null;
  private _cov: Record<string, number> = {};
  private _max: Record<string, number> = {};
  private _integral: Record<string, boolean> = {};
  private _allowed: ModelRecord[] | null = null;

  constructor(
    models: ModelRecord[],
    calibration: CalibrationTable,
    capabilityNames: Record<string, string>,
    opts: EngineOptions = {}
  ) {
    const {
      exclude_cn = true,
      usage = "moderate",
      effort_adjust = true,
      offset_pct = 0,
      out_multiple = null,
    } = opts;
    this.warnings.push(...validateModels(models));
    this.warnings.push(...validateCalibration(calibration, models));
    let tier = usage;
    if (!(tier in USAGE_TIERS)) {
      this.warnings.push(`unknown usage tier '${tier}'; using 'moderate'`);
      tier = "moderate";
    }
    let offset = offset_pct;
    if (typeof offset !== "number" || !Number.isFinite(offset) || offset < -100 || offset > 100) {
      this.warnings.push(`offset ${JSON.stringify(offset_pct)} out of range; using 0`);
      offset = 0;
    }
    this.models = models;
    this.calibration = calibration;
    this.caps = capabilityNames;
    this.exclude_cn = exclude_cn;
    this.usage = tier;
    this.effort_adjust = effort_adjust;
    this.offset_pct = offset;
    this.out_multiple = out_multiple;
  }

  allowed(): ModelRecord[] {
    if (this._allowed === null) {
      this._allowed = this.exclude_cn
        ? this.models.filter((m) => !CN_VENDORS.has(m.vendor ?? ""))
        : this.models;
    }
    return this._allowed;
  }

  /** Rule 5, the ceiling: no threshold may exceed the best score achieved here. */
  axisMax(field: string): number {
    if (!(field in this._max)) {
      const v = this.allowed()
        .map((m) => (m.benchmarks ?? {})[field])
        .filter((x): x is number => x !== null && x !== undefined);
      this._max[field] = v.length ? Math.max(...v) : 100.0;
    }
    return this._max[field];
  }

  /** True when every published value on the axis is a whole number. */
  axisIsIntegral(field: string): boolean {
    if (!(field in this._integral)) {
      this._integral[field] = this.allowed().every((m) => {
        const v = (m.benchmarks ?? {})[field];
        return v === null || v === undefined || Number.isInteger(v);
      });
    }
    return this._integral[field];
  }

  /** The same question for a top-level specification field rather than an axis. */
  specIsIntegral(field: string): boolean {
    const key = `spec:${field}`;
    if (!(key in this._integral)) {
      this._integral[key] = this.allowed().every((m) => {
        const v = (m as unknown as Record<string, unknown>)[field];
        return v === null || v === undefined || Number.isInteger(v);
      });
    }
    return this._integral[key];
  }

  coverage(field: string): number {
    if (!(field in this._cov)) {
      const pool = this.allowed();
      const n = pool.filter((m) => {
        const b = (m.benchmarks ?? {})[field];
        return b !== null && b !== undefined;
      }).length;
      this._cov[field] = pool.length ? n / pool.length : 0.0;
    }
    return this._cov[field];
  }

  /** Calibration with the offset applied as a PERCENTAGE of the axis range, capped. */
  cal(cap: string): CalibrationEntry | undefined {
    const base = this.calibration[cap];
    if (!base || !base.model_field) return base;
    const mx = this.axisMax(base.model_field);
    const thresholds: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(base.thresholds ?? {})) {
      thresholds[k] =
        v === null ? null : Math.max(0.0, Math.min(v + (this.offset_pct / 100) * mx, mx));
    }
    return { ...base, thresholds };
  }

  // ---------- cost, all USD ----------
  effortFactor(mid: string): number {
    if (!this.effort_adjust) return 1.0;
    const f = burnOf(mid);
    return f === null ? 1.0 : f;
  }

  ratioFor(m: ModelRecord): number {
    return this.out_multiple !== null && this.out_multiple !== undefined
      ? this.out_multiple
      : OUT_RATIO[m.vendor ?? ""] ?? OUT_DEFAULT;
  }

  costPerMillion(m: ModelRecord): number | null {
    const ci = m.cost_input_per_1m;
    const co = m.cost_output_per_1m;
    if (ci === null || ci === undefined) return null;
    return co !== null && co !== undefined ? round(ci * 0.7 + co * 0.3, 4) : round(ci, 4);
  }

  /** Rule 9. Output is estimated at the vendor's published ratio on 15% of volume. */
  perSeatYear(m: ModelRecord): number | null {
    const ci = m.cost_input_per_1m;
    if (ci === null || ci === undefined) return null; // unpriced models cannot be costed
    const tok =
      (USAGE_TIERS[this.usage] ?? USAGE_TIERS.moderate) / 1_000_000 *
      this.effortFactor(m.model_id);
    const outPrice = m.cost_output_per_1m;
    const outCost =
      (outPrice !== null && outPrice !== undefined ? outPrice : ci * this.ratioFor(m)) *
      tok *
      0.15;
    return Math.max(0.0, (ci * tok + outCost) * 12);
  }

  // ---------- rules ----------
  /** Rule 2. Read from the rubric, not invented: the higher of accuracy and assurance. */
  static tier(p: Profile): number {
    const v = CONSEQUENCE_SOURCES.filter((c) => c in p).map((c) => p[c].score);
    return v.length ? Math.max(...v) : 10;
  }

  /** Rule 3. A role needing many things at once cannot use a specialist. */
  static breadth(p: Profile): number {
    return Object.entries(p).filter(([c, v]) => !BREADTH_SKIP.has(c) && v.score >= 70).length;
  }

  static shiftBand(level: number, steps: number): number {
    const i = (BANDS as readonly number[]).indexOf(level);
    const idx = i === -1 ? 0 : i;
    return BANDS[Math.min(BANDS.length - 1, Math.max(0, idx + steps))];
  }

  /** Rule 4. The rubric has a ceiling and the market does not. */
  static overflow(level: number, steps: number): number {
    return level === 90 ? ABOVE_TOP[Math.min(2, steps)] : 0;
  }

  /** Rule 6. "__unknown__" means the catalogue does not publish the field. */
  meetsSpec(cap: string, level: number, m: ModelRecord): [boolean, string] {
    if (cap in MODALITY) {
      if (level <= 10) return [true, ""];
      const have = m.input_modalities;
      if (have === null || have === undefined) return [true, "__unknown__"];
      return [have.includes(MODALITY[cap]), `does not accept ${MODALITY[cap]} input`];
    }
    if (cap in SPEC_NUMERIC) {
      const field = SPEC_FIELD[cap];
      const need = SPEC_NUMERIC[cap][level];
      const have = m[field as "throughput_tokens_per_sec"];
      if (have === null || have === undefined) return [true, "__unknown__"];
      return [
        have >= need,
        `${field} ${formatScore(have, this.specIsIntegral(field))} against ${need} required`,
      ];
    }
    const need = (cap === "CAP-14" ? DATA_REQ : ASSURANCE_REQ)[level];
    const have = m[SPEC_FIELD[cap] as "data_handling" | "assurance"];
    if (have === null || have === undefined) return [true, "__unknown__"];
    const miss = need.filter((x) => !have.includes(x)).sort();
    return [miss.length === 0, miss.length ? `missing ${formatMissing(miss)}` : ""];
  }

  /**
   * The threshold a capability requirement is actually judged against: rule 2
   * and 3's band shift, rule 4's overflow at the top band, and rule 5's ceiling,
   * all applied. null when the requirement cannot be assessed at all.
   *
   * `recommend` uses this, and so does the interface, so the number shown to a
   * buyer is by construction the number that did the eliminating. Reproducing
   * the arithmetic a second time in the view is how the two drift apart.
   */
  appliedThreshold(cap: string, score: number, sh: number): { level: number; value: number } | null {
    const k = this.cal(cap);
    if (!k || !k.model_field || k.status === "unavailable") return null;
    let level = Engine.shiftBand(score, sh);
    let need = threshold(k.thresholds, level);
    if (need === null) {
      // The higher band has no measured threshold, so fall back to the stated
      // level and record that it did (join specification, section 6a).
      level = score;
      need = threshold(k.thresholds, level);
    }
    if (need === null) return null;
    return {
      level,
      value: Math.min(need + Engine.overflow(level, sh), this.axisMax(k.model_field)),
    };
  }

  /**
   * The highest-capability model in the catalogue. Rule 10's allocation, and
   * the yardstick the interface prices "everyone gets the best" against.
   * Ties go to the first, as the reference's max() does.
   */
  topRated(): ModelRecord | null {
    const scored = this.allowed().filter((m) => (m.benchmarks ?? {}).intelligence);
    if (!scored.length) return null;
    return scored.reduce((a, b) =>
      (b.benchmarks!.intelligence as number) > (a.benchmarks!.intelligence as number) ? b : a
    );
  }

  /** true / false / null where the answer is unknown. */
  meets(m: ModelRecord, cap: string, meta: RequirementEntry, sh: number): boolean | null {
    if (cap in SPEC_FIELD) {
      const [ok, why] = this.meetsSpec(cap, meta.score, m);
      return why === "__unknown__" ? null : ok;
    }
    const k = this.cal(cap);
    if (!k || !k.model_field || k.status === "unavailable") return null;
    const lvl = Engine.shiftBand(meta.score, sh);
    const t = k.thresholds;
    const need = Object.prototype.hasOwnProperty.call(t, String(lvl))
      ? t[String(lvl)]
      : threshold(t, meta.score);
    const have = (m.benchmarks ?? {})[k.model_field];
    if (need === null || need === undefined || have === null || have === undefined) return null;
    return have >= need;
  }

  recommend(
    profile: Profile,
    constraints: { excluded_vendors?: string[] } | null = null
  ): Recommendation {
    const c = constraints ?? {};
    const t = Engine.tier(profile);
    const br = Engine.breadth(profile);
    const [shiftC, strict] = CONSEQUENCE_POLICY[t];
    const shiftB = br >= BREADTH_TRIGGER ? 1 : 0;
    const sh = Math.min(2, shiftC + shiftB);

    let live: ModelRecord[] = [...this.allowed()];
    const out: Elimination[] = [];
    const unassessed: string[] = [];
    const deciding: string[] = [];
    const thin = new Set<string>();

    // Rule 1. Buyer constraints eliminate first, and they are certain.
    for (const v of c.excluded_vendors ?? []) {
      for (const m of [...live]) {
        if (m.vendor === v) {
          live = live.filter((x) => x !== m);
          out.push({
            model: m.model_id,
            requirement: "buyer constraint",
            reason: `vendor ${v} excluded`,
          });
        }
      }
    }

    // Rule 6. Specifications.
    for (const [cap, meta] of Object.entries(profile)) {
      if (!(cap in SPEC_FIELD) || meta.critical !== "Mandatory") continue;
      let silent = 0;
      for (const m of [...live]) {
        const [ok, why] = this.meetsSpec(cap, meta.score, m);
        if (why === "__unknown__") {
          silent += 1;
          continue;
        }
        if (!ok) {
          live = live.filter((x) => x !== m);
          out.push({ model: m.model_id, requirement: cap, kind: "spec", reason: why });
          if (!deciding.includes(cap)) deciding.push(cap);
        }
      }
      if (silent && silent === live.length) thin.add(cap);
    }

    // Rule 7. Capabilities, at the shifted level.
    for (const [cap, meta] of Object.entries(profile)) {
      if (cap in SPEC_FIELD || meta.critical !== "Mandatory") continue;
      const k = this.cal(cap);
      if (!k || !k.model_field || k.status === "unavailable") {
        unassessed.push(cap);
        continue;
      }
      const applied = this.appliedThreshold(cap, meta.score, sh);
      if (!applied) {
        unassessed.push(cap);
        continue;
      }
      const { level: lvl, value: need } = applied;
      for (const m of [...live]) {
        const have = (m.benchmarks ?? {})[k.model_field];
        if (have === null || have === undefined) {
          if (strict && this.coverage(k.model_field) >= COVERAGE_GATE) {
            live = live.filter((x) => x !== m);
            out.push({
              model: m.model_id,
              requirement: cap,
              kind: "capability",
              reason: "no published benchmark on a broadly-covered axis",
            });
          } else {
            thin.add(cap);
          }
          continue;
        }
        if (have < need) {
          live = live.filter((x) => x !== m);
          out.push({
            model: m.model_id,
            requirement: cap,
            kind: "capability",
            reason: `${formatScore(have, this.axisIsIntegral(k.model_field))} against ${need.toFixed(1)} required at level ${lvl}`,
            short_by: round(need - have, 1),
          });
          if (!deciding.includes(cap)) deciding.push(cap);
        }
      }
    }
    for (const cap of thin) {
      if (!unassessed.includes(cap)) unassessed.push(cap);
    }

    // Rule 8. Desirable requirements RANK, never eliminate.
    const desirable = Object.keys(profile).filter((c2) => profile[c2].critical !== "Mandatory");
    const ranked: RankedModel[] = live.map((m) => ({
      ...m,
      _miss: desirable.filter((c2) => this.meets(m, c2, profile[c2], sh) === false).length,
    }));
    // Unpriced models sort last: they cannot be recommended, only reported.
    ranked.sort((a, b) => {
      if (a._miss !== b._miss) return a._miss - b._miss;
      const ca = this.costPerMillion(a) ?? Infinity;
      const cb = this.costPerMillion(b) ?? Infinity;
      return ca === cb ? 0 : ca - cb;
    });

    // Confidence, limited by the weakest deciding link, never averaged.
    const scope = deciding.length ? deciding : Object.keys(profile);
    const ranks: number[] = [];
    for (const cap of scope) {
      ranks.push(CLASS_RANK[profile[cap]?.evidence_class ?? "E"] ?? 1);
      const k = this.calibration[cap];
      if (k && !(cap in SPEC_FIELD) && k.model_field) {
        ranks.push(STATUS_RANK[k.status ?? "unavailable"] ?? 1);
      }
    }
    const worst = ranks.length ? Math.min(...ranks) : 1;
    let limiter: string | null = null;
    for (const cap of scope) {
      if ((CLASS_RANK[profile[cap]?.evidence_class ?? "E"] ?? 1) === worst) {
        limiter = cap;
        break;
      }
    }

    return {
      pick: ranked.length ? ranked[0] : null,
      live: ranked,
      eliminated: out,
      unassessed,
      deciding,
      tier: t,
      breadth: br,
      shift: sh,
      consequence_shift: shiftC,
      breadth_shift: shiftB,
      confidence: CONFIDENCE[worst],
      limited_by: limiter,
    };
  }

  /** null propagates: an unpriced model has no cost, and must not be shown as zero. */
  private static rnd(v: number | null, mult = 1): number | null {
    return v === null ? null : round(v * mult, 2);
  }

  /**
   * strict=true throws DataError on structural faults. strict=false returns a
   * typed error result instead, for batch runs that must not abort.
   */
  assess(
    roleInput: Role,
    constraints: { excluded_vendors?: string[] } | null = null,
    strict = true
  ): Assessment {
    let role: Role;
    let roleWarnings: string[];
    try {
      const v = validateRole(roleInput);
      role = v.role;
      roleWarnings = v.warnings;
    } catch (e) {
      if (strict || !(e instanceof DataError)) throw e;
      return {
        role_id: (roleInput as Role)?.role_id,
        answer: { outcome: "cannot assess", model: null, reason: e.message },
        detail: { error: e.message },
      };
    }
    const r = this.recommend(role.profile, constraints);
    // The reference reads role.get("headcount", 60): the default applies only
    // when the key is absent. A key present and null is a null headcount, which
    // falls through to 1 below. `?? 60` would quietly turn it into 60 seats.
    const stated: unknown = role.headcount === undefined ? 60 : role.headcount;
    const seats: number = typeof stated === "number" && stated >= 1 ? stated : 1;
    const isExec = role.seniority === "Leader" && role.authority === "Strategic";

    if (r.pick) {
      const u = r.unassessed.length;
      return {
        role_id: role.role_id,
        answer: {
          outcome: u ? "qualified" : "supported",
          model: shortName(r.pick.model_id),
          model_id: r.pick.model_id,
          cost_per_million_usd: this.costPerMillion(r.pick),
          cost_per_person_year_usd: Engine.rnd(this.perSeatYear(r.pick)),
          cost_for_role_year_usd: Engine.rnd(this.perSeatYear(r.pick), seats),
          headcount: seats,
          confidence: r.confidence,
          unassessed: r.unassessed.map((c) => this.caps[c] ?? c),
          warnings: roleWarnings,
        },
        detail: r,
      };
    }

    // Rule 10. Allocate the best available, never claim it is a fit.
    if (isExec) {
      const top = this.topRated();
      if (top) {
        const unmet = r.deciding.filter((c) => !r.unassessed.includes(c));
        return {
          role_id: role.role_id,
          answer: {
            outcome: "best available",
            allocation_not_fit: true,
            model: shortName(top.model_id),
            model_id: top.model_id,
            cost_per_person_year_usd: Engine.rnd(this.perSeatYear(top)),
            cost_for_role_year_usd: Engine.rnd(this.perSeatYear(top), seats),
            headcount: seats,
            confidence: r.confidence,
            unmet_requirements: unmet.map((c) => this.caps[c] ?? c),
            warnings: roleWarnings,
          },
          detail: r,
        };
      }
    }

    // Rule 11. Decomposition fires only on failure.
    if (role.duties && role.duties.length) {
      const duties: DutyOutcome[] = role.duties.map((dd) => {
        const s = this.recommend(dd.profile, constraints);
        return {
          duty: dd.duty,
          supported: Boolean(s.pick),
          model: s.pick ? shortName(s.pick.model_id) : null,
          blocked_by: s.pick ? [] : s.deciding.map((c) => this.caps[c] ?? c),
        };
      });
      return {
        role_id: role.role_id,
        answer: {
          outcome: "partially supported",
          duties_supported: duties.filter((x) => x.supported).length,
          duties_total: duties.length,
          confidence: r.confidence,
          note: "Counts of duties, not proportions of a job. Duties are not weighted.",
          warnings: roleWarnings,
        },
        detail: { ...r, duties },
      };
    }

    return {
      role_id: role.role_id,
      answer: {
        outcome: "not supported",
        model: null,
        confidence: r.confidence,
        blocked_by: r.deciding.map((c) => this.caps[c] ?? c),
        warnings: roleWarnings,
      },
      detail: r,
    };
  }

  /**
   * Data quality report. Run this after any catalogue refresh: a model rename
   * upstream will silently drop benchmark coverage, and this is what catches it.
   */
  health(): Health {
    const pool = this.allowed();
    const axes: Record<string, AxisHealth> = {};
    for (const [cap, c] of Object.entries(this.calibration)) {
      const f = c.model_field;
      if (!f) continue;
      const n = pool.filter((m) => {
        const b = (m.benchmarks ?? {})[f];
        return b !== null && b !== undefined;
      }).length;
      axes[cap] = {
        field: f,
        status: c.status,
        models_with_data: n,
        coverage_pct: pool.length ? round((n / pool.length) * 100, 1) : 0.0,
        can_eliminate_on_absence: (pool.length ? n / pool.length : 0) >= COVERAGE_GATE,
      };
    }
    const unpriced = pool.filter(
      (m) => m.cost_input_per_1m === null || m.cost_input_per_1m === undefined
    );
    return {
      models_total: this.models.length,
      models_allowed: pool.length,
      models_unpriced: unpriced.length,
      axes,
      warnings: this.warnings,
      verdict: !this.warnings.length && !unpriced.length ? "ok" : "review warnings",
    };
  }
}

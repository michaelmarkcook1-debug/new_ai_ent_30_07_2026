// The catalogue client.
//
// Reads the movement catalogue out of Postgres over PostgREST. Deliberately
// plain `fetch` rather than @supabase/supabase-js: this repo has five runtime
// dependencies and the whole surface needed here is two GETs and one RPC.
// Adding a client library to save thirty lines would be the wrong trade, and
// the rest of this app's data layer already talks HTTP directly.
//
// The publishable key below is not a secret. Supabase's key model has exactly
// two kinds: a publishable key designed to be shipped to browsers, and a
// service key that never leaves a server. This is the first. What protects the
// data is row-level security, not the secrecy of this string: anonymous
// callers may read the catalogue, may not write to it, and may not read the
// usage table at all.

const URL_DEFAULT = "https://lmptnwqthldbficddtfn.supabase.co";
const KEY_DEFAULT = "sb_publishable_6n0xJyCSOEU6LewMa7qj5g_4WTsQVuU";
const TIMEOUT_MS = 8_000;

function base(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? URL_DEFAULT;
}

function key(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? KEY_DEFAULT;
}

/** Whether a catalogue is configured at all. */
export function catalogueConfigured(): boolean {
  return Boolean(base() && key());
}

export type Series = "model" | "vendor" | "market" | "usage";

export interface Observation {
  id: number;
  series: Series;
  subject_kind: string;
  subject_id: string;
  subject_label: string;
  metric: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  observed_at: string;
  ingested_at: string;
  source_id: string;
  provenance: string;
  vintage: string | null;
}

export interface CatalogueSource {
  id: string;
  name: string;
  url: string | null;
  licence: string;
  evidence_class: "A" | "B" | "C" | "D" | "E";
  measures: string;
  cannot_support: string;
}

export interface IngestionRun {
  id: number;
  series: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  attempted: number;
  rows_written: number;
  failures: { subject: string; reason: string }[];
  note: string | null;
}

/**
 * One page from PostgREST, with the true row count alongside it.
 *
 * `count=exact` makes the server report the total in Content-Range as
 * `<from>-<to>/<total>`. That total is the only trustworthy way to know an
 * answer was cut short: PostgREST enforces its own row ceiling (1,000 on this
 * project) regardless of the `limit` asked for, so comparing the returned
 * length against our own limit silently misses it — which it did, returning
 * 1,000 of 1,252 model observations while reporting nothing was truncated.
 */
async function getPage<T>(
  pathAndQuery: string,
  offset: number
): Promise<{ rows: T[]; total: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/rest/v1/${pathAndQuery}&offset=${offset}`, {
      headers: {
        apikey: key(),
        authorization: `Bearer ${key()}`,
        prefer: "count=exact",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`catalogue HTTP ${res.status}`);
    // PostgREST answers JSON or nothing; a non-JSON body means something is
    // in front of the database that should not be, so it is not parsed.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) throw new Error(`catalogue returned ${type || "no content-type"}`);
    const rows = (await res.json()) as T[];
    const range = res.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1]);
    // A missing or "*" total means the server declined to count; falling back
    // to the page length would understate it, so treat the page as the floor
    // and let the caller's paging loop decide.
    return { rows, total: Number.isFinite(total) ? total : rows.length + offset };
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(pathAndQuery: string): Promise<T[]> {
  const { rows } = await getPage<T>(pathAndQuery, 0);
  return rows;
}

/**
 * Every observation in a series, newest first.
 *
 * The limit exists to bound a runaway query, not to sample. It is set above
 * the current row count on purpose — the model series alone holds 1,252
 * observations, and a 500-row default silently returned an alphabetical
 * fraction of it while the response still read as complete. The caller is told
 * when the cap is reached (see `observationsWithCap`) rather than being handed
 * a truncated set that looks whole.
 */
export const OBSERVATION_LIMIT = 5000;

export function observations(
  series: Series,
  limit = OBSERVATION_LIMIT
): Promise<Observation[]> {
  return get<Observation>(
    `catalogue_observation?series=eq.${series}&order=observed_at.desc,subject_label.asc&limit=${limit}`
  );
}

/**
 * Every observation in a series, paged past the server's row ceiling.
 *
 * PostgREST caps a single response at 1,000 rows here whatever `limit` says,
 * so one request cannot return the 1,252-row model series. This pages until it
 * has them all, and reports `truncated` against the server's own count rather
 * than against our limit — a truncated answer is still useful, a truncated
 * answer presented as complete is not.
 */
export async function observationsWithCap(
  series: Series,
  limit = OBSERVATION_LIMIT
): Promise<{ rows: Observation[]; total: number; truncated: boolean }> {
  const q = `catalogue_observation?series=eq.${series}&order=observed_at.desc,subject_label.asc&limit=1000`;
  const all: Observation[] = [];
  let total = 0;

  while (all.length < limit) {
    const page = await getPage<Observation>(q, all.length);
    total = page.total;
    all.push(...page.rows);
    // An empty page, or one that already covers the count, means we are done.
    // The length check also guards against a server that ignores `offset`,
    // which would otherwise loop forever re-fetching the first page.
    if (page.rows.length === 0 || all.length >= total) break;
  }

  return { rows: all, total, truncated: all.length < total };
}

export function sources(): Promise<CatalogueSource[]> {
  return get<CatalogueSource>("catalogue_source?order=evidence_class.asc,name.asc");
}

export function runs(limit = 20): Promise<IngestionRun[]> {
  return get<IngestionRun>(`catalogue_run?order=started_at.desc&limit=${limit}`);
}

/**
 * How many observations a series holds, without fetching them. One row is
 * requested purely so PostgREST reports the exact total in Content-Range;
 * the row itself is discarded.
 */
export async function seriesCount(series: Series): Promise<number> {
  const { total } = await getPage<Observation>(
    `catalogue_observation?series=eq.${series}&order=observed_at.desc&limit=1`,
    0
  );
  return total;
}

export interface UsageSummaryRow {
  surface: string;
  action: string;
  events: number;
  last_at: string;
}

/**
 * Aggregate usage counts, via an RPC that returns GROUP BY totals only.
 *
 * The usage table itself stays unreadable from outside — no select policy —
 * and that is not weakened here: the function returns which surface, which
 * action, how many, and when last. Nothing row-shaped ever leaves.
 */
export async function usageSummary(): Promise<UsageSummaryRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/rest/v1/rpc/usage_summary`, {
      method: "POST",
      headers: {
        apikey: key(),
        authorization: `Bearer ${key()}`,
        "content-type": "application/json",
      },
      body: "{}",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`usage summary HTTP ${res.status}`);
    return (await res.json()) as UsageSummaryRow[];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One subject's movement on one metric: the two most recent observations, and
 * the change between them.
 *
 * Returns `null` for `change` when there is only one observation. A first
 * reading is not a movement of zero, and showing it as one would invent a
 * trend out of a single data point.
 */
export interface Movement {
  subject_id: string;
  subject_label: string;
  metric: string;
  unit: string | null;
  latest: number;
  latestAt: string;
  previous: number | null;
  previousAt: string | null;
  change: number | null;
  changePct: number | null;
  provenance: string;
  source_id: string;
}

export function toMovements(rows: Observation[]): Movement[] {
  // Rows arrive newest-first, so the first two of each group are the pair we
  // want without re-sorting.
  const grouped = new Map<string, Observation[]>();
  for (const r of rows) {
    if (r.value_num === null) continue;
    const k = `${r.subject_id}::${r.metric}`;
    const bucket = grouped.get(k);
    if (bucket) bucket.push(r);
    else grouped.set(k, [r]);
  }

  const out: Movement[] = [];
  for (const bucket of grouped.values()) {
    const [latest, previous] = bucket;
    const latestVal = latest.value_num as number;
    const prevVal = previous?.value_num ?? null;
    out.push({
      subject_id: latest.subject_id,
      subject_label: latest.subject_label,
      metric: latest.metric,
      unit: latest.unit,
      latest: latestVal,
      latestAt: latest.observed_at,
      previous: prevVal,
      previousAt: previous?.observed_at ?? null,
      change: prevVal === null ? null : latestVal - prevVal,
      // Guard the divide: a previous value of zero has no percentage change,
      // and Infinity rendered as "+∞%" would be worse than saying nothing.
      changePct:
        prevVal === null || prevVal === 0
          ? null
          : ((latestVal - prevVal) / Math.abs(prevVal)) * 100,
      provenance: latest.provenance,
      source_id: latest.source_id,
    });
  }
  return out;
}

/**
 * Record an anonymous usage event.
 *
 * Never throws and never awaits anything the caller depends on: telemetry that
 * can break a page is worse than no telemetry. The database sets the
 * timestamp, so a wrong clock on the caller cannot corrupt the record.
 */
export async function recordUsage(
  surface: string,
  action: string,
  subjectId?: string,
  detail?: Record<string, unknown>
): Promise<void> {
  if (!catalogueConfigured()) return;
  try {
    await fetch(`${base()}/rest/v1/rpc/record_usage`, {
      method: "POST",
      headers: {
        apikey: key(),
        authorization: `Bearer ${key()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_surface: surface,
        p_action: action,
        p_subject_id: subjectId ?? null,
        p_detail: detail ?? {},
      }),
      // keepalive so an event fired as the reader navigates away still lands.
      keepalive: true,
    });
  } catch {
    // Deliberately silent. A failed telemetry write must not surface to a
    // reader who did not ask to be counted in the first place.
  }
}

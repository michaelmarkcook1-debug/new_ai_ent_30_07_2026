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

async function get<T>(pathAndQuery: string): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base()}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: key(), authorization: `Bearer ${key()}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`catalogue HTTP ${res.status}`);
    // PostgREST answers JSON or nothing; a non-JSON body means something is
    // in front of the database that should not be, so it is not parsed.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) throw new Error(`catalogue returned ${type || "no content-type"}`);
    return (await res.json()) as T[];
  } finally {
    clearTimeout(timer);
  }
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
 * The same query, plus whether the cap was hit.
 *
 * A truncated answer is still useful; a truncated answer presented as a
 * complete one is not. `truncated` is true when exactly `limit` rows came
 * back, which is the only signal PostgREST gives without a second count query.
 */
export async function observationsWithCap(
  series: Series,
  limit = OBSERVATION_LIMIT
): Promise<{ rows: Observation[]; truncated: boolean }> {
  const rows = await observations(series, limit);
  return { rows, truncated: rows.length >= limit };
}

export function sources(): Promise<CatalogueSource[]> {
  return get<CatalogueSource>("catalogue_source?order=evidence_class.asc,name.asc");
}

export function runs(limit = 20): Promise<IngestionRun[]> {
  return get<IngestionRun>(`catalogue_run?order=started_at.desc&limit=${limit}`);
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

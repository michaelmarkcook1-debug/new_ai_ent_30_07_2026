"use client";

import { useMemo, useState } from "react";
import { MicroLabel } from "@/lib/ui/micro";
import type { Discovery, EntityDiscovery, ValueChange } from "@/lib/dataops/discover";
import type { Resolution, StagedRecord, Validation } from "@/lib/dataops/validate";
import type { IngestResult } from "@/lib/dataops/ingest";

// The operational UI. One column, in the order the work happens, and the
// mutation button appears only after validation has run on the current
// decisions. State lives in the browser: the staged discovery is exactly what
// the server saw, and validation and ingestion are asked on that object, so
// nothing is ever ingested that was not reviewed.

type DiscoveryResponse = Discovery & {
  payloads: Record<string, unknown>;
  taxonomy: string[];
  roster: { id: string; name: string }[];
  store: { writable: boolean; reason: string; root: string; staging: boolean };
};

const btn = "rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";
const btnQuiet = "rounded border border-base-300 bg-base-100 px-3 py-2 text-sm";
const sel = "tap rounded border border-base-300 bg-base-100 px-2 py-1 text-sm";
const levelTone: Record<string, string> = { READY: "text-good", WARNING: "text-warn", BLOCKED: "text-bad" };
const fmt = (v: unknown) => (v === undefined ? "" : v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : String(v));
const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function DataOperations() {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [validation, setValidation] = useState<Validation | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<IngestResult | { status: string; error?: string } | null>(null);
  const [busy, setBusy] = useState<"" | "discover" | "validate" | "ingest">("");
  const [error, setError] = useState<string | null>(null);

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`/api/admin/dataops/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  };

  const discover = async () => {
    setBusy("discover"); setError(null); setValidation(null); setSelected(new Set()); setResult(null); setResolutions({});
    try {
      const r = await post("discover");
      if (!r.ok) throw new Error((r.json as { error?: string }).error ?? `HTTP ${r.status}`);
      setDiscovery(r.json as DiscoveryResponse);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };

  const validate = async () => {
    if (!discovery) return;
    setBusy("validate"); setError(null); setResult(null);
    try {
      const r = await post("validate", { discovery, resolutions: Object.values(resolutions) });
      if (!r.ok) throw new Error((r.json as { error?: string }).error ?? `HTTP ${r.status}`);
      const v = r.json as Validation;
      setValidation(v);
      setSelected(new Set(v.records.filter((x) => x.selectedByDefault).map((x) => x.id)));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };

  const ingest = async () => {
    if (!discovery || !validation) return;
    setBusy("ingest"); setError(null);
    try {
      const r = await post("ingest", { discovery, resolutions: Object.values(resolutions), approvedIds: [...selected] });
      setResult(r.json as IngestResult);
      if (!r.ok && r.status !== 409 && r.status !== 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(""); }
  };

  const resolve = (id: string, patch: Partial<Resolution>) => {
    setValidation(null); setSelected(new Set());
    setResolutions((prev) => {
      const next = { ...prev };
      const cur = next[id] ?? { entityId: id, action: "new" as const };
      const merged = { ...cur, ...patch } as Resolution;
      if (patch.action === undefined && !merged.action) delete next[id]; else next[id] = merged;
      return next;
    });
  };
  const unresolve = (id: string) => { setValidation(null); setSelected(new Set()); setResolutions((prev) => { const n = { ...prev }; delete n[id]; return n; }); };

  const reviewEntities = useMemo(() => (discovery?.entities ?? []).filter((e) => e.state !== "KNOWN"), [discovery]);
  const stagedChanges = useMemo(() => (discovery?.changes ?? []).filter((c) => c.status !== "unchanged"), [discovery]);
  const byId = useMemo(() => new Map((validation?.records ?? []).map((r) => [r.id, r])), [validation]);
  const approvedPlan = useMemo(() => {
    if (!validation) return { entities: 0, changes: 0, records: 0 };
    const picked = validation.records.filter((r) => selected.has(r.id) && r.level !== "BLOCKED" && r.applicable);
    return { entities: picked.filter((r) => r.kind === "entity").length, changes: picked.filter((r) => r.kind === "change").length, records: picked.length };
  }, [validation, selected]);

  const card = (label: string, value: number | string, tone = "") => (
    <div className="rounded border border-base-300 bg-base-100 px-3 py-2">
      <div className="font-mono text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={btn} onClick={discover} disabled={busy !== ""}>
            {busy === "discover" ? "Discovering..." : "Discover latest data"}
          </button>
          <span className="text-sm text-muted">Reads the source and compares. Writes nothing.</span>
        </div>
        {discovery ? (
          <div className="mt-3 space-y-1 text-sm">
            <div><span className="font-semibold">Last discovery:</span> fetched {discovery.discoveredAt} from <span className="font-mono">{discovery.source}</span> <span className="text-muted">(a fetch time, not an evidence date)</span></div>
            <div><span className="font-semibold">Canonical store:</span> <span className="font-mono">{discovery.store.root}</span>{discovery.store.staging ? " (staging copy)" : ""} {discovery.store.writable ? <span className="text-good">writable</span> : <span className="text-warn">read-only: {discovery.store.reason}</span>}</div>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
      </section>

      {discovery ? (
        <>
          <section>
            <MicroLabel label="Sources" tooltip="One row per canonical payload: what we hold, what the source holds, and whether a value differs." />
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left font-mono text-xs uppercase tracking-wider text-muted"><th className="pr-3">Source</th><th className="pr-3">Status</th><th className="pr-3">Canonical capture</th><th className="pr-3">Discovered capture</th><th className="pr-3">Records</th><th>Note</th></tr></thead>
                <tbody>
                  {discovery.files.map((f) => (
                    <tr key={f.file} className="border-t border-base-300 align-top">
                      <td className="py-1 pr-3 font-mono">{f.file}{f.endpoint ? <span className="text-muted"> ← {f.endpoint}</span> : null}</td>
                      <td className={`py-1 pr-3 font-semibold ${f.status === "failed" || f.status === "older" ? "text-warn" : f.status === "new-capture" ? "text-good" : ""}`}>{f.status}</td>
                      <td className="py-1 pr-3 font-mono">{dayOf(f.canonicalCapture) || "?"}</td>
                      <td className="py-1 pr-3 font-mono">{dayOf(f.discoveredCapture) || (f.endpoint ? "?" : "n/a")}</td>
                      <td className="py-1 pr-3 font-mono">{f.canonicalRecords ?? "?"} → {f.discoveredRecords ?? "?"}</td>
                      <td className="py-1 text-muted">{f.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {card("New entities", discovery.summary.newEntities)}
            {card("Unresolved", validation ? validation.summary.unresolved : discovery.summary.unresolved, "text-warn")}
            {card("Changed values", discovery.summary.changed)}
            {card("Ready", validation ? validation.summary.ready : "–", "text-good")}
            {card("Warnings", validation ? validation.summary.warnings : "–", "text-warn")}
            {card("Blocked", validation ? validation.summary.blocked : "–", "text-bad")}
          </section>

          {reviewEntities.length > 0 ? (
            <section>
              <MicroLabel label="Entities needing a decision" tooltip="Anything the source names that this product does not hold. A suggestion is a suggestion; nothing is assigned or merged until you choose." />
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left font-mono text-xs uppercase tracking-wider text-muted"><th className="pr-2"></th><th className="pr-3">Status</th><th className="pr-3">Entity</th><th className="pr-3">Source</th><th className="pr-3">Suggested</th><th className="pr-3">Match candidates</th><th>Decision</th></tr></thead>
                  <tbody>
                    {reviewEntities.map((e: EntityDiscovery) => {
                      const r = resolutions[e.id];
                      const v = byId.get(`entity|${e.id}`);
                      const eid = `entity|${e.id}`;
                      const selectable = Boolean(v && v.level !== "BLOCKED" && v.applicable);
                      return (
                        <tr key={e.id} className="border-t border-base-300 align-top">
                          <td className="py-1 pr-2"><input type="checkbox" aria-label={`Select ${e.name}`} className="accent-[var(--ag-primary)]" disabled={!selectable} checked={selected.has(eid)} onChange={(ev) => setSelected((prev) => { const n = new Set(prev); if (ev.target.checked) n.add(eid); else n.delete(eid); return n; })} /></td>
                          <td className="py-1 pr-3"><span className={`font-semibold ${e.state === "REJECTED" ? "text-bad" : e.state === "UNRESOLVED" ? "text-warn" : ""}`}>{e.state}</span>{v ? <div className={`font-mono text-xs ${levelTone[v.level]}`}>{v.level}</div> : null}</td>
                          <td className="py-1 pr-3"><div className="font-semibold">{e.name}</div><div className="font-mono text-xs text-muted">{e.id}{e.upstreamCategory ? ` · upstream "${e.upstreamCategory}"` : ""}</div><div className="text-xs text-muted">{e.reason}</div></td>
                          <td className="py-1 pr-3 font-mono text-xs">{e.source}<div className="text-muted">{dayOf(e.evidenceDate) || "no date"}</div></td>
                          <td className="py-1 pr-3 text-xs">{e.suggestion ? (<><div className={e.suggestion.state === "evidenced" ? "font-semibold" : "font-semibold text-warn"}>{e.suggestion.suggested ?? (e.suggestion.requiresNewTopLevel ? "STOP: new top-level category needed" : "none")}</div><div className="text-muted">{e.suggestion.reason}</div><div className="text-muted">evidence: {e.suggestion.evidence} · {e.suggestion.state}</div></>) : <span className="text-muted">n/a</span>}</td>
                          <td className="py-1 pr-3 text-xs">{e.match && e.match.candidates.length ? e.match.candidates.slice(0, 3).map((c) => (<div key={c.id}><span className="font-mono">{c.id}</span> {Math.round(c.score * 100)}% <span className="text-muted">{c.reason}</span></div>)) : <span className="text-muted">none</span>}{e.match?.ambiguous ? <div className="text-warn">ambiguous: choose</div> : null}</td>
                          <td className="py-1">
                            {e.state === "REJECTED" ? <span className="text-muted">cannot ingest</span> : (
                              <div className="space-y-1">
                                <select aria-label={`Decision for ${e.name}`} className={sel} value={r?.action ?? ""} onChange={(ev) => (ev.target.value ? resolve(e.id, { action: ev.target.value as Resolution["action"], category: r?.category, matchId: r?.matchId ?? e.match?.suggestion ?? undefined }) : unresolve(e.id))}>
                                  <option value="">Review required</option>
                                  <option value="new">Add as new vendor</option>
                                  <option value="match">Match existing vendor</option>
                                  <option value="reject">Reject</option>
                                </select>
                                {r?.action === "new" ? (
                                  <select aria-label={`Category for ${e.name}`} className={sel} value={r.category ?? ""} onChange={(ev) => resolve(e.id, { category: ev.target.value || undefined })}>
                                    <option value="">Choose an existing category</option>
                                    {discovery.taxonomy.map((c) => <option key={c} value={c}>{c}{c === e.suggestion?.suggested ? " (suggested)" : ""}</option>)}
                                  </select>
                                ) : null}
                                {r?.action === "match" ? (
                                  <select aria-label={`Match for ${e.name}`} className={sel} value={r.matchId ?? ""} onChange={(ev) => resolve(e.id, { matchId: ev.target.value || undefined })}>
                                    <option value="">Choose the canonical vendor</option>
                                    {discovery.roster.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id}){c.id === e.match?.suggestion ? " (suggested)" : ""}</option>)}
                                  </select>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <MicroLabel label="Changes" tooltip="Every value that differs between the canonical payloads and the source. Unchanged values are counted, not listed." />
              {validation ? (
                <div className="flex gap-2">
                  <button type="button" className={btnQuiet} onClick={() => setSelected(new Set(validation.records.filter((x) => x.level === "READY" && x.applicable).map((x) => x.id)))}>Select all READY</button>
                  <button type="button" className={btnQuiet} onClick={() => setSelected(new Set())}>Deselect all</button>
                </div>
              ) : null}
            </div>
            {stagedChanges.length === 0 ? <p className="mt-2 text-sm text-muted">No value differs. {discovery.summary.unchanged} unchanged.</p> : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left font-mono text-xs uppercase tracking-wider text-muted"><th className="pr-2"></th><th className="pr-3">Status</th><th className="pr-3">Entity</th><th className="pr-3">Source</th><th className="pr-3">Field</th><th className="pr-3">Current</th><th className="pr-3">Discovered</th><th className="pr-3">Evidence</th><th>Findings</th></tr></thead>
                  <tbody>
                    {stagedChanges.map((c: ValueChange) => {
                      const v: StagedRecord | undefined = byId.get(c.id);
                      const selectable = Boolean(v && v.level !== "BLOCKED" && v.applicable);
                      return (
                        <tr key={c.id} className="border-t border-base-300 align-top">
                          <td className="py-1 pr-2"><input type="checkbox" aria-label={`Select ${c.label} ${c.field}`} className="accent-[var(--ag-primary)]" disabled={!selectable} checked={selected.has(c.id)} onChange={(ev) => setSelected((prev) => { const n = new Set(prev); if (ev.target.checked) n.add(c.id); else n.delete(c.id); return n; })} /></td>
                          <td className="py-1 pr-3"><span className="font-mono text-xs">{c.status}</span>{v ? <div className={`font-semibold ${levelTone[v.level]}`}>{v.level}</div> : null}</td>
                          <td className="py-1 pr-3"><div>{c.label}</div><div className="font-mono text-xs text-muted">{c.entity}</div></td>
                          <td className="py-1 pr-3 font-mono text-xs">{c.file}<div className="text-muted">{c.source}</div></td>
                          <td className="py-1 pr-3 font-mono text-xs">{c.field}</td>
                          <td className="py-1 pr-3 font-mono text-xs">{fmt(c.current)}<div className="text-muted">{dayOf(c.canonicalCapture)}</div></td>
                          <td className="py-1 pr-3 font-mono text-xs">{fmt(c.discovered)}</td>
                          <td className="py-1 pr-3 font-mono text-xs">{dayOf(c.evidenceDate) || "no date"}</td>
                          <td className="py-1 text-xs">{v ? v.findings.map((f, i) => <div key={i} className={levelTone[f.level]}>{f.rule}: {f.message}</div>) : <span className="text-muted">not validated</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={btn} onClick={validate} disabled={busy !== ""}>{busy === "validate" ? "Validating..." : "Validate"}</button>
              <span className="text-sm text-muted">Deterministic checks on the current decisions. Changing a decision above clears the result.</span>
            </div>
            {validation ? (
              <div className="mt-3 space-y-2 text-sm">
                <div>Ready {validation.summary.ready} · Warnings {validation.summary.warnings} · Blocked {validation.summary.blocked} · Unresolved {validation.summary.unresolved} · Category changes {validation.summary.categoryChanges}</div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={btn} onClick={ingest} disabled={busy !== "" || approvedPlan.records === 0 || !discovery.store.writable}>
                    {busy === "ingest" ? "Ingesting..." : `Ingest approved changes (${approvedPlan.records} record${approvedPlan.records === 1 ? "" : "s"}: ${approvedPlan.entities} entit${approvedPlan.entities === 1 ? "y" : "ies"}, ${approvedPlan.changes} value${approvedPlan.changes === 1 ? "" : "s"})`}
                  </button>
                  {!discovery.store.writable ? <span className="text-warn">Ingestion refused here: {discovery.store.reason}.</span> : <span className="text-muted">The mutation boundary. Only selected READY and WARNING records land; BLOCKED and unresolved never do.</span>}
                </div>
              </div>
            ) : null}
          </section>

          {result ? (
            <section className="rounded border border-base-300 bg-base-100 p-4 text-sm">
              <MicroLabel label="Ingestion result" />
              <div className={`mt-2 text-lg font-bold ${result.status === "INGESTED" ? "text-good" : result.status === "FAILED" ? "text-bad" : "text-warn"}`}>{result.status}</div>
              {"error" in result && result.error ? <div className="text-warn">{result.error}</div> : null}
              {"ingested" in result ? (
                <div className="mt-2 space-y-1">
                  <div>Ingested {(result as IngestResult).ingested} · Skipped {(result as IngestResult).skipped} · Blocked {(result as IngestResult).blocked} · Failed {(result as IngestResult).failed}{(result as IngestResult).reverted ? " · fixtures reverted" : ""}</div>
                  <div>Files: <span className="font-mono">{(result as IngestResult).files.join(", ") || "none"}</span></div>
                  <div>Derived artefacts: {(result as IngestResult).derived.length ? (result as IngestResult).derived.map((d) => <div key={d.step} className={d.ok ? "" : "text-bad"}><span className="font-mono">{d.step}</span> {d.ok ? "ok" : "FAILED"} <span className="text-muted">{d.output}</span></div>) : "not run"}</div>
                  <div>Evidence version: {(result as IngestResult).evidenceVersion ? <span className="font-mono">{(result as IngestResult).evidenceVersion!.before} → {(result as IngestResult).evidenceVersion!.after} ({(result as IngestResult).evidenceVersion!.changed ? "changed" : "unchanged"})</span> : "n/a"}</div>
                  <div>Analyst Insight: {(result as IngestResult).analystInsight}</div>
                  {(result as IngestResult).audit ? <div className="text-muted">Audit recorded at {(result as IngestResult).audit!.ingestedAt}: {(result as IngestResult).audit!.approved.length} approved, {(result as IngestResult).audit!.skipped.length} skipped, {(result as IngestResult).audit!.blocked.length} blocked, {(result as IngestResult).audit!.aliases.length} aliases, {(result as IngestResult).audit!.categoryMappings.length} category mappings.</div> : null}
                  {(result as IngestResult).status === "INGESTED" ? <div className="text-muted">Commit the changed files to make this permanent; a deploy follows the push.</div> : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

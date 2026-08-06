"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { formatUsd } from "@/lib/admin/cost-model";

// One fetch, four sections, no controls to learn. The page answers the four
// questions an operator actually asks, in the order they ask them, and every
// number either came from the database or is arithmetic whose inputs are a
// click away in the drawer.

interface RunCostRow {
  series: string;
  label: string;
  invocationUsd: number;
  cpuUsd: number;
  memoryUsd: number;
  upstreamUsd: number;
  totalUsd: number;
  requests: number;
  bytesIn: number;
  wallSeconds: number;
  rowsWritten: number;
  measured: string;
}

interface IngestionRun {
  id: number;
  series: string;
  started_at: string;
  ok: boolean | null;
  attempted: number;
  rows_written: number;
  failures: { subject: string; reason: string }[];
  note: string | null;
}

interface Payload {
  costs: {
    perRun: RunCostRow[];
    monthlyIfDailyUsd: number;
    unitPrices: Record<string, number | string>;
    note: string;
  };
  runs: IngestionRun[] | { error: string };
  seriesCounts: { series: string; count: number }[] | { error: string };
  usage:
    | { surface: string; action: string; events: number; last_at: string }[]
    | { error: string };
  connectors: { id: string; label: string; status: string; message: string | null }[];
  generatedAt: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const kb = (bytes: number) =>
  bytes === 0 ? "0" : bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)}MB` : `${Math.round(bytes / 1000)}KB`;

export function AdminOverview() {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/overview")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (res.ok && body?.costs) {
          setData(body as Payload);
          setState("ok");
        } else setState("failed");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <p className="py-10 text-center font-mono text-xs text-muted">
        Reading the operations state…
      </p>
    );
  }
  if (state === "failed" || !data) {
    return (
      <EmptyState
        title="The overview endpoint did not answer"
        detail="Nothing is shown rather than a status we cannot evidence."
      />
    );
  }

  const runsOk = Array.isArray(data.runs);
  const countsOk = Array.isArray(data.seriesCounts);
  const usageOk = Array.isArray(data.usage);
  const costBySeries = new Map(data.costs.perRun.map((c) => [c.series, c]));

  return (
    <div className="space-y-4">
      {/* 1: Did the ingestions run, and what did each cost? */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <MicroLabel
            label="Ingestion runs, most recent first"
            tooltip="Every run the catalogue has recorded, successful or not: a failed run is a row, not a silence. The cost column prices each run's measured quantities at published paid-tier unit prices."
          />
          <LaneBadge lane={runsOk ? "live" : "aie"} />
        </div>

        {runsOk && (data.runs as IngestionRun[]).length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="micro-label border-b border-base-300">
                  <th className="py-1.5 pr-3">When</th>
                  <th className="py-1.5 pr-3">Series</th>
                  <th className="py-1.5 pr-3">Outcome</th>
                  <th className="py-1.5 pr-3 text-right">Rows</th>
                  <th className="py-1.5 pr-3 text-right">Est. cost (list price)</th>
                </tr>
              </thead>
              <tbody>
                {(data.runs as IngestionRun[]).map((r) => {
                  const cost = costBySeries.get(r.series);
                  return (
                    <tr key={r.id} className="border-b border-base-300/60">
                      <td className="py-1.5 pr-3 font-mono">{when(r.started_at)}</td>
                      <td className="py-1.5 pr-3 font-semibold">{r.series}</td>
                      <td className="py-1.5 pr-3">
                        {r.ok === false || r.failures.length > 0 ? (
                          <span className="text-warn">
                            {r.failures.length > 0
                              ? `${r.failures.length} failure${r.failures.length === 1 ? "" : "s"}: ${r.failures.map((f) => f.subject).join(", ")}`
                              : "failed"}
                          </span>
                        ) : (
                          <span className="text-ok">ok</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-mono">{r.rows_written}</td>
                      <td className="py-1.5 pr-3 text-right font-mono">
                        {cost ? formatUsd(cost.totalUsd) : "n/a"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            {runsOk
              ? "No runs recorded yet."
              : `Could not load runs: ${(data.runs as { error: string }).error}`}
          </p>
        )}
      </section>

      {/* 2: What does a run cost, and why is the answer nothing? */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <MicroLabel
          label="What a run costs"
          tooltip="Measured requests, bytes and seconds per ingestion, priced at the platforms' published paid-tier rates. Nothing here is a vibe: the drawer shows how each quantity was measured."
        />
        <p className="measure mt-2 rounded border border-ok/40 bg-ok-bg/30 px-3 py-2 text-sm">
          <b>On the plans this product runs on, every run costs $0.</b> Vercel
          Hobby and Supabase Free are hard-capped, not metered, and every
          upstream API (SEC EDGAR, the Federal Register, the AIE feed) is
          free. The column below prices what a run <i>would</i> cost at paid
          list rates: running every series daily would come to about{" "}
          <b>{formatUsd(data.costs.monthlyIfDailyUsd)}/month</b>.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="micro-label border-b border-base-300">
                <th className="py-1.5 pr-3">Ingestion</th>
                <th className="py-1.5 pr-3 text-right">Requests</th>
                <th className="py-1.5 pr-3 text-right">Data in</th>
                <th className="py-1.5 pr-3 text-right">Wall time</th>
                <th className="py-1.5 pr-3 text-right">Rows</th>
                <th className="py-1.5 pr-3 text-right">Per run</th>
              </tr>
            </thead>
            <tbody>
              {data.costs.perRun.map((c) => (
                <tr key={c.series} className="border-b border-base-300/60">
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold">{c.series}</span>{" "}
                    <span className="text-muted">{c.label}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono">{c.requests || 0}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{kb(c.bytesIn)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{c.wallSeconds}s</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{c.rowsWritten || 0}</td>
                  <td className="py-1.5 pr-3 text-right font-mono font-bold">
                    {formatUsd(c.totalUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <DerivationDrawer title="How these costs are derived">
            <p>
              Per run: one Vercel invocation ($0.60 per million), active CPU
              seconds at $0.128/hour (fluid compute bills execution, not I/O
              waits), and provisioned memory at $0.0106/GB-hour on wall time
              for a 1.7GB instance. Unit prices as published on{" "}
              {String(data.costs.unitPrices.asOf)}. Upstream APIs charge
              nothing, and that is a fact about the sources, not a rounding.
            </p>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              {data.costs.perRun.map((c) => (
                <li key={c.series}>
                  <b>{c.series}:</b> {c.measured}
                </li>
              ))}
            </ul>
            <p className="text-muted">
              The active-CPU second counts are the least certain figures here:
              estimated from measured wall time minus network waits and the
              deliberate SEC throttle sleeps. They could be out by a factor of
              two without moving any total past a hundredth of a cent, which is
              why the estimate is safe to publish.
            </p>
          </DerivationDrawer>
        </div>
      </section>

      {/* 3: What is in the catalogue, and are the connectors up? */}
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <MicroLabel
            label="Catalogue"
            tooltip="Observation counts per series, from the database's own count: the same figure the movement API checks its answers against."
          />
          {countsOk ? (
            <ul className="mt-2 space-y-1">
              {(data.seriesCounts as { series: string; count: number }[]).map((s) => (
                <li key={s.series} className="flex justify-between text-sm">
                  <span className="font-semibold">{s.series}</span>
                  <span className="font-mono">{s.count} observations</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-warn">
              {(data.seriesCounts as { error: string }).error}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <MicroLabel
            label="Connectors"
            tooltip="Whether each external source can currently be reached with the configuration the app is running."
          />
          <ul className="mt-2 space-y-1">
            {data.connectors.map((c) => (
              <li key={c.id} className="text-sm">
                <span className={c.status === "ok" ? "text-ok" : "text-warn"}>
                  ●
                </span>{" "}
                <span className="font-semibold">{c.label}</span>
                {c.message ? (
                  <span className="block pl-4 text-xs text-muted">{c.message}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 4: Is anyone using the tools? */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <MicroLabel
          label="Usage, in aggregate"
          tooltip="Counts per surface and action, through a function that returns totals only. The raw usage table stays unreadable from outside, and holds nothing identifying anyway: no IP, no session, no visitor text."
        />
        {usageOk && (data.usage as { events: number }[]).length > 0 ? (
          <ul className="mt-2 space-y-1">
            {(
              data.usage as {
                surface: string;
                action: string;
                events: number;
                last_at: string;
              }[]
            ).map((u) => (
              <li
                key={`${u.surface}-${u.action}`}
                className="flex flex-wrap justify-between gap-x-3 text-sm"
              >
                <span>
                  <span className="font-semibold">{u.surface}</span>{" "}
                  <span className="text-muted">{u.action}</span>
                </span>
                <span className="font-mono text-xs">
                  {u.events} event{u.events === 1 ? "" : "s"} · last {when(u.last_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">
            {usageOk
              ? "No usage recorded yet. The counters start when someone presses a tracked control, and record what was done, never who did it."
              : `Could not load usage: ${(data.usage as { error: string }).error}`}
          </p>
        )}
      </section>

      <p className="font-mono text-[10px] text-muted">
        Generated {when(data.generatedAt)} · cached five minutes · this page is
        public by design: it shows nothing the public endpoints do not already
        serve.
      </p>
    </div>
  );
}

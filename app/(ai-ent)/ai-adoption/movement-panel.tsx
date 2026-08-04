"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";

// Vendor movement, from the catalogue.
//
// The first panel in this product that answers "what changed", rather than
// "what is true now". It reads the catalogue, which keeps one row per fact per
// point in time, so a change here is the difference between two recorded
// observations rather than a number somebody typed.
//
// A subject with only one observation shows no change at all — not a zero, not
// a flat line. That distinction is the whole reason the API returns null there.

interface Movement {
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

interface Payload {
  series: string;
  observations: number;
  subjects: number;
  comparable: number;
  note: string;
  movements: Movement[];
  lastRuns: {
    startedAt: string;
    ok: boolean | null;
    rowsWritten: number;
    failures: { subject: string; reason: string }[];
  }[];
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

export function MovementPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalogue/vendor")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(body?.movements)) {
          setData(body as Payload);
          setState("ok");
        } else {
          setState("failed");
        }
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = data?.movements ?? [];
  const maxVal = Math.max(...rows.map((r) => r.latest), 1);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="What moved: disclosure year on year"
          tooltip="Two consecutive twelve-month windows of SEC 10-K filings, held as separate dated observations in the catalogue. The change is the difference between them, not a figure anyone entered."
        />
        <LaneBadge lane={state === "ok" ? "live" : "aie"} />
      </div>

      <div className="mt-3">
        {state === "loading" ? (
          <p className="py-8 text-center font-mono text-xs text-muted">
            Reading the catalogue…
          </p>
        ) : state === "failed" || !data ? (
          <EmptyState
            title="The catalogue did not answer"
            detail="Nothing is shown rather than a movement we cannot evidence."
          />
        ) : (
          <>
            <ul className="space-y-1.5">
              {rows.map((r) => {
                const isOpen = open === r.subject_id;
                const up = (r.change ?? 0) > 0;
                const flat = r.change === 0;
                return (
                  <li key={r.subject_id} className="border-b border-base-300/60 pb-1.5">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.subject_id)}
                      className="flex w-full items-center gap-2 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="w-36 shrink-0 text-[12.5px] font-semibold">
                        {r.subject_label}
                      </span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-base-200">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{ width: `${(r.latest / maxVal) * 100}%` }}
                        />
                      </span>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px]">
                        {r.latest}
                      </span>
                      <span
                        className={`w-24 shrink-0 text-right font-mono text-[11px] ${
                          r.change === null
                            ? "text-muted"
                            : flat
                              ? "text-muted"
                              : up
                                ? "text-ok"
                                : "text-warn"
                        }`}
                      >
                        {r.change === null
                          ? "no prior"
                          : flat
                            ? "unchanged"
                            : `${up ? "+" : ""}${r.change}${
                                r.changePct === null
                                  ? ""
                                  : ` (${up ? "+" : ""}${r.changePct.toFixed(0)}%)`
                              }`}
                      </span>
                      <span className="w-4 shrink-0 text-center text-[10px] text-muted">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="mt-2 pl-2 text-[11px] leading-relaxed text-muted">
                        <p>
                          {r.previous === null ? (
                            <>
                              One observation so far: <b>{r.latest}</b>{" "}
                              {r.unit} as at {shortDate(r.latestAt)}. No earlier
                              reading exists, so no change is shown.
                            </>
                          ) : (
                            <>
                              {shortDate(r.previousAt as string)}:{" "}
                              <b>{r.previous}</b> {r.unit} →{" "}
                              {shortDate(r.latestAt)}: <b>{r.latest}</b>{" "}
                              {r.unit}.
                            </>
                          )}
                        </p>
                        <p className="mt-1">{r.provenance}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className="mt-2 font-mono text-[10px] text-muted">{data.note}</p>

            {data.lastRuns[0]?.failures?.length ? (
              <p className="mt-1 text-[11px] text-warn">
                The last ingestion recorded{" "}
                {data.lastRuns[0].failures.length} failure
                {data.lastRuns[0].failures.length === 1 ? "" : "s"}, so this
                view may be incomplete:{" "}
                {data.lastRuns[0].failures.map((f) => f.subject).join(", ")}.
              </p>
            ) : null}

            <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
              <b>Growth here is not market share.</b> A vendor named in more
              annual reports is being written about more, which tracks
              attention and materiality rather than revenue. The clouds start
              from a far larger base than the model labs, so their small
              percentages sit on big numbers and the labs&apos; large
              percentages sit on small ones.
            </p>
          </>
        )}
      </div>

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How movement is derived">
          <p>
            The catalogue stores one row per fact per point in time: a subject,
            a metric, a value, and the date the value was true — which is not
            the date we recorded it. Movement is then just the difference
            between the two most recent rows for a subject, computed by the API
            so the figure on screen is the one the endpoint stands behind.
          </p>
          <p>
            For this series the two observations are consecutive twelve-month
            windows of SEC 10-K filings, each queried separately against EDGAR
            and dated at its own end. That is why a change exists on the first
            run: it is two genuine measurements, not one measurement and an
            assumption.
          </p>
          <p>
            Where a subject has only one observation the change is reported as
            absent rather than zero. A single reading is not evidence of
            stability, and the catalogue will not let it be drawn as a flat
            line.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

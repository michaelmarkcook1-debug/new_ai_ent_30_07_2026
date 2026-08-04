"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";

// Disclosed adoption, from our own endpoint.
//
// The first panel in this product whose data we own rather than proxy. Every
// figure here is a count of real filings, and every count can be opened: each
// row carries named registrants with a link to the document on sec.gov.
//
// What it is NOT is market share, and the panel says so twice — once in the
// heading, once in the caveat — because a bar chart of vendor names invites
// exactly that misreading, and this source cannot support it.

interface SicBucket {
  sic: string;
  label: string;
  filings: number;
}
interface Example {
  company: string;
  cik: string;
  filedOn: string;
  sic: string;
  url: string;
}
interface Row {
  vendor: string;
  filings: number;
  bySic: SicBucket[];
  examples: Example[];
  query: string;
}
interface Snapshot {
  measures: string;
  formType: string;
  window: string;
  fetchedAt: string;
  snapshotOf?: string;
  rows: Row[];
  failed: { vendor: string; reason: string }[];
  source: { name: string; apiDocs: string; cannotSupport: string; licence: string };
}

export function DisclosurePanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [source, setSource] = useState<"live" | "mock" | "error">("live");
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/adoption/disclosure?form=10-K")
      .then(async (res) => {
        const src = (res.headers.get("x-eai-source") ?? "error") as
          | "live"
          | "mock"
          | "error";
        const body = await res.json();
        if (cancelled) return;
        setSource(src);
        if (res.ok && body?.rows?.length) {
          setData(body as Snapshot);
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

  const max = data ? Math.max(...data.rows.map((r) => r.filings), 1) : 1;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Disclosed adoption: who names whom in their annual report"
          tooltip="Counts of SEC registrants naming each vendor in a 10-K filed in the last twelve months. Measured from filings, not modelled, and every count opens to the documents behind it."
        />
        <LaneBadge lane={source === "mock" ? "mock" : state === "ok" ? "live" : "aie"} />
      </div>

      <div className="mt-3">
        {state === "loading" ? (
          <p className="py-8 text-center font-mono text-xs text-muted">
            Querying SEC EDGAR…
          </p>
        ) : state === "failed" || !data ? (
          <EmptyState
            title="No answer from SEC EDGAR and no committed snapshot"
            detail="Nothing is shown rather than a figure we cannot source."
          />
        ) : (
          <>
            <ul className="space-y-1.5">
              {data.rows.map((r) => {
                const isOpen = open === r.vendor;
                return (
                  <li key={r.vendor} className="border-b border-base-300/60 pb-1.5">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : r.vendor)}
                      className="flex w-full items-center gap-2 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="w-36 shrink-0 text-[12.5px] font-semibold">
                        {r.vendor}
                      </span>
                      <span className="h-3 flex-1 overflow-hidden rounded-full bg-base-200">
                        <span
                          className="block h-full rounded-full bg-primary/70"
                          style={{ width: `${(r.filings / max) * 100}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right font-mono text-[11px]">
                        {r.filings} filings
                      </span>
                      <span className="w-4 shrink-0 text-center text-[10px] text-muted">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen ? (
                      <div className="mt-2 pl-2">
                        <p className="micro-label">Industries filing</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.bySic.slice(0, 6).map((b) => (
                            <span
                              key={b.sic}
                              className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-[10px] text-muted"
                            >
                              {b.label} · {b.filings}
                            </span>
                          ))}
                        </div>
                        <p className="micro-label mt-2">Check it yourself</p>
                        <ul className="mt-1 space-y-0.5">
                          {r.examples.map((e) => (
                            <li key={e.url || e.cik} className="text-[11px] text-muted">
                              <a
                                href={e.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {e.company}
                              </a>{" "}
                              · filed {e.filedOn}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1.5 font-mono text-[10px] text-muted">
                          Query: {r.query}
                        </p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {data.failed.length > 0 ? (
              <p className="mt-2 text-[11px] text-warn">
                {data.failed.length} vendor
                {data.failed.length === 1 ? "" : "s"} could not be resolved and
                {data.failed.length === 1 ? " is" : " are"} omitted rather than
                shown as zero: {data.failed.map((f) => f.vendor).join(", ")}.
              </p>
            ) : null}

            <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
              <b>This is not market share.</b> {data.source.cannotSupport} Counts
              also favour vendors that are embedded in other companies&apos;
              products, which is why Google Cloud and Microsoft Azure sit above
              the model labs here and would not on a spend measure.
            </p>

            <p className="mt-2 font-mono text-[10px] text-muted">
              {data.formType} · {data.window} ·{" "}
              {source === "mock"
                ? `committed snapshot, taken ${new Date(data.fetchedAt).toLocaleDateString("en-GB")}`
                : `queried live ${new Date(data.fetchedAt).toLocaleString("en-GB")}`}
            </p>
          </>
        )}
      </div>

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How disclosed adoption is derived">
          <p>
            Each row is one query against the SEC EDGAR full-text index: the
            vendor name in quotation marks, restricted to the stated form type
            and to filings made in the last twelve months. The count is the
            number of matching filings; the industry split is EDGAR&apos;s own
            aggregation over the filers&apos; SIC codes, not a bucketing of
            ours.
          </p>
          <p>
            The window matters. EDGAR indexes back to 2001, and an unbounded
            count measures &quot;ever mentioned&quot; rather than &quot;named in
            a current annual report&quot;. Anthropic&apos;s unbounded 10-K count
            is 56; bounded to the last year it is 36.
          </p>
          <p>
            Search terms are chosen to avoid collisions. &quot;Google Cloud&quot;
            and &quot;Microsoft Azure&quot; are used rather than the parent
            company names, which would match nearly every technology filing ever
            written. Mistral is not tracked, because the word collides with a
            wind and several unrelated companies.
          </p>
          <p className="text-muted">
            {data?.source.licence ??
              "US government work, public domain. SEC fair access requires a declared User-Agent."}{" "}
            The ingestion runs eight throttled requests, sequentially, well
            inside that policy.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { aieFetch, type AiePricingRow, type AieSource } from "@/lib/aie-live";
import type { TokenPrice } from "@/lib/aie";
import { formatIsoDateGb } from "../data";
import { PricingTable } from "./pricing-table";

// Token list pricing.
//
// "Live" is not the same as "current", and this table is where that bit. The
// AIE pricing API answers on request but serves a capture dated 2026-06-02
// whatever day you ask it, so preferring it over the local rows meant showing
// a two-month-old model list under a LIVE badge: no Claude Opus 5 or Sonnet 5,
// no GPT-5.6, no Gemini 3.x, while the benchmark capture on the same page
// already had all of them.
//
// Precedence is by capture date now, not by transport. The local rows carry an
// overlay re-read from the vendor pricing pages on 2 August 2026 for the three
// largest vendors, so they are used whenever they are fresher than what the
// API returns, and the API wins if it ever moves ahead of them.

interface LivePricing {
  rows: AiePricingRow[];
  capturedAt: string;
  provenance: string;
  asOf: string;
}

function toTokenPrice(r: AiePricingRow): TokenPrice {
  return {
    id: r.id,
    vendorId: r.vendorId,
    vendorName: r.vendorName,
    modelName: r.modelName,
    inputPerM: r.inputPerM,
    outputPerM: r.outputPerM,
    cachedInputPerM: r.cachedInputPerM,
    note: r.note ?? "",
    sourceUrl: r.sourceUrl ?? "",
  } as TokenPrice;
}

function fmtStamp(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatIsoDateGb(iso);
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function PricingSection({
  fallbackRows,
  fallbackCapturedAt,
  recheckedAt,
  recheckedVendors,
}: {
  fallbackRows: TokenPrice[];
  fallbackCapturedAt: string;
  /** ISO date the overlay vendors were last read from their own pages. */
  recheckedAt: string;
  recheckedVendors: string[];
}) {
  const [live, setLive] = useState<LivePricing | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    aieFetch<LivePricing>("pricing").then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.rows) setLive(res.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Freshest wins. The local set is dated by its overlay, since that is the
  // most recent thing in it; the API is dated by the capture it serves rather
  // than by the moment it answered.
  const localDate = recheckedAt > fallbackCapturedAt ? recheckedAt : fallbackCapturedAt;
  const liveDate = live?.capturedAt?.slice(0, 10) ?? "";
  const usingLive = live !== null && liveDate > localDate;

  const rows = usingLive ? live.rows.map(toTokenPrice) : fallbackRows;
  const lane = usingLive ? (source === "mock" ? "mock" : "aie-live") : "aie-live";
  const capturedAt = usingLive ? live.capturedAt : localDate;
  const apiBehind = live !== null && !usingLive;
  const vendorCount = new Set(rows.map((r) => r.vendorName)).size;
  const unverified = rows.filter(
    (r) => r.inputPerM === null && r.outputPerM === null
  ).length;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold">Token list pricing</h2>
            <LaneBadge lane={lane} />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            {rows.length} model rows across {vendorCount} vendors, USD per 1M
            tokens. Public list price is not the negotiated enterprise price:
            batch APIs commonly list 50 per cent lower, and committed-use,
            volume and residency terms vary. {unverified} rows carry no
            verified price and say so; nothing is guessed.
            {failed
              ? " The pricing API did not answer, so the local rows are shown."
              : ""}
            {apiBehind
              ? ` ${recheckedVendors.join(", ")} were re-read from their own pricing pages on ${fmtStamp(recheckedAt)}; the pricing API is still serving a ${fmtStamp(liveDate)} capture, so it is not used here.`
              : ""}
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-200/60 px-3 py-2">
          <MicroLabel
            label="Generated"
            tooltip="Capture date of this pricing snapshot from the public vendor pricing pages. Token pricing moves quickly, so every figure on this page carries this date."
          />
          <p className="mt-0.5 font-mono text-[13px] font-bold">
            {fmtStamp(capturedAt)}
          </p>
          <p className="text-[12px] text-muted">
            Snapshot of public vendor pricing pages
          </p>
          {usingLive && live.asOf ? (
            <p className="mt-1 font-mono text-[12px] text-muted">
              checked {fmtStamp(live.asOf)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2">
        <DerivationDrawer
          title="How this table is sourced"
          trigger="How this table is sourced"
        >
          <p>
            Every figure is a public list price captured on{" "}
            {fmtStamp(capturedAt)} from the vendor pricing page linked on its
            row.{" "}
            {usingLive
              ? "Rows are pulled live from the deployed AI Enterprise app's pricing API through our proxy; its own provenance line reads: "
              : `Rows for ${recheckedVendors.join(", ")} were read directly from each vendor's own published pricing page on ${fmtStamp(recheckedAt)}, and every other vendor carries the ported AIE capture of ${fmtStamp(fallbackCapturedAt)}.`}
            {usingLive ? `"${live.provenance}"` : ""}
          </p>
          <p>
            <strong>Live is not the same as current.</strong> The pricing API
            answers on request but serves a capture dated{" "}
            {fmtStamp(fallbackCapturedAt)} whichever day it is asked, so
            preferring it by default showed a model list a generation behind
            under a live badge. This table now takes whichever source has the
            later capture date.
          </p>
          <ul className="list-disc space-y-1 pl-4 text-muted">
            <li>
              Input, output and cached-input columns are USD per 1M tokens;
              cached-input appears only where the vendor publishes a clean
              line for it.
            </li>
            <li>
              The note column carries the dataset&apos;s own caveats verbatim,
              including batch discounts, per-request fees and residency
              premiums.
            </li>
            <li>
              Rows that could not be verified from a reliable live source
              render &quot;Not published&quot; rather than a guess.
            </li>
          </ul>
          <p className="text-muted">
            This area moves fast, so the capture date sits beside the table.
            Treat the snapshot as reference data, not a quote: verify against
            the linked source before relying on any figure.
          </p>
        </DerivationDrawer>
      </div>
      <PricingTable rows={rows} />
    </section>
  );
}

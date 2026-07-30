"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { aieFetch, type AiePricingRow, type AieSource } from "@/lib/aie-live";
import type { TokenPrice } from "@/lib/aie";
import { formatIsoDateGb } from "../data";
import { PricingTable } from "./pricing-table";

// Token list pricing, pulled live from the deployed AIE app's pricing API
// (same schema as the ported dataset). The ported rows stay as the explicit
// fallback so the table never empties.

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
}: {
  fallbackRows: TokenPrice[];
  fallbackCapturedAt: string;
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

  const usingLive = live !== null;
  const rows = usingLive ? live.rows.map(toTokenPrice) : fallbackRows;
  const lane = usingLive ? (source === "mock" ? "mock" : "aie-live") : "aie";
  const capturedAt = usingLive ? live.capturedAt : fallbackCapturedAt;
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
              ? " The live pull did not answer, so the ported dataset rows are shown."
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
          <p className="text-[10px] text-muted">
            Snapshot of public vendor pricing pages
          </p>
          {usingLive && live.asOf ? (
            <p className="mt-1 font-mono text-[9px] text-muted">
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
              : "Rows come from the ported AIE dataset because the live pull did not answer."}
            {usingLive ? `"${live.provenance}"` : ""}
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

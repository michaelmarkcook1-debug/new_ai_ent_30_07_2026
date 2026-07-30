"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CategoryChip, LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  aieFetch,
  type AieDashboardVendorRef,
  type AieSource,
} from "@/lib/aie-live";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";

// "Who is winning, who is losing": the deployed AIE dashboard's live
// momentum read, reasons verbatim, confidence shown as returned.

const TRACKED_IDS = new Set(TRACKED_VENDORS.map((v) => v.id));

function VendorCard({ item }: { item: AieDashboardVendorRef }) {
  const name = TRACKED_IDS.has(item.vendor.id) ? (
    <Link
      href={`/vendor-view/${item.vendor.id}`}
      className="text-[13px] font-bold hover:text-primary hover:underline"
    >
      {item.vendor.name}
    </Link>
  ) : (
    <span className="text-[13px] font-bold">{item.vendor.name}</span>
  );
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {name}
        <span
          className="font-mono text-[10px] text-muted"
          title="The dashboard's own confidence figure for this call, as returned"
        >
          conf {Math.round(item.confidence)}%
        </span>
      </div>
      <div className="mt-1">
        <CategoryChip label={item.vendor.category} />
      </div>
      <p className="mt-2 text-[12px] leading-snug text-base-content/85">{item.reason}</p>
    </div>
  );
}

export function WinningLosing() {
  const [data, setData] = useState<{
    winningVendors: AieDashboardVendorRef[];
    losingVendors: AieDashboardVendorRef[];
    generatedAt: string;
  } | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    aieFetch<{
      winningVendors: AieDashboardVendorRef[];
      losingVendors: AieDashboardVendorRef[];
      generatedAt: string;
    }>("market-dashboard").then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.winningVendors) setData(res.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold">Who is winning, who is losing</h2>
          <LaneBadge lane="aie-live" />
        </div>
        <p className="mt-1 text-[12px] text-muted">
          The live dashboard read is unavailable and no recorded fixture
          answered; nothing is shown rather than a guess.
        </p>
      </section>
    );
  }

  const lane = source === "mock" ? "mock" : "aie-live";
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Who is winning, who is losing</h2>
        <LaneBadge lane={lane} />
        {data ? (
          <span className="font-mono text-[10px] text-muted">
            generated{" "}
            {new Date(data.generatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : null}
      </div>
      <p className="mt-1 max-w-3xl text-[11px] text-muted">
        The deployed AIE dashboard&apos;s momentum calls, reasons verbatim with
        their own confidence figures; names link into the vendor profiles
        where the vendor is in the tracked roster.
      </p>
      {data === null ? (
        <p className="mt-3 font-mono text-[11px] text-muted">Loading the live read...</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <MicroLabel label="Winning" tooltip="Vendors the dashboard flags with rising momentum, with its stated reason." />
            <div className="mt-2 space-y-2">
              {data.winningVendors.map((w) => (
                <VendorCard key={w.vendor.id} item={w} />
              ))}
            </div>
          </div>
          <div>
            <MicroLabel label="Losing" tooltip="Vendors the dashboard flags with falling momentum, with its stated reason." />
            <div className="mt-2 space-y-2">
              {data.losingVendors.map((l) => (
                <VendorCard key={l.vendor.id} item={l} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

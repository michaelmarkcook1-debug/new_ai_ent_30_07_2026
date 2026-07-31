"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";

interface RankingEntry {
  ticker: string;
  name: string;
  displayName: string;
  score: number;
  generatedAt: string;
}

interface RankingResponse {
  success: boolean;
  entries: RankingEntry[];
  count: number;
}

// Delivery channel watch: the one Pulse card that is LIVE from BoardRadar
// (spec Section 5). Clearly labelled as the services channel, never blended
// with AI-market scores.
export function DeliveryChannelWatch() {
  const [entries, setEntries] = useState<RankingEntry[] | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    brFetch<RankingResponse>("ai-readiness/ranking").then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.entries) {
        setEntries(
          [...res.data.entries].sort((a, b) => b.score - a.score).slice(0, 6)
        );
      } else {
        setErrorCode(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="delivery-channel-card rounded-lg bg-base-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <MicroLabel
          label="Delivery channel watch"
          tooltip="AI readiness of the services channel: the integrators who would deliver your AI programme. Live from the BoardRadar provider catalogue and AI readiness ranking."
        />
        <LaneBadge lane={source === "mock" ? "mock" : "live"} />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Services channel (integrators), shown as the delivery layer. Not AI
        vendors.
      </p>
      <div className="mt-3">
        {entries === null && errorCode === null ? (
          <p className="py-4 text-center font-mono text-[11px] text-muted">
            Loading live ranking...
          </p>
        ) : errorCode ? (
          <p className="py-4 text-center font-mono text-[11px] text-muted">
            Live data unavailable ({errorCode}); no figure shown rather than a
            guess.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {entries!.map((e, i) => (
              <li key={e.ticker} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-4 text-right font-mono text-[10px] text-muted">
                    {i + 1}
                  </span>
                  {e.displayName || e.name}
                </span>
                <ScorePill score={e.score} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-3 border-t border-base-300 pt-2 text-right">
        <Link
          href="/ecosystem-navigator"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Who delivers it: Ecosystem Navigator
        </Link>
      </div>
    </section>
  );
}

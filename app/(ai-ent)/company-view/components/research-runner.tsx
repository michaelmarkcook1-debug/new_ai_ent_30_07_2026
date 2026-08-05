"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResearchedCompany } from "./researched-company";
import type { CompanyResearch } from "@/lib/research/company";

// The wheel, and the reason a reader can walk away from it.
//
// Research takes most of a minute. Rendering it server-side meant the tab hung
// on a blank page for that long, and leaving mid-run threw the work away. This
// starts the run, watches it, and shows how far along it is.
//
// Returning to the tab does not restart anything. The first thing this does is
// ask whether a run for this company already exists; a finished one renders
// immediately and one still going is rejoined at whatever percentage it has
// reached.

interface Status {
  found?: boolean;
  percent?: number;
  label?: string;
  done?: boolean;
  result?: CompanyResearch | null;
  elapsedMs?: number;
}

export function ResearchRunner({ company }: { company: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshed = useRef(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const poll = async (jobId?: string) => {
      const url = jobId
        ? `/api/research?job=${encodeURIComponent(jobId)}`
        : `/api/research?company=${encodeURIComponent(company)}`;
      const res = await fetch(url).then((r) => r.json()).catch(() => null);
      if (cancelled) return;

      if (!res?.found) {
        // Nothing running here, so start one.
        const started = await fetch("/api/research", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company }),
        })
          .then((r) => r.json())
          .catch(() => null);
        if (cancelled || !started?.id) return;
        setStatus(started);
        timer.current = setTimeout(() => poll(started.id), 1500);
        return;
      }

      setStatus(res);
      if (!res.done) {
        timer.current = setTimeout(() => poll(res.id), 1500);
      } else if (!refreshed.current) {
        // The analyst reading is written on the server from the finished job,
        // so the page is re-rendered once the run lands. Without this the
        // findings would appear and the reading that interprets them would
        // not, until the reader happened to reload.
        refreshed.current = true;
        router.refresh();
      }
    };

    setStatus(null);
    void poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [company]);

  if (status?.done && status.result) {
    return <ResearchedCompany research={status.result} />;
  }

  const pct = status?.percent ?? 0;
  const label = status?.label ?? "Starting";
  const seconds = Math.round((status?.elapsedMs ?? 0) / 1000);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-6">
      <div className="flex flex-wrap items-center gap-5">
        <Wheel percent={pct} />
        <div className="min-w-0">
          <p className="text-base font-bold">Researching {company}</p>
          <p className="measure mt-1 text-sm text-muted">
            {label}
            {seconds > 2 ? ` · ${seconds}s` : ""}
          </p>
          {/* The reason this panel exists rather than a spinner: the reader is
              free to go, and needs telling so. */}
          <p className="measure mt-2 text-sm text-muted">
            This takes up to a minute. You can move to another tab and come
            back: the run keeps going and this page rejoins it.
          </p>
        </div>
      </div>
    </section>
  );
}

function Wheel({ percent }: { percent: number }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      role="img"
      aria-label={`Research ${p} per cent complete`}
    >
      <circle
        cx="36"
        cy="36"
        r={R}
        fill="none"
        stroke="currentColor"
        opacity={0.15}
        strokeWidth="7"
      />
      <circle
        cx="36"
        cy="36"
        r={R}
        fill="none"
        stroke="var(--ag-insight)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(p / 100) * C} ${C}`}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text
        x="36"
        y="41"
        textAnchor="middle"
        className="fill-current font-mono text-[15px] font-bold"
      >
        {p}%
      </text>
    </svg>
  );
}

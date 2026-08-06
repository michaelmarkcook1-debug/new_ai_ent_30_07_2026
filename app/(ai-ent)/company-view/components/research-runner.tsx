"use client";

import { useEffect, useState } from "react";
import { ResearchedCompany } from "./researched-company";
import { WorkforceExposure } from "./workforce-exposure";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import type { AnalystInsightData } from "@/lib/analyst/insight";
import type { CompanyResearch } from "@/lib/research/company";
import type { ExposurePayload } from "@/lib/exposure/payload";

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
  insight?: { data: AnalystInsightData; authorship: "written" | "computed" } | null;
  elapsedMs?: number;
}

export function ResearchRunner({
  company,
  exposure,
}: {
  company: string;
  /**
   * Computed on the server so the 684 KB role library never reaches the
   * browser. Rendered here rather than on the page because the industry to
   * match against is only known once the research lands.
   */
  exposure: ExposurePayload;
}) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;

    // A finished run for this company, held by the browser. This is what makes
    // leaving the tab safe: coming back reads the answer rather than paying
    // for the research again.
    try {
      const saved = window.sessionStorage.getItem(`ag_research:${company}`);
      if (saved) {
        setStatus({ ...JSON.parse(saved), done: true });
        return;
      }
    } catch {
      // A blocked store just means the research runs again.
    }

    const run = async () => {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company }),
      }).catch(() => null);
      if (!res?.body || cancelled) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!cancelled) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Server-sent events arrive as "data: {...}\n\n", and a chunk can
        // carry several or half of one.
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          let msg: Status;
          try {
            msg = JSON.parse(line) as Status;
          } catch {
            continue;
          }
          if (cancelled) return;
          setStatus(msg);
          if (msg.done) {
            if (msg.result) {
              try {
                window.sessionStorage.setItem(
                  `ag_research:${company}`,
                  JSON.stringify(msg)
                );
              } catch {
                // Not storable; the reading is still on screen.
              }
            }
          }
        }
      }
    };

    setStatus(null);
    void run();
    return () => {
      cancelled = true;
    };
  }, [company]);

  if (status?.done && status.result) {
    return (
      <div className="space-y-4">
        <ResearchedCompany research={status.result} />
        {/* Blank until a company is named, and then about that company against
            the market rather than about the market on its own. */}
        {status.insight ? (
          <AnalystInsight
            insight={status.insight.data}
            authorship={status.insight.authorship}
            context={`${status.result.profile?.name ?? "this company"} against the AI market`}
          />
        ) : null}
        {/* Where AI has already reached this sector's work. Derived from the
            role library rather than retrieved, so it renders whether or not
            the sources said anything about their workforce, and it is badged
            and captioned so it can never read as a measurement of their
            actual staff. */}
        {status.result.profile ? (
          <WorkforceExposure
            payload={exposure}
            industry={status.result.profile.industry}
            companyName={status.result.profile.name}
            workforce={status.result.workforce}
          />
        ) : null}
      </div>
    );
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
            This takes up to a minute. Once it lands the answer is held for
            this session, so you can move between tabs and come back to it
            without waiting again.
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

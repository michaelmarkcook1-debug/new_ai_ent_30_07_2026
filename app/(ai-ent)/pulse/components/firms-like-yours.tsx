"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { aieFetch, type AieUptakeRow, type AieSource } from "@/lib/aie-live";
import {
  ADOPTION_REGIONS,
  ADOPTION_SEGMENTS,
  GLOBAL_REGION,
} from "@/app/(ai-ent)/peer-insights/data";
import { useDeskProfile } from "@/lib/desk/profile";

// For firms like yours.
//
// Ported from The Security Desk, 6 August 2026. Two taps and the corner of the
// page becomes the reader's own cohort rather than the market's average.
//
// It pulls the SAME uptake endpoint Peer Insights uses, with the same industry
// and region taxonomy, so setting a desk here and selecting by hand there give
// the same answer. Reusing the endpoint rather than porting The Desk's Census
// and Menlo figures also avoids standing up a second peer dataset that would
// eventually disagree with the first.
//
// No uploads and no account: the choice lives in this browser and is mirrored
// into a cookie so the rest of the page can read it. Said on screen, because a
// reader is entitled to know what a personalisation feature is doing with
// their answer before they give it.

interface UptakeResponse {
  rows?: AieUptakeRow[];
  provenance?: string | null;
  scope?: { industry?: string | null; region?: string | null } | null;
}

export function FirmsLikeYours() {
  const { profile, ready, save } = useDeskProfile();
  const [rows, setRows] = useState<AieUptakeRow[] | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "failed">(
    "idle"
  );

  useEffect(() => {
    if (!profile) {
      setState("idle");
      setRows(null);
      return;
    }
    let cancelled = false;
    setState("loading");
    const params: Record<string, string> = { industry: profile.industry };
    // The API rejects region=Global and means the same thing by omission.
    if (profile.region) params.region = profile.region;
    aieFetch<UptakeResponse>("uptake", params).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.rows?.length) {
        setRows(res.data.rows);
        setState("ok");
      } else {
        setRows(null);
        setState("failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const label =
    ADOPTION_SEGMENTS.find((s) => s.apiValue === profile?.industry)?.label ??
    profile?.industry ??
    "";
  const select =
    "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]";
  const top = rows ? [...rows].sort((a, b) => b.share - a.share).slice(0, 4) : [];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="For firms like yours"
          tooltip="Model-provider adoption within your industry and region, pulled live from the deployed AI Enterprise app for exactly the slice you pick."
        />
        <LaneBadge
          lane={
            source === "mock" ? "mock" : state === "ok" ? "aie-live" : "aie"
          }
        />
      </div>

      {/* Before hydration `ready` is false, so neither branch is asserted and
          the panel does not flash the wrong state at a reader who has a desk
          already set. */}
      {!ready ? (
        <p className="mt-3 text-[13px] text-muted">Reading your desk…</p>
      ) : !profile ? (
        <>
          <p className="measure mt-2 text-[13px] leading-relaxed">
            Two taps and this corner becomes yours. Nothing is uploaded and
            there is no account: the choice stays in this browser.
          </p>
          <DeskPicker onSave={save} className="mt-3" selectClass={select} />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
            Company size is not asked for, because nothing in this dataset
            varies by it
          </p>
        </>
      ) : (
        <>
          <p className="measure mt-2 text-[13px] leading-relaxed">
            <b>{label}</b>
            {profile.region ? (
              <>
                {" "}
                in <b>{profile.region}</b>
              </>
            ) : (
              <> across all regions</>
            )}
            .
          </p>

          {state === "loading" ? (
            <p className="mt-3 text-[13px] text-muted">Reading your cohort…</p>
          ) : state === "failed" || top.length === 0 ? (
            <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
              No adoption rows came back for this slice. That is a thin cohort
              reported thin, rather than a figure invented to fill the panel.
            </p>
          ) : (
            <ul className="mt-3 grid gap-1.5">
              {top.map((r) => (
                <li key={r.vendor} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[12.5px]">
                    {r.vendor}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-300">
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${Math.min(100, r.share * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-muted">
                    {Math.round(r.share * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              href="/peer-insights"
              className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              See the full cohort in Peer Insights →
            </Link>
            <button
              type="button"
              onClick={() => save(null)}
              className="font-mono text-[10px] uppercase tracking-wider text-muted hover:underline"
            >
              Clear my desk
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function DeskPicker({
  onSave,
  className,
  selectClass,
}: {
  onSave: (p: { industry: string; region: string | null }) => void;
  className?: string;
  selectClass: string;
}) {
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="micro-label">Industry</span>
          <select
            aria-label="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={selectClass}
          >
            <option value="">Pick one</option>
            {ADOPTION_SEGMENTS.map((s) => (
              <option key={s.apiValue} value={s.apiValue}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="micro-label">Region</span>
          <select
            aria-label="Region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={selectClass}
          >
            <option value="">{GLOBAL_REGION}</option>
            {ADOPTION_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={!industry}
        onClick={() => onSave({ industry, region: region || null })}
        className="mt-3 rounded bg-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
      >
        Set my desk
      </button>
    </div>
  );
}

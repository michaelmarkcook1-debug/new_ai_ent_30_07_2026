"use client";

import { useEffect, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { PeerAdoptionChart } from "./peer-adoption-chart";
import { aieFetch, type AieSource, type AieUptakeRow } from "@/lib/aie-live";
import {
  ADOPTION_REGIONS,
  ADOPTION_SEGMENTS,
  GLOBAL_REGION,
  UPTAKE_VENDOR_ID,
} from "./data";

// The two places that measure this directly, rather than modelling it. Both
// are later than the May 2026 model and both contradict its top-two ordering,
// which is why they are linked from inside the chart's own disclosure rather
// than left further up the page for a reader to find on their own.
const LIVE_SOURCES = [
  {
    label: "Menlo Ventures, mid-2026 LLM market update",
    url: "https://finance.yahoo.com/news/enterprise-llm-spend-reaches-8-130000140.html",
    says: "Anthropic ~40% of enterprise LLM spend against OpenAI ~27%",
  },
  {
    label: "Ramp AI Index, April 2026",
    url: "https://www.axios.com/2026/05/13/anthropic-openai-workplace-ai-adoption",
    says: "Anthropic passed OpenAI in business adoption, 34.4% against 32.3%",
  },
  {
    label: "The uptake endpoint itself",
    url: "https://ranking-engine-red.vercel.app/api/uptake",
    says: "the modelled figures above, exactly as this chart receives them",
  },
];

// Months between the model's vintage (May 2026) and the build date. Stated
// rather than left as a date the reader has to subtract from today.
const MODEL_AGE_MONTHS = 3;

// Peer adoption: who your industry and region is actually buying.
//
// Every selection is a live pull. The explorer now speaks the uptake engine's
// own nine segments, so industry and region both filter upstream and the
// answer on screen is the answer the API gave for exactly that slice. It used
// to offer eight AIE archetypes mapped onto those nine segments; five of the
// eight spanned more than one segment and could not filter upstream at all,
// so most of the menu quietly showed an unfiltered slice under a label naming
// an industry.
//
// Two controls were removed rather than fixed, because neither could be made
// honest:
//
//   Organisation size did nothing. The API ignores companySize and size
//   entirely (its scope comes back {industry, region} whatever you send) so
//   the control only ever re-weighted a local copy of the data while the
//   badge said live. A filter that changes the label and not the answer is
//   worse than no filter.
//
//   Global is not an upstream value; region=Global is rejected. Global is the
//   absence of a region filter, which is what the API calls a scope of "all",
//   so it is the default option and simply sends no region.
//
// What the endpoint returns is a modelled estimate dated May 2026, and it says
// so itself in a provenance string that is rendered verbatim below. Live here
// means freshly fetched, not freshly measured, and the interface must not let
// a green badge imply otherwise.

interface UptakeResponse {
  provenance?: string;
  scope?: { industry?: string; region?: string } | null;
  count?: number;
  rows: AieUptakeRow[];
}

/**
 * `onSegmentChange` lets the page mirror the industry choice into the panel
 * below without a second selector. The explorer still owns the state: a
 * fully controlled component would have meant lifting the live-fetch effect
 * out with it, and the fetch belongs next to the chart it fills.
 */
export function PeerAdoptionExplorer({
  onSegmentChange,
}: {
  onSegmentChange?: (apiValue: string) => void;
} = {}) {
  const [segment, setSegment] = useState("");
  const [region, setRegion] = useState("");
  const [rows, setRows] = useState<AieUptakeRow[] | null>(null);
  const [provenance, setProvenance] = useState<string | null>(null);
  const [scope, setScope] = useState<UptakeResponse["scope"]>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    const params: Record<string, string> = {};
    if (segment) params.industry = segment;
    // Global sends nothing: the API rejects region=Global and means the same
    // thing by omitting it.
    if (region) params.region = region;
    aieFetch<UptakeResponse>("uptake", params).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.rows?.length) {
        setRows(res.data.rows);
        setProvenance(res.data.provenance ?? null);
        setScope(res.data.scope ?? null);
        setState("ok");
      } else {
        setRows(null);
        setState("failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [segment, region]);

  const segmentLabel =
    ADOPTION_SEGMENTS.find((s) => s.apiValue === segment)?.label ?? "All industries";
  const regionLabel = region || GLOBAL_REGION;
  const select = "rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]";

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Peer adoption: who firms like yours are buying"
          tooltip="Share of model-provider adoption within your slice, pulled live from the deployed AI Enterprise app for exactly the industry and region you select."
        />
        <LaneBadge lane={source === "mock" ? "mock" : state === "ok" ? "aie-live" : "aie"} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="micro-label">Industry</span>
          <select
            aria-label="Industry"
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              onSegmentChange?.(e.target.value);
            }}
            className={select}
          >
            <option value="">All industries</option>
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
            className={select}
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

      <p className="mt-2 text-[11px] text-muted">
        {segmentLabel} · {regionLabel}
        {scope ? (
          <span className="ml-1 font-mono text-[10px]">
            (upstream scope: industry {scope.industry ?? "all"}, region{" "}
            {scope.region ?? "all"})
          </span>
        ) : null}
      </p>

      <div className="mt-3">
        {state === "loading" ? (
          <p className="py-8 text-center font-mono text-xs text-muted">
            Pulling this slice live…
          </p>
        ) : state === "failed" || !rows ? (
          <EmptyState
            title="The live pull did not answer for this slice"
            detail="Nothing is shown rather than a local approximation dressed as a live figure."
          />
        ) : (
          <PeerAdoptionChart
            rows={rows}
            vendorIdFor={(v) => UPTAKE_VENDOR_ID[v]}
            showDerivation={false}
          />
        )}
      </div>

      {/* The endpoint's own words about its own data, verbatim, then the age
          of the model in months and the places that measure this directly.
          Re-probed 4 August 2026: the upstream still serves the same May 2026
          model, so there is no fresher pull to make. Saying how old it is
          beats printing a date and leaving the reader to do the arithmetic. */}
      {provenance ? (
        <div className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
          <p>
            <b>What the source says about itself:</b>{" "}
            <span className="font-mono text-[11px]">{provenance}</span>
          </p>
          <p className="mt-1.5">
            <b>That model is {MODEL_AGE_MONTHS} months old</b> and has not been
            re-run: the endpoint was re-probed on 4 August 2026 and returned the
            same May 2026 model, so a refresh here fetches the same figures
            again. Live means freshly fetched, not freshly measured.
          </p>
          <p className="mt-1.5">
            This ordering puts OpenAI ahead of Anthropic; the two measurements
            below, both later than the model, disagree. Read the shape of the
            slice (which vendors appear at all, and how concentrated it is)
            rather than the order of the top two.
          </p>
          <p className="mt-2 border-t border-warn/30 pt-2">
            <b>Measured directly, and more recently:</b>
          </p>
          <ul className="mt-1 space-y-1">
            {LIVE_SOURCES.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {s.label}
                </a>
                <span className="text-muted">: {s.says}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How the adoption shares are derived">
          <p>
            Every selection is a live call to the deployed AI Enterprise app&apos;s
            uptake endpoint, filtered upstream by industry and region. The
            shares are normalised within the returned slice, so they always sum
            to 100 per cent of that slice rather than of the market.
          </p>
          <p>
            The underlying model is 585 region-by-industry-by-vendor cells (5
            regions, 9 industry segments, 13 model providers). Confidence per
            row is the average of the contributing cells&apos; native labels;
            two of those labels, &quot;Low-Medium&quot; and
            &quot;Medium-Low&quot;, share a rank, so a slice made only of
            Medium-Low cells reports as Low-Medium.
          </p>
          <p className="text-muted">
            Two filters were removed rather than repaired. Organisation size was
            ignored by the endpoint entirely, so it only ever re-weighted a
            local copy while the badge said live. Global is not an upstream
            value: it is the absence of a region filter, and is sent that way.
          </p>
          <p className="text-muted">
            These are directional adoption-share estimates, not disclosed vendor
            revenue or audited market share.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

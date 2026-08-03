"use client";

import { useEffect, useState } from "react";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { Accordion } from "@/lib/ui/accordion";
import { EmptyState } from "@/lib/ui/page";
import type { CyberRiskResponse } from "../types";

// Tickers confirmed live for /cyber-risk in the coverage probe
// (DATA_COVERAGE.md). Display names follow the coverage doc.
const CYBER_LIVE_TICKERS: { ticker: string; name: string }[] = [
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "GOOGL", name: "Google Cloud" },
  { ticker: "AMZN", name: "Amazon Web Services" },
  { ticker: "IBM", name: "IBM" },
  { ticker: "ORCL", name: "Oracle" },
  { ticker: "CRM", name: "Salesforce" },
  { ticker: "NOW", name: "ServiceNow" },
  { ticker: "SAP", name: "SAP" },
  { ticker: "ADBE", name: "Adobe" },
  { ticker: "CSCO", name: "Cisco" },
  { ticker: "DELL", name: "Dell" },
  { ticker: "BABA", name: "Alibaba Cloud" },
];

function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function NarrativeBlock({ label, tooltip, body }: { label: string; tooltip: string; body: string | null }) {
  if (!body) return null;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <MicroLabel label={label} tooltip={tooltip} />
      <p className="measure mt-2 text-[12.5px] leading-relaxed">{body}</p>
    </div>
  );
}

function EvidenceList({ label, items, emptyNote }: { label: string; items: string[]; emptyNote: string }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold">{label}</h3>
        <span className="font-mono text-[10px] text-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">{emptyNote}</p>
      ) : (
        <ul className="measure mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Live half of The Security Desk: BoardRadar /cyber-risk for the probed
// universe tickers, rendered exactly as returned. hasAnalysis:false renders
// the honest null state instead of an invented score.
export function CyberRiskPanel() {
  const [ticker, setTicker] = useState("MSFT");
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<BrSource>("live");
  const [data, setData] = useState<CyberRiskResponse | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorCode(null);
    brFetch<CyberRiskResponse>("cyber-risk", { ticker }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      setSource(res.source);
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setData(null);
        setErrorCode(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Live cyber risk analysis"
            tooltip="BoardRadar's per-company cyber risk analysis for the probed platform vendor universe, fetched live through the proxy and rendered exactly as returned."
          />
          <select
            aria-label="Vendor ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
          >
            {CYBER_LIVE_TICKERS.map((t) => (
              <option key={t.ticker} value={t.ticker}>
                {t.name} ({t.ticker})
              </option>
            ))}
          </select>
        </div>
        <LaneBadge lane={source === "mock" ? "mock" : "live"} />
      </div>

      {loading ? (
        <p className="py-10 text-center font-mono text-[11px] text-muted">
          Loading live cyber analysis...
        </p>
      ) : errorCode ? (
        <p className="py-10 text-center font-mono text-[11px] text-muted">
          Live cyber analysis unavailable ({errorCode}). No figure is shown in
          its place.
        </p>
      ) : data && !data.hasAnalysis ? (
        <div className="mt-3">
          <EmptyState
            title="Awaiting cyber analysis"
            detail={`BoardRadar returned an honest empty analysis for ${data.companyName}: no score, findings or incidents exist yet, and none are invented here.`}
          />
        </div>
      ) : data ? (
        <div className="mt-3 space-y-4">
          {/* Header: company, generated stamp, score with derivation */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-bold">
                {data.companyName} ({data.ticker})
              </h2>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                Generated {formatTimestamp(data.timestamp)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <MicroLabel
                label="Cyber risk score"
                tooltip="BoardRadar's 0 to 100 cyber risk score for this company, rendered exactly as returned with no adjustment by this desk."
              />
              <ScorePill score={data.riskScore} lockedLabel="No analysis" />
              <DerivationDrawer title="How the cyber risk score is derived">
                <p>
                  The score is produced by BoardRadar's cyber risk analysis and
                  rendered here exactly as returned: The Security Desk applies
                  no adjustment, re-weighting or interpretation of its own.
                </p>
                <ul className="measure list-disc space-y-1 pl-4 text-muted">
                  <li>
                    BoardRadar does not publish its weighting formula through
                    the API, so this desk does not restate one.
                  </li>
                  <li>
                    What you can verify sits on this page: the analysis
                    summary, the findings and the evidence sources the
                    analysis cites.
                  </li>
                  <li>
                    Colour bands follow the house score bands (70 and above
                    green, 40 to 69 amber, below 40 red) and carry no extra
                    meaning beyond BoardRadar's own summary text.
                  </li>
                </ul>
                <p className="measure text-muted">
                  Where BoardRadar has no analysis for a company (hasAnalysis
                  false), no score is invented: the page shows an honest empty
                  state instead.
                </p>
              </DerivationDrawer>
            </div>
          </div>

          {data.summary ? (
            <p className="measure text-[13px] leading-relaxed">{data.summary}</p>
          ) : null}

          {/* Narrative blocks */}
          <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-3">
            <NarrativeBlock
              label="Threat landscape"
              tooltip="BoardRadar's read of the adversary pressure this company faces, as returned by the analysis."
              body={data.threatLandscape}
            />
            <NarrativeBlock
              label="Security posture"
              tooltip="BoardRadar's read of the company's defensive programme, as returned by the analysis."
              body={data.securityPosture}
            />
            <NarrativeBlock
              label="Compliance status"
              tooltip="BoardRadar's read of certifications and control effectiveness, as returned by the analysis."
              body={data.complianceStatus}
            />
          </div>

          {/* Vulnerabilities and incidents */}
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
            <EvidenceList
              label="Vulnerabilities"
              items={data.vulnerabilities}
              emptyNote="None listed in this analysis."
            />
            <EvidenceList
              label="Recent incidents"
              items={data.recentIncidents}
              emptyNote="None listed in this analysis."
            />
          </div>

          {/* Findings and recommendations as accordions (house idiom) */}
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
            <Accordion title="Key findings" count={data.keyFindings.length} defaultOpen>
              <ul className="measure list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed">
                {data.keyFindings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Recommendations" count={data.recommendations.length}>
              <ul className="measure list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed">
                {data.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Accordion>
          </div>

          {/* Evidence sources, attributed */}
          <div className="rounded-lg border border-base-300 bg-base-200/50 p-4">
            <MicroLabel
              label="Evidence sources"
              tooltip="The sources BoardRadar cites for this analysis, listed as attributed by the API."
            />
            {data.evidenceSources.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted">
                No sources attributed in this analysis.
              </p>
            ) : (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] text-muted">
                {data.evidenceSources.map((src) => (
                  <li key={src}>{src}</li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

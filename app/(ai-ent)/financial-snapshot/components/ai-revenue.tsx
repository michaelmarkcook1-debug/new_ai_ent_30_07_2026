import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import {
  formatUsd,
  type CompanyRevenueView,
  type RevenueView,
} from "../segment-data";

// Where AI revenue sits, on two footings kept deliberately apart.
//
// The segment bar is audited XBRL, and it is a CEILING: AI revenue cannot
// exceed the segment that carries it, and AWS is overwhelmingly non-AI cloud.
// The disclosed statement is the company's own words, quoted with its filing.
// The gap between them is the honest answer to "what is their AI revenue",
// and for six of nine there is no answer at all.

const BAR_H = 26;

function SegmentBar({ company }: { company: CompanyRevenueView }) {
  const segs = company.segments ?? [];
  const total = company.segmentTotalUsd ?? 0;
  if (!segs.length || !total) return null;

  // Colour by size rank rather than by any AI judgement: naming one segment
  // "the AI segment" would be an editorial call the filing does not support.
  const shades = [
    "var(--ag-primary)",
    "color-mix(in srgb, var(--ag-primary) 62%, transparent)",
    "color-mix(in srgb, var(--ag-primary) 38%, transparent)",
    "color-mix(in srgb, var(--ag-primary) 22%, transparent)",
  ];

  let x = 0;
  return (
    <div>
      <svg
        viewBox={`0 0 100 ${BAR_H}`}
        preserveAspectRatio="none"
        className="h-[26px] w-full"
        role="img"
        aria-label={`${company.name} revenue split across ${segs.length} reported segments`}
      >
        {segs.map((s, i) => {
          const w = (s.revenueUsd / total) * 100;
          const el = (
            <rect
              key={s.segment}
              x={x}
              y={0}
              width={Math.max(0, w - 0.4)}
              height={BAR_H}
              fill={shades[Math.min(i, shades.length - 1)]}
              rx={1}
            >
              <title>
                {s.segment}: {formatUsd(s.revenueUsd)} ({s.sharePct}% of
                reported segment revenue)
              </title>
            </rect>
          );
          x += w;
          return el;
        })}
      </svg>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {segs.map((s, i) => (
          <li key={s.segment} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: shades[Math.min(i, shades.length - 1)] }}
              aria-hidden
            />
            <span>{s.segment}</span>
            <span className="font-mono text-[10.5px] text-muted">
              {formatUsd(s.revenueUsd)} · {s.sharePct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AiRevenuePanel({ view }: { view: RevenueView }) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">
          AI revenue: what is actually disclosed
        </h2>
        <LaneBadge lane="live" />
        <span className="font-mono text-[10px] text-muted">
          {view.disclosingCount} of {view.totalCount} disclose a figure
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[12px] text-muted">
        No filer reports AI revenue as a segment, so there is no AI line to
        extract and none is estimated here. Two things are shown instead: the
        audited segment split from each company&apos;s own 10-K, which is a
        ceiling rather than an AI figure, and any AI revenue the company states
        in its own words, quoted with the filing it came from.
      </p>

      <div className="mt-3 space-y-3">
        {view.companies.map((c) => (
          <article
            key={c.ticker}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.vendorId ? (
                    <Link
                      href={`/vendor-view/${c.vendorId}`}
                      className="text-[14px] font-bold hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  ) : (
                    <span className="text-[14px] font-bold">{c.name}</span>
                  )}
                  <span className="font-mono text-[10px] text-muted">
                    {c.ticker}
                  </span>
                  {c.category ? (
                    <span className="rounded-full border border-base-300 px-2 py-0.5 text-[10.5px] text-muted">
                      {c.category}
                    </span>
                  ) : null}
                </div>
                {c.segmentTotalUsd ? (
                  <p className="mt-0.5 font-mono text-[11px] text-muted">
                    {formatUsd(c.segmentTotalUsd)} reported segment revenue
                    {c.periodEnd ? `, FY to ${c.periodEnd}` : ""}
                  </p>
                ) : null}
              </div>
              {c.aiStatements.length > 0 ? (
                <span className="rounded bg-good-bg px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-good">
                  States a figure
                </span>
              ) : (
                <span className="rounded bg-base-200 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-muted">
                  Not disclosed
                </span>
              )}
            </div>

            {c.segments?.length ? (
              <div className="mt-3">
                <MicroLabel
                  label="Reported segments"
                  tooltip="The audited segment split from the company's own 10-K. A ceiling on AI revenue, not a measure of it."
                />
                <div className="mt-1.5">
                  <SegmentBar company={c} />
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded border border-dashed border-base-300 px-3 py-2 text-[11.5px] text-muted">
                {c.singleSegment
                  ? "Reports as a single segment: no breakout is disclosed, so there is no split to show."
                  : (c.segmentNote ??
                    "No segment breakout could be read from the latest filing.")}
              </p>
            )}

            {c.aiStatements.length > 0 ? (
              <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                <MicroLabel
                  label="Stated by the company"
                  tooltip="Quoted verbatim from the filing. Not computed, not paraphrased."
                />
                {c.aiStatements.slice(0, 2).map((s) => (
                  <div key={s.url + s.statement.slice(0, 40)} className="mt-1.5">
                    <p className="text-[12px] leading-relaxed">
                      &ldquo;{s.statement}&rdquo;
                    </p>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 inline-block font-mono text-[9.5px] text-primary hover:underline"
                    >
                      {s.form ?? "filing"}
                      {s.filedAt ? ` filed ${s.filedAt}` : ""} · SEC EDGAR
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11.5px] text-muted">
                States no quantified AI revenue figure in any 10-K, 10-Q or 8-K.
                Its AI revenue is not public, and nothing here estimates one.
              </p>
            )}

            {c.filingUrl ? (
              <a
                href={c.filingUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-[9px] text-muted hover:text-primary hover:underline"
              >
                source: {c.form} XBRL instance
              </a>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-3">
        <DerivationDrawer title="How this is derived, and what it is not">
          <p>
            Segment revenue is parsed from each filer&apos;s own XBRL instance,
            where facts point at contexts carrying a business-segments axis.
            SEC&apos;s JSON APIs return consolidated facts only and strip that
            dimension, so the split is not available from them. These are
            audited figures exactly as filed.
          </p>
          <p>
            <strong>Segment revenue is not AI revenue.</strong> It is a
            ceiling: AI revenue cannot exceed the segment carrying it. AWS,
            Intelligent Cloud and Google Cloud are overwhelmingly conventional
            cloud, so treating a segment total as an AI figure would overstate
            it by a wide margin.
          </p>
          <p>
            The stated figures come from full-text search over the same
            filings, keeping only statements that carry a magnitude, quoted
            verbatim with the filing URL. Amazon&apos;s $15 billion AI run rate
            sitting inside a $128.7 billion AWS segment is the useful reading:
            even at the most AI-exposed company, AI is a minority of the
            segment that carries it.
          </p>
          <p className="text-muted">
            Six of the nine tracked listed AI vendors state no AI revenue
            figure at all. That silence is reported as the finding rather than
            filled with an estimate. Segment data captured{" "}
            {view.segmentCapturedAt}; disclosure search run{" "}
            {view.disclosureCapturedAt}.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

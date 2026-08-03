import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type { AnalystInsightData } from "@/lib/analyst/insight";

// The Analyst Insight that opens every page except the Pulse.
//
// Same shape as the Pulse hero, which is the reference: label, headline,
// judgement, then the action. The Pulse itself is untouched; this is that
// pattern applied to the other tabs, driven by each page's own data.
//
// No confidence badge. The brief asks for one, but confidence labels were
// removed from this platform on request and putting them back on fourteen new
// surfaces would undo that deliberately. Evidence state and the record count
// answer the useful half of the question: whether a reading is measured or
// assumed, and how much sits behind it.

// Sources publish dates in two shapes: ISO from the live APIs, and already
// formatted from the AIE datasets. Slicing ten characters off the second kind
// printed "31 July 20" on the Price / Performance page, which reads as a
// clipped year rather than a date.
const shortDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value;

const ACTION_TONE: Record<string, string> = {
  Accelerate: "bg-good-bg text-good border-good/40",
  Expand: "bg-good-bg text-good border-good/40",
  Shortlist: "bg-good-bg text-good border-good/40",
  Monitor: "bg-base-200 text-muted border-base-300",
  Investigate: "bg-warn-bg text-warn border-warn/40",
  Renegotiate: "bg-warn-bg text-warn border-warn/40",
  Pause: "bg-error-bg text-error border-error/40",
  "Reduce exposure": "bg-error-bg text-error border-error/40",
};

export function AnalystInsight({
  insight,
  /** What the page is about, shown as the label. */
  context,
}: {
  insight: AnalystInsightData;
  context: string;
}) {
  const { evidence } = insight;

  return (
    <section className="rounded-xl border border-primary/35 bg-primary/[0.04] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary"
            aria-hidden
          >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          <MicroLabel
            label="Analyst insight"
            tooltip={`What the ${context} data means, before the data itself.`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LaneBadge lane={evidence.lane} />
          {evidence.lastUpdated ? (
            <span className="font-mono text-[12px] text-muted">
              {shortDate(evidence.lastUpdated)}
            </span>
          ) : null}
        </div>
      </div>

      {insight.insufficient ? (
        // The data will not carry a conclusion, so none is offered. This is a
        // first-class state rather than a softened version of a claim.
        <p className="measure mt-3 text-[14px] leading-relaxed text-muted">
          <span className="font-semibold text-base-content">
            Current evidence is insufficient to draw a reliable conclusion.
          </span>{" "}
          {insight.insufficient}
        </p>
      ) : (
        <>
          <h2 className="mt-3 max-w-3xl text-balance text-[18px] font-bold leading-snug sm:text-[21px]">
            {insight.headline}
          </h2>

          {/* Two columns once there is width for them: the reading on the
              left, the corroborating item and the action on the right. The
              single column was the source of the worst dead space in the
              product, because the copy stopped at its measure while the news
              box below it ran the full width of the card. */}
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 @4xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="measure text-[13.5px] leading-relaxed text-muted">
                {insight.summary}
              </p>

              {insight.implications.length > 0 ? (
                <ul className="measure mt-4 space-y-1.5 border-t border-base-300/70 pt-3">
                  {insight.implications.slice(0, 3).map((im) => (
                    <li key={im} className="flex gap-2.5 text-[13px] leading-snug">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{im}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {/* The dated item the conclusion should be read against.
                  Selected by the source's own impact score and filtered to
                  this page's subject, so it corroborates the reading rather
                  than decorating it. Absent when nothing recent bears on the
                  page. */}
              {insight.news ? (
                <div className="rounded-lg border border-base-300 bg-base-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] uppercase tracking-wider text-muted">
                      Latest development
                    </span>
                    {insight.news.publishedAt ? (
                      <span className="font-mono text-[12px] text-muted">
                        {shortDate(insight.news.publishedAt)}
                      </span>
                    ) : null}
                    {insight.news.sentiment ? (
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[12px] ${
                          insight.news.sentiment === "negative"
                            ? "bg-warn-bg text-warn"
                            : insight.news.sentiment === "positive"
                              ? "bg-good-bg text-good"
                              : "bg-base-200 text-muted"
                        }`}
                      >
                        {insight.news.sentiment}
                      </span>
                    ) : null}
                  </div>
                  <p className="measure mt-1.5 text-[13.5px] font-semibold leading-snug">
                    {insight.news.title}
                  </p>
                  {insight.news.whyItMatters ? (
                    <p className="measure mt-1 text-[13px] leading-snug text-muted">
                      {insight.news.whyItMatters}
                    </p>
                  ) : null}
                  {insight.news.sourceUrl ? (
                    <a
                      href={insight.news.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-[12px] font-semibold text-primary hover:underline"
                    >
                      {insight.news.sourceName ?? "Source"} →
                    </a>
                  ) : insight.news.sourceName ? (
                    <p className="mt-1.5 font-mono text-[12px] text-muted">
                      {insight.news.sourceName}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Sits at the foot of its column so the action lands in the
                  same place whether or not there is a news item above it. */}
              <div className="mt-auto flex flex-wrap items-center gap-3 rounded-lg border border-base-300 bg-base-100 p-3">
                <span className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  Recommended action
                </span>
                <span
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${ACTION_TONE[insight.action] ?? ACTION_TONE.Monitor}`}
                >
                  {insight.action}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mt-3">
        <DerivationDrawer
          title="What this reading rests on"
          trigger="What this rests on"
        >
          <p>
            Computed from {evidence.count.toLocaleString()} records on this
            page&apos;s own datasets:{" "}
            {evidence.sources.map((s) => (
              <strong key={s} className="text-base-content">
                {s}
                {s === evidence.sources[evidence.sources.length - 1] ? "" : ", "}
              </strong>
            ))}
            .
            {evidence.lastUpdated
              ? ` Last updated ${evidence.lastUpdated.slice(0, 10)}.`
              : " No update date is published for these sources."}
          </p>
          <p>
            This reading is assembled from figures rather than written by a
            language model. Every sentence above is constructed from a value
            held on this page, which is why it cannot drift from the data
            underneath it, and why it says nothing where the data runs out.
          </p>
          <p className="measure text-muted">
            It interprets the page&apos;s own datasets and weights them first.
            It is not general commentary on the AI market, and it does not
            reach for a conclusion the figures here will not carry.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

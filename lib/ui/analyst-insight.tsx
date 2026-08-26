import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DoItHere } from "@/lib/ui/do-it-here";
import { DerivationDrawer } from "@/lib/ui/score";
import type { AnalystInsightData } from "@/lib/analyst/insight";
import { STRENGTH_LABEL } from "@/lib/analyst/decision";

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
  /**
   * Whether the prose was written by the analyst model or assembled by the
   * deterministic builder. Shown, because a reader is entitled to know which
   * of the two they are reading. The figures are identical either way: the
   * model may not introduce one, and is discarded if it tries.
   */
  authorship = "computed",
}: {
  insight: AnalystInsightData;
  context: string;
  authorship?: "written" | "computed";
}) {
  const { evidence, decision } = insight;

  return (
    <section className="finding rounded-xl p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-insight"
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
          {/* Which of the two wrote the sentences below. The prop existed and
              was never rendered, so this panel accepted the distinction and
              then kept it from the reader, which is the opposite of the
              point. The figures are identical either way: the model may not
              introduce one and is discarded if it tries. */}
          <span className="font-mono text-sm text-muted">
            {authorship === "written" ? "analyst written" : "computed"}
          </span>
          {evidence.lastUpdated ? (
            <span className="font-mono text-sm text-muted">
              {shortDate(evidence.lastUpdated)}
            </span>
          ) : null}
        </div>
      </div>

      {insight.insufficient ? (
        // The data will not carry a conclusion, so none is offered. This is a
        // first-class state rather than a softened version of a claim.
        <>
          <p className="measure mt-3 text-base leading-relaxed text-muted">
            <span className="font-semibold text-base-content">
              Current evidence is insufficient to draw a reliable conclusion.
            </span>{" "}
            {insight.insufficient}
          </p>
          <AskYourAnalyst exhausted />
        </>
      ) : (
        <>
          <h2 className="mt-3 max-w-3xl text-balance text-lg font-bold leading-snug sm:text-xl">
            {insight.headline}
          </h2>

          {/* Two columns once there is width for them: the reading on the
              left, the corroborating item and the action on the right. The
              single column was the source of the worst dead space in the
              product, because the copy stopped at its measure while the news
              box below it ran the full width of the card. */}
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 @4xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="measure text-sm leading-relaxed text-muted">
                {insight.summary}
              </p>

              {insight.implications.length > 0 ? (
                <ul className="measure mt-4 space-y-1.5 border-t border-base-300/70 pt-3">
                  {insight.implications.slice(0, 3).map((im) => (
                    <li key={im} className="flex gap-2.5 text-sm leading-snug">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-insight" aria-hidden />
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
                <div className="rounded-lg border border-base-300 bg-base-100 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm uppercase tracking-wider text-muted">
                      Latest development
                    </span>
                    {insight.news.publishedAt ? (
                      <span className="font-mono text-sm text-muted">
                        {shortDate(insight.news.publishedAt)}
                      </span>
                    ) : null}
                    {insight.news.sentiment ? (
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-sm ${
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
                  <p className="measure mt-1.5 text-sm font-semibold leading-snug">
                    {insight.news.title}
                  </p>
                  {/* Our tie to this page, not the source's commentary.
                      The source's line used to render here, under our heading,
                      which presented their reading as ours. On the OpenAI
                      funding item that line names the round's investors
                      wrongly, and it was printing on seven tabs. The headline
                      above stays verbatim and linked, because that is what the
                      source said and rewriting it would misattribute; the
                      reading is ours and comes from what this page holds. */}
                  {insight.news.tie ? (
                    <p className="measure mt-1 text-sm leading-snug text-muted">
                      {insight.news.tie}
                    </p>
                  ) : null}
                  {insight.news.sourceUrl ? (
                    <a
                      href={insight.news.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-sm font-semibold text-primary hover:underline"
                    >
                      {insight.news.sourceName ?? "Source"} →
                    </a>
                  ) : insight.news.sourceName ? (
                    <p className="mt-1.5 font-mono text-sm text-muted">
                      {insight.news.sourceName}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Sits at the foot of its column so the action lands in the
                  same place whether or not there is a news item above it. */}
              {/* The recommendation carries the judgement edge; the pill
                  inside it keeps the semantic tone, because the colour of the
                  action answers a different question from the colour of the
                  box around it. Purple says AG concluded this, green, amber
                  and red say what the conclusion is. */}
              <div className="finding-strong mt-auto rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm uppercase tracking-wider text-insight">
                    Recommended action
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${ACTION_TONE[decision?.action ?? insight.action] ?? ACTION_TONE.Monitor}`}
                  >
                    {decision?.action ?? insight.action}
                  </span>
                </div>

                {/* The action is a direction of travel. This is the thing to
                    do. It sits directly under the pill because that is the
                    order a reader needs them in, and it is deterministic:
                    the analyst model may say it better and may not decide
                    what it is. */}
                {decision ? (
                  <div className="mt-2.5 space-y-2">
                    <p className="measure text-sm font-semibold text-base-content">
                      {decision.instruction}
                    </p>
                    <p className="measure text-sm text-muted">
                      <span className="font-semibold text-base-content">
                        Why now:
                      </span>{" "}
                      {decision.whyNow}
                    </p>

                    {/* Inline rather than in the drawer below, deliberately.
                        A contradiction hidden behind a disclosure control lets
                        a recommendation read as settled when it is not, which
                        is the failure this whole packet exists to prevent. */}
                    {decision.evidenceAgainst.length > 0 ? (
                      <p className="measure text-sm text-warn">
                        <span className="font-semibold">Against this:</span>{" "}
                        {decision.evidenceAgainst.map((e) => e.claim).join(" ")}
                      </p>
                    ) : null}

                    {decision.trigger ? (
                      <p className="measure text-sm text-muted">
                        <span className="font-semibold text-base-content">
                          Watch for:
                        </span>{" "}
                        {decision.trigger}
                      </p>
                    ) : null}

                    {decision.doNotDo ? (
                      <p className="measure text-sm text-muted">
                        <span className="font-semibold text-base-content">
                          Do not:
                        </span>{" "}
                        {decision.doNotDo}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* A recommendation that names the page which does the thing
                    is worth more than one that leaves the reader to find it. */}
                <DoItHere tools={insight.tools ?? []} label="Do this in" />
              </div>
            </div>
          </div>

          {/* A conclusion was drawn, and its basis is genuinely limited. The
              limit is named by the builder rather than guessed here, and the
              offer is made at the point the reader meets the ceiling rather
              than buried in the derivation drawer below. */}
          {insight.thin ? <AskYourAnalyst reason={insight.thin} /> : null}
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
            Every figure above is computed here, and the prose is written over
            those figures by the analyst model where the badge says analyst
            written. The model may choose the words and the emphasis; it may
            not introduce a number or a vendor, and any answer that does is
            discarded and rewritten rather than shown. That is why the reading
            cannot drift from the data underneath it, and why it says nothing
            where the data runs out.
          </p>
          {decision ? (
            <>
              {/* Not a confidence badge and not a score. Confidence labels
                  were removed from this platform on request, and a 0 to 100
                  number over evidence of mixed provenance would have no
                  methodology behind it anyway. This says how many independent
                  sources point the same way, which is a statement about the
                  evidence rather than a rating of the conclusion. */}
              <p>
                <strong className="text-base-content">
                  {STRENGTH_LABEL[decision.strength]}.
                </strong>{" "}
                {decision.evidenceFor.length > 0
                  ? `Drawn from ${new Set(decision.evidenceFor.map((e) => e.source)).size === 1 ? "one source" : `${new Set(decision.evidenceFor.map((e) => e.source)).size} independent sources`}.`
                  : ""}
              </p>
              <ul className="ml-4 list-disc space-y-1">
                {decision.evidenceFor.map((e) => (
                  <li key={`${e.source}-${e.claim}`}>
                    {e.claim}{" "}
                    <span className="text-muted">
                      ({e.source}, {e.basis}
                      {e.asOf ? `, ${shortDate(e.asOf)}` : ""})
                    </span>
                  </li>
                ))}
                {decision.evidenceAgainst.map((e) => (
                  <li key={`against-${e.source}-${e.claim}`} className="text-warn">
                    Against: {e.claim}{" "}
                    <span className="text-muted">
                      ({e.source}, {e.basis}
                      {e.asOf ? `, ${shortDate(e.asOf)}` : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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

/**
 * The offer made at the point the dataset stops.
 *
 * Two states, because they are different admissions. `exhausted` is "this page
 * cannot draw a conclusion at all", and the reason is already printed above it,
 * so it is not repeated. The default is "here is the conclusion, and here is
 * precisely what limits it", where naming the limit is the whole value: a
 * reader who knows the reading rests on unconfirmed links asks a different
 * question from one who does not.
 *
 * Deliberately not a generic "contact us" that appears on every panel. It
 * renders only where a builder has declared its own ceiling, so it stays a
 * signal rather than furniture. No contact route is invented here: the product
 * holds no analyst address or booking link, and inventing one would be the same
 * class of error as inventing a figure.
 */
function AskYourAnalyst({
  reason,
  exhausted = false,
}: {
  reason?: string;
  exhausted?: boolean;
}) {
  return (
    <div className="finding mt-4 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-insight"
          aria-hidden
        >
          <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.5Z" />
        </svg>
        <span className="font-mono text-sm uppercase tracking-wider text-insight">
          Ask your AG Analyst
        </span>
      </div>
      <p className="measure mt-1.5 text-sm leading-snug">
        {exhausted ? (
          <>
            This page will not close the question on its own, and saying so is
            the honest answer rather than a softened one. Your AG Analyst can go
            and ask what no dataset here can settle.
          </>
        ) : (
          <>
            The reading above stands, but it has a ceiling:{" "}
            <span className="font-semibold text-base-content">{reason}</span>.
            Your AG Analyst can take it past that, on your shortlist and your
            timetable.
          </>
        )}
      </p>
    </div>
  );
}

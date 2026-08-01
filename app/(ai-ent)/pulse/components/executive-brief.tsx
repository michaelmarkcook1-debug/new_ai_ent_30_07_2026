import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type {
  ExecutiveBrief,
  RecommendationMeta,
  ScorecardDimension,
} from "@/lib/pulse/brief";
import type { DataLane } from "@/lib/provenance";

// The executive brief: hero, three actions, five-dimension scorecard.
//
// The judgement text is editorial and stays SAMPLE-badged, because no dataset
// publishes an opinion. Everything under it is computed from figures the app
// already holds, and each dimension carries the numbers it came from.

// Metadata sits quietly under a recommendation. Horizon and evidence state
// only: confidence labels are gone from the platform and do not belong here.
// 12px floor throughout, since the audit found the most common text size on
// this page was 10px, which is not a size to read a brief in.
export function MetaRow({ meta }: { meta: RecommendationMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted">
      <span>
        Act within <span className="text-base-content">{meta.horizon}</span>
      </span>
      <span aria-hidden>·</span>
      <LaneBadge lane={meta.lane} />
      {meta.lastUpdated ? (
        <>
          <span aria-hidden>·</span>
          <span>Updated {meta.lastUpdated.slice(0, 10)}</span>
        </>
      ) : null}
    </div>
  );
}

// The only place green, amber and red appear. A reader should be able to sort
// good from bad without reading a word, which the previous version made
// impossible: every verdict rendered in the same white, so "Favourable" and
// "Elevated" were visually identical.
const TONE_TEXT: Record<ScorecardDimension["tone"], string> = {
  good: "text-good",
  warn: "text-warn",
  bad: "text-error",
  neutral: "text-muted",
};

const TONE_RULE: Record<ScorecardDimension["tone"], string> = {
  good: "border-l-good",
  warn: "border-l-warn",
  bad: "border-l-error",
  neutral: "border-l-base-300",
};

export function PulseHero({
  headline,
  judgement,
  changed,
  matters,
  todo,
  action,
  meta,
  evidenceNote,
  editorialDate,
}: {
  headline: string;
  judgement: string;
  changed: string;
  matters: string;
  todo: string;
  action: string;
  meta: RecommendationMeta;
  evidenceNote: string;
  editorialDate: string;
}) {
  return (
    <section className="rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Today's Pulse"
          tooltip="One judgement on the enterprise AI market, with what to do about it."
        />
        <div className="flex items-center gap-2">
          <LaneBadge lane="sample" />
          <span className="font-mono text-[12px] text-muted">
            {editorialDate}
          </span>
        </div>
      </div>

      <h2 className="mt-3 max-w-3xl text-balance text-[22px] font-bold leading-tight sm:text-[28px]">
        {headline}
      </h2>

      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted">
        {judgement}
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-base-300 pt-4 sm:grid-cols-3">
        {(
          [
            ["What changed", changed],
            ["Why it matters", matters],
            ["What to do", todo],
          ] as const
        ).map(([label, body]) => (
          <div key={label}>
            <dt className="font-mono text-[12px] uppercase tracking-wider text-muted">
              {label}
            </dt>
            <dd className="mt-1 text-[13px] leading-snug">{body}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-base-300 pt-4">
        <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white">
          {action}
        </span>
        <MetaRow meta={meta} />
      </div>

      <div className="mt-3">
        <DerivationDrawer title="What this judgement rests on">
          <p>{evidenceNote}</p>
          <p className="text-muted">
            The headline and the judgement above are an editorial view, badged
            SAMPLE because no dataset publishes an opinion. The scorecard below
            it, and every figure it cites, is computed from the tracked data and
            carries its own source.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

export function ExecutiveActions({
  actions,
}: {
  actions: { action: string; detail: string; meta: RecommendationMeta }[];
}) {
  return (
    <section>
      <MicroLabel
        label="Do these three things"
        tooltip="The actions that follow from today's judgement."
      />
      <ol className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
        {actions.map((a, i) => (
          <li
            key={a.action}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[12px] text-muted">{i + 1}</span>
              <h3 className="text-[13.5px] font-bold">{a.action}</h3>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              {a.detail}
            </p>
            <div className="mt-3 border-t border-base-300 pt-2">
              <MetaRow meta={a.meta} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Scorecard({
  brief,
  lane,
}: {
  brief: ExecutiveBrief;
  lane: DataLane;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Enterprise scorecard"
          tooltip="Five readings on the market, each answering a different buying question."
        />
        <LaneBadge lane={lane} />
      </div>
      <p className="mt-1 max-w-3xl text-[12px] text-muted">
        Five readings on the market as a whole, not a vendor ranking. Colour
        carries the verdict: green is favourable, amber is watch, red is act.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {brief.scorecard.map((d) => (
          <div
            key={d.key}
            className={`rounded-lg border border-l-4 border-base-300 bg-base-100 p-4 ${TONE_RULE[d.tone]}`}
          >
            <h3 className="text-[13px] font-bold">{d.name}</h3>

            {/* The figure leads. Previously the numbers were buried inside the
                sentence below, so nothing on the card read as a finding. */}
            <div className="mt-2 flex items-baseline gap-2">
              {d.figure ? (
                <span
                  className={`font-mono text-[30px] font-bold leading-none ${TONE_TEXT[d.tone]}`}
                >
                  {d.figure}
                </span>
              ) : null}
              <span
                className={`text-[15px] font-semibold ${d.figure ? TONE_TEXT[d.tone] : "text-muted"}`}
              >
                {d.status}
              </span>
            </div>
            {d.figureCaption ? (
              <p className="mt-1 text-[12px] text-muted">{d.figureCaption}</p>
            ) : null}

            <p className="mt-2.5 text-[13px] leading-snug text-muted">
              {d.meaning}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-muted">
        No direction of travel is shown on any reading: the sources publish a
        current value with no prior period, so there is nothing to compare
        against.
      </p>

      <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
        <MicroLabel label="Overall recommendation" />
        <p className="mt-1 max-w-3xl text-[13px] leading-snug">
          {brief.overall.recommendation}
        </p>
        <div className="mt-2.5">
          <MetaRow meta={brief.overall.meta} />
        </div>
      </div>

      <div className="mt-2">
        <DerivationDrawer title="How each reading is calculated">
          <ul className="list-disc space-y-1.5 pl-4">
            {brief.scorecard.map((d) => (
              <li key={d.key}>
                <span className="font-semibold text-base-content">{d.name}</span>
                : {d.basis}
              </li>
            ))}
          </ul>
          <p className="text-muted">
            Direction of travel is not shown. The AIE datasets publish current
            values without a prior period, and the share estimates carry a
            changePct that is zero on every row because each prior estimate is
            a copy of the current one. An arrow drawn from that would mean
            nothing.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

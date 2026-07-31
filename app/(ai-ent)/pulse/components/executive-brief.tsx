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

export function MetaRow({ meta }: { meta: RecommendationMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted">
      <span>
        Confidence <span className="text-base-content">{meta.confidence}</span>
      </span>
      <span aria-hidden>·</span>
      <span>
        Horizon <span className="text-base-content">{meta.horizon}</span>
      </span>
      <span aria-hidden>·</span>
      <LaneBadge lane={meta.lane} />
      {meta.lastUpdated ? (
        <>
          <span aria-hidden>·</span>
          <span>Updated {meta.lastUpdated.slice(0, 10)}</span>
        </>
      ) : (
        <>
          <span aria-hidden>·</span>
          <span>Update date not published</span>
        </>
      )}
    </div>
  );
}

const ARROW: Record<ScorecardDimension["direction"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
  unpublished: "",
};

function DirectionTag({ d }: { d: ScorecardDimension }) {
  if (d.direction === "unpublished") {
    return (
      <span className="font-mono text-[10px] text-muted">
        direction not published
      </span>
    );
  }
  const tone =
    d.direction === "up"
      ? "text-good"
      : d.direction === "down"
        ? "text-warn"
        : "text-muted";
  return (
    <span className={`font-mono text-[10px] ${tone}`}>
      {ARROW[d.direction]} {d.direction === "flat" ? "no change" : d.direction === "up" ? "improving" : "weakening"}
    </span>
  );
}

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
          <span className="font-mono text-[10px] text-muted">
            {editorialDate}
          </span>
        </div>
      </div>

      <h2 className="mt-3 max-w-3xl text-balance text-[22px] font-bold leading-tight sm:text-[28px]">
        {headline}
      </h2>

      <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-muted">
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
            <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {label}
            </dt>
            <dd className="mt-1 text-[12.5px] leading-snug">{body}</dd>
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
              <span className="font-mono text-[11px] text-muted">{i + 1}</span>
              <h3 className="text-[13.5px] font-bold">{a.action}</h3>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
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
        Five readings on the market as a whole, not a vendor ranking. Each says
        what it means for a buyer and how far to trust it.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {brief.scorecard.map((d) => (
          <div
            key={d.key}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[12.5px] font-bold">{d.name}</h3>
              <LaneBadge lane={d.lane} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-[17px] font-bold">{d.status}</span>
              <DirectionTag d={d} />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-muted">
              {d.meaning}
            </p>
            <p className="mt-2 border-t border-base-300 pt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
              Confidence <span className="text-base-content">{d.confidence}</span>
            </p>
          </div>
        ))}
      </div>

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
            Direction of travel is shown only where a prior reading exists. The
            AIE datasets publish current values without a prior period for most
            of these, so most dimensions say the direction is not published
            rather than drawing an arrow that would mean nothing.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

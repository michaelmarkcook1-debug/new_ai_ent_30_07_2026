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
// The judgement text used to be fixture editorial, SAMPLE-badged on the
// grounds that no dataset publishes an opinion. That put the page's only
// sample panel on its most-read section. It is now written from the tracked
// figures by lib/pulse/judgement.ts, so it carries the data's own lane.
// Everything under it is computed from figures the app already holds, and
// each dimension carries the numbers it came from.

// Metadata sits quietly under a recommendation. Horizon and evidence state
// only: confidence labels are gone from the platform and do not belong here.
// 12px floor throughout, since the audit found the most common text size on
// this page was 10px, which is not a size to read a brief in.
export function MetaRow({ meta }: { meta: RecommendationMeta }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted">
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

// Full borders rather than a left stripe. A coloured side-rule on a card is
// never a deliberate design choice, and the tone reads just as clearly from a
// full border sitting alongside the coloured figure inside.
const TONE_RULE: Record<ScorecardDimension["tone"], string> = {
  good: "border-good/55",
  warn: "border-warn/55",
  bad: "border-error/55",
  neutral: "border-base-300",
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
  lane,
  asOf,
}: {
  headline: string;
  judgement: string;
  changed: string;
  matters: string;
  todo: string;
  action: string;
  meta: RecommendationMeta;
  evidenceNote: string;
  lane: DataLane;
  asOf: string | null;
}) {
  return (
    // The Pulse is the single largest judgement in the product and was
    // wearing the same grey border as every data panel under it.
    <section className="finding-strong rounded-xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Today's Pulse"
          tooltip="One judgement on the enterprise AI market, with what to do about it."
        />
        <div className="flex items-center gap-2">
          {/* Was lane="sample" over a fixed fixture date. The headline and
              judgement are now computed from the tracked figures, so the badge
              reports what they are and the date is the data's, not an
              editorial's. */}
          <LaneBadge lane={lane} />
          <span className="font-mono text-sm text-muted">
            {asOf ?? "date not published"}
          </span>
        </div>
      </div>

      {/* This is the product. It is the first thing read and the only thing
          some readers read, so it carries the largest type on the page. */}
      <h2 className="mt-3 max-w-3xl text-balance text-2xl font-bold leading-tight sm:text-4xl">
        {headline}
      </h2>

      <p className="mt-4 measure text-lg leading-relaxed text-base-content/80">
        {judgement}
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-base-300 pt-4 @3xl:grid-cols-3">
        {(
          [
            ["What changed", changed],
            ["Why it matters", matters],
            ["What to do", todo],
          ] as const
        ).map(([label, body]) => (
          <div key={label}>
            <dt className="font-mono text-sm uppercase tracking-wider text-muted">
              {label}
            </dt>
            <dd className="measure mt-1 text-sm leading-snug">{body}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-base-300 pt-4">
        {/* Purple, not the brand navy. Navy is also links, buttons and the
            active nav item, so the single most important sentence on the page
            was rendered in the same colour as the chrome around it. */}
        <span className="rounded-full bg-[var(--ag-insight)] px-3 py-1.5 text-sm font-semibold text-white">
          {action}
        </span>
        <MetaRow meta={meta} />
      </div>

      <div className="mt-3">
        <DerivationDrawer title="What this judgement rests on">
          <p>{evidenceNote}</p>
          <p className="measure text-muted">
            The headline and the judgement above are written from those same
            figures: which vendors gained and slipped, the tracked average that
            moved furthest, and the count of published risks. No opinion is
            added on top of them, and where an input has no prior reading the
            sentence says so rather than implying a direction.
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
  // The heading promises three, so the code enforces three. A section that
  // says "do these three things" over four cards is a small lie that costs
  // the reader their trust in the larger ones.
  const three = actions.slice(0, 3);
  return (
    <section>
      <MicroLabel
        label="Do these three things"
        tooltip="The actions that follow from today's judgement."
      />
      {/* These are the only cards on the page a reader is meant to act on, so
          they carry the judgement edge that marks everything AG concluded
          rather than measured. Kept at the lighter weight: three cards as
          strong as the overall recommendation box would compete with the
          judgement above rather than follow from it. */}
      <ol className="mt-2 grid grid-cols-1 gap-3 @4xl:grid-cols-3">
        {three.map((a, i) => (
          <li key={a.action} className="finding rounded-lg p-5">
            <div className="flex items-baseline gap-2.5">
              <span className="finding-figure font-mono text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="text-sm font-bold">{a.action}</h3>
            </div>
            <p className="measure mt-1.5 text-sm leading-snug text-muted">
              {a.detail}
            </p>
            <div className="mt-3 border-t border-base-300/70 pt-2">
              <MetaRow meta={a.meta} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The Enterprise scorecard lived here until 4 August 2026. It showed a
// five-dimension composite without ever saying how many of its inputs were
// actually published, which is the specific false precision this product
// exists to replace. Its replacement is components/verdict-dial.tsx, which
// renders the count inside the ring and cannot be asked not to.

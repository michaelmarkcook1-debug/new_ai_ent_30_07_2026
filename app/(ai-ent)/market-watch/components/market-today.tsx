import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { formatDate, type RegimeView, type SignalRow } from "../data";

// "Market today": the AIE market regime read plus the source-cited signal
// feed. All values are native dataset fields; nothing here is computed.

function DirectionChip({ direction }: { direction: string }) {
  const styles: Record<string, string> = {
    positive: "bg-good-bg text-good",
    negative: "bg-bad-bg text-error",
    mixed: "bg-warn-bg text-warn",
    neutral: "bg-base-200 text-muted",
    unknown: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${styles[direction] ?? styles.neutral}`}
      title="Signal direction as labelled in the AIE market signals seed"
    >
      {direction}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className="inline-flex rounded border border-base-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted"
      title="Native data status label from the AIE dataset (seed entries cannot move centre estimates, they only widen bands)"
    >
      {status}
    </span>
  );
}

export function MarketToday({
  regime,
  signals,
}: {
  regime: RegimeView;
  signals: SignalRow[];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Market today</h2>
        <LaneBadge lane="aie" />
        <span className="font-mono text-[10px] text-muted">
          Regime period {formatDate(regime.periodStart)} to {formatDate(regime.periodEnd)}
        </span>
      </div>

      {/* Regime strip */}
      <div className="mt-2 rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="Market regime"
            tooltip="The AIE market signals seed classifies the current market regime from public official sources. Values are shown exactly as labelled in the dataset."
          />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">Regime confidence</span>
            <ScorePill score={regime.confidenceScore} estimated />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {regime.facets.map((f) => (
            <div key={f.label} className="rounded border border-base-300 bg-base-200/40 px-2 py-1.5">
              <span className="micro-label">{f.label}</span>
              <p className="mt-0.5 text-[12px] font-semibold capitalize">{f.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <DerivationDrawer title="How the market regime read is derived">
            <p>
              The regime classification and its confidence score come straight from
              the AIE market signals seed. It is analyst-judged from {regime.sourceCount}{" "}
              public official sources (central bank statements, official statistics,
              exchange data) and {regime.contributingSignalCount} contributing signals
              listed in the same dataset.
            </p>
            <p className="text-muted">Dataset note: {regime.uncertaintyNote}</p>
            <p className="text-muted">
              Nothing in this strip is measured by this demo; it is the dataset&apos;s own
              confidence-labelled read, re-rendered with its labels intact.
            </p>
          </DerivationDrawer>
        </div>
      </div>

      {/* Signal feed */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {signals.map((s) => (
          <article key={s.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <DirectionChip direction={s.direction} />
              <StatusChip status={s.dataStatus} />
              <span
                className="inline-flex rounded border border-base-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted"
                title="Evidence grade as labelled in the AIE dataset (E5 strongest, E1 weakest)"
              >
                {s.evidenceGrade}
              </span>
              <span className="font-mono text-[10px] text-muted">
                conf {s.confidenceScore}
              </span>
              <span className="ml-auto font-mono text-[10px] text-muted">
                {formatDate(s.sourceDate)}
              </span>
            </div>
            <h3 className="mt-1.5 text-[13px] font-bold leading-snug">{s.title}</h3>
            <p className="mt-1 text-[12px] leading-snug text-muted">{s.summary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span className="capitalize">{s.category}</span>
              <span aria-hidden>&middot;</span>
              <span className="capitalize">{s.timeHorizon}</span>
              <span aria-hidden>&middot;</span>
              {s.sourceUrl ? (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {s.sourceName}
                </a>
              ) : (
                <span>{s.sourceName}</span>
              )}
            </div>
            <p className="mt-1.5 border-t border-base-300/60 pt-1.5 text-[10px] italic text-muted">
              {s.uncertaintyNote}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

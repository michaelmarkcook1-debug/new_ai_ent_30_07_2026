import { MicroLabel } from "@/lib/ui/micro";
import type { AllianceVenture, ChannelLink } from "@/lib/aie/alliances/seed";

// The cited alliances, written up.
//
// The map shows breadth; this is depth. Only links the source could attach a
// named publisher and a date to appear here, which is why there are fourteen
// of these against fifty-one links on the map. That ratio is the finding, not
// a gap to be filled: most of the channel is inferred, and a dozen or so
// relationships are actually documented.

function ProofList({
  points,
}: {
  points: { label: string; value: string }[];
}) {
  return (
    <dl className="mt-2 space-y-1">
      {points.map((p) => (
        <div key={p.label} className="flex flex-wrap gap-x-2 text-sm">
          <dt className="font-mono text-xs uppercase tracking-wider text-muted">
            {p.label}
          </dt>
          <dd className="measure flex-1 leading-snug">{p.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cite({
  publisher,
  url,
  asOf,
}: {
  publisher: string;
  url: string;
  asOf: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs font-semibold text-primary hover:underline"
    >
      {publisher} ↗ · {asOf}
    </a>
  );
}

export function AllianceDossiers({
  links,
  ventures,
}: {
  links: ChannelLink[];
  ventures: AllianceVenture[];
}) {
  const cited = links.filter((l) => l.spotlight);
  if (cited.length === 0 && ventures.length === 0) return null;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Source-cited alliances"
          tooltip="The links a named publisher has documented, with the figures that publisher states."
        />
        <span className="font-mono text-xs text-muted">
          {cited.length + ventures.length} of {links.length + ventures.length}
        </span>
      </div>
      <p className="measure mt-1 text-sm text-muted">
        Every figure below traces to a named press or vendor source. Claims that
        are widely repeated but could not be sourced were dropped rather than
        softened, and nothing here is an AG estimate.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        {ventures.map((v) => (
          <article key={v.id} className="finding rounded-lg p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold">{v.title}</h3>
              <span className="rounded bg-insight-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-insight">
                Delivery vehicle
              </span>
            </div>
            <Cite publisher={v.publisher} url={v.url} asOf={v.asOf} />
            <p className="measure mt-2 text-sm leading-relaxed">{v.summary}</p>
            <ProofList points={v.proofPoints} />
          </article>
        ))}

        {cited.map((l) => {
          const s = l.spotlight!;
          return (
            <article
              key={l.key}
              className="rounded-lg border border-base-300 bg-base-100 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-bold">
                  {l.partnerName}{" "}
                  <span className="text-insight" aria-label="and">
                    ×
                  </span>{" "}
                  {l.vendorName}
                </h3>
                <span className="font-mono text-xs uppercase tracking-wider text-muted">
                  {s.relationship}
                </span>
              </div>
              <Cite publisher={s.publisher} url={s.url} asOf={s.asOf} />
              <p className="measure mt-2 text-sm leading-relaxed">{s.summary}</p>
              <ProofList points={s.proofPoints} />
              {l.portedFromMarkup ? (
                <p className="measure mt-3 border-t border-base-300 pt-2 text-xs text-muted">
                  The source publishes this alliance as a written entry but not
                  as a row in its own dataset, so it appears in its dossier list
                  while being absent from its map. It is carried here as an
                  ordinary link so the two agree.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

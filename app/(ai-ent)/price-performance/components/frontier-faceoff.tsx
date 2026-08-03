import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { FaceOffView } from "../data";

// Frontier model face-off: each frontier-lab vendor's single highest-rated
// model, on identical fields so the comparison is like for like.
//
// Deliberately not a ranking of vendors. It ranks one model per vendor on one
// third-party index, which is a narrower claim, and the derivation drawer says
// so. Vendors in the category with no priced and scored model are named as
// absent rather than dropped silently.

const BAR_W = 148;

export function FrontierFaceOff({ view }: { view: FaceOffView }) {
  const top = view.leader?.intelligence ?? 0;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Frontier model face-off</h2>
            <LaneBadge lane="aie-live" />
            <span className="font-mono text-[10px] text-muted">
              {view.entries.length} vendors
            </span>
          </div>
          <p className="mt-1 measure text-[12px] text-muted">
            Each frontier-lab vendor&apos;s single highest-rated model, on the
            same fields for every one, so they compare like for like. The
            vendor set is the frontier model and API category from the dataset
            taxonomy, not a shortlist chosen here.
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-200/60 px-3 py-2">
          <MicroLabel
            label="As of"
            tooltip="Capture date of the model inventory, and the date of the freshest benchmark within it."
          />
          <p className="mt-0.5 font-mono text-[11px] font-bold">
            {view.capturedAtDisplay}
          </p>
          <p className="font-mono text-[9px] text-muted">
            freshest benchmark {view.freshestBenchmarkDisplay}
          </p>
        </div>
      </div>

      {view.leader && view.leadGap !== null ? (
        <p className="mt-3 rounded border border-primary/25 bg-primary/5 px-3 py-2 text-[12.5px] leading-relaxed">
          <span className="font-semibold">{view.leader.provider}</span>
          &apos;s {view.leader.model} leads on the Intelligence Index at{" "}
          <span className="font-mono font-bold">{view.leader.intelligence}</span>
          , {view.leadGap} point{view.leadGap === 1 ? "" : "s"} ahead of{" "}
          {view.entries[1].provider}. Price and throughput move independently of
          that ranking, which is the point of showing all three together.
        </p>
      ) : null}

      {view.entries.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-6 text-[12px] text-muted">
          No frontier-category vendor currently publishes both a list price and
          an independent index score.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                {[
                  ["Vendor", ""],
                  ["Highest-rated model", ""],
                  ["Intelligence Index", "Independent third-party score."],
                  ["Behind leader", "Index points behind the top model."],
                  ["Input $/1M", "Published list price per 1M input tokens."],
                  ["Throughput", "Output tokens per second."],
                  ["Efficiency frontier", "No cheaper model scores as well."],
                ].map(([label, help]) => (
                  <th
                    key={label}
                    title={help || undefined}
                    className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-muted"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {view.entries.map((e, i) => (
                <tr
                  key={e.provider}
                  className={i === 0 ? "bg-primary/5" : "hover:bg-base-200/60"}
                >
                  <td className="px-3 py-2">
                    <span className="text-[12.5px] font-bold">
                      {e.provider}
                    </span>
                    {i === 0 ? (
                      <span className="ml-2 rounded bg-primary px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-white">
                        Leads
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[12px]">{e.model}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <svg
                        width={BAR_W}
                        height="10"
                        viewBox={`0 0 ${BAR_W} 10`}
                        aria-hidden
                        className="shrink-0"
                      >
                        <rect
                          x="0"
                          y="2"
                          width={BAR_W}
                          height="6"
                          rx="3"
                          className="fill-base-200"
                        />
                        <rect
                          x="0"
                          y="2"
                          width={
                            top > 0 ? (e.intelligence / top) * BAR_W : 0
                          }
                          height="6"
                          rx="3"
                          fill="var(--ag-primary)"
                        />
                      </svg>
                      <span className="font-mono text-[12px] font-bold">
                        {e.intelligence}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px]">
                    {e.behindLeader === 0 ? (
                      <span className="text-muted">&mdash;</span>
                    ) : (
                      `-${e.behindLeader}`
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px]">
                    ${e.inputPerM}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px]">
                    {e.throughput === null ? (
                      <span className="text-muted">not published</span>
                    ) : (
                      `${e.throughput} tok/s`
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {e.frontier ? (
                      <span className="rounded bg-good-bg px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-good">
                        On frontier
                      </span>
                    ) : (
                      <span
                        className="font-mono text-[10.5px] text-muted"
                        title="A cheaper model matches or beats this one on the index."
                      >
                        dominated
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3">
        <DerivationDrawer title="How the face-off is built">
          <p>
            The vendor set is the frontier model and API market category from
            the dataset&apos;s own taxonomy. For each vendor in it, this takes
            the single highest-scoring model it publishes on the{" "}
            {view.benchmarkSource} Intelligence Index, then shows the same four
            fields for every one: index score, list input price, throughput and
            whether the model sits on the efficiency frontier.
          </p>
          <p>
            This ranks one model per vendor on one third-party index. It is not
            a ranking of the vendors themselves, and a vendor whose best model
            trails here may still lead on price, latency, deployment options or
            anything else the index does not measure. Leading on the index and
            sitting on the efficiency frontier are different things: the leader
            can be dominated on value by something cheaper.
          </p>
          <p>
            <strong>A low position can mean the index is behind, not that the
            vendor is.</strong> Each vendor is represented by its
            highest-scoring model <em>in this capture</em>, so a vendor whose
            newest release the index has not benchmarked yet appears at the
            strength of its previous generation. Meta is the clearest case
            here: it is placed on Llama 4 Maverick, while its current frontier
            model, the proprietary Muse Spark, is not in the capture at all. Its
            position on this table reflects a model two generations old.
          </p>
          <p className="measure text-muted">
            No score is estimated for an unbenchmarked model to correct for
            this, because that would be inventing the measurement the table
            exists to report. The gap is stated instead, and it closes when the
            index publishes.
          </p>
          {view.absent.length > 0 ? (
            <p className="measure text-muted">
              In the category but absent from this table because they publish no
              model with both a list price and an index score:{" "}
              {view.absent.join(", ")}. They are named rather than dropped, so
              the table is not mistaken for the whole category.
            </p>
          ) : null}
          <p className="measure text-muted">
            AG produces no benchmark of its own. Scores are third-party,
            attributed and dated; the capture date and freshest benchmark date
            sit beside the heading because both prices and benchmarks move
            quickly.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

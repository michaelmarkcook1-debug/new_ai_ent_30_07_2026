import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { PostureView } from "@/lib/vendor-posture";

// Private AI labs. These sit outside the probed BoardRadar universe, so there
// is no cyber-incident analysis for them. There is, however, a real security
// capability assessment in the AI Enterprise dataset covering every tracked
// vendor, so these cards now carry a measured reading with its evidence grade
// and the evidence note behind it, rather than illustrative posture prose.
//
// The two measurements are kept apart on purpose. BoardRadar /cyber-risk is
// an incident and exposure analysis. This is an assessment of published
// security practice. Neither substitutes for the other and they are never
// combined into one number.

const STATUS_HELP: Record<string, string> = {
  verified: "Checked against a primary source.",
  tested: "Tested against public or proxy evidence.",
  documented: "Recorded from vendor documentation.",
  inferred: "Inferred from adjacent signals: the weakest basis here.",
};

export function LabsSection({ view }: { view: PostureView }) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Private AI labs</h2>
        <LaneBadge lane={view.lane} />
        <span className="font-mono text-[10px] text-muted">
          {view.assessedCount} assessed
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[12px] text-muted">
        These labs sit outside the probed BoardRadar universe, so no cyber
        incident analysis exists for them. What is shown instead is the AI
        Enterprise security capability assessment, which does cover them: a
        maturity reading, the evidence grade behind it, and the evidence note
        itself. It is an assessment of published security practice, not an
        incident record, and it is never merged with the BoardRadar scores
        above.
      </p>

      {view.rows.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-6 text-[12px] text-muted">
          No security assessment rows are available for these vendors.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.rows.map((lab) => (
            <article
              key={lab.vendorId}
              className="flex flex-col gap-2.5 rounded-lg border border-base-300 bg-base-100 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[13px] font-bold">{lab.vendorName}</h3>
                  <p className="text-[10.5px] text-muted">{lab.category}</p>
                </div>
                <LaneBadge lane={view.lane} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ScorePill score={lab.maturity} lockedLabel="Not assessed" />
                <span
                  className="font-mono text-[9.5px] uppercase tracking-wider text-muted"
                  title={
                    lab.status
                      ? (STATUS_HELP[lab.status] ?? lab.status)
                      : undefined
                  }
                >
                  {lab.status ?? "no status"}
                  {lab.evidenceGrade ? ` · ${lab.evidenceGrade}` : ""}
                </span>
              </div>

              {lab.note ? (
                <div>
                  <MicroLabel
                    label="Evidence"
                    tooltip="The evidence excerpt the assessment records for this row, carried across unchanged."
                  />
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                    {lab.note}
                  </p>
                </div>
              ) : (
                <p className="text-[11.5px] text-muted">
                  No evidence note is recorded against this assessment.
                </p>
              )}

              {lab.riskProfile.length > 0 ? (
                <div>
                  <MicroLabel
                    label="Open risks on the vendor record"
                    tooltip="The risks the vendor record lists, carried across verbatim. Not security findings made here."
                  />
                  <ul className="mt-0.5 flex flex-wrap gap-1">
                    {lab.riskProfile.map((r) => (
                      <li
                        key={r}
                        className="rounded-full border border-base-300 px-2 py-0.5 text-[10.5px] text-muted"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-2">
                <span className="font-mono text-[9px] text-muted">
                  {lab.lastVerified
                    ? `verified ${lab.lastVerified.slice(0, 10)}`
                    : "no verification date"}
                </span>
                <DerivationDrawer title={`How ${lab.vendorName} is assessed`}>
                  <p>
                    The score is the security capability maturity from the AI
                    Enterprise assessment, on a 0 to 100 scale, shown with the
                    dataset&apos;s own row status and evidence grade. Grades
                    run E1 (strongest) to E5, and the evidence note above is
                    the excerpt the assessment cites.
                  </p>
                  <p>
                    This is not a cyber risk score. It counts no incidents,
                    breaches or exposure, and it is not comparable with the
                    BoardRadar cyber analysis shown for the public platform
                    vendors on this page. They stay separate because they
                    measure different things.
                  </p>
                  <p className="text-muted">
                    A status of inferred means the reading rests on adjacent
                    signals rather than a primary source, so treat it as the
                    weakest basis on the card. No score is invented where the
                    assessment has none: the pill reads &quot;Not
                    assessed&quot; instead.
                  </p>
                </DerivationDrawer>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

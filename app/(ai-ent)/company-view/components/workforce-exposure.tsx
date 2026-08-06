import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { matchIndustryIn, type ExposurePayload } from "@/lib/exposure/payload";

// Which of a company's functions AI has already reached.
//
// Modelled on a workforce-exposure view from another AnalystGenius product,
// with the columns it cannot honestly fill left out rather than filled.
//
// That product shows, per role: estimated headcount, an exposure percentage, a
// hiring trend and a layoff signal. For an employer whose workforce has
// actually been studied, all four are answerable. For any company a reader
// types into a box, three of them are not. Nobody publishes a role-by-role
// headcount split, a per-function hiring delta or a layoff signal for an
// arbitrary employer, and generating them would be the easiest way to break
// this product's promise while looking authoritative.
//
// So this draws the column that is genuinely computable, and the drawer names
// the three that are missing and what they would need. The gap is on the page
// rather than in a comment.
//
// Takes a server-computed payload rather than importing the role library:
// roles.json is 684 KB and this renders inside a client component.

const BAND_LABEL: Record<number, string> = {
  10: "Routine",
  30: "Structured",
  50: "Judgement",
  70: "Expert",
  90: "Frontier",
};

/** Reach describes the catalogue, so the wording never implies a job forecast. */
function reachTone(pct: number): { label: string; cls: string } {
  if (pct >= 50) return { label: "Widely reached", cls: "bg-warn-bg text-warn" };
  if (pct >= 12) return { label: "Partly reached", cls: "bg-base-200 text-muted" };
  return { label: "Frontier only", cls: "bg-good-bg text-good" };
}

export function WorkforceExposure({
  payload,
  industry,
  companyName,
}: {
  payload: ExposurePayload;
  industry: string | null;
  companyName: string;
}) {
  const matched = matchIndustryIn(industry, payload.industries);
  const pool = matched
    ? payload.roles.filter((r) => r.i === matched)
    : payload.roles;
  if (pool.length === 0) return null;

  const rows = pool
    .map((r) => ({
      ...r,
      reach: payload.reachByBand[r.b] ?? 0,
      need: payload.indexByBand[r.b] ?? 0,
    }))
    .sort((a, b) => b.reach - a.reach || a.n.localeCompare(b.n));

  const meanReach = Math.round(
    rows.reduce((a, r) => a + r.reach, 0) / rows.length
  );
  const widely = rows.filter((r) => r.reach >= 50).length;
  const frontier = rows.filter((r) => r.reach <= 11).length;
  const shown = rows.slice(0, 18);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Where AI has already reached this work"
          tooltip="The share of tracked models that already work at the level each role's work demands. Computed from the role library and the model catalogue, never measured on a company's staff."
        />
        <div className="flex flex-wrap items-center gap-2">
          <LaneBadge lane="derived" />
          <span className="font-mono text-sm text-muted">
            {payload.modelsScored} models scored
          </span>
        </div>
      </div>

      <p className="measure mt-2 text-sm text-muted">
        {matched ? (
          <>
            The {rows.length} roles the library carries for{" "}
            <span className="font-semibold text-base-content">{matched}</span>,
            the sector {companyName} was matched to.
          </>
        ) : (
          <>
            The full {rows.length}-role library across every sector. No industry
            the library carries matched {companyName}, so this is the
            cross-industry picture rather than a sector one.
          </>
        )}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Stat label="Mean reach" value={`${meanReach}%`} note="Across the roles below" />
        <Stat label="Widely reached" value={String(widely)} note="Over half the catalogue" />
        <Stat label="Frontier only" value={String(frontier)} note="Capability still binds" />
        <Stat label="Roles read" value={String(rows.length)} note={matched ?? "All sectors"} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-base-300 text-left">
              <th className="pb-2 pr-3 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Role
              </th>
              <th className="pb-2 pr-3 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                What the work demands
              </th>
              <th className="pb-2 pr-3 text-right font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Catalogue reach
              </th>
              <th className="pb-2 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Reading
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const tone = reachTone(r.reach);
              return (
                <tr key={`${r.n}-${r.f}`} className="border-b border-base-300/60">
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{r.n}</span>
                    {r.f ? (
                      <span className="block text-sm text-muted">{r.f}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {BAND_LABEL[r.b] ?? `Band ${r.b}`}
                    <span className="block font-mono text-sm">index {r.need}+</span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-base-200">
                        <span
                          className="block h-full rounded-full bg-insight"
                          style={{ width: `${r.reach}%` }}
                        />
                      </span>
                      <span className="font-mono font-bold">{r.reach}%</span>
                    </div>
                  </td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 font-mono text-sm ${tone.cls}`}>
                      {tone.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > shown.length ? (
        <p className="mt-2 font-mono text-sm text-muted">
          Showing {shown.length} of {rows.length}, most reached first.
        </p>
      ) : null}

      <div className="mt-3">
        <DerivationDrawer
          title="How this is derived, and the three columns that are missing"
          trigger="How this is derived"
        >
          <p>
            Every role in the library records what its work demands on a
            capability band from 10 to 90. That band converts to a minimum
            Intelligence Index through a table pinned by test, and{" "}
            {payload.modelsScored} models in the catalogue carry a measured
            index. Reach is the share of those models at or above the level the
            role demands, so a role high on this list is work most of the market
            can already perform at the level required.
          </p>
          <p>
            <strong className="text-base-content">Reach is not displacement.</strong>{" "}
            A model working at the level a role requires is a precondition for
            automating that work, not proof it will be: cost, integration,
            regulation and appetite all sit in between. This says where
            capability has arrived, and nothing about anyone&apos;s job.
          </p>
          <p>
            <strong className="text-base-content">
              This is not a reading of {companyName}&apos;s staff.
            </strong>{" "}
            The library holds role archetypes by sector, not an employer&apos;s
            headcount. Three columns a full workforce study would carry are
            deliberately absent, because no public source publishes them per
            company and computing them would mean inventing them: estimated
            headcount per role, the hiring trend in each function, and a layoff
            signal. Those need the company&apos;s own disclosures. Where a
            figure is stated in its sources it appears in the findings above,
            and where you hold one yourself the assumptions panel takes it.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-200/40 p-3">
      <p className="micro-label">{label}</p>
      <p className="mt-0.5 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}

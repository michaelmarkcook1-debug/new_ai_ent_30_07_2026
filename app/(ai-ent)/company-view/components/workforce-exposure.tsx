import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type { ExposurePayload } from "@/lib/exposure/payload";

// Where AI has already reached the work every employer has.
//
// Two decisions shape this panel, and both were arrived at by trying the
// alternative first.
//
// IT READS THE 99 MULTI-INDUSTRY ROLES, not a sector's specialists. The library
// holds 294 roles; 99 carry one profile that serves every sector, across 18
// functions from finance and legal to cybersecurity and executive leadership.
// Reading a company against its own sector needed the company placed in a
// taxonomy, which can be got wrong; rested a mean on five to seven roles; and
// once the multi-industry roles were correctly included beside them, ninety-nine
// swamped six and every sector returned the same number anyway. These 99 apply
// to a bank, a grocer and a shipyard alike, so nothing has to be guessed about
// the company for the reading to be true of it.
//
// THE VERTICAL LENS IS ABOUT ASSURANCE, NOT CAPABILITY. A customer care agent in
// investment banking is not one in retail, and the role library cannot say so:
// its cross-industry profiles are shared, which the specification itself records
// as a known gap. Inventing a per-sector capability multiplier would be exactly
// the fabrication this product refuses. What genuinely differs, and is recorded
// per workflow, is the risk tier, the reliability bar and the autonomy it is
// safe to default to. So the same work is reachable in both sectors and only one
// of them can let it run supervised, which is the difference a buyer feels.

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
  sector,
  companyName,
}: {
  payload: ExposurePayload;
  /** Where the analyst model placed this company, when it could. */
  sector: { tag: string | null };
  companyName: string;
}) {
  if (payload.roles.length === 0) return null;
  const lens = sector.tag ? payload.verticals[sector.tag] : null;
  const sectorName = sector.tag ? payload.tagLabels[sector.tag] : null;

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
        The {payload.roles.length} roles every employer has, across{" "}
        {payload.functions.length} functions, whatever it sells. Nothing here is
        specific to {companyName}, and nothing had to be guessed about them for
        it to hold.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        <Stat label="Mean reach" value={`${payload.meanReach}%`} note="Across all 18 functions" />
        <Stat label="Widely reached" value={String(payload.widelyReached)} note="Over half the catalogue" />
        <Stat label="Frontier only" value={String(payload.frontierOnly)} note="Capability still binds" />
        <Stat label="Functions" value={String(payload.functions.length)} note="Finance to cyber" />
      </div>

      {/* The vertical difference, drawn from the workflow catalogue rather than
          from a capability adjustment the library cannot support. */}
      {lens && sectorName ? (
        <div className="mt-4 rounded-lg border border-base-300 bg-base-200/40 p-4">
          <MicroLabel
            label={`What ${sectorName} does to the same work`}
            tooltip="Risk tier, reliability bar and safe autonomy, from the workflows the catalogue tags to this sector."
          />
          <p className="measure mt-2 text-sm">
            The capability these roles demand is recorded once and reads the
            same in every sector. What your sector changes is what you are
            permitted to do with it.{" "}
            <span className="font-semibold">
              {sectorName} runs its catalogued workflows at a mean risk of{" "}
              {lens.meanRisk} out of 4 and a reliability bar of{" "}
              {lens.meanReliability} out of 5
            </span>
            {lens.vsAll.risk !== 0 ? (
              <>
                , {lens.vsAll.risk > 0 ? "above" : "below"} the catalogue average
                by {Math.abs(lens.vsAll.risk)} on risk
              </>
            ) : null}
            . {lens.highRisk} of its {lens.workflows} tagged workflows sit at
            high or critical risk, and the most constrained autonomy any of them
            defaults to is{" "}
            <span className="font-semibold">
              {payload.autonomyLabels[lens.tightestAutonomy] ??
                lens.tightestAutonomy}
            </span>
            . So work a model reaches in both sectors may run supervised in one
            and only with a person in the loop in the other.
          </p>
          {lens.thin ? (
            <p className="measure mt-2 text-sm text-muted">{lens.thin}.</p>
          ) : null}
        </div>
      ) : (
        <p className="measure mt-4 rounded-lg border border-dashed border-base-300 px-3 py-3 text-sm text-muted">
          {companyName} was not placed in a sector the workflow catalogue covers,
          so the reach figures stand on their own. A sector reading would add
          what that vertical permits: its risk tier, its reliability bar and the
          autonomy it can safely default to.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <thead>
            <tr className="border-b border-base-300 text-left">
              <th className="pb-2 pr-3 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Function
              </th>
              <th className="pb-2 pr-3 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Most reached role in it
              </th>
              <th className="pb-2 pr-3 text-right font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Mean reach
              </th>
              <th className="pb-2 font-mono text-sm font-normal uppercase tracking-wider text-muted">
                Reading
              </th>
            </tr>
          </thead>
          <tbody>
            {payload.functions.map((fn) => {
              const tone = reachTone(fn.mean);
              const top = fn.roles[0];
              return (
                <tr key={fn.f} className="border-b border-base-300/60">
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{fn.f}</span>
                    <span className="block text-sm text-muted">
                      {fn.roles.length}{" "}
                      {fn.roles.length === 1 ? "role" : "roles"}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {top?.n}
                    <span className="block font-mono text-sm">
                      {BAND_LABEL[top?.b] ?? ""} · index{" "}
                      {payload.indexByBand[top?.b] ?? 0}+
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-base-200">
                        <span
                          className="block h-full rounded-full bg-insight"
                          style={{ width: `${fn.mean}%` }}
                        />
                      </span>
                      <span className="font-mono font-bold">{fn.mean}%</span>
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

      <div className="mt-3">
        <DerivationDrawer
          title="How this is derived, and what it deliberately does not claim"
          trigger="How this is derived"
        >
          <p>
            Every role records what its work demands on a capability band from
            10 to 90. That band converts to a minimum Intelligence Index through
            a table pinned by test, and {payload.modelsScored} models carry a
            measured index. Reach is the share of those models at or above the
            level the role demands, so a function high on this list is work most
            of the market can already perform at the level required.
          </p>
          <p>
            <strong className="text-base-content">Reach is not displacement.</strong>{" "}
            A model working at the level a role requires is a precondition for
            automating that work, not proof it will be: cost, integration,
            regulation and appetite all sit in between.
          </p>
          <p>
            <strong className="text-base-content">
              The same role reads the same in every sector, and that is a known
              gap.
            </strong>{" "}
            These 99 roles carry one shared profile each, which the role
            library&apos;s own specification records as wrong and not yet
            fixable from evidence. A customer care agent in investment banking
            does harder work than one in retail, and the capability figures here
            cannot see the difference. Rather than invent a per-sector
            multiplier, the sector reading above uses what is actually recorded:
            the risk tier, reliability bar and safe autonomy of the workflows
            that sector runs.
          </p>
          <p className="text-muted">
            This is not a reading of {companyName}&apos;s staff. It describes
            the functions every employer has, not how many people they put in
            each. Headcount per role, hiring trend and layoff signal would need
            the company&apos;s own disclosures and are not shown rather than
            being modelled.
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

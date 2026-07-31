import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";

// The live AI talent exposure matrix for a BoardRadar-covered company. The
// endpoint returns the same field names the exemplar fixture uses, so this
// is the same block on real data: workforce size, headcount-weighted average
// exposure, and role families with the direction each is moving.

interface RoleProvenance {
  sourceBasis?: string | null;
  confidence?: string | null;
  sourceUrl?: string | null;
  sourceNote?: string | null;
}

interface Role {
  role: string;
  // The live endpoint names this aiExposurePct; the exemplar fixture used
  // exposurePct. Both are read so neither renders as a missing value.
  aiExposurePct?: number | null;
  exposurePct?: number | null;
  direction?: string | null;
  rationale?: string | null;
  estHeadcount?: number | null;
  hiringTrend?: { direction?: string | null; changePct?: number | null } | null;
  layoffSignal?: { level?: string | null; note?: string | null } | null;
  provenance?: Record<string, RoleProvenance> | null;
}

// The endpoint's own direction vocabulary. Growth is good for the workforce,
// high-risk is not, stable is neither.
const DIRECTION_STYLE: Record<string, string> = {
  growth: "text-good",
  growing: "text-good",
  "high-risk": "text-error",
  contracting: "text-error",
  stable: "text-muted",
};
const DIRECTION_MARK: Record<string, string> = {
  growth: "▲",
  growing: "▲",
  "high-risk": "▼",
  contracting: "▼",
  stable: "▬",
};

export function LiveTalentExposure({
  matrix,
  source,
  ticker,
}: {
  matrix: Record<string, unknown> | null;
  source: "live" | "mock" | "error";
  ticker: string;
}) {
  if (!matrix) {
    return (
      <EmptyState
        title={`No talent exposure analysis for ${ticker}`}
        detail="The live call did not answer and no recorded response exists for this company. Awaiting coverage rather than an estimated workforce reading."
      />
    );
  }

  const lane = source === "live" ? "live" : "mock";
  const fmt = new Intl.NumberFormat("en-GB");
  const num = (k: string): number | null =>
    typeof matrix[k] === "number" ? (matrix[k] as number) : null;
  const str = (k: string): string | null =>
    typeof matrix[k] === "string" ? (matrix[k] as string) : null;

  const roles = Array.isArray(matrix.roles) ? (matrix.roles as Role[]) : [];
  const workforce = num("workforce");
  const avg = num("avgAiExposurePct");
  const threshold = num("highExposureThresholdPct");
  const coverage = num("roleCoveragePct");

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {[
          {
            label: "WORKFORCE",
            value: workforce === null ? "not published" : fmt.format(workforce),
            help: "Headcount as reported by the endpoint.",
          },
          {
            label: "AVG AI EXPOSURE",
            value: avg === null ? "not published" : `${avg}%`,
            help: str("avgAiExposureBasis")
              ? `Basis: ${str("avgAiExposureBasis")}.`
              : "Average share of tasks AI changes materially.",
          },
          {
            label: "HIGH-EXPOSURE ROLES",
            value: String(num("highExposureRoleCount") ?? "not published"),
            help:
              threshold === null
                ? "Roles above the endpoint's high-exposure threshold."
                : `Role families above ${threshold} per cent exposure.`,
          },
          {
            label: "CONTRACTING ROLES",
            value: String(num("contractingRoleCount") ?? "not published"),
            help: "Role families the endpoint reads as shrinking.",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <MicroLabel label={c.label} tooltip={c.help} />
              <LaneBadge lane={lane} />
            </div>
            <p className="mt-1.5 font-mono text-[20px] font-bold">{c.value}</p>
          </div>
        ))}
      </section>

      {str("summary") ? (
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <p className="text-[13px] leading-relaxed">{str("summary")}</p>
        </section>
      ) : null}

      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="AI talent exposure"
            tooltip={`Share of each role's tasks that AI changes materially.${
              threshold !== null
                ? ` High exposure threshold: ${threshold} per cent.`
                : ""
            }${coverage !== null ? ` Coverage: ${coverage} per cent of headcount.` : ""}`}
          />
          <LaneBadge lane={lane} />
        </div>
        {roles.length === 0 ? (
          <p className="px-3 py-4 text-[11.5px] text-muted">
            No role-level breakdown is published for this company.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                    Role family
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                    AI exposure
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                    Direction
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                    Hiring trend
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                    Est. headcount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {roles.map((r, i) => {
                  const exposure = r.aiExposurePct ?? r.exposurePct ?? null;
                  const dir = r.direction ?? "";
                  const change = r.hiringTrend?.changePct ?? null;
                  // Every provenance entry on the row is inferred unless the
                  // endpoint says otherwise, so the source link is the only
                  // hard evidence and is surfaced where present.
                  const sourceUrl = r.provenance
                    ? Object.values(r.provenance).find((p) => p?.sourceUrl)
                        ?.sourceUrl
                    : null;
                  return (
                    <tr key={`${r.role}-${i}`} className="align-top hover:bg-base-200/60">
                      <td className="px-3 py-2">
                        <div className="text-[12.5px] font-semibold">
                          {r.role}
                        </div>
                        {r.rationale ? (
                          <p className="mt-0.5 max-w-md text-[11px] leading-snug text-muted">
                            {r.rationale}
                          </p>
                        ) : null}
                        {r.layoffSignal?.level &&
                        r.layoffSignal.level !== "none" ? (
                          <span
                            className="mt-1 inline-block rounded bg-warn-bg px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-warn"
                            title={r.layoffSignal.note ?? undefined}
                          >
                            layoff signal {r.layoffSignal.level}
                          </span>
                        ) : null}
                        {sourceUrl ? (
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 font-mono text-[9px] text-primary hover:underline"
                          >
                            source
                          </a>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <ScorePill score={exposure} invert />
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`font-mono text-[11px] ${DIRECTION_STYLE[dir] ?? "text-muted"}`}
                        >
                          {DIRECTION_MARK[dir] ?? "▬"} {dir || "not stated"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {change === null ? (
                          <span className="text-muted">not published</span>
                        ) : (
                          <span
                            className={
                              change > 0
                                ? "text-good"
                                : change < 0
                                  ? "text-error"
                                  : "text-muted"
                            }
                          >
                            {change > 0 ? `+${change}` : change}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {typeof r.estHeadcount === "number"
                          ? fmt.format(r.estHeadcount)
                          : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-base-300 px-3 py-2">
          <DerivationDrawer title="How talent exposure is derived">
            <p>
              Every figure here is the endpoint&apos;s own: workforce,{" "}
              <code>avgAiExposurePct</code> on the basis it states, the
              high-exposure threshold, and the role families with the direction
              it assigns each one. Exposure is banded inverted, because a higher
              share of tasks changed means more disruption to absorb.
            </p>
            <p className="text-muted">
              Coverage can exceed 100 per cent where role headcounts overlap in
              the source; it is shown as returned rather than normalised.
              {source === "mock"
                ? " This view is the recorded response: the live call did not answer."
                : ""}
            </p>
          </DerivationDrawer>
        </div>
      </section>

      <section className="rounded-lg border border-dashed border-base-300 px-4 py-3">
        <p className="text-[11.5px] text-muted">
          The workforce pyramid, functional readiness and leadership signals
          shown for the exemplar buyer have no per-company equivalent in the
          API, so they are omitted here rather than shown under this
          company&apos;s name.
        </p>
      </section>
    </div>
  );
}

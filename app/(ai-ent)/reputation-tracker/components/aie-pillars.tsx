"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  REPUTATION_INDEX,
  REPUTATION_VENDOR_IDS,
  INTELLIGENCE_VENDORS,
} from "@/lib/aie";
import type {
  CustomerReputation,
  DeveloperReputation,
  EmployeeReputation,
} from "@/lib/aie/reputation/seed";
import { aieFetch, type AieSource } from "@/lib/aie-live";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";

// Live rows from the deployed AIE app's reputation API: identical schema to
// the ported seed, so the same pillar UI renders either source.
interface LiveReputationRow {
  vendorId: string;
  developer: DeveloperReputation | null;
  employee: EmployeeReputation | null;
  customer: CustomerReputation | null;
}

// Vendor display names come from the intelligence seed spine; the one
// reputation-only id (aleph) gets a local fallback so nothing renders raw.
const NAME_FALLBACK: Record<string, string> = { aleph: "Aleph Alpha" };
const VENDOR_NAME = new Map(INTELLIGENCE_VENDORS.map((v) => [v.id, v.name]));

function nameOf(id: string): string {
  return VENDOR_NAME.get(id) ?? NAME_FALLBACK[id] ?? id;
}

type CellStatus = "seed" | "documented" | "verified";

// Native dataset confidence labels (seed / documented / verified), shown
// verbatim per cell as the AIE reputation seed defines them.
function StatusChip({ status }: { status: CellStatus }) {
  const styles: Record<CellStatus, string> = {
    verified: "bg-good-bg text-good",
    documented: "bg-warn-bg text-warn",
    seed: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider ${styles[status]}`}
      title={
        status === "verified"
          ? "Fetched from the named public source"
          : status === "documented"
            ? "Computed from a public source with known caveats"
            : "Curated seed value awaiting real ingestion"
      }
    >
      {status}
    </span>
  );
}

function MetricRow({
  label,
  score,
  status,
  note,
}: {
  label: string;
  score: number;
  status?: CellStatus;
  note?: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-1">
      <div className="min-w-0">
        <span className="text-[12.5px]">{label}</span>
        {note ? <p className="text-[10px] leading-snug text-muted">{note}</p> : null}
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        {status ? <StatusChip status={status} /> : null}
        <ScorePill score={score} />
      </span>
    </li>
  );
}

function ThemesAndSources({
  heading,
  themes,
  sources,
}: {
  heading: string;
  themes: string[];
  sources: string[];
}) {
  return (
    <div className="mt-3 border-t border-base-300 pt-2">
      <p className="micro-label">{heading}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-base-content/85">
        {themes.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[9px] text-muted">
        Sources: {sources.join(", ")}
      </p>
    </div>
  );
}

function PillarCard({
  title,
  tooltip,
  overall,
  drawerTitle,
  drawerBody,
  children,
  lane = "aie",
}: {
  title: string;
  tooltip: string;
  overall: number;
  drawerTitle: string;
  drawerBody: React.ReactNode;
  children: React.ReactNode;
  lane?: "aie" | "aie-live" | "mock";
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel label={title} tooltip={tooltip} />
        <LaneBadge lane={lane} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-2xl font-bold leading-none">{overall}</span>
        <span className="text-[11px] text-muted">overall, 0 to 100</span>
      </div>
      <div className="mt-1">
        <DerivationDrawer title={drawerTitle}>{drawerBody}</DerivationDrawer>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// AIE three-pillar reputation section: developer, employee and customer
// pillars, pulled live from the deployed AIE app when it answers (identical
// schema to the ported seed, which remains the fallback with its own badge).
export function AiePillarsSection() {
  const [live, setLive] = useState<Map<string, LiveReputationRow> | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [vendorId, setVendorId] = useState("anthropic");

  useEffect(() => {
    let cancelled = false;
    aieFetch<{ rows: LiveReputationRow[] }>("reputation").then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.rows) {
        setLive(new Map(res.data.rows.map((r) => [r.vendorId, r])));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const usingLive = live !== null;
  const lane: "aie" | "aie-live" | "mock" = usingLive
    ? source === "mock"
      ? "mock"
      : "aie-live"
    : "aie";
  const vendorIds = (usingLive ? [...live.keys()] : [...REPUTATION_VENDOR_IDS]).sort(
    (a, b) => nameOf(a).localeCompare(nameOf(b))
  );

  const liveRow = usingLive ? live.get(vendorId) : undefined;
  const dev = usingLive ? liveRow?.developer ?? undefined : REPUTATION_INDEX.developer.get(vendorId);
  const emp = usingLive ? liveRow?.employee ?? undefined : REPUTATION_INDEX.employee.get(vendorId);
  const cust = usingLive ? liveRow?.customer ?? undefined : REPUTATION_INDEX.customer.get(vendorId);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="AI vendor reputation"
          tooltip="Three-pillar reputation read (developer, employee, customer). Native per-cell confidence labels (seed, documented, verified) are kept visible whichever source renders."
        />
        <LaneBadge lane={lane} />
        <span className="micro-label">
          {usingLive
            ? "Pulled live from the deployed AIE app; identical schema to the ported seed"
            : "Ported seed (the live pull did not answer)"}
        </span>
        <span className="font-mono text-[10px] text-muted">
          {vendorIds.length} vendors tracked
        </span>
        <select
          aria-label="Reputation vendor"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
        >
          {vendorIds.map((id) => (
            <option key={id} value={id}>
              {nameOf(id)}
            </option>
          ))}
        </select>
        <Link
          href={`/vendor-view/${vendorId}`}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Full profile: {nameOf(vendorId)}
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Developer pillar */}
        {dev ? (
          <PillarCard
            title="Developer reputation"
            tooltip="How developers using this vendor's models report on developer experience, from public GitHub, Reddit, HackerNews and status-page signals. Not employees of the vendor."
            overall={dev.overall}
            lane={lane}
            drawerTitle="How the developer pillar is derived"
            drawerBody={
              <>
                <p>
                  The overall figure is the rounded mean of five 0 to 100
                  columns: GitHub signal, Reddit reception, forum signal, API
                  reliability and documentation quality.
                </p>
                <ul className="list-disc space-y-1 pl-4 text-muted">
                  <li>
                    GitHub: flagship-repo stars plus freshness from the public
                    GitHub API (log-scaled star score weighted 70 per cent,
                    push freshness 30 per cent). Cells fetched live are
                    labelled verified.
                  </li>
                  <li>
                    Reddit: average upvote ratio from the public Reddit search
                    API over 12 months. Volume is deliberately discarded as
                    name-ambiguity noise, so the cell is labelled documented,
                    not verified.
                  </li>
                  <li>
                    Forum: 12-month HackerNews story volume and engagement via
                    the public Algolia API (verified).
                  </li>
                  <li>
                    API reliability: 90-day incident history from the vendor's
                    public status page where one exists (verified); curated
                    seed otherwise.
                  </li>
                  <li>Documentation: curated seed until ingestion is wired.</li>
                </ul>
                <p className="text-muted">
                  Per-cell labels (seed, documented, verified) are the
                  dataset's own and are shown next to each figure.
                </p>
              </>
            }
          >
            <ul className="divide-y divide-base-300/60">
              <MetricRow
                label="GitHub signal"
                score={dev.githubScore}
                status={dev.cellStatus?.github ?? dev.dataStatus}
                note={
                  dev.githubRepo
                    ? `${dev.githubRepo}${dev.githubStars ? `, ${dev.githubStars.toLocaleString("en-GB")} stars` : ""}${dev.githubLastFetched ? `, fetched ${dev.githubLastFetched}` : ""}`
                    : "No public flagship repo; curated seed value"
                }
              />
              <MetricRow
                label="Reddit reception"
                score={dev.redditSentiment}
                status={dev.cellStatus?.reddit ?? dev.dataStatus}
                note={
                  dev.redditUpvoteRatio
                    ? `Average upvote ratio ${dev.redditUpvoteRatio}, fetched ${dev.redditLastFetched ?? ""}`
                    : undefined
                }
              />
              <MetricRow
                label="Forum signal"
                score={dev.forumScore}
                status={dev.cellStatus?.forum ?? dev.dataStatus}
                note={
                  typeof dev.forumHnHits === "number"
                    ? `${dev.forumHnHits.toLocaleString("en-GB")} HackerNews stories in 12 months`
                    : undefined
                }
              />
              <MetricRow
                label="API reliability"
                score={dev.apiReliability}
                status={dev.cellStatus?.api ?? dev.dataStatus}
                note={
                  typeof dev.apiIncidents90d === "number"
                    ? `${dev.apiIncidents90d} incidents in 90 days, ${dev.apiMajorIncidents90d ?? 0} major`
                    : undefined
                }
              />
              <MetricRow
                label="Documentation quality"
                score={dev.documentationScore}
                status={dev.cellStatus?.docs ?? dev.dataStatus}
              />
            </ul>
            <ThemesAndSources
              heading="What developers talk about"
              themes={dev.primaryThemes}
              sources={dev.sources}
            />
          </PillarCard>
        ) : (
          <EmptyState
            title="No developer coverage"
            detail={`The AIE reputation seed has no developer pillar for ${nameOf(vendorId)}. Nothing is invented in its place.`}
          />
        )}

        {/* Employee pillar */}
        {emp ? (
          <PillarCard
            title="Employee reputation"
            tooltip="Employee experience from public review platforms, forums and public court records: work-life balance, culture, litigation, career growth, compensation and mission alignment."
            overall={emp.overall}
            lane={lane}
            drawerTitle="How the employee pillar is derived"
            drawerBody={
              <>
                <p>
                  The overall figure is the rounded mean of six 0 to 100
                  metrics: work-life balance, culture, litigation score,
                  career growth, compensation and mission alignment.
                </p>
                <ul className="list-disc space-y-1 pl-4 text-muted">
                  <li>
                    Litigation: the raw footprint is the real count of
                    employment-related court records over 24 months from the
                    public CourtListener API (verified). The score derives
                    from that count per 1,000 employees on a log scale; the
                    headcount denominator is a public estimate, so the rate is
                    labelled documented.
                  </li>
                  <li>
                    Mission alignment: curated seed informed by recurring
                    public review themes; no free API exists for it, so it is
                    honestly labelled seed.
                  </li>
                  <li>
                    The remaining metrics are curated seed values from public
                    review platforms until ingestion is wired.
                  </li>
                </ul>
              </>
            }
          >
            <ul className="divide-y divide-base-300/60">
              <MetricRow label="Work-life balance" score={emp.workLifeBalance} status={emp.dataStatus} />
              <MetricRow label="Culture" score={emp.culture} status={emp.dataStatus} />
              <MetricRow
                label="Litigation score"
                score={emp.litigationScore}
                status={emp.cellStatus?.litigation ?? emp.dataStatus}
                note={
                  typeof emp.litigationFootprint === "number"
                    ? `${emp.litigationFootprint.toLocaleString("en-GB")} court records in 24 months, ${emp.litigationPerThousand ?? 0} per 1,000 employees (approx. headcount ${emp.approxHeadcount?.toLocaleString("en-GB") ?? "n/a"})`
                    : undefined
                }
              />
              <MetricRow label="Career growth" score={emp.careerGrowth} status={emp.dataStatus} />
              <MetricRow label="Compensation" score={emp.compensation} status={emp.dataStatus} />
              <MetricRow
                label="Mission alignment"
                score={emp.missionAlignment}
                status={emp.cellStatus?.mission ?? emp.dataStatus}
              />
            </ul>
            <ThemesAndSources
              heading="What employees say"
              themes={emp.primaryThemes}
              sources={emp.sources}
            />
          </PillarCard>
        ) : (
          <EmptyState
            title="No employee coverage"
            detail={`The AIE reputation seed has no employee pillar for ${nameOf(vendorId)}. Nothing is invented in its place.`}
          />
        )}

        {/* Customer pillar */}
        {cust ? (
          <PillarCard
            title="Customer reputation"
            tooltip="Customer experience of the vendor's service: uptime, value for money, customer service, responsiveness and quality, sourced from review platforms and status-page archives."
            overall={cust.overall}
            lane={lane}
            drawerTitle="How the customer pillar is derived"
            drawerBody={
              <>
                <p>
                  The overall figure is the rounded mean of five inputs:
                  average uptime (a percentage that feeds the composite
                  directly as a 0 to 100 value), value for money, customer
                  service, responsiveness and quality of service.
                </p>
                <p className="text-muted">
                  Values are curated seed from G2, Capterra, TrustRadius and
                  status-page archives until real ingestion is wired; the
                  structure swaps in verified scores per cell without UI
                  changes.
                </p>
              </>
            }
          >
            <ul className="divide-y divide-base-300/60">
              <li className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span className="text-[12.5px]">Average uptime</span>
                <span className="flex items-center gap-1.5">
                  <StatusChip status={cust.dataStatus} />
                  <span className="font-mono text-[11px] font-semibold">
                    {cust.averageUptimePct} per cent
                  </span>
                </span>
              </li>
              <MetricRow label="Value for money" score={cust.valueForMoney} status={cust.dataStatus} />
              <MetricRow label="Customer service" score={cust.customerService} status={cust.dataStatus} />
              <MetricRow label="Responsiveness" score={cust.responsiveness} status={cust.dataStatus} />
              <MetricRow label="Quality of service" score={cust.qualityOfService} status={cust.dataStatus} />
            </ul>
            <ThemesAndSources
              heading="What customers like and flag"
              themes={cust.primaryThemes}
              sources={cust.sources}
            />
          </PillarCard>
        ) : (
          <EmptyState
            title="No customer coverage"
            detail={`The AIE reputation seed has no customer pillar for ${nameOf(vendorId)}. Nothing is invented in its place.`}
          />
        )}
      </div>
    </section>
  );
}

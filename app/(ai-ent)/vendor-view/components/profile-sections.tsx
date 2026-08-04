import Link from "next/link";
import { CategoryChip, LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { PILLARS } from "@/lib/aie/types";
import type {
  DeveloperReputation,
  EmployeeReputation,
  CustomerReputation,
} from "@/lib/aie/reputation/seed";
import type { VendorProfile } from "../data";

// Shared section frame: title, AIE dataset badge, optional derivation
// drawer on the right, content below.
function Section({
  title,
  drawer,
  children,
}: {
  title: string;
  drawer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold">{title}</h3>
          <LaneBadge lane="aie" />
        </div>
        {drawer}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const TH_CLASS =
  "px-2 py-1.5 font-mono text-xs font-medium uppercase tracking-wider text-muted";

// ---------- Facts strip ----------

export function ProfileFacts({ profile }: { profile: VendorProfile }) {
  const { vendor, intel } = profile;
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryChip label={`Layer: ${vendor.layer}`} />
        <CategoryChip label={intel.category ?? "not stated"} />
        <CategoryChip label={intel.marketPosition ?? "not stated"} />
        {intel.headquarters ? <CategoryChip label={intel.headquarters ?? "not stated"} /> : null}
        <CategoryChip
          label={
            vendor.isPublic
              ? `Public${vendor.ticker ? `: ${vendor.ticker}` : ""}`
              : "Private"
          }
        />
        <LaneBadge lane="aie" />
      </div>
      <p className="measure mt-3 text-sm leading-relaxed text-base-content/85">
        <span className="micro-label mr-2">Analyst interpretation</span>
        {intel.analystInterpretation ?? "No interpretation published."}
      </p>
    </section>
  );
}

// ---------- Score block ----------

export function ScoreBlock({ profile }: { profile: VendorProfile }) {
  const { intel, liveCapabilities } = profile;

  const drawer = (
    <DerivationDrawer title={`How ${intel.name}'s scores are derived`}>
      <p>
        Carried unchanged from the AI Enterprise source.{" "}
        <span className="font-mono text-sm">overallScore</span> is the score
        that source publishes for the vendor, and each capability row is its{" "}
        <span className="font-mono text-sm">maturityScore</span> with the
        evidence grade (E1 to E5) and the date it was last verified.
      </p>
      <p className="measure text-muted">
        These figures used to come from a copy of the source taken on 8 July
        2026 and frozen into this app. That copy had drifted: it scored every
        one of 37 overlapping vendors higher than the live source, by 18 points
        on average and by 46 for Microsoft. The copy is gone and this reads the
        published figures directly, so a number here now matches the number
        upstream.
      </p>
      <p className="measure text-muted">
        The six pillar scores that used to sit here are gone with it. Upstream
        publishes no pillar scores: they were computed by the frozen copy, so
        there was nothing current to refresh them against. The ten capabilities
        below are what the source actually publishes per vendor.
      </p>
    </DerivationDrawer>
  );

  return (
    <Section title="Scores" drawer={drawer}>
      <div className="flex flex-wrap gap-6">
        <div>
          <span className="micro-label">overallScore</span>
          <div className="mt-1">
            <ScorePill score={intel.overallScore} />
          </div>
        </div>
        <div>
          <span className="micro-label">confidenceScore</span>
          <div className="mt-1">
            <ScorePill score={intel.confidenceScore} />
          </div>
        </div>
        <div>
          <span className="micro-label">marketPosition</span>
          <div className="mt-1 font-mono text-sm">{intel.marketPosition ?? "not stated"}</div>
        </div>
      </div>
      {liveCapabilities.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className={TH_CLASS}>Capability</th>
                <th className={TH_CLASS}>maturityScore</th>
                <th className={TH_CLASS}>status</th>
                <th className={TH_CLASS}>evidenceGrade</th>
                <th className={TH_CLASS}>lastVerified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {liveCapabilities.map((c) => (
                <tr key={c.capabilityId}>
                  <td className="px-2 py-2">
                    <span className="font-mono text-xs">{c.capabilityId}</span>
                  </td>
                  <td className="px-2 py-2">
                    <ScorePill score={c.maturityScore} />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-muted">
                    {c.status ?? "not stated"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {c.evidenceGrade ?? "not graded"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-muted">
                    {c.lastVerified ? c.lastVerified.slice(0, 10) : "not stated"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No capability scores published"
          detail="The AI Enterprise source publishes no capability breakdown for this vendor."
        />
      )}
    </Section>
  );
}

// ---------- Capabilities ----------

export function CapabilitiesSection({ profile }: { profile: VendorProfile }) {
  const { capabilities, intel } = profile;

  const drawer = (
    <DerivationDrawer title="How capability scores are derived">
      <p>
        Capability rows come from the AI Enterprise capability matrix (10
        capability families per covered vendor). Each cell keeps the
        dataset&apos;s native labels: a status (inferred, documented, tested or
        verified), a maturityScore (0 to 100), an evidence grade (E1 to E5)
        and a last-verified date. Values are evidence-gradelled derived
        signals; a claim only reads as verified when the dataset itself grades
        it that way, and claims below the strong-evidence bar are suppressed
        at source.
      </p>
    </DerivationDrawer>
  );

  return (
    <Section title="Capabilities" drawer={drawer}>
      {capabilities.length === 0 ? (
        <EmptyState
          title="Not covered in the capability matrix"
          detail={`The AI Enterprise capability matrix does not include ${intel.name}. No capability scores are shown rather than invented.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className={TH_CLASS}>Capability</th>
                <th className={TH_CLASS}>maturityScore</th>
                <th className={TH_CLASS}>status</th>
                <th className={TH_CLASS}>evidenceGrade</th>
                <th className={TH_CLASS}>Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {capabilities.map((item) => (
                <tr key={item.row.capabilityId}>
                  <td className="px-2 py-2">
                    <span className="text-sm font-semibold" title={item.description}>
                      {item.name}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <ScorePill score={item.row.maturityScore} />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {item.row.status}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {item.row.evidenceGrade}
                  </td>
                  <td className="max-w-sm px-2 py-2 text-xs text-muted">
                    {item.row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Dependency edges ----------

const EDGE_TYPE_LABEL: Record<string, string> = {
  investment: "Investment",
  cloud: "Cloud",
  model_hosting: "Model hosting",
  commercial_partnership: "Commercial partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

function EvidenceTierChip({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    high: "bg-good-bg text-good",
    medium: "bg-warn-bg text-warn",
    seed: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${styles[tier] ?? "bg-base-200 text-muted"}`}
      title={
        tier === "high"
          ? "Disclosed in filings, press releases or official model catalogues"
          : tier === "medium"
            ? "Publicly stated but with lower disclosure depth"
            : "Plausible but not independently verified; treat as a hypothesis"
      }
    >
      {tier}
    </span>
  );
}

export function DependencySection({ profile }: { profile: VendorProfile }) {
  const { edges, intel } = profile;

  const drawer = (
    <DerivationDrawer title="How dependency edges are sourced">
      <p>
        Edges come from the AI Enterprise exposure map, a hand-curated,
        source-backed relationship list. Confidence tiers are the
        dataset&apos;s own: high means the relationship is disclosed in
        filings, press releases or official model catalogues; medium means
        publicly stated with lower disclosure depth; seed means plausible but
        not independently verified. Speculative edges are never recorded at
        high confidence, so anything below the strong-evidence bar stays
        visibly labelled rather than being presented as fact.
      </p>
    </DerivationDrawer>
  );

  return (
    <Section title="Dependency and alliance edges" drawer={drawer}>
      {edges.length === 0 ? (
        <EmptyState
          title="No edges recorded"
          detail={`The exposure map records no dependency or alliance edges touching ${intel.name}.`}
        />
      ) : (
        <ul className="space-y-2">
          {edges.map((item) => (
            <li
              key={item.edge.id}
              className="rounded-lg border border-base-300 bg-base-100 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {item.sourceLabel} → {item.targetLabel}
                </span>
                <CategoryChip
                  label={
                    EDGE_TYPE_LABEL[item.edge.relationshipType] ??
                    item.edge.relationshipType
                  }
                />
                <EvidenceTierChip tier={item.edge.confidence} />
                {item.edge.estimatedValue ? (
                  <span className="font-mono text-xs text-muted">
                    {item.edge.estimatedValue}
                  </span>
                ) : null}
                <span className="font-mono text-xs text-muted">
                  updated {item.edge.dateUpdated}
                </span>
              </div>
              <p className="measure mt-1 text-sm leading-snug text-base-content/85">
                {item.edge.summary}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {item.edge.sourceUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {new URL(url).hostname}
                  </a>
                ))}
                {item.counterpartVendorId ? (
                  <Link
                    href={`/vendor-view/${item.counterpartVendorId}`}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Counterparty profile
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------- Models ----------

export function ModelsSection({ profile }: { profile: VendorProfile }) {
  const { models, intel, infrastructureOnly } = profile;

  const drawer = (
    <DerivationDrawer title="How model records are sourced">
      <p>
        Model rows come from the AI Enterprise commercial model inventory,
        filtered to models this vendor owns. Every record cites official
        source URLs and keeps the inventory&apos;s native labels: an ownership
        type, an availability stage, a data status (seed until live
        verification upgrades it) and an evidence grade with a numeric
        confidence. Hosted third-party records always keep the actual owner,
        and vendors with no confirmed first-party model are marked as such
        rather than having one invented.
      </p>
    </DerivationDrawer>
  );

  return (
    <Section title="Models owned" drawer={drawer}>
      {models.length === 0 ? (
        infrastructureOnly ? (
          <EmptyState
            title="Infrastructure-only vendor"
            detail={`The model inventory lists ${intel.name} as infrastructure-only: no confirmed first-party commercial model is recorded, and none is invented.`}
          />
        ) : (
          <EmptyState
            title="Not covered in the model inventory"
            detail={`The AI Enterprise model inventory records no models owned by ${intel.name}.`}
          />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className={TH_CLASS}>Model</th>
                <th className={TH_CLASS}>modelFamily</th>
                <th className={TH_CLASS}>modelCategory</th>
                <th className={TH_CLASS}>availabilityStage</th>
                <th className={TH_CLASS}>ownershipType</th>
                <th className={TH_CLASS}>dataStatus</th>
                <th className={TH_CLASS}>Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {models.map((model) => (
                <tr key={model.id}>
                  <td className="px-2 py-2">
                    <span
                      className="text-sm font-semibold"
                      title={model.uncertaintyNote}
                    >
                      {model.modelName}
                    </span>
                    {model.hostingVendorName ? (
                      <div className="text-xs text-muted">
                        hosted by {model.hostingVendorName}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {model.modelFamily}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-muted">
                    {model.modelCategory}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {model.availabilityStage}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-muted">
                    {model.ownershipType}
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-mono text-xs">
                      {model.dataStatus} · {model.evidenceGrade}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {model.sourceUrls[0] ? (
                      <a
                        href={model.sourceUrls[0]}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                        title={model.sourceNames[0]}
                      >
                        {new URL(model.sourceUrls[0]).hostname}
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted">
                        none cited
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

// ---------- Reputation ----------

function ReputationCard({
  label,
  overall,
  dataStatus,
  metrics,
  themes,
  sources,
}: {
  label: string;
  overall: number;
  dataStatus: string;
  metrics: { field: string; value: number }[];
  themes: string[];
  sources: string[];
}) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="micro-label">{label}</span>
        <span className="font-mono text-xs uppercase tracking-wider text-muted">
          {dataStatus}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <ScorePill score={overall} />
        <span className="font-mono text-xs text-muted">overall</span>
      </div>
      <dl className="mt-2 space-y-0.5">
        {metrics.map((m) => (
          <div key={m.field} className="flex items-center justify-between">
            <dt className="font-mono text-xs text-muted">{m.field}</dt>
            <dd className="font-mono text-xs">{m.value}</dd>
          </div>
        ))}
      </dl>
      {themes.length > 0 ? (
        <ul className="measure mt-2 list-disc space-y-0.5 pl-4 text-xs text-base-content/85">
          {themes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      {sources.length > 0 ? (
        <p className="mt-2 break-words font-mono text-xs text-muted">
          {sources.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function developerMetrics(r: DeveloperReputation) {
  return [
    { field: "githubScore", value: r.githubScore },
    { field: "redditSentiment", value: r.redditSentiment },
    { field: "forumScore", value: r.forumScore },
    { field: "apiReliability", value: r.apiReliability },
    { field: "documentationScore", value: r.documentationScore },
  ];
}

function employeeMetrics(r: EmployeeReputation) {
  return [
    { field: "workLifeBalance", value: r.workLifeBalance },
    { field: "culture", value: r.culture },
    { field: "litigationScore", value: r.litigationScore },
    { field: "careerGrowth", value: r.careerGrowth },
    { field: "compensation", value: r.compensation },
    { field: "missionAlignment", value: r.missionAlignment },
  ];
}

function customerMetrics(r: CustomerReputation) {
  return [
    { field: "averageUptimePct", value: r.averageUptimePct },
    { field: "valueForMoney", value: r.valueForMoney },
    { field: "customerService", value: r.customerService },
    { field: "responsiveness", value: r.responsiveness },
    { field: "qualityOfService", value: r.qualityOfService },
  ];
}

export function ReputationSection({ profile }: { profile: VendorProfile }) {
  const { reputation, intel } = profile;
  const { developer, employee, customer } = reputation;
  const covered = developer || employee || customer;

  const drawer = (
    <DerivationDrawer title="How reputation pillars are derived">
      <p>
        The three pillars come from the AI Enterprise reputation seed. Each
        pillar&apos;s overall is the rounded mean of its column scores as
        recorded in the dataset: developer averages the GitHub, Reddit, forum,
        API-reliability and documentation columns; employee averages six
        columns including a derived litigationScore (100 minus 8 points per
        recent filing, floored at 30) and missionAlignment; customer averages
        five columns with averageUptimePct feeding in directly as a 0 to 100
        value.
      </p>
      <p>
        Every cell keeps its native data status: scores marked seed remain
        evidence-graded derived signals until real ingestion verifies
        them, and nothing below that bar is presented as verified.
      </p>
    </DerivationDrawer>
  );

  return (
    <Section title="Reputation pillars" drawer={drawer}>
      {!covered ? (
        <EmptyState
          title="Not covered in the reputation seed"
          detail={`The AI Enterprise reputation dataset does not cover ${intel.name}.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-3">
          {developer ? (
            <ReputationCard
              label="Developer"
              overall={developer.overall}
              dataStatus={developer.dataStatus}
              metrics={developerMetrics(developer)}
              themes={developer.primaryThemes}
              sources={developer.sources}
            />
          ) : (
            <EmptyState title="No developer pillar" detail="Not recorded for this vendor." />
          )}
          {employee ? (
            <ReputationCard
              label="Employee"
              overall={employee.overall}
              dataStatus={employee.dataStatus}
              metrics={employeeMetrics(employee)}
              themes={employee.primaryThemes}
              sources={employee.sources}
            />
          ) : (
            <EmptyState title="No employee pillar" detail="Not recorded for this vendor." />
          )}
          {customer ? (
            <ReputationCard
              label="Customer"
              overall={customer.overall}
              dataStatus={customer.dataStatus}
              metrics={customerMetrics(customer)}
              themes={customer.primaryThemes}
              sources={customer.sources}
            />
          ) : (
            <EmptyState title="No customer pillar" detail="Not recorded for this vendor." />
          )}
        </div>
      )}
    </Section>
  );
}

// ---------- Source directory ----------

export function SourcesSection({ profile }: { profile: VendorProfile }) {
  const { sources, intel } = profile;
  return (
    <Section title="Source directory">
      {sources.length === 0 ? (
        <EmptyState
          title="No curated sources listed"
          detail={`The sourcing manifest holds no curated evidence URLs for ${intel.name}.`}
        />
      ) : (
        <ul className="space-y-2">
          {sources.map((entry) => (
            <li
              key={entry.url}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-base-300 bg-base-100 p-2.5"
            >
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-primary hover:underline"
              >
                {entry.label}
              </a>
              <CategoryChip label={entry.category.replace(/_/g, " ")} />
              <span className="font-mono text-xs text-muted">
                fresh for {entry.freshnessHorizonDays}{" "}
                {entry.freshnessHorizonDays === 1 ? "day" : "days"}
              </span>
              <span className="ml-auto break-all font-mono text-xs text-muted">
                {entry.expectedDomains.join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

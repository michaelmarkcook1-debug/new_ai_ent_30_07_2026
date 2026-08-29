import { CarryToDesk } from "./carry-to-desk";
import { OpportunityRow } from "./opportunity-row";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { toPosition } from "@/lib/position/store";
import { opportunitiesFor, weightingFrom } from "@/lib/position/opportunities";
import type { CompanyResearch } from "@/lib/research/company";

// What was found about a company, and where each part of it came from.
//
// Every statement carries the numbered source it was drawn from, and the
// sources are listed in full underneath, because the claim and the link have
// to travel together. A finding a reader cannot open is an assertion.

export function ResearchedCompany({ research }: { research: CompanyResearch }) {
  const { profile, metrics, findings, aiFindings, recommendations, sources, absence } =
    research;

  if (absence) {
    return (
      <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-5">
        <MicroLabel
          label={`Nothing returned for ${research.query}`}
          tooltip="Retrieval found nothing usable, so nothing is shown."
        />
        <p className="measure mt-2 text-sm text-muted">{absence}</p>
        {sources.length > 0 ? <SourceList sources={sources} /> : null}
      </section>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-4">
      <section className="finding rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Researched now"
            tooltip="Retrieved from the open web at the moment you asked, and read by the analyst model. Not an audit."
          />
          <LaneBadge lane="live" />
          <span className="font-mono text-sm text-muted">
            {sources.length} sources
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
          {profile.name}
        </h2>
        <p className="measure mt-1 text-sm text-muted">{profile.industry}</p>
        <p className="measure mt-3 text-lg leading-relaxed text-base-content/85">
          {profile.what}
        </p>
      </section>

      {/* The figure row this tab used to open with. Every card is a number a
          source states outright, shown in the currency and wording it used,
          with the source one click away. No card is a score of ours: where the
          old page computed a readiness or exposure index for an exemplar, this
          shows what is actually published and nothing else. */}
      {metrics.length > 0 ? (
        <section>
          <MicroLabel
            label="What the sources state"
            tooltip="Figures quoted exactly as the source gives them. Never converted, computed or estimated."
          />
          <div className="mt-2 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
            {metrics.map((m, i) => {
              const src = sources[m.sourceIndex];
              return (
                <div
                  key={`${m.label}-${i}`}
                  className="rounded-lg border border-base-300 bg-base-100 p-4"
                >
                  <p className="micro-label">{m.label}</p>
                  <p className="mt-1 text-xl font-bold leading-tight">
                    {m.value}
                  </p>
                  {src ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-mono text-sm text-primary hover:underline"
                    >
                      [{m.sourceIndex + 1}] {hostOf(src.url)}
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="measure rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-muted">
          No source stated a figure outright for this company, so no figure
          cards are shown. The findings below are what the passages support.
        </p>
      )}

      <EvidenceGraphic
        sources={sources.length}
        used={
          new Set(
            [...findings, ...aiFindings].map((f) => f.sourceIndex)
          ).size
        }
        business={findings.length}
        ai={aiFindings.length}
        figures={metrics.length}
      />

      <FindingList
        label="What the sources say"
        tooltip="The company's size, position and direction, as the retrieved passages report them."
        findings={findings}
        sources={sources}
        empty="The retrieved sources carried nothing substantive about the company itself."
      />

      <FindingList
        label="What they say about its AI"
        tooltip="Only what the passages state about this company's use of, or exposure to, AI. Silence here is a finding."
        findings={aiFindings}
        sources={sources}
        empty="Nothing in the retrieved sources describes this company's use of AI. That silence is the finding: it is not evidence of absence, but there is no public account to read."
      />

      {recommendations.length > 0 ? (
        <section className="finding rounded-xl p-5">
          <MicroLabel
            label="What to do about it"
            tooltip="What follows for a buyer evaluating AI for this company, from what was found."
          />
          <ol className="mt-2 space-y-2">
            {recommendations.map((r, i) => (
              <li key={r} className="flex gap-2.5">
                <span className="finding-figure font-mono text-sm font-bold">
                  {i + 1}
                </span>
                <span className="measure text-sm leading-snug">{r}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <OpportunityAreas research={research} />

      <SourceList sources={sources} />

      <DerivationDrawer title="How this was researched, and what it is not">
        <p>
          The company name was searched twice, once for the business and once
          for its AI activity, and the passages that came back were handed to
          the analyst model with the instruction to report only what they
          support. Every statement above cites the passage it came from.
        </p>
        <p>
          Each response is checked against those passages before it is shown. A
          figure the retrieved text did not contain causes the whole answer to
          be discarded rather than displayed, which is the same rule that
          governs every written surface in this product.
        </p>
        <p className="text-muted">
          This is retrieval, not audit. A figure from a company profile page is
          reported as a figure from a company profile page, and where two
          sources disagree the reading says so rather than picking one. Nothing
          here has the standing of a filing.
        </p>
      </DerivationDrawer>
    </div>
  );
}

// How much of what was retrieved actually carried something.
//
// The old tab opened with gauges scoring an exemplar's readiness and exposure.
// Those cannot be computed for an arbitrary company without inventing them, so
// this measures the thing that is genuinely measurable here: how much evidence
// was found, how much of it bore on AI specifically, and how many passages
// went unused. A reader can see the weight behind the reading before they
// read it, and a thin bar is itself the finding.
function EvidenceGraphic({
  sources,
  used,
  business,
  ai,
  figures,
}: {
  sources: number;
  used: number;
  business: number;
  ai: number;
  figures: number;
}) {
  const total = Math.max(business + ai, 1);
  const aiPct = Math.round((ai / total) * 100);
  const usedPct = sources > 0 ? Math.round((used / sources) * 100) : 0;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <MicroLabel
        label="Weight of evidence"
        tooltip="Counts of what was retrieved and what it supported. Not a score: nothing here is judged, only counted."
      />

      <div className="mt-3 grid grid-cols-1 gap-4 @2xl:grid-cols-[1fr_auto]">
        <div>
          {/* Business versus AI evidence. The split matters because a company
              can be well documented and still have no public AI account, and
              that is the case this product most needs to show. */}
          <div className="flex h-6 overflow-hidden rounded-full bg-base-300/60">
            <div
              className="h-full bg-primary/70"
              style={{ width: `${100 - aiPct}%` }}
              title={`${business} findings about the business`}
            />
            <div
              className="h-full bg-[var(--ag-insight)]"
              style={{ width: `${aiPct}%` }}
              title={`${ai} findings about its AI`}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary/70" />
              {business} on the business
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ag-insight)]" />
              {ai} on its AI
            </span>
          </div>
          <p className="measure mt-2 text-sm text-muted">
            {ai === 0
              ? "No retrieved passage described this company's use of AI. On this product that absence is the headline, not a gap in the search."
              : `${usedPct} per cent of the ${sources} passages retrieved carried something worth reporting, and ${figures} stated a figure outright.`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Dial label="passages used" value={used} of={sources} />
          <Dial label="stated figures" value={figures} of={sources} />
        </div>
      </div>
    </section>
  );
}

function Dial({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of: number;
}) {
  const R = 22;
  const C = 2 * Math.PI * R;
  const pct = of > 0 ? Math.min(1, value / of) : 0;
  return (
    <div className="flex flex-col items-center">
      <svg width="60" height="60" viewBox="0 0 60 60" role="img" aria-label={`${value} of ${of} ${label}`}>
        <circle cx="30" cy="30" r={R} fill="none" stroke="currentColor" opacity={0.15} strokeWidth="6" />
        <circle
          cx="30"
          cy="30"
          r={R}
          fill="none"
          stroke="var(--ag-insight)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${pct * C} ${C}`}
          transform="rotate(-90 30 30)"
        />
        <text x="30" y="35" textAnchor="middle" className="fill-current font-mono text-[13px] font-bold">
          {value}
        </text>
      </svg>
      <span className="mt-1 text-center font-mono text-sm text-muted">
        {label}
        <br />
        of {of}
      </span>
    </div>
  );
}

function FindingList({
  label,
  tooltip,
  findings,
  sources,
  empty,
}: {
  label: string;
  tooltip: string;
  findings: CompanyResearch["findings"];
  sources: CompanyResearch["sources"];
  empty: string;
}) {
  return (
    <section>
      {/* Titles a list of findings rather than captioning a figure, so it is
          set larger than the house micro-label. Both call sites are the two
          finding lists, which is why the size is set here rather than passed
          in per call. */}
      <MicroLabel label={label} tooltip={tooltip} size="large" />
      {findings.length === 0 ? (
        <p className="measure mt-2 rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {findings.map((f, i) => {
            const src = sources[f.sourceIndex];
            return (
              <li
                key={`${i}-${f.statement.slice(0, 24)}`}
                className="rounded-lg border border-base-300 bg-base-100 p-4"
              >
                <p className="measure text-sm leading-snug">{f.statement}</p>
                {src ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-block font-mono text-sm text-primary hover:underline"
                  >
                    [{f.sourceIndex + 1}] {hostOf(src.url)}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SourceList({ sources }: { sources: CompanyResearch["sources"] }) {
  return (
    <section className="mt-4">
      <MicroLabel
        label="Sources retrieved"
        tooltip="Every passage the reading was drawn from, in the order it was numbered."
      />
      <ol className="mt-2 space-y-1">
        {sources.map((s, i) => (
          <li key={s.url} className="text-sm">
            <span className="font-mono text-muted">[{i + 1}]</span>{" "}
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {s.title || hostOf(s.url)}
            </a>{" "}
            <span className="text-muted">{hostOf(s.url)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Where AI could go here, and what a buyer should weight because of it.
 *
 * The page reported what sources said and stopped, so a reader learned what
 * had been written about the company and nothing about what to do with it.
 * This takes a position, and takes it from the workflow catalogue keyed on the
 * sector the research placed the company in, never from an impression of the
 * company: the research prompt forbids carrying in anything the passages do
 * not contain, and that rule is right.
 *
 * Two classes, kept apart on screen. An area the company's own sources spoke
 * to is evidence; an area its sector runs is a place to look. Merging them
 * would turn a curated library into a claim about this company.
 */

function OpportunityAreas({ research }: { research: CompanyResearch }) {
  const position = toPosition(research);
  const opp = position ? opportunitiesFor(position) : null;

  if (!position || !opp) {
    return (
      <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-5">
        <MicroLabel
          label="Where AI could go here"
          tooltip="Derived from the workflow catalogue, keyed on the sector the research placed this company in."
        />
        <p className="mt-2 measure text-sm text-muted">
          The sources did not place this company in one of the fifteen sectors
          the workflow catalogue carries, so no areas are named. Placing it
          anyway would read this company against another sector&apos;s
          workflows and its assurance bar.
        </p>
      </section>
    );
  }

  const weights = weightingFrom(opp);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <section className="finding rounded-xl p-5">
      <MicroLabel
        label="Where AI could go here"
        tooltip="The workflows the catalogue holds for this sector, ranked. Evidenced areas came from this company's own sources; sector areas are what the sector runs and are a place to look rather than a finding."
      />
      <p className="mt-1 measure text-sm">
        For {opp.sectorLabel.toLowerCase()} the catalogue holds these areas.{" "}
        <strong className="text-base-content">
          {opp.evidencedCount} of {opp.areas.length}
        </strong>{" "}
        {opp.evidencedCount === 1 ? "is" : "are"} backed by this
        company&apos;s own sources; the rest are what the sector runs, and are
        somewhere to look rather than something we found.
      </p>

      {/* The rows, unchanged when collapsed. OpportunityRow renders exactly
          what was inline here and adds the take-forward control and the three
          role columns underneath, so a reader who never uses it sees the row
          they saw before. */}
      <ul className="mt-3 space-y-1.5">
        {opp.areas.map((a) => (
          <OpportunityRow key={a.id} area={a} positionKey={position.key} />
        ))}
      </ul>

      {/* The weighting this implies, and where it goes next. Stated rather
          than applied silently: it changes where the Decision Desk's sliders
          start, and every one of them stays draggable. */}
      <div className="mt-3 border-t border-base-300 pt-3">
        <p className="micro-label mb-1.5">What this weights on the Decision Desk</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["Strategic fit", weights.strategic_fit],
            ["Execution readiness", weights.execution_readiness],
            ["Governance and trust", weights.governance_trust],
            ["Economics", weights.economics],
          ].map(([label, w]) => (
            <span
              key={label as string}
              className="rounded border border-base-300 px-2 py-0.5 font-mono text-xs"
            >
              {label} {pct(w as number)}
            </span>
          ))}
        </div>
        <p className="mt-1.5 measure text-xs text-muted">{weights.why}</p>
        <CarryToDesk position={position} />
      </div>
    </section>
  );
}

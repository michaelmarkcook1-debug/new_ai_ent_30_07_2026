import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
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
      <MicroLabel label={label} tooltip={tooltip} />
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

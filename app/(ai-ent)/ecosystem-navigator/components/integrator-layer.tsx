"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge, ProvenanceBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { isIntegrator, excludedNote } from "@/lib/integrators/is-integrator";
import {
  capabilitySignals,
  partnersMissingFromMatrix,
  NO_SIGNAL_NOTE,
} from "@/lib/integrators/capability-signals";
import type { NewsItemRaw } from "@/lib/analyst/insight";
import type {
  BrProvider,
  BrProvidersResponse,
  IntegrationResponse,
} from "../types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function laneFor(source: BrSource): "live" | "mock" {
  return source === "mock" ? "mock" : "live";
}

// Section (c): the LIVE integrator layer. Both calls go through the /api/br
// proxy via brFetch; a mock source swaps the badge to "Cached sample" and a
// failure renders the friendly error state with the code, never a guess.
export function IntegratorLayer({ news }: { news: NewsItemRaw[] }) {
  const [providers, setProviders] = useState<BrProvider[] | null>(null);
  const [providersSource, setProvidersSource] = useState<BrSource>("live");
  const [providersError, setProvidersError] = useState<string | null>(null);

  const [ticker, setTicker] = useState("ACN");
  const [integration, setIntegration] = useState<IntegrationResponse | null>(null);
  const [integrationSource, setIntegrationSource] = useState<BrSource>("live");
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    brFetch<BrProvidersResponse>("providers").then((res) => {
      if (cancelled) return;
      setProvidersSource(res.source);
      if (res.ok && res.data?.providers) {
        setProviders(res.data.providers);
      } else {
        setProvidersError(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIntegrationLoading(true);
    setIntegrationError(null);
    setIntegration(null);
    brFetch<IntegrationResponse>("ai-platform/integration", { ticker }).then((res) => {
      if (cancelled) return;
      setIntegrationSource(res.source);
      setIntegrationLoading(false);
      if (res.ok && res.data?.categories) {
        setIntegration(res.data);
      } else {
        setIntegrationError(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // SORTED ON ASSESSMENT, NOT AI READINESS.
  //
  // This used to sort on aiReadinessScore, and that measures how far a provider
  // has adopted AI inside its OWN operations. It is not a measure of how well
  // they would deliver an AI programme for you, which is the question this
  // panel exists to answer.
  //
  // Sorting on it produced a table that read as a delivery league table and was
  // not one: Accenture holds the highest assessment score on the page and sat
  // tenth, below providers scoring in the sixties on that dimension. Assessment
  // is the provider assessment framework score, a weighted composite of four
  // dimensions with published rationales, and is the closer of the two to the
  // question actually asked.
  const topProviders = useMemo(() => {
    if (!providers) return [];
    return providers
      .filter(isIntegrator)
      .filter((p) => typeof p.assessmentScore === "number")
      .sort((a, b) => (b.assessmentScore ?? 0) - (a.assessmentScore ?? 0))
      .slice(0, 12);
  }, [providers]);

  // Live capability signal for whoever is selected. A frontier partnership is
  // the most informative public event about what an integrator can now deliver,
  // and the feed carries them: "IBM and OpenAI Announce Strategic Partnership".
  const selected = useMemo(
    () => providers?.find((p) => p.ticker === ticker) ?? null,
    [providers, ticker]
  );
  const signals = useMemo(() => {
    if (!selected) return [];
    const names = [selected.displayName, selected.name].filter(Boolean);
    return capabilitySignals(news, names as string[], 6);
  }, [news, selected]);

  // Partners the feed names that the matrix does not list. A coverage gap must
  // not read as a capability gap: the matrix shows Accenture on 2 platforms
  // against Infosys on 8, and Accenture is the larger integrator by some way.
  const missingPartners = useMemo(() => {
    if (!integration) return [];
    const listed = integration.categories.flatMap((c) =>
      (c.platforms ?? []).map((pl) => pl.name)
    );
    return partnersMissingFromMatrix(signals, listed);
  }, [signals, integration]);

  // Integrators only. The catalogue carries payroll, telecom billing and
  // infrastructure vendors, and offering them under a heading about delivering
  // your AI programme sent readers to an empty matrix.
  const selectorOptions = useMemo(() => {
    if (!providers) return [];
    return providers
      .filter(isIntegrator)
      .sort((a, b) =>
        (a.displayName || a.name).localeCompare(b.displayName || b.name, "en-GB")
      );
  }, [providers]);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-bold">The delivery layer, live</h2>
        <LaneBadge lane={laneFor(providersSource)} />
      </div>
      <p className="measure mt-1 text-sm text-muted">
        The services channel: the integrators who would deliver your AI programme, live from the
        BoardRadar provider catalogue. IT services content appears only here, as the labelled
        delivery channel, never blended with AI vendor scores.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 @4xl:grid-cols-5">
        {/* Provider readiness table */}
        <div className="@container delivery-channel-card rounded-lg bg-base-100 p-5 @4xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <MicroLabel
              label="Integrator readiness"
              tooltip="Top of the live BoardRadar provider catalogue by assessment score. Both figures are shown exactly as the API returns them. AI readiness is a separate measure: how far the provider has adopted AI in its own operations, not how well it would deliver AI for you."
            />
            <LaneBadge lane={laneFor(providersSource)} />
          </div>
          <div className="mt-2">
            {providers === null && providersError === null ? (
              <p className="py-6 text-center font-mono text-xs text-muted">
                Loading live provider catalogue...
              </p>
            ) : providersError ? (
              <p className="py-6 text-center font-mono text-xs text-muted">
                Live data unavailable ({providersError}); no figure shown rather than a guess.
              </p>
            ) : (
              <>
                <p className="mb-2 font-mono text-xs text-muted">
                  Top {topProviders.length} of{" "}
                  {providers!.filter(isIntegrator).length} integrators by
                  assessment
                </p>
                {/* Named, not dropped silently. A list that quietly gets
                    shorter is a decision made on the reader's behalf. */}
                {excludedNote(providers!.length, providers!.filter(isIntegrator).length) ? (
                  <p className="measure mb-2 text-xs text-muted">
                    {excludedNote(
                      providers!.length,
                      providers!.filter(isIntegrator).length
                    )}
                  </p>
                ) : null}
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="py-1.5 pr-2">
                        <span className="micro-label">Provider</span>
                      </th>
                      <th className="py-1.5 pr-2">
                        <span className="micro-label">Assessment</span>
                      </th>
                      <th className="py-1.5">
                        <span
                          className="micro-label"
                          title="How far this provider has adopted AI inside its own operations. NOT a measure of how well it would deliver AI for you."
                        >
                          Own AI adoption
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProviders.map((p) => (
                      <tr key={p.ticker} className="border-t border-base-300/70">
                        <td className="py-2 pr-2">
                          <button
                            type="button"
                            onClick={() => setTicker(p.ticker)}
                            className={`text-left text-sm hover:text-primary hover:underline ${
                              p.ticker === ticker ? "font-semibold text-primary" : ""
                            }`}
                            title={`Open the ${p.displayName || p.name} platform matrix`}
                          >
                            {p.displayName || p.name}
                          </button>
                          <span className="block text-xs text-muted">{p.segment}</span>
                        </td>
                        <td className="py-2 pr-2">
                          <ScorePill
                            score={
                              typeof p.assessmentScore === "number"
                                ? Math.round(p.assessmentScore)
                                : null
                            }
                          />
                        </td>
                        <td className="py-2">
                          <ScorePill score={p.aiReadinessScore} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div className="mt-2 border-t border-base-300 pt-2">
            <DerivationDrawer title="How the delivery scores are derived">
              <p>
                Both figures are live BoardRadar values, surfaced exactly as returned and never
                recomputed by this product.
              </p>
              <ul className="measure list-disc space-y-1 pl-4 text-muted">
                <li>
                  <strong>Assessment</strong>: the provider assessment framework score, a weighted
                  composite of four dimensions with published rationales per provider.
                </li>
                <li>
                  <strong>Own AI adoption</strong>: the provider&apos;s position in the BoardRadar
                  AI readiness ranking, published with generation dates. It measures how far the
                  provider has adopted AI <strong>within its own operations</strong>, which is a
                  different question from how well it would deliver an AI programme for you, and
                  the two do not move together. This table was sorted on it under a heading about
                  delivery, which put Accenture tenth while it held the highest assessment score on
                  the page. It is shown because a provider that has not adopted AI itself is worth
                  noticing, not because it ranks delivery.
                </li>
              </ul>
              <p className="measure text-muted">
                Where a provider has no published figure the cell shows the locked no-disclosure
                state instead of a number.
              </p>
            </DerivationDrawer>
          </div>
        </div>

        {/* Integrator by AI-platform matrix */}
        <div className="@container delivery-channel-card rounded-lg bg-base-100 p-5 @4xl:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <MicroLabel
                label="Integrator platform matrix"
                tooltip="Which AI platforms this integrator uses to deliver, by service line, live from the BoardRadar AI-platform integration endpoint."
              />
              <select
                aria-label="Integrator"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm"
              >
                {selectorOptions.length === 0 ? (
                  <option value="ACN">Accenture (ACN)</option>
                ) : (
                  selectorOptions.map((p) => (
                    <option key={p.ticker} value={p.ticker}>
                      {p.displayName || p.name} ({p.ticker})
                    </option>
                  ))
                )}
              </select>
            </div>
            <LaneBadge lane={laneFor(integrationSource)} />
          </div>

          <div className="mt-2">
            {integrationLoading ? (
              <p className="py-6 text-center font-mono text-xs text-muted">
                Loading live platform matrix for {ticker}... first call can take a moment while the
                API computes.
              </p>
            ) : integrationError ? (
              <p className="py-6 text-center font-mono text-xs text-muted">
                Live data unavailable for {ticker} ({integrationError}); no matrix shown rather
                than a guess. Try Accenture (ACN), the reference integrator.
              </p>
            ) : integration ? (
              <>
                <p className="measure text-sm leading-snug text-muted">{integration.intro}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    {integration.platformCounts.total} platforms:{" "}
                    {integration.platformCounts.proprietary} proprietary,{" "}
                    {integration.platformCounts.partner} partner
                  </span>
                  {/* A coverage gap must not read as a capability gap. */}
                  {missingPartners.length > 0 ? (
                    <span className="rounded-full border border-warn/40 bg-warn-bg px-2 py-0.5 font-mono text-xs text-warn">
                      matrix omits {missingPartners.join(", ")}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1.5">
                    <MicroLabel label="Generated" />
                    <span className="font-mono text-xs text-muted">
                      {formatDate(integration.generatedAt)}
                    </span>
                  </span>
                  {/* The one link that will not move: the provider's own domain,
                      carried on its catalogue record rather than constructed by
                      us. Guessed service-page paths 404. */}
                  {selected?.domain ? (
                    <a
                      href={`https://${selected.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {selected.domain} &rarr;
                    </a>
                  ) : null}
                </div>
                {/* Live capability signal. A frontier partnership is the most
                    informative public event about what an integrator can now
                    deliver, and it dates itself, unlike a services page. */}
                <div className="mt-3 border-t border-base-300/70 pt-3">
                  <MicroLabel
                    label="Capability signal, live"
                    tooltip="Items in the AI Enterprise news feed naming this integrator. A new partnership with a frontier vendor is what changes what they can deliver, so that is what is tracked here rather than a marketing page."
                  />
                  {signals.length === 0 ? (
                    <p className="measure mt-1.5 text-xs text-muted">
                      {NO_SIGNAL_NOTE}
                    </p>
                  ) : (
                    <>
                    {missingPartners.length > 0 ? (
                      <p className="measure mt-1.5 text-xs text-warn">
                        The feed names {missingPartners.join(", ")} working with
                        this integrator, and the platform matrix above does not
                        list {missingPartners.length === 1 ? "it" : "them"}. Read
                        a low platform count as our coverage of them, not as the
                        limit of what they deliver.
                      </p>
                    ) : null}
                    <ul className="mt-1.5 space-y-1.5">
                      {signals.map((sig) => (
                        <li key={sig.title} className="text-sm">
                          <span className="leading-snug">{sig.title}</span>
                          <span className="ml-1.5 font-mono text-xs text-muted">
                            {sig.alongside.length > 0
                              ? `with ${sig.alongside.join(", ")}`
                              : null}
                            {/* Named only in the summary is a weaker signal
                                than named in the headline, and saying which
                                stops the two reading alike. */}
                            {sig.matchedIn === "summary" ? " · named in summary" : ""}
                          </span>
                          {sig.sourceUrl ? (
                            <a
                              href={sig.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-1.5 font-mono text-xs text-primary hover:underline"
                            >
                              {sig.sourceName ?? "source"} &rarr;
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    </>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  {integration.categories.map((cat) => (
                    <div key={cat.id} className="border-t border-base-300/70 pt-2">
                      <h3 className="text-sm font-bold">{cat.label}</h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {cat.platforms.map((pl) => (
                          <li key={`${cat.id}-${pl.name}`} className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{pl.name}</span>
                            <span className="inline-flex rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-base-content/80">
                              {pl.vendor ?? "proprietary"}
                            </span>
                            <span className="inline-flex rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">
                              {pl.integrationDepth} integration
                            </span>
                            <ProvenanceBadge env={pl.provenance} />
                            {pl.sourceUrl ? (
                              <a
                                href={pl.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-xs text-primary hover:underline"
                                title={pl.description}
                              >
                                source
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <p
                        className="mt-1.5 text-xs text-muted"
                        title={[
                          `${integration.highDisplacementLabel}: ${cat.highDisplacementRoles.join(", ")}`,
                          `${integration.partialDisplacementLabel}: ${cat.partialDisplacementRoles.join(", ")}`,
                        ].join(" | ")}
                      >
                        {cat.highDisplacementRoles.length} high-displacement roles,{" "}
                        {cat.partialDisplacementRoles.length} partial (hover for the list)
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Closing CTA */}
      <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-5">
        <p className="text-sm font-semibold">
          You have seen the models, the dependencies and the platforms: and here is who delivers
          it.
        </p>
        <p className="measure mt-1 text-sm text-muted">
          The integrators above are the delivery layer for every vendor decision in this
          workspace. Services channel only, clearly labelled, never mixed into AI vendor scores.
        </p>
        {/* The link that used to sit here sent a reader to Model 4 Role for a
            delivery matrix that tab no longer has: the matrix was removed on
            4 August because it called the integration endpoint with one
            hardcoded provider, and this page answers the same question from
            the live provider list. Pointing away from the page that answers it
            was worse than not linking at all. */}
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href="/vendor-view"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Back to vendor profiles
          </Link>
        </div>
      </div>
    </section>
  );
}

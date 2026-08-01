"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge, ProvenanceBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
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
export function IntegratorLayer() {
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

  const topProviders = useMemo(() => {
    if (!providers) return [];
    return [...providers]
      .filter((p) => typeof p.aiReadinessScore === "number")
      .sort((a, b) => (b.aiReadinessScore ?? 0) - (a.aiReadinessScore ?? 0))
      .slice(0, 12);
  }, [providers]);

  const selectorOptions = useMemo(() => {
    if (!providers) return [];
    return [...providers].sort((a, b) =>
      (a.displayName || a.name).localeCompare(b.displayName || b.name, "en-GB")
    );
  }, [providers]);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">The delivery layer, live</h2>
        <LaneBadge lane={laneFor(providersSource)} />
      </div>
      <p className="mt-1 text-[12px] text-muted">
        The services channel: the integrators who would deliver your AI programme, live from the
        BoardRadar provider catalogue. IT services content appears only here, as the labelled
        delivery channel, never blended with AI vendor scores.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* Provider readiness table */}
        <div className="delivery-channel-card rounded-lg bg-base-100 p-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <MicroLabel
              label="Integrator readiness"
              tooltip="Top of the live BoardRadar provider catalogue by AI readiness score. Assessment and readiness figures are shown exactly as the API returns them."
            />
            <LaneBadge lane={laneFor(providersSource)} />
          </div>
          <div className="mt-2">
            {providers === null && providersError === null ? (
              <p className="py-6 text-center font-mono text-[11px] text-muted">
                Loading live provider catalogue...
              </p>
            ) : providersError ? (
              <p className="py-6 text-center font-mono text-[11px] text-muted">
                Live data unavailable ({providersError}); no figure shown rather than a guess.
              </p>
            ) : (
              <>
                <p className="mb-2 font-mono text-[10px] text-muted">
                  Top {topProviders.length} of {providers!.length} providers by AI readiness
                </p>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="py-1 pr-2">
                        <span className="micro-label">Provider</span>
                      </th>
                      <th className="py-1 pr-2">
                        <span className="micro-label">Assessment</span>
                      </th>
                      <th className="py-1">
                        <span className="micro-label">AI readiness</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProviders.map((p) => (
                      <tr key={p.ticker} className="border-t border-base-300/70">
                        <td className="py-1.5 pr-2">
                          <button
                            type="button"
                            onClick={() => setTicker(p.ticker)}
                            className={`text-left text-[12.5px] hover:text-primary hover:underline ${
                              p.ticker === ticker ? "font-semibold text-primary" : ""
                            }`}
                            title={`Open the ${p.displayName || p.name} platform matrix`}
                          >
                            {p.displayName || p.name}
                          </button>
                          <span className="block text-[10px] text-muted">{p.segment}</span>
                        </td>
                        <td className="py-1.5 pr-2">
                          <ScorePill
                            score={
                              typeof p.assessmentScore === "number"
                                ? Math.round(p.assessmentScore)
                                : null
                            }
                          />
                        </td>
                        <td className="py-1.5">
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
              <ul className="list-disc space-y-1 pl-4 text-muted">
                <li>
                  <strong>Assessment</strong>: the provider assessment framework score, a weighted
                  composite of four dimensions with published rationales per provider.
                </li>
                <li>
                  <strong>AI readiness</strong>: the provider&apos;s position in the BoardRadar AI
                  readiness ranking, published with generation dates.
                </li>
              </ul>
              <p className="text-muted">
                Where a provider has no published figure the cell shows the locked no-disclosure
                state instead of a number.
              </p>
            </DerivationDrawer>
          </div>
        </div>

        {/* Integrator by AI-platform matrix */}
        <div className="delivery-channel-card rounded-lg bg-base-100 p-4 xl:col-span-3">
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
                className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
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
              <p className="py-6 text-center font-mono text-[11px] text-muted">
                Loading live platform matrix for {ticker}... first call can take a moment while the
                API computes.
              </p>
            ) : integrationError ? (
              <p className="py-6 text-center font-mono text-[11px] text-muted">
                Live data unavailable for {ticker} ({integrationError}); no matrix shown rather
                than a guess. Try Accenture (ACN), the reference integrator.
              </p>
            ) : integration ? (
              <>
                <p className="text-[12px] leading-snug text-muted">{integration.intro}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[10px] text-muted">
                    {integration.platformCounts.total} platforms:{" "}
                    {integration.platformCounts.proprietary} proprietary,{" "}
                    {integration.platformCounts.partner} partner
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MicroLabel label="Generated" />
                    <span className="font-mono text-[10px] text-muted">
                      {formatDate(integration.generatedAt)}
                    </span>
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {integration.categories.map((cat) => (
                    <div key={cat.id} className="border-t border-base-300/70 pt-2">
                      <h3 className="text-[13px] font-bold">{cat.label}</h3>
                      <ul className="mt-1.5 space-y-1.5">
                        {cat.platforms.map((pl) => (
                          <li key={`${cat.id}-${pl.name}`} className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-semibold">{pl.name}</span>
                            <span className="inline-flex rounded-full border border-base-300 bg-base-200/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-base-content/80">
                              {pl.vendor ?? "proprietary"}
                            </span>
                            <span className="inline-flex rounded-full border border-base-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                              {pl.integrationDepth} integration
                            </span>
                            <ProvenanceBadge env={pl.provenance} />
                            {pl.sourceUrl ? (
                              <a
                                href={pl.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10px] text-primary hover:underline"
                                title={pl.description}
                              >
                                source
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <p
                        className="mt-1.5 text-[10px] text-muted"
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
      <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4">
        <p className="text-[13px] font-semibold">
          You have seen the models, the dependencies and the platforms: and here is who delivers
          it.
        </p>
        <p className="mt-1 text-[12px] text-muted">
          The integrators above are the delivery layer for every vendor decision in this
          workspace. Services channel only, clearly labelled, never mixed into AI vendor scores.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href="/market-view"
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            Open the delivery matrix in Model 4 Role
          </Link>
          <Link
            href="/vendor-view"
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            Back to vendor profiles
          </Link>
        </div>
      </div>
    </section>
  );
}

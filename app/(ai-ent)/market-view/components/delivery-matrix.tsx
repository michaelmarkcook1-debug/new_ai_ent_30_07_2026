"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge, ProvenanceBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import { Accordion } from "@/lib/ui/accordion";
import type { IntegrationResponse } from "../types";

function DepthChip({ depth }: { depth: string }) {
  const styles: Record<string, string> = {
    deep: "bg-good-bg text-good",
    moderate: "bg-warn-bg text-warn",
    light: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${styles[depth] ?? "bg-base-200 text-muted"}`}
      title="Integration depth as reported by the endpoint"
    >
      {depth}
    </span>
  );
}

// The LIVE delivery leg: the Service Providers delivery matrix from the
// BoardRadar integrator-by-AI-platform endpoint, labelled as the services
// channel and never blended with the AI-vendor content above.
export function DeliveryMatrix() {
  const [data, setData] = useState<IntegrationResponse | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    brFetch<IntegrationResponse>("ai-platform/integration", {
      ticker: "ACN",
    }).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setErrorCode(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lane = source === "mock" ? "mock" : "live";

  return (
    <section className="mt-4 border-t border-base-300 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Service Providers delivery matrix"
          tooltip="How a major integrator embeds AI platforms across its service lines, live from the BoardRadar integrator-by-AI-platform endpoint. This is the delivery channel for AI programmes, not the AI vendor set."
        />
        <LaneBadge lane={lane} />
        <DerivationDrawer title="How this matrix is sourced">
          <p>
            The matrix is the BoardRadar integrator-by-AI-platform view for
            the selected provider, rendered as returned: service-line
            categories, the platforms embedded in each, the endpoint's own
            integration-depth grading and its role-displacement lists, with
            each platform's provenance envelope passed through untouched.
          </p>
          <p className="measure text-muted">
            Shown as the services channel (the delivery layer for AI
            programmes); it is never blended with the AI-vendor adoption
            content above.
          </p>
        </DerivationDrawer>
      </div>
      <p className="mt-1 text-xs text-muted">
        Services channel (integrators), shown as the delivery layer. Not AI
        vendors.
      </p>

      <div className="mt-3">
        {loading ? (
          <p className="py-8 text-center font-mono text-xs text-muted">
            Loading the live delivery matrix...
          </p>
        ) : errorCode ? (
          <EmptyState
            title={`Live data unavailable (${errorCode})`}
            detail="The integration call failed and no recorded fixture exists; no matrix is shown rather than a guess."
          />
        ) : data ? (
          <div className="space-y-3">
            <div className="delivery-channel-card rounded-lg bg-base-100 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold">
                  {data.displayName || data.providerName}
                </h3>
                <span className="font-mono text-xs text-muted">
                  {data.platformCounts.total} platforms:{" "}
                  {data.platformCounts.proprietary} proprietary,{" "}
                  {data.platformCounts.partner} partner
                </span>
              </div>
              <p className="measure mt-1 text-sm leading-relaxed text-base-content/85">
                {data.intro}
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
                Generated{" "}
                {new Date(data.generatedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
              {data.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="rounded-lg border border-base-300 bg-base-100 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="text-sm font-bold">{cat.label}</h4>
                    <LaneBadge lane={lane} />
                  </div>
                  <ul className="mt-2 space-y-2">
                    {cat.platforms.map((p) => (
                      <li key={`${cat.id}-${p.name}`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold">
                            {p.name}
                          </span>
                          <DepthChip depth={p.integrationDepth} />
                          <span className="text-xs text-muted">
                            {p.vendor ?? "proprietary"}
                          </span>
                          <ProvenanceBadge env={p.provenance} />
                        </div>
                        <p className="measure mt-0.5 text-xs leading-snug text-muted">
                          {p.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 space-y-2">
                    <Accordion
                      title={data.highDisplacementLabel}
                      count={cat.highDisplacementRoles.length}
                    >
                      <ul className="measure list-disc space-y-0.5 pl-4 text-xs text-muted">
                        {cat.highDisplacementRoles.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </Accordion>
                    <Accordion
                      title={data.partialDisplacementLabel}
                      count={cat.partialDisplacementRoles.length}
                    >
                      <ul className="measure list-disc space-y-0.5 pl-4 text-xs text-muted">
                        {cat.partialDisplacementRoles.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </Accordion>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-right">
              <Link
                href="/ecosystem-navigator"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Who delivers it: Ecosystem Navigator
              </Link>
            </div>
          </div>
        ) : (
          <EmptyState title="Awaiting public disclosure" />
        )}
      </div>
    </section>
  );
}

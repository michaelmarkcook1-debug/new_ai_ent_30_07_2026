"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { latestPosition } from "@/lib/position/store";
import {
  opportunitiesFor,
  weightingFrom,
  type StartingWeights,
} from "@/lib/position/opportunities";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { ScorePill } from "@/lib/ui/score";
import { scoreBand } from "@/lib/provenance";
import { aieFetch, type AiePillar } from "@/lib/aie-live";
import type { ShellFixture } from "@/lib/shell-fixture";

type Assessment = ShellFixture["assess"]["assessment"];

// The three depth tiers of the deployed AIE assessment, described factually.
const TIERS = [
  {
    id: "opportunity",
    label: "Tier 1 · Opportunity",
    question: "Where should we start?",
    audience: "CIOs, COOs and innovation leaders",
    duration: "5 to 10 minutes",
    note: "Identifies top AI opportunity areas, risk and readiness.",
    weights: { strategic_fit: 0.4, execution_readiness: 0.25, governance_trust: 0.15, economics: 0.2 },
  },
  {
    id: "strategy",
    label: "Tier 2 · Strategy",
    question: "What should we deploy?",
    audience: "CIOs, CTOs and enterprise architects",
    duration: "20 to 30 minutes",
    note: "Recommended architecture, vendor shortlist and implementation roadmap.",
    weights: { strategic_fit: 0.3, execution_readiness: 0.25, governance_trust: 0.25, economics: 0.2 },
  },
  {
    id: "procurement",
    label: "Tier 3 · Procurement",
    question: "Should we buy this?",
    audience: "Procurement, audit and risk committees",
    duration: "60 to 120 minutes",
    note: "Procurement-grade scoring across value, risk, security, governance, integration, cost and sovereignty.",
    weights: { strategic_fit: 0.2, execution_readiness: 0.2, governance_trust: 0.35, economics: 0.25 },
  },
] as const;

export function AssessDecideView({ assessment }: { assessment: Assessment }) {
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("strategy");
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(assessment.dimensions.map((d) => [d.id, d.weight]))
  );
  const [pillars, setPillars] = useState<AiePillar[] | null>(null);
  const [pillarSource, setPillarSource] = useState<"live" | "mock" | "error">("live");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openDim, setOpenDim] = useState<string | null>(null);
  // The weighting Your AI Position derived for this company's sector, applied
  // as a starting point. Null when nothing is saved, which is the common case
  // and changes nothing.
  //
  // Applied after mount, not during render: localStorage does not exist on the
  // server. It only fills sliders the reader has not already moved, because a
  // saved position arriving later must never overwrite a deliberate weighting.
  const [derived, setDerived] = useState<StartingWeights | null>(null);
  const [derivedFor, setDerivedFor] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    const p = latestPosition();
    if (!p) return;
    const w = weightingFrom(opportunitiesFor(p));
    setDerived(w);
    setDerivedFor(p.name);
    if (touched.current) return;
    setWeights((cur) => {
      const next = { ...cur };
      for (const k of ["strategic_fit", "execution_readiness", "governance_trust", "economics"] as const) {
        if (k in next) next[k] = w[k];
      }
      return next;
    });
    // Once, on mount.
  }, []);

  useEffect(() => {
    let cancelled = false;
    aieFetch<{ pillars: AiePillar[] }>("metadata").then((res) => {
      if (cancelled) return;
      setPillarSource(res.source);
      if (res.ok && res.data?.pillars) setPillars(res.data.pillars);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTier = (id: (typeof TIERS)[number]["id"]) => {
    setTier(id);
    const preset = TIERS.find((t) => t.id === id)?.weights;
    // Choosing a tier is a deliberate act, so it overrides the derived start
    // and stops it being reapplied.
    touched.current = true;
    if (preset) setWeights({ ...preset });
  };

  const normalised = useMemo(() => {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, v / sum])
    );
  }, [weights]);

  const total = useMemo(
    () =>
      Math.round(
        assessment.dimensions.reduce(
          (acc, d) => acc + (normalised[d.id] ?? 0) * d.score,
          0
        )
      ),
    [assessment.dimensions, normalised]
  );

  const band = scoreBand(total);
  const ringColour =
    band === "good" ? "var(--ag-green)" : band === "warn" ? "var(--ag-amber)" : "var(--ag-error)";
  const r = 42;
  const c = 2 * Math.PI * r;
  const activeTier = TIERS.find((t) => t.id === tier)!;

  return (
    <div className="space-y-4">
      {/* Depth tiers */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <MicroLabel
            label="Assessment depth"
            tooltip="The three depth tiers of the AIE assessment engine. Switching tier applies that tier's weight preset; you can then adjust every weight yourself."
          />
          <LaneBadge lane="aie" />
        </div>
        <div className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTier(t.id)}
              className={`rounded-lg border p-4 text-left transition ${
                tier === t.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-base-300 bg-base-100 hover:border-primary/50"
              }`}
            >
              <p className="micro-label">{t.label}</p>
              <p className="mt-1 text-base font-bold">{t.question}</p>
              <p className="measure mt-1 text-xs leading-snug text-muted">{t.note}</p>
              <p className="mt-2 font-mono text-xs text-muted">
                {t.audience} · {t.duration}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Headline, recomputed from the user's weights. The weighted total is
          AG's assessment rather than a published figure, so the card carries
          the judgement edge. The ring keeps the semantic band, because the
          colour of the score answers what the verdict is, not who reached
          it. */}
      <section className="finding flex flex-wrap items-center gap-6 rounded-lg p-6">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--ag-base-300)" strokeWidth="9" opacity="0.5" />
          <circle
            cx="55" cy="55" r={r} fill="none" stroke={ringColour} strokeWidth="9"
            strokeDasharray={`${(total / 100) * c} ${c - (total / 100) * c}`}
            strokeLinecap="round" transform="rotate(-90 55 55)"
          />
          <text x="55" y="60" textAnchor="middle" className="font-mono" fontSize="30" fontWeight="700" fill="currentColor">
            {total}
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">{assessment.subject}</h2>
            <LaneBadge lane="sample" />
          </div>
          <p className="measure mt-1 text-sm text-muted">
            Weighted total under the {activeTier.label.toLowerCase()} preset
            and your adjustments. Dimension scores never move with the
            weights: same verified basis, your priorities.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            How this is derived
          </button>
        </div>
      </section>

      {/* Where these weights started, said out loud. A weighting applied from
          a saved position without saying so would be a hidden setting, and the
          reader would have no way to know why governance sat at 30 per cent. */}
      {derived ? (
        <section className="rounded-lg border border-insight/30 bg-insight/[0.06] px-3 py-2.5">
          <p className="measure text-sm">
            <span className="micro-label text-insight">Started from your position</span>{" "}
            These weights opened where{" "}
            <strong className="text-base-content">{derivedFor}</strong>&apos;s
            sector puts them. {derived.why}
          </p>
        </section>
      ) : null}

      {/* Dimensions with weight sliders */}
      <section className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
        {assessment.dimensions.map((d) => (
          <div key={d.id} className="rounded-lg border border-base-300 bg-base-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{d.label}</p>
                <p className="font-mono text-xs text-muted">
                  weight {Math.round((normalised[d.id] ?? 0) * 100)} per cent
                </p>
              </div>
              <ScorePill score={d.score} estimated />
            </div>
            <input
              type="range"
              min={5}
              max={60}
              value={Math.round((weights[d.id] ?? 0) * 100)}
              onChange={(e) =>
                {
                  touched.current = true;
                  setWeights((w) => ({ ...w, [d.id]: Number(e.target.value) / 100 }));
                }
              }
              className="mt-3 w-full accent-[var(--ag-primary)]"
              aria-label={`Weight for ${d.label}`}
            />
            <p className="measure mt-2 text-sm leading-snug text-muted">{d.rationale}</p>
            <button
              type="button"
              onClick={() => setOpenDim(openDim === d.id ? null : d.id)}
              className="mt-2 text-xs font-semibold text-primary hover:underline"
            >
              {openDim === d.id ? "Hide subcriteria" : `Subcriteria (${d.subcriteria.length})`}
            </button>
            {openDim === d.id ? (
              <ul className="mt-2 space-y-1.5 border-t border-base-300 pt-2">
                {d.subcriteria.map((s) => (
                  <li key={s.label} className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted">{s.note}</p>
                    </div>
                    <ScorePill score={s.score} estimated />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      {/* The engine's methodology backbone, live */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="The engine behind this: six pillars, evidence-graded"
            tooltip="The AIE assessment engine's pillars and default weights, pulled live from the deployed app. Pillar weights shift dynamically with industry, data sensitivity, risk tolerance, autonomy appetite and budget sensitivity."
          />
          <LaneBadge lane={pillarSource === "mock" ? "mock" : "aie-live"} />
        </div>
        {pillars ? (
          <div className="mt-3 grid grid-cols-2 gap-2 @3xl:grid-cols-3 @5xl:grid-cols-6">
            {pillars.map((p) => (
              <div key={p.id} className="rounded border border-base-300 p-2.5 text-center">
                <p className="text-xs font-semibold leading-tight">{p.label}</p>
                <p className="mt-1 font-mono text-sm font-bold text-primary">
                  {Math.round(p.defaultWeight * 100)}%
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 font-mono text-xs text-muted">
            {pillarSource === "error"
              ? "Live pillar weights unavailable; no figure shown rather than a guess."
              : "Loading the live pillar weights..."}
          </p>
        )}
        <p className="measure mt-3 text-xs text-muted">
          Evidence grading runs E0 (no evidence, weight 0.0) to E5 (independent
          audit, weight 1.0); claims below the strong-evidence bar are
          suppressed rather than shown. The exemplar decision above mirrors
          the BoardRadar assessment schema, so a live buyer swap changes data,
          not code.
        </p>
      </section>

      {/* Derivation drawer. Portalled to the body: the content column is a
          container query root, and container-type carries `contain: layout`,
          which would otherwise make it the containing block for this fixed
          overlay and trap the panel inside the column. */}
      {drawerOpen ? createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDrawerOpen(false)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l border-base-300 bg-base-100 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">How this assessment is derived</h3>
              <button type="button" aria-label="Close" onClick={() => setDrawerOpen(false)} className="rounded p-1 text-muted hover:bg-base-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-relaxed">
              <div>
                <p className="micro-label mb-1">Method</p>
                <p>
                  Weighted sum of the four dimension scores under YOUR weights
                  (normalised to 1.0). Dimension scores are evidence-weighted
                  means of their subcriteria and never move with the weights.
                </p>
              </div>
              <div>
                <p className="micro-label mb-1">Worked calculation (current weights)</p>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="py-1.5 font-mono text-xs uppercase text-muted">Dimension</th>
                      <th className="py-1.5 font-mono text-xs uppercase text-muted">Weight</th>
                      <th className="py-1.5 font-mono text-xs uppercase text-muted">Score</th>
                      <th className="py-1.5 font-mono text-xs uppercase text-muted">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {assessment.dimensions.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1.5">{d.label}</td>
                        <td className="py-1.5 font-mono">{(normalised[d.id] ?? 0).toFixed(2)}</td>
                        <td className="py-1.5 font-mono">{d.score}</td>
                        <td className="py-1.5 font-mono">{((normalised[d.id] ?? 0) * d.score).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1.5 font-bold" colSpan={3}>Weighted total</td>
                      <td className="py-1.5 font-mono font-bold">{total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 border-t border-base-300 pt-2">
                <LaneBadge lane="sample" />
                <p className="text-xs text-muted">{assessment.derivation.schemaNote}</p>
              </div>
            </div>
          </aside>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

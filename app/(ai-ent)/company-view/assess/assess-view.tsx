"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill } from "@/lib/ui/score";
import { scoreBand } from "@/lib/provenance";
import type { ShellFixture } from "../data";

type Assessment = ShellFixture["assess"]["assessment"];

export function AssessView({ assessment }: { assessment: Assessment }) {
  const [openDim, setOpenDim] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const total = assessment.weightedTotal;
  const band = scoreBand(total);
  const ringColour =
    band === "good" ? "var(--ag-green)" : band === "warn" ? "var(--ag-amber)" : "var(--ag-error)";
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="space-y-4">
      {/* Headline weighted total */}
      <section className="flex flex-wrap items-center gap-6 rounded-lg border border-base-300 bg-base-100 p-5">
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--ag-base-300)" strokeWidth="9" opacity="0.5" />
          <circle
            cx="55" cy="55" r={r} fill="none" stroke={ringColour} strokeWidth="9"
            strokeDasharray={`${(total / 100) * c} ${c - (total / 100) * c}`}
            strokeLinecap="round" transform="rotate(-90 55 55)"
          />
          <text x="55" y="60" textAnchor="middle" className="font-mono" fontSize="26" fontWeight="700" fill="currentColor">
            {total}
          </text>
        </svg>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold">{assessment.subject}</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Weighted total across four dimensions, 0 to 100, higher supports
            proceeding. Weights sum to 1.0; every dimension carries its
            rationale and subcriteria below.
          </p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-[12px] font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            How this is derived
          </button>
        </div>
      </section>

      {/* Dimension cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {assessment.dimensions.map((d) => (
          <div key={d.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-bold">{d.label}</p>
                <p className="font-mono text-[10px] text-muted">weight {Math.round(d.weight * 100)} per cent</p>
              </div>
              <ScorePill score={d.score} estimated />
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-base-300/60">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${d.score}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] leading-snug text-muted">{d.rationale}</p>
            <button
              type="button"
              onClick={() => setOpenDim(openDim === d.id ? null : d.id)}
              className="mt-2 text-[11px] font-semibold text-primary hover:underline"
            >
              {openDim === d.id ? "Hide subcriteria" : `Subcriteria (${d.subcriteria.length})`}
            </button>
            {openDim === d.id ? (
              <ul className="mt-2 space-y-1.5 border-t border-base-300 pt-2">
                {d.subcriteria.map((s) => (
                  <li key={s.label} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-medium">{s.label}</p>
                      <p className="text-[11px] text-muted">{s.note}</p>
                    </div>
                    <ScorePill score={s.score} estimated />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      {/* Derivation drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDrawerOpen(false)}>
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l border-base-300 bg-base-100 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">How this assessment is derived</h3>
              <button type="button" aria-label="Close" onClick={() => setDrawerOpen(false)} className="rounded p-1 text-muted hover:bg-base-200">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-3 space-y-3 text-[13px] leading-relaxed">
              <div>
                <p className="micro-label mb-1">Method</p>
                <p>{assessment.derivation.method}</p>
              </div>
              <div>
                <p className="micro-label mb-1">Formula</p>
                <p className="rounded bg-base-200 p-2 font-mono text-[11.5px]">{assessment.derivation.formula}</p>
              </div>
              <div>
                <p className="micro-label mb-1">Worked calculation</p>
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="py-1 font-mono text-[10px] uppercase text-muted">Dimension</th>
                      <th className="py-1 font-mono text-[10px] uppercase text-muted">Weight</th>
                      <th className="py-1 font-mono text-[10px] uppercase text-muted">Score</th>
                      <th className="py-1 font-mono text-[10px] uppercase text-muted">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-300">
                    {assessment.dimensions.map((d) => (
                      <tr key={d.id}>
                        <td className="py-1">{d.label}</td>
                        <td className="py-1 font-mono">{d.weight.toFixed(2)}</td>
                        <td className="py-1 font-mono">{d.score}</td>
                        <td className="py-1 font-mono">{(d.weight * d.score).toFixed(1)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-1 font-bold" colSpan={3}>Weighted total</td>
                      <td className="py-1 font-mono font-bold">{assessment.weightedTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <p className="micro-label mb-1">Confidence</p>
                <p className="text-muted">{assessment.derivation.confidenceNote}</p>
              </div>
              <div className="flex items-center gap-2 border-t border-base-300 pt-2">
                <LaneBadge lane="sample" />
                <p className="text-[11px] text-muted">{assessment.derivation.schemaNote}</p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

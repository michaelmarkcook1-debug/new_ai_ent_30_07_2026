"use client";

import { useState } from "react";
import {
  INDUSTRIES,
  industryMaturityScore,
  adoptionMaturityBand,
} from "@/lib/aie";
import { LaneBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";

function BandChip({ band }: { band: string }) {
  const styles: Record<string, string> = {
    nascent: "bg-base-200 text-muted",
    emerging: "bg-warn-bg text-warn",
    developing: "bg-warn-bg text-warn",
    mainstream: "bg-good-bg text-good",
    advanced: "bg-good-bg text-good",
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${styles[band] ?? "bg-base-200 text-muted"}`}
    >
      {band}
    </span>
  );
}

// How far AI use has progressed inside each industry archetype: the AIE
// dataset's own adoption profiles, from experimentation through to scaled
// agentic deployment. This survived the August 2026 sanity check that
// retired the vendor-share model which used to sit beside it: maturity
// stages are not contradicted by current public data, vendor shares were.
export function AdoptionMaturity() {
  const [archetypeId, setArchetypeId] = useState("");
  const archetypes = Object.values(INDUSTRIES);
  const archetype = archetypeId ? INDUSTRIES[archetypeId] : null;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel
          label="Industry adoption maturity"
          tooltip="Each archetype carries a native adoption profile: the share of organisations at experimentation, regular use, production and scaled deployment, plus the agentic equivalents."
        />
        <LaneBadge lane="aie" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setArchetypeId("")}
          className={`rounded-full border px-2.5 py-1 text-sm transition ${!archetypeId ? "border-primary font-semibold text-primary" : "border-base-300 text-muted hover:border-primary"}`}
        >
          All industries
        </button>
        {archetypes.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setArchetypeId(a.id)}
            className={`rounded-full border px-2.5 py-1 text-sm transition ${archetypeId === a.id ? "border-primary font-semibold text-primary" : "border-base-300 text-muted hover:border-primary"}`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {archetype ? (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold">{archetype.name}</h3>
            <BandChip band={adoptionMaturityBand(industryMaturityScore(archetype))} />
            <ScorePill score={Math.round(industryMaturityScore(archetype))} />
            <span className="text-[11px] text-muted">maturity, 0 to 100</span>
          </div>
          <ul className="mt-3 max-w-2xl space-y-1.5">
            {(
              [
                ["Experimentation", archetype.adoption.experimentationPct],
                ["Regular use", archetype.adoption.regularUsePct],
                ["Production", archetype.adoption.productionPct],
                ["Scaled", archetype.adoption.scaledPct],
                ["Agentic experimentation", archetype.adoption.agenticExperimentationPct],
                ["Agentic scaled", archetype.adoption.agenticScaledPct],
              ] as [string, number][]
            ).map(([label, value]) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-44 shrink-0 text-[11.5px]">{label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
                  <span
                    className="block h-full rounded-full bg-secondary/60"
                    style={{ width: `${value}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[10px]">
                  {value} per cent
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted">
            Evidence strictness x{archetype.evidenceStrictness}
          </p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[300px] text-left text-[11.5px]">
            <thead>
              <tr className="border-b border-base-300 font-mono text-[9px] uppercase tracking-wider text-muted">
                <th className="py-1.5 pr-2 font-medium">Archetype</th>
                <th className="px-1 py-1.5 text-right font-medium">Production</th>
                <th className="px-1 py-1.5 text-right font-medium">Scaled</th>
                <th className="py-1.5 pl-1 text-right font-medium">Band</th>
              </tr>
            </thead>
            <tbody>
              {archetypes.map((a) => (
                <tr key={a.id} className="border-b border-base-300/60">
                  <td className="py-1.5 pr-2">{a.name}</td>
                  <td className="px-1 py-1.5 text-right font-mono text-[10px]">
                    {a.adoption.productionPct} per cent
                  </td>
                  <td className="px-1 py-1.5 text-right font-mono text-[10px]">
                    {a.adoption.scaledPct} per cent
                  </td>
                  <td className="py-1.5 pl-1 text-right">
                    <BandChip band={adoptionMaturityBand(industryMaturityScore(a))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How industry maturity is derived">
          <p>
            The maturity score is the dataset&apos;s own formula: 25 per cent of
            regular use, plus 35 per cent of production, plus 40 per cent of
            scaled deployment, banded nascent to advanced.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

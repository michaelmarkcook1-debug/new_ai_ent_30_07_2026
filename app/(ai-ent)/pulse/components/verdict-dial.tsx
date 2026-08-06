"use client";

import { useMemo, useState } from "react";
import { MicroLabel } from "@/lib/ui/micro";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  composite,
  compositeCaveat,
  DEFAULT_WEIGHTS,
  INPUT_KEYS,
  QUESTIONS,
  UNKNOWN_COPY,
  type CompositeInputs,
  type InputKey,
  type Weights,
} from "@/lib/vendor/composite";

// One number, and the count that makes it honest.
//
// The non-negotiable here is the denominator. A composite built from partial
// inputs and shown without saying so is precisely the false precision this
// product exists to replace: it reads as a measurement of three things when it
// is a measurement of two. So the count is rendered inside the ring, at the
// same visual weight as the score, and there is no prop that turns it off.
//
// The weights are exposed and adjustable because they are a judgement, not a
// measurement. A reader who disagrees with 40/30/30 can say so and watch the
// number move, which is a more honest way to hold a weighted score than
// defending the weights.

export interface DialVendor {
  vendorId: string;
  name: string;
  inputs: CompositeInputs;
}

const BAR_COLOUR: Record<InputKey, string> = {
  winning: "var(--ag-insight)",
  trust: "#0f766e",
  durability: "#1d4ed8",
};

export function VerdictDial({
  vendors,
  coverage,
  total,
}: {
  vendors: DialVendor[];
  coverage: Record<InputKey, number>;
  total: number;
}) {
  const [weights, setWeights] = useState<Weights>({ ...DEFAULT_WEIGHTS });
  const [selected, setSelected] = useState(vendors[0]?.vendorId ?? "");

  const vendor = vendors.find((v) => v.vendorId === selected) ?? vendors[0];
  const result = useMemo(
    () => (vendor ? composite(vendor.inputs, weights) : null),
    [vendor, weights]
  );

  if (!vendor || !result) return null;

  const setWeight = (k: InputKey, v: number) =>
    setWeights((w) => ({ ...w, [k]: v }));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Vendor Resiliency"
            tooltip="Whether a vendor is winning, trusted and financially durable, in one number, with the count of inputs behind it."
          />
          <LaneBadge lane="derived" />
        </div>
        <select
          aria-label="Vendor"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm"
        >
          {vendors.map((v) => (
            <option key={v.vendorId} value={v.vendorId}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-5 rounded-lg border border-base-300 bg-base-100 p-5 @2xl:grid-cols-[auto_1fr]">
        <Ring result={result} />

        <div className="min-w-0">
          {/* The three contributing bars, each labelled with its own verdict
              source and its applied weight. An input with no data draws no
              bar and says why. */}
          <ul className="space-y-2.5">
            {INPUT_KEYS.map((k) => {
              const value = vendor.inputs[k];
              const applied = result.applied[k];
              return (
                <li key={k}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-semibold">
                      {QUESTIONS[k].question}
                    </span>
                    <span className="font-mono text-sm text-muted">
                      {value === null
                        ? "not published"
                        : `${value.toFixed(1)} · weight ${(applied ? applied * 100 : 0).toFixed(0)}%`}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-base-300/60">
                    {value === null ? (
                      <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,currentColor_4px,currentColor_5px)] opacity-20" />
                    ) : (
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, value))}%`,
                          backgroundColor: BAR_COLOUR[k],
                        }}
                      />
                    )}
                  </div>
                  {value === null ? (
                    <p className="mt-0.5 text-sm text-muted">
                      {UNKNOWN_COPY[k]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <WeightControls
            weights={weights}
            onChange={setWeight}
            onReset={() => setWeights({ ...DEFAULT_WEIGHTS })}
          />
        </div>
      </div>

      <div className="mt-3">
        <DerivationDrawer title="What this number is, and is not">
          <p>
            Three inputs, weighted and combined. Across the {total} tracked
            vendors, capability is published for {coverage.winning}, reputation
            for {coverage.trust} and financial disclosure for{" "}
            {coverage.durability}, so most resiliency scores are built from two
            of three and the ring always states how many.
          </p>
          <p>
            Weights are renormalised over the inputs that are present. Scoring
            a missing input as zero would push a vendor down for not
            disclosing, which turns a gap in our data into a verdict about
            their business. A vendor scored on two inputs is scored fairly on
            those two, and the denominator is what stops that being mistaken
            for a reading of all three.
          </p>
          <p className="text-muted">
            The weights are a judgement, not a measurement, which is why they
            are adjustable. Move them and the number moves; that is the honest
            relationship between a weighted score and the person reading it.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

function Ring({
  result,
}: {
  result: ReturnType<typeof composite>;
}) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = result.score === null ? 0 : Math.max(0, Math.min(100, result.score));
  const partial = result.inputsPresent < result.inputsTotal;

  return (
    <div className="flex flex-col items-center">
      <svg width="132" height="132" viewBox="0 0 132 132" role="img"
        aria-label={`Vendor Resiliency ${result.score ?? "unavailable"}, ${compositeCaveat(result)}`}>
        <circle cx="66" cy="66" r={R} fill="none" stroke="currentColor" opacity={0.12} strokeWidth="11" />
        <circle
          cx="66"
          cy="66"
          r={R}
          fill="none"
          stroke="var(--ag-insight)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 66 66)"
          // Dashed when built from partial inputs, so the ring itself carries
          // the caveat and not only the text under it.
          strokeOpacity={partial ? 0.75 : 1}
        />
        <text
          x="66"
          y="62"
          textAnchor="middle"
          className="fill-current text-[26px] font-bold"
        >
          {result.score === null ? "n/a" : result.score.toFixed(0)}
        </text>
        {/* The denominator, inside the ring. Not a footnote. */}
        <text
          x="66"
          y="80"
          textAnchor="middle"
          className="fill-current text-[11px] font-semibold opacity-70"
        >
          from {result.inputsPresent} of {result.inputsTotal}
        </text>
      </svg>
      <p className="measure mt-1 max-w-[16rem] text-center text-sm text-muted">
        {compositeCaveat(result)}
      </p>
    </div>
  );
}

function WeightControls({
  weights,
  onChange,
  onReset,
}: {
  weights: Weights;
  onChange: (k: InputKey, v: number) => void;
  onReset: () => void;
}) {
  const sum = INPUT_KEYS.reduce((a, k) => a + weights[k], 0);
  return (
    <div className="mt-4 border-t border-base-300 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="micro-label">Weights</span>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-primary hover:underline"
        >
          Reset to 40 / 30 / 30
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 @xl:grid-cols-3">
        {INPUT_KEYS.map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-sm text-muted">
              {QUESTIONS[k].question}{" "}
              <span className="font-mono">
                {sum > 0 ? Math.round((weights[k] / sum) * 100) : 0}%
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(weights[k] * 100)}
              onChange={(e) => onChange(k, Number(e.target.value) / 100)}
              className="accent-[var(--ag-insight)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

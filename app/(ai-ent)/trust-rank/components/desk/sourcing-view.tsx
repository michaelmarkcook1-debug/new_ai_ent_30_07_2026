"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  CONSTRAINTS,
  DIMS,
  USE_CASES,
  rankVendors,
  topPriorities,
  type Constraint,
  type ShieldWeights,
} from "@/lib/desk/sourcing";
import {
  DEFAULT_SHIELD_WEIGHTS,
  shieldCoverage,
  type MarkState,
} from "@/lib/shield/data";
import { PILOT_STEPS, pilotProbesFor } from "@/lib/desk/pilot";
import { buildPack } from "@/lib/desk/pack";
import { downloadPack } from "@/lib/desk/pack-html";

// Step 3: the sourcing shortlist.
//
// Ported from The Security Desk, 6 August 2026. Steps 1 and 2 answer "what is
// my situation" and "how do I score the call". Neither answers the question
// procurement actually asks, which is "which vendors may we buy from, and can
// you show me why the others were dropped".
//
// Three things this refuses to do, all of them visible on screen.
//
//   It does not score capability. There is no honest per-vendor capability
//   number, so the ranking is on verified contract posture alone and the pilot
//   below is how the buyer fills that gap with their own data. Saying so is
//   more useful than a number nobody can defend.
//
//   It does not hide a rejection. Every vendor dropped by a constraint says
//   which constraint dropped it. A filter that silently shortens a list is
//   indistinguishable from a bug, and in procurement it is indistinguishable
//   from a thumb on the scale.
//
//   It does not let the pack and the page disagree. Both are rendered from
//   one PackSpec, so a figure in the downloaded document came from the same
//   object the reader was looking at.

const MARK_TONE: Record<MarkState, string> = {
  protective: "text-good",
  conditional: "text-warn",
  adverse: "text-error",
  unverified: "text-muted",
};
const MARK_GLYPH: Record<MarkState, string> = {
  protective: "●",
  conditional: "◐",
  adverse: "○",
  unverified: "–",
};

export function SourcingView() {
  const [useCases, setUseCases] = useState<string[]>([]);
  const [weights, setWeights] = useState<ShieldWeights>(DEFAULT_SHIELD_WEIGHTS);
  const [constraints, setConstraints] = useState<Constraint[]>([]);

  const ranked = useMemo(
    () => rankVendors(weights, constraints),
    [weights, constraints]
  );
  const passing = ranked.filter((r) => r.passes);
  const rejected = ranked.filter((r) => !r.passes);
  const probes = pilotProbesFor(useCases);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const toggleUseCase = (u: string) =>
    setUseCases((p) => (p.includes(u) ? p.filter((x) => x !== u) : [...p, u]));
  const toggleConstraint = (c: Constraint) =>
    setConstraints((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const onDownload = () =>
    downloadPack(buildPack(useCases, weights, ranked, dateLabel));

  return (
    <div className="space-y-4">
      {/* What you are buying for. */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="What are you buying for?"
          tooltip="Selecting a workflow does not change the ranking. It selects the capability probes for the pilot, and titles the pack. Nothing here claims any vendor is good at it."
        />
        <p className="measure mt-1.5 text-[12.5px] leading-relaxed text-muted">
          This does not change the ranking, and deliberately so: naming a
          workflow claims nothing about who is good at it. It picks the
          capability traps for your pilot and titles the pack.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {USE_CASES.map((u) => {
            const on = useCases.includes(u);
            return (
              <button
                key={u}
                type="button"
                onClick={() => toggleUseCase(u)}
                aria-pressed={on}
                className={`rounded border px-2 py-1 text-[12px] transition ${
                  on
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-base-300 bg-base-200/40 hover:border-primary/50"
                }`}
              >
                {u}
              </button>
            );
          })}
        </div>
      </section>

      {/* Priorities and constraints. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-base-300 bg-base-100 p-5">
          <MicroLabel
            label="Your priorities"
            tooltip="Weights from 0 to 3 over the four Shield dimensions. The marks never move; only what the ranking optimises for."
          />
          <div className="mt-3 grid gap-2">
            {DIMS.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <label
                  htmlFor={`src-w-${d.key}`}
                  className="flex-1 text-[12px] leading-tight"
                  title={d.blurb}
                >
                  {d.label}
                </label>
                <input
                  id={`src-w-${d.key}`}
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={weights[d.key]}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [d.key]: Number(e.target.value) }))
                  }
                  className="w-24 accent-[var(--ag-primary)]"
                />
                <span className="w-4 text-right font-mono text-[12px] tabular-nums text-muted">
                  {weights[d.key]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100 p-5">
          <MicroLabel
            label="Argue with it"
            tooltip="Hard requirements. A vendor that fails one is dropped, and always says which one dropped it."
          />
          <p className="measure mt-1.5 text-[12.5px] leading-relaxed text-muted">
            A weight is a preference. These are requirements: fail one and you
            are out, with the reason stated.
          </p>
          <div className="mt-3 grid gap-1.5">
            {CONSTRAINTS.map((c) => (
              <label
                key={c.key}
                className="flex cursor-pointer items-start gap-2 text-[12.5px]"
                title={c.blurb}
              >
                <input
                  type="checkbox"
                  checked={constraints.includes(c.key)}
                  onChange={() => toggleConstraint(c.key)}
                  className="mt-0.5"
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      {/* The shortlist. */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="The shortlist"
            tooltip="Ranked on the verified Privacy & IP Shield under your weights, and on nothing else."
            heading
          />
          <LaneBadge lane="cited" />
        </div>

        <p className="measure mt-2 text-[13px] leading-relaxed">
          {passing.length === 0 ? (
            <>
              <b>No vendor clears your requirements.</b> That is a real answer
              rather than an empty table: every candidate was dropped by
              something you asked for. Relax a requirement, or take a
              conditional grade with your eyes open.
            </>
          ) : (
            <>
              <b>
                {passing.length} of {ranked.length} vendors clear your
                requirements
              </b>
              {constraints.length > 0 ? (
                <>
                  , and {rejected.length} were dropped, each for a stated
                  reason
                </>
              ) : null}
              .{" "}
              {DIMS.every((d) => weights[d.key] === 0)
                ? "Every priority is set to zero, so every score is zero and the order is alphabetical."
                : topPriorities(weights)
                  ? `Ranked with ${topPriorities(weights)} weighted above the rest.`
                  : "All four questions weighted equally."}
            </>
          )}
        </p>

        {passing.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="py-2 pr-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Vendor
                  </th>
                  {DIMS.map((d) => (
                    <th
                      key={d.key}
                      title={d.blurb}
                      className="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted"
                    >
                      {d.label.replace(" / zero-retention", "")}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Score
                  </th>
                  <th className="px-2 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Read
                  </th>
                </tr>
              </thead>
              <tbody>
                {passing.map((r, i) => (
                  <tr
                    key={r.vendor.slug}
                    className="border-b border-base-300/60 last:border-b-0"
                  >
                    <td className="py-2 pr-3 text-[13px] font-semibold">
                      {i === 0 ? (
                        <span className="mr-1.5 rounded border border-primary/40 bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                          pick
                        </span>
                      ) : null}
                      {r.vendor.vendor}
                    </td>
                    {(
                      ["training", "retention", "indemnity", "residency"] as const
                    ).map((k) => (
                      <td key={k} className="px-2 py-2 text-center">
                        <span
                          className={`font-mono text-[15px] leading-none ${MARK_TONE[r.vendor.marks[k].state]}`}
                          title={r.vendor.marks[k].note}
                        >
                          {MARK_GLYPH[r.vendor.marks[k].state]}
                        </span>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-mono text-[12.5px] tabular-nums">
                      {r.weightedScore}
                      <span className="text-muted">/{r.maxScore}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span
                        className={`font-mono text-[11.5px] tabular-nums ${shieldCoverage(r.vendor) === 4 ? "text-muted" : "text-warn"}`}
                      >
                        {shieldCoverage(r.vendor)}/4
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {rejected.length > 0 ? (
          <details className="group mt-3">
            <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-wider text-primary hover:underline">
              <span className="inline-block transition-transform group-open:rotate-90">
                ▸
              </span>{" "}
              Why the other {rejected.length} were dropped
            </summary>
            <ul className="mt-2 grid gap-1">
              {rejected.map((r) => (
                <li
                  key={r.vendor.slug}
                  className="text-[12.5px] leading-relaxed text-muted"
                >
                  <b className="text-base-content">{r.vendor.vendor}</b>:{" "}
                  {r.failReason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
          <b>This ranks contract posture, not capability.</b> No vendor here is
          claimed to be good at your workflow, because no honest per-vendor
          capability number exists to publish: public benchmarks are gamed and
          rarely resemble a real workload. The pilot below is how you close that
          gap with your own data.
        </p>
      </section>

      {/* The pilot. */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MicroLabel
            label="Prove the capability"
            tooltip="A method you run on your own data. Nothing here asserts how any vendor performs."
            heading
          />
          <LaneBadge lane="derived" />
        </div>
        <p className="measure mt-2 text-[13px] leading-relaxed">
          The bake-off to run before you sign. This is method, not results:
          nothing below says how any vendor performs, because that is the thing
          only your own data can tell you.
        </p>
        <ol className="mt-3 grid gap-2">
          {PILOT_STEPS.map((s, i) => (
            <li
              key={s.title}
              className="rounded border border-base-300 bg-base-200/30 px-3 py-2"
            >
              <p className="text-[12.5px] font-semibold">
                <span className="mr-1.5 font-mono text-muted">{i + 1}</span>
                {s.title}
              </p>
              <p className="measure mt-0.5 text-[12px] leading-relaxed text-muted">
                {s.why}
              </p>
              <p className="measure mt-0.5 text-[12px] leading-relaxed">
                {s.how}
              </p>
            </li>
          ))}
        </ol>

        {probes.length > 0 ? (
          <div className="mt-3">
            <p className="micro-label">
              The trap your workload hides · add these to the eval set
            </p>
            <ul className="mt-1 grid gap-1.5">
              {probes.map((p) => (
                <li
                  key={p.useCase}
                  className="rounded border border-base-300 bg-base-200/30 px-3 py-2 text-[12.5px] leading-relaxed"
                >
                  <b>{p.useCase}:</b>{" "}
                  <span className="text-muted">{p.probe}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
            Pick a workflow above to see the failure mode it hides
          </p>
        )}
      </section>

      {/* The pack. */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <MicroLabel
          label="The Decision Pack"
          tooltip="Built in your browser from the same spec that rendered this page, so a figure cannot differ between them. Nothing is posted anywhere."
          heading
        />
        <p className="measure mt-2 text-[13px] leading-relaxed">
          Everything above, as one document: the recommendation, the shortlist,
          exactly why each rejected vendor was dropped, what the decision does
          not cover, the pilot, and every source. It is built from the same spec
          that rendered this page, so a number cannot differ between what you
          read and what you hand over. Built in your browser and posted nowhere.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onDownload}
            className="rounded bg-primary px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            Download the pack
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Self-contained page · opens and prints anywhere ·{" "}
            {
              buildPack(useCases, weights, ranked, dateLabel).sources.length
            }{" "}
            sources listed
          </span>
        </div>
        <p className="measure mt-2 text-[11.5px] leading-relaxed text-muted">
          Every grade in it links the vendor document it was read from. See the{" "}
          <Link href="/trust-rank" className="text-primary hover:underline">
            Privacy &amp; IP Shield
          </Link>{" "}
          for the full wording behind each one.
        </p>
      </section>
    </div>
  );
}

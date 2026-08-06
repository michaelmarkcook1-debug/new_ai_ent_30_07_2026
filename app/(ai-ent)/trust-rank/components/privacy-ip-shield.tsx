"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  SHIELD_DIM_INFO,
  DEFAULT_SHIELD_WEIGHTS,
  rankedShieldWeighted,
  shieldCoverage,
  type Mark,
  type MarkState,
  type ShieldDim,
  type ShieldWeights,
} from "@/lib/shield/data";
import type { Freshness } from "@/lib/shield/freshness";

// The Privacy & IP Shield.
//
// Four questions a buyer must answer before their data leaves the building,
// answered in each vendor's own words: will they train on it, how long do they
// keep it, will they defend you if an output is claimed to infringe, and where
// does it live.
//
// The thing worth preserving from The Security Desk is not the grid. It is
// that no cell here is an opinion. Every determined mark is a sentence lifted
// out of the vendor's published terms with the URL it came from, and a mark we
// could not verify says so and scores zero rather than being quietly filled in
// or quietly dropped. That is why the panel does not carry the `finding` edge
// used elsewhere in this app: that border means AG concluded something, and
// here AG concluded nothing. The vendors wrote this.
//
// Two design rules follow from it:
//
//   A blank is not a low score. A vendor scoring 2 of 4 because two marks are
//   adverse has been fully read; one scoring 2 of 4 because two marks are
//   unverified has not. Those are different facts about different things and
//   the coverage column keeps them apart, because collapsing them punishes a
//   vendor for our own missing receipts.
//
//   Re-weighting changes priority, never a fact. A healthcare CIO may treat
//   residency as a hard requirement and not care about indemnity at all. The
//   weights move what the ranking optimises for; the marks underneath never
//   move, and no weighting can lift an all-adverse vendor off zero.

const MARK_GLYPH: Record<MarkState, string> = {
  protective: "●",
  conditional: "◐",
  adverse: "○",
  unverified: "–",
};

const MARK_TONE: Record<MarkState, string> = {
  protective: "text-good",
  conditional: "text-warn",
  adverse: "text-error",
  unverified: "text-muted",
};

const MARK_LABEL: Record<MarkState, string> = {
  protective: "Protective",
  conditional: "Conditional",
  adverse: "Adverse",
  unverified: "Not established",
};

const MARK_MEANING: Record<MarkState, string> = {
  protective: "A protective fact, verified in the vendor's own words.",
  conditional:
    "Protection exists but is gated, by approval, mitigations or plan tier.",
  adverse: "A verified fact that works against the customer.",
  unverified:
    "No receipt obtained. Scores zero, because under-claiming beats over-claiming.",
};

const FRESHNESS_TONE: Record<Freshness["status"], string> = {
  fresh: "border-good/40 bg-good-bg text-good",
  due: "border-warn/40 bg-warn-bg text-warn",
  overdue: "border-error/50 bg-bad-bg text-error",
};

function MarkCell({ mark, dim }: { mark: Mark; dim: string }) {
  return (
    <span
      className={`font-mono text-[15px] leading-none ${MARK_TONE[mark.state]}`}
      title={`${dim}: ${MARK_LABEL[mark.state]}. ${MARK_MEANING[mark.state]}`}
    >
      <span aria-hidden>{MARK_GLYPH[mark.state]}</span>
      <span className="sr-only">{`${dim}: ${MARK_LABEL[mark.state]}`}</span>
    </span>
  );
}

function MarkDetail({ label, mark }: { label: string; mark: Mark }) {
  return (
    <div className="border-b border-base-300/60 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <MarkCell mark={mark} dim={label} />
        <span className="text-[12.5px] font-semibold">{label}</span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${MARK_TONE[mark.state]}`}
        >
          {MARK_LABEL[mark.state]}
        </span>
      </div>
      <p className="measure mt-1 pl-5 text-[12.5px] leading-relaxed text-muted">
        {mark.note}
      </p>
      {mark.source ? (
        <a
          href={mark.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 ml-5 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
        >
          {mark.source.name} →
        </a>
      ) : (
        <p className="mt-1 ml-5 font-mono text-[10px] uppercase tracking-wider text-muted">
          No receipt obtained this pass
        </p>
      )}
    </div>
  );
}

export function PrivacyIpShield({
  freshness,
  onList,
  unmapped,
}: {
  freshness: Freshness;
  /** Shield slugs the reader has shortlisted. */
  onList: string[];
  /** Shield providers the vendor directory does not carry. */
  unmapped: string[];
}) {
  const [weights, setWeights] = useState<ShieldWeights>(DEFAULT_SHIELD_WEIGHTS);
  const mine = useMemo(() => new Set(onList), [onList]);

  const rows = useMemo(() => rankedShieldWeighted(weights), [weights]);
  const customised = useMemo(
    () =>
      SHIELD_DIM_INFO.some(
        (d) => weights[d.key] !== DEFAULT_SHIELD_WEIGHTS[d.key]
      ),
    [weights]
  );

  const setDim = (key: ShieldDim, value: number) =>
    setWeights((w) => ({ ...w, [key]: value }));

  // Stated on screen rather than left to be counted off the grid.
  const fullyRead = rows.filter((r) => shieldCoverage(r) === 4).length;
  const noIndemnity = rows.filter(
    (r) => r.marks.indemnity.state === "adverse"
  ).length;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="The Privacy & IP Shield"
              tooltip="Four questions answered in each vendor's own published words: will they train on your data, how long they keep it, whether they indemnify you on output IP claims, and where your data is processed."
              heading
            />
            <LaneBadge lane="cited" />
            <span
              title="Legal terms have no feed to poll, so this is the honest version of live: the clock runs on its own against today's date and says when the vendors' own documents are due a human re-read."
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${FRESHNESS_TONE[freshness.status]}`}
            >
              {freshness.label}
            </span>
          </div>
          <p className="measure mt-2 text-[13px] leading-relaxed">
            <b>
              Every mark below is quoted from the vendor&apos;s own terms, not
              scored by us.
            </b>{" "}
            {rows.length} model providers, {fullyRead} of them read on all four
            questions. {noIndemnity} state plainly that they offer no output IP
            indemnity, which is a verified absence rather than a gap in our
            receipts. Cloud hosts that resell these models sit on the Ecosystem
            Navigator, because reselling somebody else&apos;s model does not
            change whose terms govern your data.
          </p>
        </div>
      </div>

      {/* Re-weighting. Same marks, the buyer's own priorities. */}
      <div className="mt-4 rounded border border-base-300 bg-base-200/40 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="micro-label">
            Your priorities · 0 means it does not matter to you
          </p>
          {customised ? (
            <button
              type="button"
              onClick={() => setWeights(DEFAULT_SHIELD_WEIGHTS)}
              className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              Reset to equal
            </button>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Equal weights
            </span>
          )}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SHIELD_DIM_INFO.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <label
                htmlFor={`shield-w-${d.key}`}
                className="flex-1 text-[12px] leading-tight"
                title={d.blurb}
              >
                {d.label}
              </label>
              <input
                id={`shield-w-${d.key}`}
                type="range"
                min={0}
                max={3}
                step={1}
                value={weights[d.key]}
                onChange={(e) => setDim(d.key, Number(e.target.value))}
                className="w-24 accent-[var(--ag-primary)]"
              />
              <span className="w-4 text-right font-mono text-[12px] tabular-nums text-muted">
                {weights[d.key]}
              </span>
            </div>
          ))}
        </div>
        {weights.training +
          weights.retention +
          weights.indemnity +
          weights.residency ===
        0 ? (
          <p className="measure mt-2 text-[11.5px] leading-relaxed text-warn">
            Every priority is set to zero, so every vendor scores zero. The
            marks below are unchanged; there is simply nothing left to rank on.
          </p>
        ) : null}
      </div>

      {/* The grid. */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="py-2 pr-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Provider
              </th>
              {SHIELD_DIM_INFO.map((d) => (
                <th
                  key={d.key}
                  title={d.blurb}
                  className="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-wider text-muted"
                >
                  {d.label.replace(" / zero-retention", "")}
                  {weights[d.key] !== 1 ? (
                    <span className="ml-1 text-primary">×{weights[d.key]}</span>
                  ) : null}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Score
              </th>
              <th
                title="How many of the four questions we obtained a receipt for. A low score on 4 of 4 is a verdict; a low score on 2 of 4 is a gap in our reading."
                className="px-2 py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-wider text-muted"
              >
                Read
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const coverage = shieldCoverage(v);
              const pct = v.max > 0 ? (v.score / v.max) * 100 : 0;
              return (
                <tr
                  key={v.slug}
                  className="border-b border-base-300/60 align-top last:border-b-0"
                >
                  <td className="py-2.5 pr-3">
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-1.5">
                        <span className="font-mono text-[10px] text-muted transition-transform group-open:rotate-90">
                          ▸
                        </span>
                        <span className="text-[13px] font-semibold">
                          {v.vendor}
                        </span>
                        {v.kind === "open-weights" ? (
                          <span
                            title="Open weights you host yourself, so several of these questions are answered by construction rather than by contract."
                            className="rounded border border-base-300 bg-base-200/60 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted"
                          >
                            self-hosted
                          </span>
                        ) : null}
                        {mine.has(v.slug) ? (
                          <span className="rounded border border-primary/40 bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                            on your list
                          </span>
                        ) : null}
                      </summary>
                      <div className="mt-2 max-w-2xl">
                        <MarkDetail
                          label="Will not train on our data"
                          mark={v.marks.training}
                        />
                        <MarkDetail
                          label="Retention / zero-retention"
                          mark={v.marks.retention}
                        />
                        <MarkDetail
                          label="Output IP indemnity"
                          mark={v.marks.indemnity}
                        />
                        <MarkDetail
                          label="Data residency"
                          mark={v.marks.residency}
                        />
                      </div>
                    </details>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <MarkCell
                      mark={v.marks.training}
                      dim="Will not train on our data"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <MarkCell
                      mark={v.marks.retention}
                      dim="Retention / zero-retention"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <MarkCell
                      mark={v.marks.indemnity}
                      dim="Output IP indemnity"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <MarkCell mark={v.marks.residency} dim="Data residency" />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span className="font-mono text-[12.5px] tabular-nums">
                      {v.score}
                      <span className="text-muted">/{v.max}</span>
                    </span>
                    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-base-300">
                      <span
                        className="block h-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span
                      title={
                        coverage === 4
                          ? "All four questions answered from the vendor's own documents."
                          : `${4 - coverage} of the four could not be verified this pass. Those marks score zero.`
                      }
                      className={`font-mono text-[11.5px] tabular-nums ${coverage === 4 ? "text-muted" : "text-warn"}`}
                    >
                      {coverage}/4
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* The legend, and the limits. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {(
          ["protective", "conditional", "adverse", "unverified"] as MarkState[]
        ).map((s) => (
          <span
            key={s}
            title={MARK_MEANING[s]}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted"
          >
            <span className={MARK_TONE[s]} aria-hidden>
              {MARK_GLYPH[s]}
            </span>
            {MARK_LABEL[s]}
          </span>
        ))}
      </div>

      <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
        <b>This is a reading of published terms, not legal advice.</b> Each mark
        links the document it was read from so you can check it against the
        contract you are actually offered, which is the one that binds you: an
        enterprise agreement can differ from the public terms in either
        direction. The paid or enterprise tier is the one graded throughout,
        because that is the buyer&apos;s real context, and free-tier behaviour
        is noted in the mark where it differs.
        {unmapped.length > 0 ? (
          <>
            {" "}
            {unmapped.length === 1
              ? "One provider here"
              : `${unmapped.length} providers here`}{" "}
            {unmapped.length === 1 ? "is" : "are"} not in the tracked vendor
            directory, so {unmapped.length === 1 ? "it" : "they"} can never be
            marked as being on your list even if you run{" "}
            {unmapped.length === 1 ? "it" : "them"}.
          </>
        ) : null}
      </p>
    </section>
  );
}

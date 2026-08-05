"use client";

import { useEffect, useState } from "react";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  RUNG_LABEL,
  RUNG_MEANS,
  type LadderEntry,
  type Rung,
} from "@/lib/finance/disclosure-ladder";

// One scale, five rungs, and a bar whose width is how much we actually know.
//
// The page used to be binary: a filer either stated an AI revenue figure or
// showed nothing, which left six of nine blank. A ceiling is a fact though,
// so BOUNDED sits between "stated" and "silent": Alphabet's AI revenue cannot
// exceed the audited $58.7B Google Cloud segment, and saying so rules out it
// being $200B without estimating anything.
//
// The bar carries the rung. A stated figure is a point, a bound is a bracket
// from zero, a derived range is a bracket between two computed ends, and a
// vendor with nothing gets no bar at all. A reader can see how much is known
// before reading a word, which is the job.

const RUNG_STYLE: Record<Rung, string> = {
  stated: "border-good/60 text-good",
  bounded: "border-primary/60 text-primary",
  derived: "border-[var(--ag-insight)]/60 text-[var(--ag-insight)]",
  override: "border-dashed border-warn/70 text-warn",
  not_estimable: "border-base-300 text-muted",
};

const usd = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(n / 1e9 >= 100 ? 0 : 1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n).toLocaleString("en-GB")}`;
};

const STORAGE_KEY = "ag_ai_revenue_overrides";

export function DisclosureLadder({
  publicRows,
  privateRows,
  coverage,
}: {
  publicRows: LadderEntry[];
  privateRows: LadderEntry[];
  coverage: { withFigure: number; ingested: number; listed: number };
}) {
  // The reader's own figures. Held in their browser only: never posted, never
  // merged into an AG number, and never shared between vendors or users. The
  // brief asked for "estimates or overrides"; this is the override, and the
  // reason it is the only editable value on the page is that the reader is
  // the only party entitled to supply one.
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOverrides(JSON.parse(raw) as Record<string, number>);
    } catch {
      // A corrupt or blocked store just means no overrides.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // Private browsing. The override still works for this session.
    }
  }, [overrides, loaded]);

  // Only vendors carrying a figure: a stated one, a hard bound, or a derived
  // range. The eleven that publish nothing are counted below rather than
  // listed, because eleven consecutive rows reading "nothing published" told
  // the reader the same thing eleven times and buried the ten that did.
  const all = [...publicRows, ...privateRows];
  const rows = all.filter((r) => r.rung !== "not_estimable");
  const silent = all.filter((r) => r.rung === "not_estimable");
  // One scale across every row, so bar lengths are comparable.
  const max = Math.max(
    ...rows.map((r) =>
      r.rung === "stated"
        ? r.stated!.valueUsd
        : r.rung === "bounded"
          ? r.bounded!.ceilingUsd
          : r.rung === "derived"
            ? r.derived!.highUsd
            : 0
    ),
    ...Object.values(overrides),
    1
  );

  const setOverride = (key: string, value: number | null) =>
    setOverrides((o) => {
      const next = { ...o };
      if (value === null || !Number.isFinite(value) || value <= 0) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });

  return (
    <section className="mt-8">
      <MicroLabel
        label="What each vendor discloses about its AI revenue"
        tooltip="Five rungs of evidence, from a figure stated in a filing down to nothing published at all."
      />

      <p className="measure mt-2 text-sm text-base-content/75">
        {coverage.withFigure} of the {coverage.ingested} filers whose accounts
        we hold now carry a stated figure or a hard upper bound, up from the{" "}
        {publicRows.filter((r) => r.rung === "stated").length} that state one
        outright. Nothing here is estimated: a bound is two published numbers
        with a bracket between them. The remaining{" "}
        {coverage.listed - coverage.ingested} tickers in the selector have no
        filing ingested yet and say so rather than rendering nothing.
      </p>

      <ol className="mt-4 space-y-2">
        {rows.map((row) => (
          <LadderRow
            key={row.key}
            row={row}
            max={max}
            override={overrides[row.key] ?? null}
            onOverride={(v) => setOverride(row.key, v)}
          />
        ))}
      </ol>

      {/* The absence still gets reported, once, with the names. Dropping these
          rows without saying so would turn "we do not know" into "there is
          nothing to know", which is the one substitution this page exists to
          prevent. */}
      {silent.length > 0 ? (
        <p className="measure mt-3 rounded-lg border border-dashed border-base-300 px-3 py-2 text-sm text-muted">
          <span className="font-semibold text-base-content">
            {silent.length} more are not listed
          </span>{" "}
          because nothing about their AI revenue is published or inferable:{" "}
          {silent.map((r) => r.name).join(", ")}. That silence is a finding
          about disclosure, not a gap in this page.
        </p>
      ) : null}

      <Key />

      <div className="mt-3">
        <DerivationDrawer title="What a bound is, and what it is not">
          <p>
            A bound is not an estimate. Alphabet states no AI revenue figure,
            but its AI products are sold through Google Cloud, and Google Cloud
            is an audited segment reporting $58.7B. So Alphabet&apos;s AI
            revenue is somewhere between nothing and that, which rules out a
            great many numbers people quote and invents none.
          </p>
          <p>
            The segment is named on every bounded row so you can judge the
            bracket yourself. Where it is too wide to be worth much, the row
            says so rather than letting a long bar imply precision: Meta sells
            no AI product line, so its bracket is close to its whole business.
          </p>
          <p className="text-muted">
            Your own figures stay in your browser. They are never sent to us,
            never merged into any published AG number, and never shown to
            anyone else. Every coverage count on this page is computed before
            overrides are applied.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

function LadderRow({
  row,
  max,
  override,
  onOverride,
}: {
  row: LadderEntry;
  max: number;
  override: number | null;
  onOverride: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const pct = (v: number) => `${Math.max(1.5, (v / max) * 100)}%`;
  const rung: Rung = override !== null ? "override" : row.rung;

  return (
    <li className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-bold">{row.name}</span>
        <span
          className={`rounded-full border-2 px-2 py-0.5 font-mono text-sm ${RUNG_STYLE[rung]}`}
        >
          {RUNG_LABEL[rung]}
        </span>
      </div>

      {/* The bar. Its shape is the claim: a point, a bracket, or nothing. */}
      <div className="mt-2 h-3 w-full rounded-full bg-base-300/50">
        {rung === "override" && override !== null ? (
          <div
            className="h-full rounded-full border-2 border-dashed border-warn bg-warn/25"
            style={{ width: pct(override) }}
          />
        ) : row.rung === "stated" ? (
          <div
            className="h-full rounded-full bg-good"
            style={{ width: pct(row.stated!.valueUsd) }}
          />
        ) : row.rung === "bounded" ? (
          // Floor zero, ceiling the audited segment. A gradient rather than a
          // solid fill, because the true value is somewhere inside and the bar
          // should not read as a measurement of the whole span.
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/15 to-primary/70"
            style={{ width: pct(row.bounded!.ceilingUsd) }}
          />
        ) : row.rung === "derived" ? (
          <div className="relative h-full">
            <div
              className="absolute h-full rounded-full bg-[var(--ag-insight)]/60"
              style={{
                left: pct(row.derived!.lowUsd),
                width: `calc(${pct(row.derived!.highUsd)} - ${pct(row.derived!.lowUsd)})`,
              }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 text-sm">
        {rung === "override" && override !== null ? (
          <p className="text-warn">
            Your figure: <span className="font-mono">{usd(override)}</span>.
            Held in this browser only and excluded from every AG count.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => onOverride(null)}
            >
              Remove
            </button>
          </p>
        ) : row.rung === "stated" ? (
          <p className="measure text-base-content/80">
            <span className="font-mono font-semibold">
              {row.stated!.isFloor ? "at least " : ""}
              {usd(row.stated!.valueUsd)}
            </span>{" "}
            &middot; {row.stated!.measures}
            {row.stated!.url ? (
              <>
                {" "}
                <a
                  href={row.stated!.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {row.stated!.form ?? "filing"}
                  {row.stated!.filedAt ? `, ${row.stated!.filedAt}` : ""}
                </a>
              </>
            ) : row.stated!.filedAt ? (
              <span className="text-muted"> &middot; {row.stated!.filedAt}</span>
            ) : null}
          </p>
        ) : row.rung === "bounded" ? (
          <p className="measure text-base-content/80">
            <span className="font-mono font-semibold">
              at most {usd(row.bounded!.ceilingUsd)}
            </span>{" "}
            &middot; capped by the audited {row.bounded!.segment} segment.{" "}
            {row.bounded!.because}
            {row.bounded!.looseNote ? (
              <span className="text-warn"> {row.bounded!.looseNote}</span>
            ) : null}
          </p>
        ) : row.rung === "derived" ? (
          <p className="measure text-base-content/80">
            <span className="font-mono font-semibold">
              {usd(row.derived!.lowUsd)} to {usd(row.derived!.highUsd)}
            </span>{" "}
            &middot; {row.derived!.basis}
          </p>
        ) : (
          <p className="measure text-muted">{row.notEstimable}</p>
        )}
      </div>

      {/* The override control. Present on every row, because the reader may
          disagree with a bound as readily as with a blank. */}
      <div className="mt-2">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. 4.2"
              aria-label={`Your AI revenue figure for ${row.name}, in billions`}
              className="w-28 rounded border-2 border-dashed border-warn/70 bg-base-100 px-2 py-1 text-sm"
            />
            <span className="text-sm text-muted">$B</span>
            <button
              type="button"
              className="rounded border border-base-300 px-2 py-1 text-sm hover:bg-base-300/50"
              onClick={() => {
                const n = Number(draft);
                onOverride(Number.isFinite(n) && n > 0 ? n * 1e9 : null);
                setEditing(false);
                setDraft("");
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="text-sm text-muted underline"
              onClick={() => {
                setEditing(false);
                setDraft("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="text-sm text-muted underline hover:text-base-content"
            onClick={() => setEditing(true)}
          >
            {override !== null ? "Change your figure" : "Use your own figure"}
          </button>
        )}
      </div>
    </li>
  );
}

function Key() {
  return (
    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm @2xl:grid-cols-2">
      {(Object.keys(RUNG_LABEL) as Rung[]).map((r) => (
        <div key={r} className="flex gap-2">
          <dt
            className={`h-fit shrink-0 rounded-full border-2 px-2 py-0.5 font-mono ${RUNG_STYLE[r]}`}
          >
            {RUNG_LABEL[r]}
          </dt>
          <dd className="measure text-muted">{RUNG_MEANS[r]}</dd>
        </div>
      ))}
    </dl>
  );
}

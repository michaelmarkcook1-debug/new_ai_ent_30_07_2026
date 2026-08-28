"use client";

import { MicroLabel } from "@/lib/ui/micro";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  isSaved,
  listPositions,
  POSITIONS_CHANGED,
  removePosition,
  savePosition,
  toPosition,
  type SavedPosition,
} from "./store";
import type { CompanyResearch } from "@/lib/research/company";

// Save this position, and say what saving it actually does.
//
// A save button whose only feedback is the word "Saved" leaves the reader
// guessing where it went. This one names the tool that will use it, because
// that is the entire point of the feature: the Decision Desk opens with this
// company already in the box.
//
// The research is not saved automatically. It is the reader's company and
// their browser, and a tool that quietly retains what you typed is a different
// product from one that offers to.

export function SavePosition({ research }: { research: CompanyResearch }) {
  const position = toPosition(research);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  // Rendered on the server and hydrated on the client, and localStorage exists
  // in only one of those. Reading it during render would mismatch, so the
  // saved state is resolved after mount and the button starts neutral.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Re-derived on every change to the store rather than on mount alone. A
    // reader who clears the company from the context bar while this run is
    // still on screen was otherwise told it "is saved" by the button beside
    // the list that had just stopped listing it.
    const sync = () => {
      if (position) setSaved(isSaved(position.name));
      setReady(true);
    };
    sync();
    window.addEventListener(POSITIONS_CHANGED, sync);
    return () => window.removeEventListener(POSITIONS_CHANGED, sync);
  }, [position?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to carry forward from a run that could not name the company.
  if (!position) return null;

  const onSave = () => {
    const ok = savePosition(position);
    setFailed(!ok);
    setSaved(ok);
  };

  const onRemove = () => {
    removePosition(position.key);
    setSaved(false);
    setFailed(false);
  };

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {saved ? `${position.name} is saved` : `Save this position`}
          </p>
          <p className="measure mt-0.5 text-sm text-muted">
            {saved ? (
              <>
                The Decision Desk now opens with {position.name} already in the
                box, and a question that names them is answered against what
                these sources said.{" "}
                <Link
                  href="/decision-desk"
                  className="text-insight underline underline-offset-2"
                >
                  Go to the Decision Desk
                </Link>
                .
              </>
            ) : (
              <>
                Keeps what was found here so the Decision Desk can open with{" "}
                {position.name} already in the box, rather than asking you to
                describe them again.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={saved ? onRemove : onSave}
          disabled={!ready}
          className={
            saved
              ? "shrink-0 rounded-full border border-base-300 px-4 py-2 text-sm font-semibold text-muted transition hover:border-error/50 hover:text-error disabled:opacity-50"
              : "shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          }
        >
          {saved ? "Remove" : "Save this position"}
        </button>
      </div>

      {failed ? (
        <p className="measure mt-2 rounded border border-warn/30 bg-warn-bg/40 px-3 py-2 text-sm text-warn">
          This browser refused to store it, which usually means private browsing
          or a full storage quota. Nothing was saved, so the Decision Desk will
          not have it.
        </p>
      ) : null}

      {saved ? (
        <p className="measure mt-2 text-sm text-muted">
          Held in this browser only. It does not follow you to another machine,
          and clearing site data removes it.
        </p>
      ) : null}
    </section>
  );
}

/** The chip the Decision Desk shows when a saved position is in play. */
export function PositionChip({
  position,
  onClear,
}: {
  position: SavedPosition;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-insight/30 bg-insight/[0.06] px-3 py-2">
      <span className="micro-label text-insight">From your saved position</span>
      <span className="text-sm font-semibold">{position.name}</span>
      <span className="text-sm text-muted">
        researched{" "}
        {new Date(position.savedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-full px-2 py-0.5 text-sm text-muted underline underline-offset-2 hover:text-base-content"
      >
        Clear
      </button>
    </div>
  );
}

/**
 * Everything saved in this browser, with a way to remove each one.
 *
 * `listPositions()` was written and never called, so nothing on any screen
 * showed a reader what they had saved. The only way to remove a position was
 * to research that same company again and click Remove on it, which nobody
 * would guess. A test company saved while trying the tool therefore stayed in
 * the store indefinitely and kept being offered to the Decision Desk.
 *
 * Renders nothing when the store is empty, rather than a standing "no saved
 * positions" notice on a page most readers arrive at with none.
 */
export function SavedPositions() {
  const [positions, setPositions] = useState<SavedPosition[]>([]);

  // After mount: localStorage does not exist during the server render, and
  // reading it while rendering is a hydration mismatch.
  //
  // AND ON EVERY CHANGE, which this read once on mount and then stopped doing.
  // The context bar's "Stop carrying" removes the position from the same store
  // this list renders, so a reader who cleared it there was left looking at
  // this list still naming the company, on the very page the list lives on.
  // The store was empty and the screen said otherwise, which is the failure
  // POSITIONS_CHANGED was added for and which this component was missed by.
  useEffect(() => {
    const sync = () => setPositions(listPositions());
    sync();
    window.addEventListener(POSITIONS_CHANGED, sync);
    return () => window.removeEventListener(POSITIONS_CHANGED, sync);
  }, []);

  const forget = (key: string) => {
    removePosition(key);
    setPositions(listPositions());
  };

  const forgetAll = () => {
    for (const p of listPositions()) removePosition(p.key);
    setPositions(listPositions());
  };

  if (positions.length === 0) return null;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <MicroLabel
          label={`Saved in this browser (${positions.length})`}
          tooltip="Saved positions live in this browser only. There is no account here, so they do not follow you to another machine and clearing site data removes them."
        />
        <button
          type="button"
          onClick={forgetAll}
          className="text-xs text-muted underline underline-offset-2 hover:text-base-content"
        >
          Clear all
        </button>
      </div>
      <ul className="mt-2 divide-y divide-base-300">
        {positions.map((p) => (
          <li key={p.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="text-sm font-semibold">{p.name}</span>
            {p.industry ? (
              <span className="text-xs text-muted">{p.industry}</span>
            ) : null}
            <span className="font-mono text-xs text-muted">
              {new Date(p.savedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <button
              type="button"
              onClick={() => forget(p.key)}
              className="ml-auto rounded-full border border-base-300 px-2 py-0.5 text-xs text-muted transition hover:border-error hover:text-error"
            >
              Clear
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 measure text-xs text-muted">
        The most recent of these is what the Decision Desk offers to open with.
      </p>
    </section>
  );
}

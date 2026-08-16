"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// The "Ask AI" pill in the top bar, with the suggested questions folded into
// it.
//
// These used to sit as chip grids on The Pulse and the Company View overview,
// which pushed the actual content down the page and repeated the same
// affordance in two places. Holding them here puts them one click away from
// anywhere in the app and leaves each page to its own subject.
//
// Every question routes to /decision-desk?q=..., which starts the adaptive
// interview already primed. Interrogate reads the parameter on mount.

export interface SuggestedQuestion {
  group: string;
  question: string;
}

// Curated, not derived: no dataset publishes "good opening questions". They
// are grouped so the menu reads as two different jobs rather than one flat
// list, and both groups are short on purpose.
export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    group: "The market",
    question: "Which model providers are strongest in regulated industries?",
  },
  {
    group: "The market",
    question: "Which integrators lead on agentic delivery capability?",
  },
  {
    group: "The market",
    question: "What changed in EU AI Act enforcement this month?",
  },
  {
    group: "Your organisation",
    question: "Where does our current stack create vendor lock-in risk?",
  },
  {
    group: "Your organisation",
    question: "Which of our functions gain most from agentic AI this year?",
  },
  {
    group: "Your organisation",
    question: "Which vendor shortlist fits our governance posture?",
  },
  {
    group: "Your organisation",
    question: "Who should deliver our AI programme, and at what readiness?",
  },
];

export function AskAiButton() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape, so the menu never traps focus or
  // strands itself open behind a navigation.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = [...new Set(SUGGESTED_QUESTIONS.map((q) => q.group))];

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="tap inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m12 3 1.9 5.6L19.5 10l-5.6 1.4L12 17l-1.9-5.6L4.5 10l5.6-1.4L12 3Z" />
        </svg>
        Ask AI
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className={`transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1.5 w-80 overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-lg"
        >
          <p className="border-b border-base-300 px-3 py-2.5 text-xs text-muted">
            Start the AI Analyst on a ready-made question, or open it blank and
            describe your own situation.
          </p>
          {groups.map((g) => (
            <div key={g} className="border-b border-base-300 last:border-b-0">
              <p className="px-3 pt-2 font-mono text-xs uppercase tracking-wider text-muted">
                {g}
              </p>
              <ul className="pb-1.5">
                {SUGGESTED_QUESTIONS.filter((q) => q.group === g).map((q) => (
                  <li key={q.question}>
                    <Link
                      role="menuitem"
                      href={`/decision-desk?tool=finding&q=${encodeURIComponent(q.question)}`}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 text-sm leading-snug transition hover:bg-base-200 hover:text-primary"
                    >
                      {q.question}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link
            role="menuitem"
            href="/decision-desk"
            onClick={() => setOpen(false)}
            className="block bg-base-200/60 px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-base-200"
          >
            Ask something else &rarr;
          </Link>
        </div>
      ) : null}
    </div>
  );
}

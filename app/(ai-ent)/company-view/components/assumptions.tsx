"use client";

import { useEffect, useState } from "react";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";

// The figures nobody publishes, supplied by the person who knows them.
//
// Public sources give a company's revenue and sometimes its headcount. They do
// not give what a buyer actually needs to size an AI decision: how many people
// would use it, what a seat is worth, what is already committed. Those exist
// only inside the company.
//
// The product's rule does not bend for that. It will not estimate them, and
// this panel does not either. It states each assumption as a question, leaves
// it empty until the reader answers, and marks every answer as theirs. That is
// the same rung the financial snapshot calls OVERRIDE, applied to the tab
// where a reader is reasoning about their own business rather than a vendor's.
//
// Nothing typed here is sent anywhere. It stays in this browser, it never
// reaches an AG figure, and the derived lines below it are arithmetic on the
// reader's own numbers rather than a claim of ours.

interface Assumption {
  key: string;
  label: string;
  unit: string;
  /** Why the product will not fill this in. */
  why: string;
}

const ASSUMPTIONS: Assumption[] = [
  {
    key: "staff",
    label: "People who would use AI tools",
    unit: "people",
    why: "Headcount is sometimes published; how much of it is in scope never is.",
  },
  {
    key: "seat",
    label: "Budgeted cost per seat, per year",
    unit: "£",
    why: "List prices are public, what you would actually pay is not.",
  },
  {
    key: "topTierPct",
    label: "Share of those people on top-tier models",
    unit: "%",
    why: "The role library puts this near 15% across a reference workforce. Yours is yours.",
  },
];

const STORAGE_KEY = "ag_company_assumptions";

export function Assumptions({ company }: { company: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const storeKey = `${STORAGE_KEY}:${company.toLowerCase()}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storeKey);
      setValues(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    } catch {
      setValues({});
    }
    setLoaded(true);
  }, [storeKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storeKey, JSON.stringify(values));
    } catch {
      // Private browsing. The figures still work for this session.
    }
  }, [values, loaded, storeKey]);

  const num = (k: string) => {
    const n = Number(values[k]);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const staff = num("staff");
  const seat = num("seat");
  const topPct = num("topTierPct");

  // Arithmetic on the reader's own figures, shown only once they exist. Every
  // line names the inputs it multiplied, so it can be checked rather than
  // trusted.
  const lines: { label: string; value: string; from: string }[] = [];
  if (staff && seat) {
    lines.push({
      label: "Annual seat cost, everyone",
      value: `£${Math.round(staff * seat).toLocaleString("en-GB")}`,
      from: `${staff.toLocaleString("en-GB")} people at £${seat.toLocaleString("en-GB")}`,
    });
  }
  if (staff && topPct) {
    lines.push({
      label: "People on the top tier",
      value: Math.round((staff * topPct) / 100).toLocaleString("en-GB"),
      from: `${topPct}% of ${staff.toLocaleString("en-GB")}`,
    });
  }

  return (
    <section className="mt-4 rounded-lg border-2 border-dashed border-warn/50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Your assumptions"
          tooltip="Figures no public source holds. You supply them; we never guess them."
        />
        <span className="rounded-full border-2 border-dashed border-warn/70 px-2 py-0.5 font-mono text-sm text-warn">
          YOUR FIGURES
        </span>
      </div>
      <p className="measure mt-2 text-sm text-base-content/75">
        These are not published anywhere, so the page leaves them to you rather
        than estimating them. Nothing you type is sent to us or mixed into any
        figure we publish.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        {ASSUMPTIONS.map((a) => (
          <label key={a.key} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{a.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted">{a.unit}</span>
              <input
                inputMode="decimal"
                value={values[a.key] ?? ""}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [a.key]: e.target.value }))
                }
                placeholder="not set"
                aria-label={a.label}
                className="w-full rounded border-2 border-dashed border-warn/60 bg-base-100 px-2 py-1.5 text-sm"
              />
            </span>
            <span className="measure text-sm text-muted">{a.why}</span>
          </label>
        ))}
      </div>

      {lines.length > 0 ? (
        <div className="mt-4 border-t border-base-300 pt-3">
          <MicroLabel
            label="What that implies"
            tooltip="Arithmetic on your figures alone. Each line names what it multiplied."
          />
          <ul className="mt-2 space-y-1.5">
            {lines.map((l) => (
              <li key={l.label} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold">{l.label}</span>
                <span className="font-mono text-warn">{l.value}</span>
                <span className="text-muted">from {l.from}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Fill any two of the three and the arithmetic appears here.
        </p>
      )}

      <div className="mt-3">
        <DerivationDrawer title="Why these are blank">
          <p>
            Everything else on this page is retrieved from a source you can
            open. These three are not retrievable: no filing, index or company
            page states how many of your people would use an AI tool, what you
            would pay for a seat, or how much of your work needs the expensive
            tier. A number here would be a guess wearing the same styling as
            the cited figures above it.
          </p>
          <p className="text-muted">
            Your figures stay in this browser. They are never sent to us, never
            merged into a published AG figure, and the lines derived from them
            are arithmetic on your inputs alone, with the multiplication shown
            so you can check it rather than trust it.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

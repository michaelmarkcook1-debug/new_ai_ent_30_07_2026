"use client";

import { useMemo, useState } from "react";
import type { TokenPrice } from "@/lib/aie";

type SortKey = "dataset" | "vendor" | "model" | "input" | "output";
type SortDir = "asc" | "desc";

// Exact string rendering of a captured price: no rounding, no reformatting,
// so the figure on screen is byte-identical to the dataset value.
function price(v: number | null): React.ReactNode {
  if (v === null) {
    return (
      <span className="text-xs italic text-muted" title="Not verified from a reliable live source in the dataset">
        Not published
      </span>
    );
  }
  return <span className="font-mono text-sm">${String(v)}</span>;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function compareNullable(a: number | null, b: number | null, dir: SortDir): number {
  // Nulls always sort last regardless of direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

// Sortable token pricing table. Every row keeps its native dataset note and
// links to the vendor pricing page it was captured from.
export function PricingTable({ rows }: { rows: TokenPrice[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("dataset");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    if (sortKey === "dataset") return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "vendor") {
        const cmp = a.vendorName.localeCompare(b.vendorName) || a.modelName.localeCompare(b.modelName);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortKey === "model") {
        const cmp = a.modelName.localeCompare(b.modelName);
        return sortDir === "asc" ? cmp : -cmp;
      }
      if (sortKey === "input") return compareNullable(a.inputPerM, b.inputPerM, sortDir);
      return compareNullable(a.outputPerM, b.outputPerM, sortDir);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ label, k, align }: { label: string; k: SortKey; align?: "right" }) {
    const active = sortKey === k;
    return (
      <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
        <button
          type="button"
          onClick={() => toggle(k)}
          className={`inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-wider ${active ? "text-primary" : "text-muted"} hover:text-primary`}
        >
          {label}
          {active ? <span aria-hidden>{sortDir === "asc" ? "▲" : "▼"}</span> : null}
        </button>
      </th>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-base-300">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-base-300 bg-base-200/60">
            <SortHeader label="Vendor" k="vendor" />
            <SortHeader label="Model" k="model" />
            <SortHeader label="Input $/1M" k="input" align="right" />
            <SortHeader label="Output $/1M" k="output" align="right" />
            <th className="px-3 py-2.5 text-right">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                Cached in $/1M
              </span>
            </th>
            <th className="px-3 py-2.5 text-left">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                Dataset note
              </span>
            </th>
            <th className="px-3 py-2.5 text-left">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
                Source
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-b border-base-300 last:border-b-0 hover:bg-base-200/40">
              <td className="px-3 py-2.5 font-semibold">{row.vendorName}</td>
              <td className="px-3 py-2.5">{row.modelName}</td>
              <td className="px-3 py-2.5 text-right">{price(row.inputPerM)}</td>
              <td className="px-3 py-2.5 text-right">{price(row.outputPerM)}</td>
              <td className="px-3 py-2.5 text-right">{price(row.cachedInputPerM)}</td>
              <td className="max-w-[300px] px-3 py-2.5 text-xs leading-snug text-muted">{row.note}</td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                  title={row.sourceUrl}
                >
                  {hostOf(row.sourceUrl)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

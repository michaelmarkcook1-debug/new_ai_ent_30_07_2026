"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { brFetch } from "@/lib/br-client";

// Client island: the company dropdown. Everything around it is server
// rendered from the resolved query parameter, so the page never flashes the
// wrong company before correcting itself.

interface CompanyRow {
  id: string;
  ticker: string | null;
  name: string;
  displayName?: string | null;
}

export function CompanySelect({ selected }: { selected: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [rows, setRows] = useState<CompanyRow[]>([]);

  useEffect(() => {
    let alive = true;
    brFetch<{ companies: CompanyRow[] }>("companies").then((res) => {
      if (!alive || !res.ok || !res.data?.companies) return;
      setRows(
        res.data.companies
          .filter((c) => c.ticker)
          .sort((a, b) =>
            (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name)
          )
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  function pick(value: string) {
    router.push(value === "SHELL" ? pathname : `${pathname}?company=${value}`);
  }

  return (
    <select
      aria-label="Company"
      value={selected ?? "SHELL"}
      onChange={(e) => pick(e.target.value)}
      className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px] font-semibold"
    >
      <option value="SHELL">Shell (exemplar, sample)</option>
      {/* Until the roster arrives, keep the current selection selectable so
          the control never silently reports a different company. */}
      {rows.length === 0 && selected ? (
        <option value={selected}>{selected}</option>
      ) : null}
      {rows.map((c) => (
        <option key={c.id} value={c.ticker as string}>
          {(c.displayName ?? c.name)} ({c.ticker})
        </option>
      ))}
    </select>
  );
}

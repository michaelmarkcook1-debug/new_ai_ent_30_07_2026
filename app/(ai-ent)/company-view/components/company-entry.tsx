"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// The company a reader actually wants to know about.
//
// This page used to be one fixture for one company, which made every figure on
// it a worked example rather than an answer. The name goes in the URL so a
// researched company can be linked, bookmarked and shared, and so a reload
// does not lose it.

export function CompanyEntry({ busy = false }: { busy?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("company") ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/company-view?company=${encodeURIComponent(q)}` : "/company-view");
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
        <span className="micro-label">Company</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter any company, listed or private"
          aria-label="Company to research"
          className="rounded border border-base-300 bg-base-100 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Researching..." : "Research"}
      </button>
      {params.get("company") ? (
        <button
          type="button"
          onClick={() => router.push("/company-view")}
          className="text-sm text-muted underline"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}

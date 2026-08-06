"use client";

import { useState } from "react";
import { TheTape } from "./the-tape";
import { FirmsLikeYours } from "./firms-like-yours";
import { SourcingView } from "./sourcing-view";
import { IndustryEntry } from "./industry-entry";
import { ContractPostureSection } from "./contract-posture";
import type { StatusRow } from "@/lib/desk/status";
import type { VendorDossier } from "@/lib/desk/dossier";

// Trust Rank as one surface, in four reads.
//
// Everything ported from The Security Desk lives here (6 August 2026). It was
// briefly spread across six tabs, which was the wrong call: split up it was six
// additions to six products, and on one surface it is a product. Michael said
// so and he was right.
//
// The reason this needs steps rather than a scroll is arithmetic. Trust Rank
// now holds eleven substantial panels, and the existing page was already four
// of them. A reader arriving to check one thing should not scroll past ten
// others to reach it, and a page where everything is present is a page where
// nothing is findable.
//
// The four steps are the order a buyer actually works in, which is also the
// order The Desk's own rooms ran in:
//
//   Today       what changed overnight, and is anything of mine on fire
//   The terms   what each vendor's own contract permits, and who can reach it
//   Source      given all that, who may we buy from, and prove it in a pilot
//   Obligations what the law puts on me rather than on them
//
// Every panel stays mounted and the inactive step is hidden rather than
// unmounted, the same rule the Decision Desk follows: the sourcing flow holds
// weights and constraints a reader has set, and switching to read a contract
// term must not throw that away.

type Step = "today" | "terms" | "source" | "obligations";

export function DeskView({
  statuses,
  statusesAttempted,
  watchedVendorIds,
  wire,
  shield,
  sovereignty,
  obligations,
  posture,
  dossiers,
}: {
  statuses: StatusRow[];
  statusesAttempted: number;
  watchedVendorIds: string[];
  /** Server-rendered, because the feed is fetched on the request. */
  wire: React.ReactNode;
  shield: React.ReactNode;
  sovereignty: React.ReactNode;
  obligations: React.ReactNode;
  /** The cyber-risk and lab-posture blocks that were already on this page. */
  posture: React.ReactNode;
  /** One dossier per vendor the Shield covers, keyed by directory id. Built on
   *  the server because the join reads several server-only datasets. */
  dossiers: Record<string, { name: string; dossier: VendorDossier }>;
}) {
  const [step, setStep] = useState<Step>("today");
  const dossierIds = Object.keys(dossiers);
  const [vendorId, setVendorId] = useState<string>(dossierIds[0] ?? "");
  const selected = dossiers[vendorId] ?? null;

  const pill = (id: Step, label: string, sub: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setStep(id)}
      aria-pressed={step === id}
      className={`rounded-lg border px-4 py-2.5 text-left transition ${
        step === id
          ? "border-primary bg-primary/[0.06]"
          : "border-base-300 bg-base-100 hover:border-primary/50"
      }`}
    >
      <span
        className={`block text-sm font-bold ${step === id ? "text-primary" : ""}`}
      >
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-muted">{sub}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {pill(
          "today",
          "1 · Today",
          "What changed overnight, whether any of it is yours, and whether the labs are up right now."
        )}
        {pill(
          "terms",
          "2 · The terms",
          "What each vendor's own contract permits with your data, quoted, and whose government can reach it."
        )}
        {pill(
          "source",
          "3 · Source",
          "Set hard requirements, get the vendors you may buy from, and the pilot that proves what the ranking cannot."
        )}
        {pill(
          "obligations",
          "4 · Obligations",
          "What AI regulation binds you rather than your vendor, dated, and the security posture underneath."
        )}
      </div>

      <div className={step === "today" ? "space-y-4" : "hidden"}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TheTape
            statuses={statuses}
            attempted={statusesAttempted}
            watchedVendorIds={watchedVendorIds}
          />
          <FirmsLikeYours />
        </div>
        {wire}
      </div>

      <div className={step === "terms" ? "space-y-4" : "hidden"}>
        {shield}
        {sovereignty}
        {/* The per-vendor join: one vendor, everything the ported surfaces
            hold about it. The Shield above lists all fourteen and their terms;
            this is the other cut, where the terms sit beside that vendor's
            sovereignty flag, its retirements and who is encroaching on it. */}
        {dossierIds.length > 0 ? (
          <div className="rounded-lg border border-base-300 bg-base-100 p-5">
            <label className="flex flex-wrap items-center gap-2">
              <span className="micro-label">One vendor, everything we hold</span>
              <select
                aria-label="Vendor"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="rounded border border-base-300 bg-base-100 px-2 py-1.5 text-[12px]"
              >
                {dossierIds.map((id) => (
                  <option key={id} value={id}>
                    {dossiers[id].name}
                  </option>
                ))}
              </select>
            </label>
            {selected ? (
              <div className="mt-3">
                <ContractPostureSection
                  dossier={selected.dossier}
                  vendorName={selected.name}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={step === "source" ? "space-y-4" : "hidden"}>
        <IndustryEntry />
        <SourcingView />
      </div>

      <div className={step === "obligations" ? "space-y-4" : "hidden"}>
        {obligations}
        {posture}
      </div>
    </div>
  );
}

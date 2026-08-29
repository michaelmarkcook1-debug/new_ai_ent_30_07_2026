"use client";

import { useEffect, useState } from "react";
import type { Opportunity } from "@/lib/position/opportunities";
import {
  rolesFor,
  COLUMN_LABEL,
  COLUMN_TOOLTIP,
  type ColumnFit,
  type RoleColumn,
} from "@/lib/position/role-fit";
import {
  entryFor,
  setRole,
  setTakeForward,
  TAKE_FORWARD_CHANGED,
} from "@/lib/position/take-forward";

// One opportunity, and who would own it if the reader took it forward.
//
// THE DEFAULT STATE IS UNCHANGED. Collapsed, this renders exactly the row that
// was here before: the basis badge, the label, the risk and reliability line
// and the source quote. A reader who never touches the control sees what they
// saw yesterday, which is the point: the ownership question is an addition to
// this section rather than a replacement for it.
//
// ITS OWN CLIENT MODULE. `researched-company.tsx` is imported by the client
// research runner AND by the server-rendered Governance tab, so it cannot hold
// state or a handler. The same boundary `carry-to-desk.tsx` sits on, and for
// the same reason.
//
// THE RECOMMENDATION IS COMPUTED, NOT STORED. `rolesFor()` is deterministic and
// derived from the catalogue, so it is recomputed on render rather than written
// to the browser. Only the reader's own decisions persist: that they took this
// area forward, and any role they chose instead of the recommended one. A
// stored recommendation would go stale the moment the catalogue moved and
// nothing would say so.

const ORDER: RoleColumn[] = ["businessOwner", "deliveryOwner", "governanceOwner"];

function RoleSelect({
  column,
  fit,
  chosen,
  onChoose,
  // Scoped to the workflow, because eight expanded rows would otherwise carry
  // three duplicate ids each and every label would point at the first row's
  // control rather than its own.
  domId,
}: {
  column: RoleColumn;
  fit: ColumnFit;
  chosen: string | undefined;
  onChoose: (role: string) => void;
  domId: string;
}) {
  const value = chosen ?? fit.recommended.role;
  // The recommendation first, then the ranked alternatives, deduplicated in
  // case an override matches one of them.
  const options = [
    fit.recommended.role,
    ...fit.alternatives.map((a) => a.role),
  ].filter((r, i, all) => all.indexOf(r) === i);
  const why =
    value === fit.recommended.role
      ? fit.recommended.why
      : (fit.alternatives.find((a) => a.role === value)?.why ??
        "Chosen by you, in place of the recommendation.");

  return (
    <div className="min-w-0">
      <p className="micro-label" title={COLUMN_TOOLTIP[column]}>
        {COLUMN_LABEL[column]}
      </p>
      <label className="sr-only" htmlFor={domId}>
        {COLUMN_LABEL[column]}
      </label>
      <select
        id={domId}
        value={value}
        onChange={(e) => onChoose(e.target.value)}
        className="tap mt-1 w-full rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm"
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {r === fit.recommended.role ? `Recommended: ${r}` : r}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted">{why}</p>
    </div>
  );
}

export function OpportunityRow({
  area,
  positionKey,
}: {
  area: Opportunity;
  /** Scopes the decision to this company, so two never share a list. */
  positionKey: string;
}) {
  const roles = rolesFor(area);
  const [takeForward, setTf] = useState(false);
  const [chosen, setChosen] = useState<Partial<Record<RoleColumn, string>>>({});
  // localStorage does not exist during the server render, so the stored
  // decision is read after mount. Until then the row renders collapsed, which
  // is the state it had before this feature existed.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      const e = entryFor(positionKey, area.id);
      setTf(e.takeForward);
      setChosen(e.roles);
      setReady(true);
    };
    sync();
    window.addEventListener(TAKE_FORWARD_CHANGED, sync);
    return () => window.removeEventListener(TAKE_FORWARD_CHANGED, sync);
  }, [positionKey, area.id]);

  const toggle = () => {
    const next = !takeForward;
    setTf(next);
    setTakeForward(positionKey, area.id, next);
  };

  const choose = (column: RoleColumn, role: string) => {
    setChosen((c) => ({ ...c, [column]: role }));
    setRole(positionKey, area.id, column, role);
  };

  const expanded = ready && takeForward;

  return (
    <li
      className={`rounded-lg border bg-base-100 px-3 py-2 ${
        expanded ? "border-primary/40" : "border-base-300"
      }`}
    >
      {/* The row exactly as it was. Nothing here is conditional on the new
          state, so the collapsed rendering is unchanged. */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide ${
            area.basis === "evidenced"
              ? "border border-good/40 bg-good-bg text-good"
              : "border border-base-300 text-muted"
          }`}
          title={
            area.basis === "evidenced"
              ? "This company's own retrieved sources spoke to this area."
              : "The catalogue holds this workflow for this sector. The sources said nothing about it."
          }
        >
          {area.basis === "evidenced" ? "evidenced" : "sector"}
        </span>
        <span className="text-sm font-semibold">{area.label}</span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted">
            {area.riskTier} risk · reliability {area.reliabilityRequirement}/5
          </span>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={expanded}
            title="Name the three roles who would own this if you took it forward. Nothing is sent anywhere; the choice is kept in this browser."
            className={`tap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
              expanded
                ? "border-primary bg-primary text-white"
                : "border-base-300 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {expanded ? "Taken forward" : "Take forward"}
          </button>
        </span>
      </div>

      {area.evidence ? (
        <p className="mt-1 measure text-xs text-muted">
          Your sources: &ldquo;{area.evidence}&rdquo;
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-3 border-t border-base-300 pt-3">
          <p className="mb-2 measure text-xs text-muted">
            Role archetypes, ranked from what this workflow is, what regulates
            it and how much damage it can do. This product does not know how you
            are organised, so these are the roles that would own this kind of
            work rather than a reading of your org chart. Change any of them.
          </p>
          {/* Three across only where there is genuinely room for three, and
              stacked below that. The sibling grid in researched-company.tsx
              waits for @4xl before going three-up; these are selects rather
              than cards so they need less, but @lg would have put three
              dropdowns and their reasons into a 512px container. No
              intermediate two-column step: the three are one set and splitting
              them 2 + 1 reads as a hierarchy that is not there. */}
          <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
            {ORDER.map((column) => (
              <RoleSelect
                key={column}
                column={column}
                fit={roles[column]}
                chosen={chosen[column]}
                onChoose={(role) => choose(column, role)}
                domId={`${area.id}-${column}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

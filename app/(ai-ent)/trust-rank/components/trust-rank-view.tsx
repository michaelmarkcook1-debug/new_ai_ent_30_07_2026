"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CategoryChip, LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import {
  eventTypeLabel,
  LAYER_LABEL,
  rulingsForLayer,
  type GridRowView,
  type LensVendor,
  type RegEventView,
} from "../lens";
import { GovernancePostureBlock } from "./governance-posture";
import type { PostureView } from "@/lib/vendor-posture";

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s.includes("in force")
    ? "bg-good-bg text-good"
    : s.includes("enacted")
      ? "bg-warn-bg text-warn"
      : "bg-base-200 text-muted";
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  );
}

const IMPACT_LABELS: Record<string, string> = {
  revenueOpportunity: "Revenue opportunity",
  marginRisk: "Margin risk",
  marketAccessRisk: "Market access risk",
  valuationRisk: "Valuation risk",
  ipoWindowRisk: "IPO window risk",
  customerAdoptionRisk: "Customer adoption risk",
  supplyChainRisk: "Supply chain risk",
};

// Trust Rank, vendor-oriented view: a vendor lens over the shared regulatory
// grid, the vendor-specific rulings, the AIE regulatory events, and the
// governance-posture pattern block for the selected vendor.
export function TrustRankView({
  vendors,
  grid,
  events,
  postures,
}: {
  vendors: LensVendor[];
  grid: GridRowView[];
  events: RegEventView[];
  postures: PostureView;
}) {
  const defaultId =
    vendors.find((v) => v.id === "anthropic")?.id ?? vendors[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(defaultId);

  const selected = useMemo(
    () => vendors.find((v) => v.id === selectedId) ?? vendors[0],
    [vendors, selectedId]
  );
  const rulings = selected ? rulingsForLayer(selected.layer) : [];
  const posture = selected
    ? (postures.rows.find((r) => r.vendorId === selected.id) ?? null)
    : null;

  if (!selected) return null;

  return (
    <div className="space-y-5">
      {/* Vendor lens selector */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <MicroLabel
            label="Vendor lens"
            tooltip="Pick a tracked vendor to see which jurisdiction rows and rulings bear on its layer of the stack."
          />
          <select
            aria-label="Vendor lens"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <CategoryChip label={LAYER_LABEL[selected.layer]} />
          <DerivationDrawer title="How the vendor lens works">
            <p>
              Each tracked vendor sits in one layer of the stack (frontier lab,
              hyperscaler, enterprise platform, application layer or
              infrastructure), taken from the AIE tracked-vendor roster.
            </p>
            <p>The lens applies two simple, honest mappings:</p>
            <ul className="list-disc space-y-1 pl-4 text-muted">
              <li>
                Rulings: frontier labs inherit the EU general-purpose AI
                obligations ruling; infrastructure vendors inherit the US chip
                export controls ruling. No other vendor-specific rulings exist
                in the tracked material, so no other layer claims one.
              </li>
              <li>
                Jurisdiction rows: horizontal regimes (the EU AI Act, the UK
                approach, US federal action, India&apos;s advisories) bear on
                every layer. Narrower statutes are mapped to the layers their
                duties touch: California&apos;s developer-disclosure duties to
                frontier labs; Colorado, Texas and New York deployer and hiring
                rules to the application and enterprise layers; German and
                French supervision to the layers operating workplace and
                customer-facing AI.
              </li>
            </ul>
            <p className="text-muted">
              The mapping is analyst-judged and deliberately coarse: it flags
              which rows to read first, it does not score compliance. Rows
              seeded from the AIE legislation material carry the AIE dataset
              badge; the remaining rows are demo SAMPLE content.
            </p>
          </DerivationDrawer>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Highlighted rows below bear on the {LAYER_LABEL[selected.layer].toLowerCase()} layer.
          The grid itself is jurisdiction-first; the lens only changes emphasis,
          never the content.
        </p>
      </section>

      {/* Regulatory grid */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[13px] font-bold">Regulatory grid</h3>
          <LaneBadge lane="aie" />
          <LaneBadge lane="sample" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-base-300">
                <th className="px-3 py-2"><span className="micro-label">Jurisdiction</span></th>
                <th className="px-3 py-2"><span className="micro-label">Regime</span></th>
                <th className="px-3 py-2"><span className="micro-label">Status</span></th>
                <th className="px-3 py-2"><span className="micro-label">What it means</span></th>
                <th className="px-3 py-2"><span className="micro-label">Source</span></th>
                <th className="px-3 py-2"><span className="micro-label">Lens</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {grid.map((row) => {
                const applies = row.layers.includes(selected.layer);
                return (
                  <tr
                    key={row.jurisdiction}
                    className={applies ? "bg-primary/5" : undefined}
                  >
                    <td className="px-3 py-2.5 font-semibold">{row.jurisdiction}</td>
                    <td className="px-3 py-2.5">{row.regime}</td>
                    <td className="px-3 py-2.5">
                      <StatusChip status={row.status} />
                    </td>
                    <td className="max-w-md px-3 py-2.5 text-[12px] leading-snug text-base-content/85">
                      {row.note}
                    </td>
                    <td className="px-3 py-2.5">
                      <LaneBadge lane={row.aieSource ? "aie" : "sample"} />
                    </td>
                    <td className="px-3 py-2.5">
                      {applies ? (
                        <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                          Applies
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-muted">·</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Vendor-specific rulings for the selected layer */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-[13px] font-bold">
            Rulings bearing on {selected.name}
          </h3>
        </div>
        {rulings.length === 0 ? (
          <p className="rounded-lg border border-base-300 bg-base-100 px-3 py-4 text-[12px] text-muted">
            No vendor-specific ruling in the tracked material bears on the{" "}
            {LAYER_LABEL[selected.layer].toLowerCase()} layer. The jurisdiction
            rows above still apply; nothing further is asserted.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rulings.map((r) => (
              <div key={r.item} className="rounded-lg border border-base-300 bg-base-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="micro-label">{r.vendor}</span>
                  <LaneBadge lane={r.aieSource ? "aie" : "sample"} />
                </div>
                <p className="mt-1 text-[13px] font-semibold">{r.item}</p>
                <p className="mt-1 text-[12px] leading-snug text-base-content/85">
                  {r.note}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Regulatory events from the AIE market-signals dataset */}
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-bold">Regulatory events</h3>
          <LaneBadge lane="aie" />
          <DerivationDrawer title="How the regulatory event figures are derived">
            <p>
              These events come from the AIE market-signals dataset with their
              native labels kept intact: the evidence grade (E1 to E5), the
              dataset&apos;s evidence grade and data status are shown
              exactly as recorded, alongside the cited source.
            </p>
            <p>
              The impact figures (market access risk, margin risk and the rest)
              are the dataset&apos;s own 0 to 100 pressure estimates for each
              channel. Under the dataset&apos;s truthfulness gate they widen
              uncertainty bands and trigger watchlist alerts; they never move a
              headline score on their own, and they are not computed by this
              product.
            </p>
          </DerivationDrawer>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryChip label={e.jurisdiction} />
                <CategoryChip label={eventTypeLabel(e.eventType)} />
                {e.effectiveDate ? (
                  <span className="font-mono text-[10px] text-muted">
                    Effective {DATE_FMT.format(new Date(e.effectiveDate))}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-muted">
                    Effective date not stated
                  </span>
                )}
              </div>
              {e.signal ? (
                <>
                  <p className="mt-2 text-[13px] font-semibold leading-snug">
                    {e.signal.title}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted">
                    {e.signal.evidenceGrade} · {e.signal.dataStatus}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {e.signal.sourceUrl ? (
                      <a
                        href={e.signal.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary hover:underline"
                      >
                        {e.signal.sourceName}
                      </a>
                    ) : (
                      e.signal.sourceName
                    )}
                    , {DATE_FMT.format(new Date(e.signal.sourceDate))}
                  </p>
                </>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(e.impacts)
                  .filter(([, v]) => v !== 0)
                  .map(([k, v]) => (
                    <span
                      key={k}
                      className="inline-flex rounded border border-base-300 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                    >
                      {IMPACT_LABELS[k] ?? k} {v > 0 ? "+" : ""}
                      {v}
                    </span>
                  ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted">
                {e.uncertaintyNote}
              </p>
              {e.affectedVendorIds.length > 0 ? (
                <p className="mt-1 font-mono text-[10px] text-muted">
                  Affects: {e.affectedVendorIds.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Governance posture pattern block for the selected vendor */}
      <GovernancePostureBlock
        vendor={selected}
        posture={posture}
        lane={postures.lane}
      />

      <div className="text-right">
        <Link
          href="/security-desk"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Cyber posture: The Security Desk
        </Link>
      </div>
    </div>
  );
}

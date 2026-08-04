import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { EmptyState } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import type { SourceCategory } from "@/lib/aie/sourcing/manifest";
import type { PrivateVendorCard } from "../types";
import {
  RUNG_LABEL,
  type LadderEntry,
} from "@/lib/finance/disclosure-ladder";

// UI copy is British English per the house rules.
const CATEGORY_LABEL: Partial<Record<SourceCategory, string>> = {
  vendor_docs: "Product docs",
  trust_center: "Trust centre",
  pricing_page: "Pricing page",
  status_page: "Status page",
  changelog: "Changelog",
  public_filing: "Public filings",
  job_posting: "Job postings",
  review_platform: "Review platform",
  marketplace: "Marketplace",
  github: "GitHub",
  analyst_report: "Analyst report",
  press_release: "Press release",
};

const usd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;

// Disclosed-figures-only card for a private AI company.
//
// It used to render the locked empty state unconditionally, which meant
// Anthropic showed "Awaiting public disclosure" while a $4.2-12.7B derived
// range sat on the same page about 400px above it. The card now reads the
// same ladder the panel above does, so a vendor with a figure shows it and
// only a vendor with nothing shows the empty state. The empty state was never
// wrong; it was just being shown to the wrong vendors.
function PrivateCard({
  card,
  entry,
}: {
  card: PrivateVendorCard;
  entry?: LadderEntry;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-bold">
          <Link
            href={`/vendor-view/${card.id}`}
            className="hover:text-primary hover:underline"
          >
            {card.name}
          </Link>
        </h3>
        <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">
          Private
        </span>
      </div>
      {card.tagline ? (
        <div className="mt-2">
          <p className="measure text-sm leading-snug text-base-content/80">
            {card.tagline}
          </p>
          <div className="mt-1">
            <LaneBadge lane="aie" />
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        {entry?.rung === "stated" && entry.stated ? (
          <div className="rounded-lg border-2 border-good/60 p-3">
            <span className="font-mono text-sm text-good">
              {RUNG_LABEL.stated}
            </span>
            <p className="mt-1 text-lg font-bold">
              {entry.stated.isFloor ? "at least " : ""}
              {usd(entry.stated.valueUsd)}
            </p>
            <p className="measure mt-0.5 text-sm text-muted">
              {entry.stated.measures}
            </p>
          </div>
        ) : entry?.rung === "derived" && entry.derived ? (
          <div className="rounded-lg border-2 border-[var(--ag-insight)]/60 p-3">
            <span className="font-mono text-sm text-[var(--ag-insight)]">
              {RUNG_LABEL.derived}
            </span>
            <p className="mt-1 text-lg font-bold">
              {usd(entry.derived.lowUsd)} to {usd(entry.derived.highUsd)}
            </p>
            <p className="measure mt-0.5 text-sm text-muted">
              {entry.derived.basis}
            </p>
          </div>
        ) : (
          <EmptyState
            title="Awaiting public disclosure"
            detail={
              entry?.notEstimable ??
              "Private company: disclosed figures only. No revenue, valuation or growth figure is shown until it is publicly disclosed."
            }
          />
        )}
      </div>
      <div className="mt-3 border-t border-base-300 pt-3">
        <div className="flex items-center gap-2">
          <MicroLabel
            label="Curated public sources"
            tooltip="Outbound links from the AIE sourcing manifest: the curated public pages where evidence for this vendor is gathered. Disclosed figures, when they appear, will come from sources like these."
          />
          <LaneBadge lane="aie" />
        </div>
        {card.sources.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {card.sources.map((s) => (
              <li key={s.url} className="flex items-baseline justify-between gap-2">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-primary hover:underline"
                >
                  {s.label}
                </a>
                <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-muted">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">
            No curated sources in the AIE manifest for this vendor yet.
          </p>
        )}
      </div>
    </div>
  );
}

export function PrivateCompanyCards({
  cards,
  ladder,
}: {
  cards: PrivateVendorCard[];
  ladder: LadderEntry[];
}) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold">Private AI companies</h2>
        <LaneBadge lane="aie" />
      </div>
      <p className="mt-0.5 measure text-sm text-muted">
        These vendors are not in BoardRadar and publish no audited accounts.
        Cards stay locked to what is disclosed or derivable from named sources:
        a stated revenue where one exists, a range where a disclosed round
        implies one, and nothing at all where neither does. The links go to the
        curated public sources for each vendor.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
        {cards.map((c) => (
          <PrivateCard
            key={c.id}
            card={c}
            entry={ladder.find((e) => e.key === c.id)}
          />
        ))}
      </div>
    </section>
  );
}

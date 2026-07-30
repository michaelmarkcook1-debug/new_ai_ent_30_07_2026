import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { EmptyState } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import type { SourceCategory } from "@/lib/aie/sourcing/manifest";
import type { PrivateVendorCard } from "../types";

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

// Disclosed-figures-only card for a private AI company. Deliberately renders
// NO financial figures: only the locked empty state, the AIE seed tagline,
// and the curated outbound source links from the AIE sourcing manifest.
function PrivateCard({ card }: { card: PrivateVendorCard }) {
  return (
    <div className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold">
          <Link
            href={`/vendor-view/${card.id}`}
            className="hover:text-primary hover:underline"
          >
            {card.name}
          </Link>
        </h3>
        <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
          Private
        </span>
      </div>
      {card.tagline ? (
        <div className="mt-2">
          <p className="text-[12px] leading-snug text-base-content/80">
            {card.tagline}
          </p>
          <div className="mt-1">
            <LaneBadge lane="aie" />
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <EmptyState
          title="Awaiting public disclosure"
          detail="Private company: disclosed figures only. No revenue, valuation or growth figure is shown until it is publicly disclosed."
        />
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
                  className="truncate text-[12px] text-primary hover:underline"
                >
                  {s.label}
                </a>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-muted">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-muted">
            No curated sources in the AIE manifest for this vendor yet.
          </p>
        )}
      </div>
    </div>
  );
}

export function PrivateCompanyCards({ cards }: { cards: PrivateVendorCard[] }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">Private AI companies</h2>
        <LaneBadge lane="aie" />
      </div>
      <p className="mt-0.5 max-w-2xl text-[12px] text-muted">
        These vendors are not in BoardRadar and publish no audited accounts.
        Cards stay locked to disclosed figures only: qualitative context comes
        from the AIE dataset, and the links go to the curated public sources
        for each vendor.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <PrivateCard key={c.id} card={c} />
        ))}
      </div>
    </section>
  );
}

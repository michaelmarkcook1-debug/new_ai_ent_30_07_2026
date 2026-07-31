import Link from "next/link";
import { SeverityBadge, type Severity } from "@/lib/ui/badges";
import type { MarketSignal } from "@/lib/market-metrics";

// Card for a market signal carried straight from the AI Enterprise dashboard:
// a risk alert, or a vendor the dataset reads as gaining or slipping. The
// headline text, the severity and the confidence are all the dataset's own.
// Nothing here is rewritten or re-scored, so the card shows the confidence
// beside the claim rather than presenting it as settled.

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

export function SignalCard({
  signal,
  vendorHref,
}: {
  signal: MarketSignal;
  vendorHref?: string | null;
}) {
  const severity = signal.severity
    ? SEVERITY_MAP[signal.severity.toLowerCase()]
    : undefined;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {severity ? <SeverityBadge severity={severity} /> : null}
        {vendorHref ? (
          <Link
            href={vendorHref}
            className="text-[12px] font-bold hover:text-primary hover:underline"
          >
            {signal.vendorName}
          </Link>
        ) : (
          <span className="text-[12px] font-bold">{signal.vendorName}</span>
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug">{signal.headline}</p>

    </div>
  );
}

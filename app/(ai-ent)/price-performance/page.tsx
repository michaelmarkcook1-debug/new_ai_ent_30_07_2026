import { PageHeader, EmptyState } from "@/lib/ui/page";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { loadPricingDataset } from "./data";
import { PricingTable } from "./components/pricing-table";

export const metadata = { title: "Price / Performance | New AI.Ent" };

export default function PricePerformancePage() {
  const pricing = loadPricingDataset();
  return (
    <>
      <PageHeader
        title="Price / Performance Scorecard"
        subtitle="Token list pricing across the frontier and challenger model vendors, date-stamped and attributed per row. Performance figures appear only when a third party can be named per cell."
        lanes={["aie"]}
      />
      <div className="space-y-6">
        {/* Pricing side: AIE dataset, passed through untouched */}
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold">Token list pricing</h2>
                <LaneBadge lane="aie" />
              </div>
              <p className="mt-1 max-w-3xl text-[12px] text-muted">
                {pricing.rows.length} model rows across {pricing.vendorCount}{" "}
                vendors, USD per 1M tokens. Public list price is not the
                negotiated enterprise price: batch APIs commonly list 50 per
                cent lower, and committed-use, volume and residency terms
                vary. {pricing.unverifiedRowCount} rows carry no verified
                price and say so; nothing is guessed.
              </p>
            </div>
            <div className="rounded-lg border border-base-300 bg-base-200/60 px-3 py-2">
              <MicroLabel
                label="Generated"
                tooltip="Capture date of this pricing snapshot from the public vendor pricing pages. Token pricing moves quickly, so every figure on this page carries this date."
              />
              <p className="mt-0.5 font-mono text-[13px] font-bold">
                {pricing.capturedAtDisplay}
              </p>
              <p className="text-[10px] text-muted">
                Snapshot of public vendor pricing pages
              </p>
            </div>
          </div>
          <div className="mt-2">
            <DerivationDrawer
              title="How this table is sourced"
              trigger="How this table is sourced"
            >
              <p>
                Every figure is a public list price captured on{" "}
                {pricing.capturedAtDisplay} from the vendor pricing page linked
                on its row (AIE dataset lane). Prices are rendered exactly as
                captured: no averaging, no estimation, no currency conversion.
              </p>
              <ul className="list-disc space-y-1 pl-4 text-muted">
                <li>
                  Input, output and cached-input columns are USD per 1M
                  tokens; cached-input appears only where the vendor publishes
                  a clean line for it.
                </li>
                <li>
                  The dataset note column carries the dataset&apos;s own
                  caveats verbatim, including batch discounts, per-request
                  fees and residency premiums.
                </li>
                <li>
                  Rows the dataset could not verify from a reliable live
                  source render &quot;Not published&quot; rather than a guess.
                </li>
              </ul>
              <p className="text-muted">
                This area moves fast, so the capture date sits beside the
                table. Treat the snapshot as reference data, not a quote:
                verify against the linked source before relying on any figure.
              </p>
            </DerivationDrawer>
          </div>
          <PricingTable rows={pricing.rows} />
        </section>

        {/* Performance side: no benchmark dataset exists, so say so */}
        <section>
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[15px] font-bold">
              Third-party signals
            </h2>
            <div className="h-px flex-1 bg-base-300" aria-hidden />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            The performance half of this scorecard shows third-party benchmark
            results only, attributed per cell.
          </p>
          <div className="mt-3">
            <EmptyState
              title="Awaiting curated benchmark data"
              detail="The AIE dataset carries no third-party benchmark results, so this page shows none. When curated benchmark feeds are wired in, each cell will name its benchmark, publisher and run date, attributed per cell and date-stamped like the pricing table. No benchmark figure is invented in the meantime."
            />
          </div>
        </section>
      </div>
    </>
  );
}

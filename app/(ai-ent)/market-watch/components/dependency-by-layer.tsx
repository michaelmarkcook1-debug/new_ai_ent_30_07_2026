import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  RELATIONSHIP_LABEL,
  RELATIONSHIP_TYPES,
  type DependencyView,
} from "../data";
import type { RelationshipType } from "@/lib/aie";

// "Most depended-upon by layer": in-degree per exposure-map node, split by
// relationship type and grouped by the tracked-roster layer of the node.

const TYPE_COLOUR: Record<RelationshipType, string> = {
  investment: "var(--ag-primary)",
  cloud: "var(--ag-green)",
  model_hosting: "var(--ag-amber)",
  commercial_partnership: "var(--ag-secondary)",
  supply_chain: "var(--ag-error)",
  subsidiary: "var(--ag-muted)",
};

function NodeName({
  label,
  vendorLinkId,
}: {
  label: string;
  vendorLinkId: string | null;
}) {
  if (!vendorLinkId) return <span className="text-[12px] font-medium">{label}</span>;
  return (
    <Link
      href={`/vendor-view/${vendorLinkId}`}
      className="text-[12px] font-medium hover:text-primary hover:underline"
    >
      {label}
    </Link>
  );
}

export function DependencyByLayer({ view }: { view: DependencyView }) {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Most depended-upon by layer</h2>
        <LaneBadge lane="aie" />
        <span className="font-mono text-[10px] text-muted">
          {view.edgeCount} typed edges, {view.nodeCount} counterparties
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[11px] text-muted">
        Which suppliers the ecosystem leans on hardest: the count of inbound
        dependency edges each company carries in the AIE exposure map, split by
        relationship type.
      </p>
      <div className="mt-1">
        <DerivationDrawer title="How the dependency counts are derived">
          <p>
            Each figure is a count of inbound dependency edges in the AIE exposure
            map: for every company we count the edges that point at it, split by
            the edge&apos;s relationship type (investment, cloud capacity, model
            hosting, partnership, supply chain, subsidiary). Nothing is weighted
            or estimated; it is a plain count over the dataset&apos;s hand-curated,
            source-backed edge list.
          </p>
          <p className="text-muted">
            Edge direction follows the dataset&apos;s own orientation, from the
            exposure holder to the counterparty, so a high count means many
            named companies have a stated relationship into that node. Companies
            are grouped by their layer in the tracked vendor roster; nodes
            outside the roster group under &quot;Wider ecosystem&quot; rather than being
            guessed into a layer.
          </p>
          <p className="text-muted">
            The dataset marks each edge with a confidence tier (high, medium,
            seed). Counts here include all tiers; the per-edge tiers are visible
            on the Alliances page.
          </p>
        </DerivationDrawer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {RELATIONSHIP_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-[10px] text-muted">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: TYPE_COLOUR[t] }}
              aria-hidden
            />
            {RELATIONSHIP_LABEL[t]}
          </span>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {view.groups.map((group) => (
          <div key={group.layer} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <h3 className="text-[13px] font-bold">{group.layer}</h3>
            <div className="mt-3 space-y-2.5">
              {group.nodes.map((node) => (
                <div key={node.nodeId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-1.5">
                      <NodeName label={node.label} vendorLinkId={node.vendorLinkId} />
                      <span className="text-[10px] text-muted">{node.category}</span>
                    </span>
                    <span
                      className="font-mono text-[11px] font-semibold"
                      title="Count of inbound dependency edges in the AIE exposure map"
                    >
                      {node.total}
                    </span>
                  </div>
                  <div
                    className="mt-1 flex h-2 w-full overflow-hidden rounded-full bg-base-200"
                    role="img"
                    aria-label={`${node.label}: ${node.total} inbound dependency edges`}
                  >
                    {RELATIONSHIP_TYPES.filter((t) => node.byType[t] > 0).map((t) => (
                      <span
                        key={t}
                        className="h-full"
                        style={{
                          width: `${(node.byType[t] / view.maxTotal) * 100}%`,
                          background: TYPE_COLOUR[t],
                        }}
                        title={`${RELATIONSHIP_LABEL[t]}: ${node.byType[t]}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { LaneBadge, CategoryChip } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import {
  MODELS,
  MODEL_COUNT,
  modelCategoriesPresent,
  modelsGeneratedStamp,
  MODEL_CATEGORY_LABEL,
  AVAILABILITY_LABEL,
  OWNERSHIP_LABEL,
  type CommercialModel,
} from "../data";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const STAGE_STYLE: Record<string, string> = {
  ga: "bg-good-bg text-good",
  preview: "bg-warn-bg text-warn",
  beta: "bg-warn-bg text-warn",
  deprecated: "bg-base-200 text-muted",
  retired: "bg-base-200 text-muted",
  unknown: "bg-base-200 text-muted",
};

function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${STAGE_STYLE[stage] ?? "bg-base-200 text-muted"}`}
    >
      {stage}
    </span>
  );
}

function ModelRow({ m }: { m: CommercialModel }) {
  const channel = m.hostingVendorName
    ? `${m.vendorName}`
    : m.vendorName === m.ownerVendorName
      ? "Direct"
      : m.vendorName;
  return (
    <tr className="border-t border-base-300/70 align-top">
      <td className="px-2 py-1.5">
        <span className="text-[12.5px] font-semibold">{m.modelName}</span>
        <span className="block font-mono text-[10px] text-muted">{m.modelFamily}</span>
      </td>
      <td className="px-2 py-1.5 text-[12px]">{m.ownerVendorName}</td>
      <td className="px-2 py-1.5">
        <span className="text-[12px]">{channel}</span>
        <span className="block text-[10px] text-muted">
          {OWNERSHIP_LABEL[m.ownershipType] ?? m.ownershipType}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <CategoryChip label={MODEL_CATEGORY_LABEL[m.modelCategory] ?? m.modelCategory} />
      </td>
      <td className="px-2 py-1.5">
        <StageBadge stage={m.availabilityStage} />
        <span className="mt-0.5 block text-[10px] text-muted">
          {AVAILABILITY_LABEL[m.commercialAvailability] ?? m.commercialAvailability}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <span
          className="font-mono text-[10px] text-muted"
          title={m.uncertaintyNote}
        >
          {m.dataStatus} {m.evidenceGrade}
        </span>
      </td>
      <td className="px-2 py-1.5">
        {m.sourceUrls[0] ? (
          <a
            href={m.sourceUrls[0]}
            target="_blank"
            rel="noreferrer"
            title={m.sourceNames[0] ?? m.sourceUrls[0]}
            className="font-mono text-[10px] text-primary hover:underline"
          >
            source
          </a>
        ) : (
          <span className="font-mono text-[10px] text-muted">none</span>
        )}
      </td>
    </tr>
  );
}

// Section (b): the commercial models catalogue, rendered straight from the
// AIE model inventory seed with its native evidence labels.
export function ModelsCatalogue() {
  const categories = useMemo(() => modelCategoriesPresent(), []);
  const stamp = useMemo(() => modelsGeneratedStamp(), []);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODELS.filter((m) => {
      if (category && m.modelCategory !== category) return false;
      if (!q) return true;
      return (
        m.modelName.toLowerCase().includes(q) ||
        m.vendorName.toLowerCase().includes(q) ||
        m.ownerVendorName.toLowerCase().includes(q) ||
        m.modelFamily.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <section>
      {/* Collapsed by default. Ninety-eight model rows is a reference lookup,
          not something to read on the way past. */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Models catalogue</h2>
        <LaneBadge lane="aie" />
        <DerivationDrawer title="How the catalogue evidence labels work">
          <p>
            The catalogue lists the {MODEL_COUNT} commercial model records in the AIE model
            inventory. Every record cites an official source URL and carries the dataset&apos;s own
            evidence metadata, shown unchanged.
          </p>
          <p>
            <strong>Data status</strong> stays at &quot;seed&quot; until live verification against the
            vendor&apos;s own model-list endpoint flips it to &quot;documented&quot; or
            &quot;verified&quot;. <strong>Evidence grade</strong> (for example E2) and the numeric
            evidence grade are the dataset&apos;s native labels, not scores computed by this
            product.
          </p>
          <p>
            Vendors with no confirmed first-party model are marked infrastructure-only or
            refresh-required in the dataset, never invented. Hosted third-party records keep the
            true owner: Claude stays Anthropic on Bedrock, GPT stays OpenAI on Azure.
          </p>
        </DerivationDrawer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Generated"
          tooltip="Dates come from the dataset itself: the capture timestamp on each record and the most recent source date it cites."
        />
        <span className="font-mono text-[10px] text-muted">
          dataset captured {formatDate(stamp.capturedAt)}; latest source dated{" "}
          {formatDate(stamp.latestSourceDate)}
        </span>
      </div>

      {/* Ninety-eight model rows is a reference lookup rather than something
          to read on the way past, so the catalogue opens closed. */}
      <div className="mt-2">
      <Accordion title="Browse the model catalogue" count={MODEL_COUNT}>

      {/* Category chips built from the categories present in the data */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
            category === null
              ? "border-primary bg-primary/10 font-semibold text-primary"
              : "border-base-300 text-muted hover:border-primary hover:text-primary"
          }`}
        >
          All <span className="font-mono text-[9px]">{MODEL_COUNT}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(category === c.id ? null : c.id)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              category === c.id
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "border-base-300 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {c.label} <span className="font-mono text-[9px]">{c.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search model, family or vendor"
          aria-label="Search models"
          className="w-full max-w-xs rounded border border-base-300 bg-base-100 px-2.5 py-1.5 text-[12px] placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <span className="font-mono text-[10px] text-muted">
          Showing {filtered.length} of {MODEL_COUNT} models
        </span>
      </div>

      {/* Table */}
      <div className="mt-2 overflow-hidden rounded-lg border border-base-300 bg-base-100">
        {filtered.length === 0 ? (
          <EmptyState
            title="No models match"
            detail="No records in the AIE model inventory match this search. Adjust the search or category filter."
          />
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-base-200">
                <tr>
                  {["Model", "Owner", "Channel", "Category", "Availability", "Evidence", "Source"].map(
                    (h) => (
                      <th key={h} className="px-2 py-2">
                        <span className="micro-label">{h}</span>
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <ModelRow key={m.id} m={m} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        Evidence labels are the dataset&apos;s own: seed records await live verification against
        each vendor&apos;s model-list endpoint. Nothing in this catalogue is an invented benchmark,
        price or availability claim.
      </p>
      </Accordion>
      </div>
    </section>
  );
}

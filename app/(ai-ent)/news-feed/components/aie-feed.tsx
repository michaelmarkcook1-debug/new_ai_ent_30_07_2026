"use client";

import { useMemo, useState } from "react";
import { CategoryChip, LaneBadge, SentimentPill } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { FeedItem, FeedMeta } from "../data";

// Timeframes are anchored to the dataset's own window end, not today,
// so item dates stay honest: the seed brief is dated as recorded.
const TIMEFRAMES = [
  { label: "Full window", days: null as number | null },
  { label: "Last 7 days of window", days: 7 },
  { label: "Last 14 days of window", days: 14 },
];

function sentimentBadge(s: FeedItem["sentiment"]) {
  if (s === "positive") return <SentimentPill sentiment="Positive" />;
  if (s === "negative") return <SentimentPill sentiment="Negative" />;
  if (s === "neutral") return <SentimentPill sentiment="Neutral" />;
  return (
    <span className="inline-flex rounded-full bg-base-200 px-2 py-0.5 text-[10px] font-medium text-base-content/80">
      Mixed
    </span>
  );
}

// Full-length AIE Brief feed: headline, summary, why it matters, native
// source label and date, topic tag chips, sentiment, vendors, and the
// dataset's own impact figures kept as native labels.
export function AieFeed({ items, meta }: { items: FeedItem[]; meta: FeedMeta }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[0].label);

  const filtered = useMemo(() => {
    const tf = TIMEFRAMES.find((t) => t.label === timeframe) ?? TIMEFRAMES[0];
    const anchor = items.length > 0 ? Math.max(...items.map((i) => i.dateMs)) : 0;
    const cutoff = tf.days === null ? null : anchor - tf.days * 86_400_000;
    return items.filter(
      (i) =>
        (cutoff === null || i.dateMs >= cutoff) &&
        (topic === null || i.tags.includes(topic))
    );
  }, [items, topic, timeframe]);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-bold">AI market brief (historical seed)</h3>
          <LaneBadge lane="aie" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
            seed
          </span>
          <DerivationDrawer title="How this feed is derived">
            <p>
              These 30 items are the structured news seed from the AI
              Enterprise dataset, re-used verbatim. The dataset labels itself
              as a mock seed pending live ingestion, which is why every source
              carries its native [MOCK] marker: nothing here is presented as a
              published article.
            </p>
            <p>
              The impact figure on each item is the
              dataset&apos;s own 0 to 100 labels: impact estimates how much the
              event should move vendor assessment, confidence is the
              dataset&apos;s belief in the classification. They are
              native dataset values, not scores computed by this
              product, and claims below the strong-evidence bar are suppressed
              rather than shown.
            </p>
            <p className="text-muted">
              Item dates are shown exactly as recorded in the dataset window
              ({meta.windowStart} to {meta.windowEnd}).
            </p>
          </DerivationDrawer>
        </div>
        <select
          aria-label="Timeframe"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-1.5 py-0.5 text-[11px] text-muted"
        >
          {TIMEFRAMES.map((t) => (
            <option key={t.label}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 px-3 py-2">
        <MicroLabel
          label="Topics"
          tooltip="Topic tags are derived from the category labels on the dataset items. Pick one to filter the feed."
        />
        <button
          type="button"
          onClick={() => setTopic(null)}
          className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
            topic === null
              ? "border-primary bg-primary text-white"
              : "border-base-300 text-muted hover:border-primary hover:text-primary"
          }`}
        >
          All topics
        </button>
        {meta.topics.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => setTopic(topic === t.tag ? null : t.tag)}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              topic === t.tag
                ? "border-primary bg-primary text-white"
                : "border-base-300 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {t.tag} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 pt-2">
        <span className="micro-label">
          Dataset window {meta.windowStart} to {meta.windowEnd}
        </span>
        <span className="font-mono text-[10px] text-muted">
          {filtered.length} of {meta.itemCount} items
        </span>
      </div>

      <ul className="divide-y divide-base-300">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-[12px] text-muted">
            No items match this topic and timeframe.
          </li>
        ) : (
          filtered.map((n) => (
            <li key={n.id} className="px-3 py-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-muted" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <rect x="3" y="5" width="18" height="15" rx="2" />
                    <path d="M7 9h7M7 13h10M7 17h10" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <p className="text-[13px] font-semibold leading-snug">{n.title}</p>
                    <span
                      className="shrink-0 font-mono text-[10px] text-muted"
                      title="The dataset's native impact label, 0 to 100. See the derivation drawer above."
                    >
                      Impact {n.impactScore}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-base-content/85">
                    {n.summary}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    <span className="font-semibold">Why it matters:</span> {n.whyItMatters}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-muted">
                      {n.sourceName} · {n.date}
                    </span>
                    {n.tags.map((t) => (
                      <CategoryChip key={t} label={t} />
                    ))}
                    {sentimentBadge(n.sentiment)}
                  </div>
                  {n.vendors.length > 0 ? (
                    <p className="mt-1 text-[10px] text-muted">
                      Vendors: {n.vendors.join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

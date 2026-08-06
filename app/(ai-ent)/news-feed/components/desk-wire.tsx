import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  fetchDeskNews,
  NEWS_SOURCE_COUNT,
  type DeskNewsItem,
} from "@/lib/desk/news";

// The wire: security and AI press, read on this request.
//
// Ported from The Security Desk, 6 August 2026. This page already had three
// feeds and none of them answered "what broke in the last few hours". The AIE
// pipeline and the seed brief are both market-intelligence reads on a weekly
// clock, and BoardRadar company news is per-ticker. Security moves faster than
// any of them and is the beat a CIO gets asked about first.
//
// Five sources, and the mix is the point: the vendors' own newsrooms are
// primary sources, the security press is where a vulnerability surfaces first,
// and the community signal is one voice among five rather than the whole feed.
// A developer-community feed on its own lets a small launch outrank a breach.
//
// Deliberately absent and said so: Anthropic publishes no public RSS feed, and
// BleepingComputer sits behind a bot challenge that we do not work around.

function Item({ n }: { n: DeskNewsItem }) {
  return (
    <li>
      <a
        href={n.url}
        target="_blank"
        rel="noreferrer"
        title={n.title}
        className="block rounded border border-base-300 bg-base-200/30 px-3 py-2 transition-colors hover:border-primary/50"
      >
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          {n.security ? (
            <span className="rounded border border-warn/50 bg-warn-bg px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">
              security
            </span>
          ) : null}
          {n.kind === "vendor" ? (
            <span
              title="From the lab's own newsroom, which is a primary source."
              className="rounded border border-good/40 bg-good-bg px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-good"
            >
              primary
            </span>
          ) : null}
          {n.kind === "community" ? (
            <span
              title="Community signal. One voice among five, never the whole feed."
              className="rounded border border-base-300 bg-base-200 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted"
            >
              community
            </span>
          ) : null}
          <span className="text-[12.5px] font-medium">{n.title}</span>
          <span className="ml-auto whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-muted">
            {n.source} · {n.ageHours}h
          </span>
        </div>
      </a>
    </li>
  );
}

export async function DeskWire() {
  const items = await fetchDeskNews(10);
  const security = items.filter((i) => i.security).length;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="The wire: security and AI press"
          tooltip="Five sources read on this request: the vendors' own newsrooms, two security publications, and the community signal. Filtered to enterprise AI and security, deduplicated, security first."
          heading
        />
        <LaneBadge lane="live" />
      </div>

      {items.length === 0 ? (
        <p className="measure mt-2 text-[13px] leading-relaxed">
          <b>Nothing across the five sources right now.</b> Either it is a quiet
          few hours or the feeds did not answer. Rather than fill the panel,
          this says which it cannot tell you: no item is shown that was not
          fetched.
        </p>
      ) : (
        <>
          <p className="measure mt-2 text-[13px] leading-relaxed">
            <b>
              {items.length} stor{items.length === 1 ? "y" : "ies"} from up to{" "}
              {NEWS_SOURCE_COUNT} sources
            </b>
            {security > 0 ? (
              <>
                , {security} of them security. Security leads because it is the
                beat a board asks about first, and because a vulnerability in a
                model you run is a question with your name on it.
              </>
            ) : (
              <>
                , none of them security. A quiet security day is reported quiet.
              </>
            )}
          </p>
          <ul className="mt-3 grid gap-1.5">
            {items.map((n) => (
              <Item key={n.url} n={n} />
            ))}
          </ul>
        </>
      )}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
        Every item links its own source · nothing older than 14 days ·
        Anthropic publishes no public feed, so it is absent rather than faked
      </p>
    </section>
  );
}

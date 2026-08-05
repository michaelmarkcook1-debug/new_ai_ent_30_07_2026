import { PageHeader } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import { PeerAdoptionExplorer } from "./peer-explorer";

export const metadata = { title: "Peer Insights | AI Enterprise" };

// The two sources that measured this directly, later than the model the
// explorer reads, and disagreeing with its top-two ordering. They sit above
// the slice rather than below it, because a caveat a reader meets after the
// figures has already failed.
const MEASURED_AGAINST = [
  {
    source: "Menlo Ventures, mid-2026 LLM market update",
    url: "https://finance.yahoo.com/news/enterprise-llm-spend-reaches-8-130000140.html",
    says: "Anthropic ~40% of enterprise LLM spend against OpenAI's ~27%.",
  },
  {
    source: "Ramp AI Index, April 2026 data",
    url: "https://www.axios.com/2026/05/13/anthropic-openai-workplace-ai-adoption",
    says:
      "Anthropic passed OpenAI in business adoption for the first time, 34.4% against 32.3%.",
  },
];

// Peer Insights (5 August 2026). Split out of AI Adoption, where it was the
// fourth panel on a page about something else.
//
// The question this answers is narrower and more personal than the rest of AI
// Adoption: not "how far has the market got" but "who are firms like mine
// actually buying". That is a different reader in a different moment, and it
// was competing for attention with three panels of market-wide measurement.
//
// The split also cleans up a genuine problem. AI Adoption opened with two
// measured third-party sources and a warning that read "read these before the
// slice below" — a warning that only worked while the slice sat directly
// underneath. Moving the explorer to its own page would have orphaned it, so
// the caveat travels here, where the figures it qualifies actually are.
//
// The honesty position is unchanged and travels intact: what this explorer
// pulls is a modelled estimate dated May 2026, live means freshly fetched
// rather than freshly measured, and the two measurements that contradict its
// ordering are named on this page rather than left on the one it came from.

export default function PeerInsightsPage() {
  return (
    <>
      <PageHeader
        title="Peer Insights"
        subtitle="What firms like yours are buying: pick your industry segment and region, and see which vendors show up in that slice. Every selection is a live pull, and what it pulls is a modelled estimate — read the caveat below before the ordering."
        lanes={["aie-live"]}
      />
      <div className="space-y-4">
        <section className="rounded-lg border border-warn/40 bg-warn-bg/40 p-4">
          <MicroLabel
            label="What this slice can and cannot tell you"
            tooltip="The explorer fetches live on every selection, but the data behind the endpoint is a modelled estimate with a May 2026 vintage. Live means freshly fetched, not freshly measured."
          />
          <p className="measure mt-2 text-[12.5px] leading-relaxed">
            Every selection below is a genuine live pull, and what it pulls is
            a <b>modelled estimate dated May 2026</b> — the endpoint says so
            itself, and its provenance string is printed verbatim under the
            chart. This is not a stale copy a refresh would fix: the upstream
            route reads a static seed, and the evidence pipeline that would
            refresh it is not built.
          </p>
          <p className="measure mt-2 text-[12.5px] leading-relaxed">
            <b>Read the slice for its shape</b> — which vendors appear in your
            segment at all, and how concentrated it is. <b>Do not read it for
            the ranking.</b> Two independent measurements taken later put the
            top two the other way round:
          </p>
          <ul className="mt-2 space-y-1">
            {MEASURED_AGAINST.map((m) => (
              <li key={m.source} className="text-[12.5px] leading-relaxed">
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  {m.source}
                </a>
                {" — "}
                {m.says}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            The measured picture, and how far each industry has progressed,
            live on{" "}
            <a
              href="/ai-adoption"
              className="font-semibold text-primary hover:underline"
            >
              AI Adoption
            </a>
            .
          </p>
        </section>

        <PeerAdoptionExplorer />
      </div>
    </>
  );
}

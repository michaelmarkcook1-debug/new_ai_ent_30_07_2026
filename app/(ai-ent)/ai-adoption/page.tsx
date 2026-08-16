import { PageHeader } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import { AdoptionMaturity } from "./adoption-view";
import { DisclosurePanel } from "./disclosure-panel";

export const metadata = { title: "AI Adoption | AI Enterprise" };

// AI Adoption (4 August 2026, peer slice split out 5 August). What remains of
// the old FitEngine market explorer after a sanity check against current
// public data, and what replaced the part that failed it.
//
// The peer-adoption slice now lives on /peer-insights. It answered a narrower
// question than the rest of this page , "who are firms like mine buying"
// rather than "how far has the market got", and it was the one panel here
// reading a modelled estimate rather than a measurement. The caveat that used
// to sit above it travelled with it; what remains below is a pointer, because
// a warning about a slice that is no longer on the page would be worse than
// no warning at all.
//
// The vendor-share model (585 modelled cells, May 2026) claimed OpenAI led
// adoption in every slice and dominated SMEs 59/23. Two independent current
// sources say otherwise: Menlo Ventures puts Anthropic at ~40% of enterprise
// LLM spend against OpenAI's ~27%, and the Ramp AI Index recorded Anthropic
// passing OpenAI in overall business adoption in April 2026. A modelled
// figure that current measurement contradicts is not "directional", it is
// wrong, so the model is retired from the interface rather than relabelled.
// What is shown instead is the measured, attributed third-party data itself.
const EXTERNAL_FIGURES = [
  {
    source: "Menlo Ventures, mid-2026 LLM market update",
    url: "https://finance.yahoo.com/news/enterprise-llm-spend-reaches-8-130000140.html",
    date: "2026",
    facts: [
      "Enterprise LLM spend reached $8.4B, up from $3.5B in November 2024.",
      "Share of enterprise LLM spend: Anthropic ~40%, OpenAI ~27%, Google ~21%.",
      "Claude holds ~42% of enterprise code-generation usage, roughly double OpenAI's.",
    ],
  },
  {
    source: "Ramp AI Index (card and invoice spend across ~40,000 businesses)",
    url: "https://www.axios.com/2026/05/13/anthropic-openai-workplace-ai-adoption",
    date: "April 2026 data",
    facts: [
      "50.6% of businesses pay for AI tools.",
      "Anthropic passed OpenAI in business adoption for the first time: 34.4% of businesses against 32.3%.",
      "Anthropic wins ~70% of head-to-head matchups among first-time AI buyers; ~79% of its customers also pay OpenAI.",
    ],
  },
];

export default function AiAdoptionPage() {
  return (
    <>
      <PageHeader
        title="AI Adoption"
        subtitle="Who is actually adopting AI, measured three ways: what companies disclose in their own SEC filings, what independent measurement firms report, and how far each industry has progressed. What firms like yours are buying now lives on Peer Insights."
        lanes={["live", "aie-live", "aie"]}
      />
      <div className="space-y-4">
        {/* How far each industry has got. Moved to the top on 5 August 2026:
            it is the question a reader arrives on this page holding, and it
            was sitting fourth behind three panels that answer narrower ones.
            The measured third-party figures follow directly, so the caveat
            about reading measurement before any modelled slice still lands
            before the reader reaches Peer Insights. */}
        <AdoptionMaturity />

        {/* Measured figures, attributed and dated. Never blended. */}
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Measured adoption, from the people who measured it"
              tooltip="Third-party figures quoted with source and date, never merged into a score of ours. If a figure matters to your decision, follow the link and read the methodology."
            />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 @3xl:grid-cols-2">
            {EXTERNAL_FIGURES.map((f) => (
              <article
                key={f.source}
                className="rounded border border-base-300 bg-base-200/40 p-3"
              >
                <p className="text-sm font-bold">{f.source}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {f.date}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed">
                  {f.facts.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-[10px] text-primary hover:underline"
                >
                  {new URL(f.url).hostname.replace(/^www\./, "")}
                </a>
              </article>
            ))}
          </div>
          <p className="measure mt-3 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-xs leading-relaxed">
            <b>Read these before any modelled slice.</b> The figures above are
            measured. The peer slice on{" "}
            <a
              href="/peer-insights"
              className="font-semibold text-primary hover:underline"
            >
              Peer Insights
            </a>{" "}
            is not: it pulls live for every selection, but what it pulls is a
            modelled estimate dated May 2026 whose ordering puts OpenAI ahead
            of Anthropic, which both measurements above, taken later,
            contradict. Read that slice for its shape (which vendors appear
            at all, and how concentrated it is) and read these figures for
            the ranking.
          </p>
          <p className="mt-2 text-xs text-muted">
            Category-level market shares (who leads frontier APIs, enterprise
            assistants, coding agents) are a separate AIE dataset with its own
            per-row source, confidence and methodology, and live on{" "}
            <a href="/market-watch" className="font-semibold text-primary hover:underline">
              Market Watch
            </a>
            .
          </p>
        </section>

        {/* MovementPanel was here and was removed on 16 August 2026. It read
            /api/catalogue/vendor, which answers CATALOGUE_ERROR "fetch failed"
            against production, so the panel could only ever render its own
            empty state. The empty state was working correctly and was honest;
            a panel that is permanently honest about having nothing is still a
            panel with nothing in it, and it sat above real content.

            The component file is kept. Nothing about the panel was wrong, so
            if the catalogue endpoint starts answering, restoring it is a
            one-line import. */}
        <DisclosurePanel />
      </div>
    </>
  );
}

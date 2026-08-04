import { PageHeader } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import { AdoptionMaturity } from "./adoption-view";

export const metadata = { title: "AI Adoption | AI Enterprise" };

// AI Adoption (4 August 2026). What remains of the old Model 4 Role market
// explorer after a sanity check against current public data, and what
// replaced the part that failed it.
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
        subtitle="Who is actually paying for AI, and how far each industry has got: measured third-party adoption figures with their sources, and the AIE dataset's industry maturity profiles."
        lanes={["aie"]}
      />
      <div className="space-y-4">
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
            <b>A vendor-share model was retired from this page.</b> The May 2026
            segment-share model (585 modelled cells by region, industry and
            company size) claimed OpenAI led adoption in every slice and held
            59 per cent of SMEs. Both sources above, measured rather than
            modelled, contradict that ordering, so the model is withdrawn
            rather than shown with a caveat. Its industry maturity profiles
            below are a different dataset and stand.
          </p>
          <p className="mt-2 text-xs text-muted">
            Category-level market shares — who leads frontier APIs, enterprise
            assistants, coding agents — are a separate AIE dataset with its own
            per-row source, confidence and methodology, and live on{" "}
            <a href="/market-watch" className="font-semibold text-primary hover:underline">
              Market Watch
            </a>
            .
          </p>
        </section>

        <AdoptionMaturity />
      </div>
    </>
  );
}

import Link from "next/link";
import {
  MODELS,
  LIBRARY_ROLE_COUNT,
  LIBRARY_INDUSTRY_COUNT,
} from "@/lib/model-fit";
import { PageHeader } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";

export const metadata = { title: "Explore | AI Enterprise" };

// Orientation for a first-time buyer.
//
// The modules are named for what they contain (The Pulse, Trust Rank,
// Interrogate), which is useless to someone who has never seen the product and
// arrives with a job to do. This page is framed by the job instead and routes
// into the existing modules; it adds no data of its own.

// Each card is a job a buyer arrives with, and the icon is the action rather
// than the subject: a magnifier for research, a target for matching a model to
// a role, a shield for obligations. A card that shows what it is about tells a
// reader nothing they cannot read in the heading; one that shows what they
// will do there is worth the space.
const ICON: Record<string, React.ReactNode> = {
  research: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" fill="currentColor" /></>,
  shortlist: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" /></>,
  ask: <><path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.5Z" /><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.2" /><path d="M12 17h.01" /></>,
  compare: <><path d="M12 3v18" /><path d="M6 8H3l3-5 3 5H6Zm0 0v6a3 3 0 0 0 3 3" /><path d="M18 8h-3l3-5 3 5h-3Zm0 0v6a3 3 0 0 1-3 3" /></>,
  price: <><path d="M12 2v20" /><path d="M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  peers: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15.5 15c2.5.4 4.5 2.5 4.5 5" /></>,
  deliver: <><path d="M3 7h11v8H3z" /><path d="M14 10h4l3 3v2h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
};

const JOBS: {
  question: string;
  detail: string;
  href: string;
  cta: string;
  then?: string;
  icon: keyof typeof ICON;
}[] = [
  // First, because it is the only card that answers a question about the
  // reader's own company rather than about the market.
  {
    question: "What is our own AI position?",
    detail:
      "Name your company, listed or private. Its public sources are retrieved at that moment and read now, every statement carrying the link it came from, then set against the tracked market. Where the sources say nothing, so does the page.",
    href: "/company-view",
    cta: "Research your company",
    then: "Your AI Position",
    icon: "research",
  },
  {
    question: "Which AI model should each of my people actually get?",
    detail:
      `Pick an industry, a function and a role. You get the cheapest model that meets that role's requirements, which requirements decided it, which models were eliminated and by what number, and the cost per person and for the whole role. ${LIBRARY_ROLE_COUNT} roles across ${LIBRARY_INDUSTRY_COUNT} industries against ${MODELS.length} priced models.`,
    href: "/market-view",
    cta: "Pick a role",
    then: "ModelEngine",
    icon: "target",
  },
  {
    question: "We want AI for a specific workflow. Who should we shortlist?",
    detail:
      "Pick your industry and the workflow itself, from 75 tracked workflows in 15 areas. You get its risk tier, reliability bar and regulatory flags, then the vendors that ship it and the model providers you would build it on.",
    href: "/workflow-shortlist",
    cta: "Start with your workflow",
    then: "Workflow Shortlist",
    icon: "shortlist",
  },
  {
    question: "Just tell me what to do in our situation.",
    detail:
      "Describe the situation in your own words. You get a few sharp questions, then a tailored finding where every claim carries a citation. Upload your own documents and they become the highest-weighted source behind it.",
    href: "/decision-desk",
    cta: "Describe your situation",
    then: "Decision Desk",
    icon: "ask",
  },
  {
    question: "Who are the serious vendors, and how do they compare?",
    detail:
      "Evidence-graded capability across ten dimensions for 43 tracked vendors, one market category at a time, so a frontier lab is never ranked against a CRM assistant.",
    href: "/competitive-intel",
    cta: "Compare the providers",
    then: "Competitive Intel",
    icon: "compare",
  },
  {
    question: "What will it cost, and what do we get for it?",
    detail:
      "Independent benchmark scores against published list prices across four capability axes, with the efficiency frontier picked out: the models no cheaper option beats. Models scored on no axis stay visible rather than being dropped.",
    href: "/price-performance",
    cta: "See price against capability",
    then: "Price / Performance",
    icon: "price",
  },
  {
    question: "What binds us legally, and where is the risk?",
    detail:
      "AI regulation by jurisdiction with a vendor lens, plus each vendor's evidence-graded governance and security posture.",
    href: "/trust-rank",
    cta: "Check the obligations",
    then: "Trust Rank",
    icon: "shield",
  },
  {
    question: "What are firms like ours actually buying?",
    detail:
      "Adoption by industry and region, shown with the age of the model behind it and links to the measurements that disagree with it.",
    href: "/peer-insights",
    cta: "See your peers",
    then: "Peer Insights",
    icon: "peers",
  },
  {
    question: "Who would actually deliver this for us?",
    detail:
      "Which integrators carry which AI vendors, and how deep the tie is. An enterprise rarely stands a frontier model up alone, so the firm carrying a vendor decides who turns up on the engagement.",
    href: "/alliances",
    cta: "Find the integrator",
    then: "Integrators",
    icon: "deliver",
  },
];

export default function StartPage() {
  return (
    <>
      <PageHeader
        title="Explore"
        subtitle="Independent intelligence on the enterprise AI market, for people buying it. Pick the question closest to yours."
        lanes={["aie-live", "live"]}
      />

      <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        {JOBS.map((j) => (
          <Link
            key={j.href}
            href={j.href}
            className="group flex flex-col rounded-lg border border-base-300 bg-base-100 p-5 transition hover:border-primary"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--ag-insight-bg)] p-2 text-[var(--ag-insight)]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {ICON[j.icon]}
                </svg>
              </span>
              <h2 className="text-base font-bold leading-snug group-hover:text-primary">
                {j.question}
              </h2>
            </div>
            <p className="measure mt-1.5 flex-1 text-sm leading-relaxed text-muted">
              {j.detail}
            </p>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-primary">
              {j.cta}
              <span aria-hidden>&rarr;</span>
              {j.then ? (
                <span className="ml-auto font-mono text-xs font-normal text-muted">
                  {j.then}
                </span>
              ) : null}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-5 rounded-lg border border-base-300 bg-base-200/40 p-5">
        <MicroLabel
          label="How to read anything here"
          tooltip="The conventions used across every page."
        />
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-sm text-muted @xl:grid-cols-2">
          <li>
            <span className="font-semibold text-base-content">
              Every figure names its source.
            </span>{" "}
            A badge on each panel says whether it is live, a dataset read or a
            sample, and &quot;How this is derived&quot; opens the method.
          </li>
          <li>
            <span className="font-semibold text-base-content">
              Missing means missing.
            </span>{" "}
            Where nothing is published you will see &quot;not disclosed&quot;
            rather than an estimate dressed as a measurement.
          </li>
          <li>
            <span className="font-semibold text-base-content">
              Scores compare within a category.
            </span>{" "}
            A chip maker and a CRM assistant are not competing for the same
            budget, so they are never ranked against each other.
          </li>
          <li>
            <span className="font-semibold text-base-content">
              A purple edge means AG concluded it.
            </span>{" "}
            Every analyst insight, recommendation and action carries one, so an
            interpretation is never mistaken for a measurement.
          </li>
          <li>
            <span className="font-semibold text-base-content">
              A teal edge means the delivery channel.
            </span>{" "}
            Systems integrators deliver AI but do not build it, and those panels
            are marked so the two are never confused.
          </li>
        </ul>
      </section>
    </>
  );
}

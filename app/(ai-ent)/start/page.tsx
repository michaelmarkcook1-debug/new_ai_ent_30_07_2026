import Link from "next/link";
import { PageHeader } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";

export const metadata = { title: "Start here | AI Enterprise" };

// Orientation for a first-time buyer.
//
// The modules are named for what they contain (The Pulse, Trust Rank,
// Interrogate), which is useless to someone who has never seen the product and
// arrives with a job to do. This page is framed by the job instead and routes
// into the existing modules; it adds no data of its own.

const JOBS: {
  question: string;
  detail: string;
  href: string;
  cta: string;
  then?: string;
}[] = [
  {
    question: "We want AI for a specific workflow. Who should we shortlist?",
    detail:
      "Pick your industry and the workflow itself, from 146 tracked workflows. You get its risk tier, reliability bar and regulatory flags, then the vendors that ship it and the model providers you would build it on.",
    href: "/market-view",
    cta: "Start with your workflow",
    then: "Model 4 Role",
  },
  {
    question: "Just tell me what to do in our situation.",
    detail:
      "Describe the situation in your own words. You get a few sharp questions, then a tailored finding where every claim carries a citation. The fastest route if you are not sure where to look.",
    href: "/interrogate",
    cta: "Describe your situation",
    then: "Interrogate",
  },
  {
    question: "Who are the serious vendors, and how do they compare?",
    detail:
      "Evidence-graded capability across ten dimensions, one market category at a time, so a frontier lab is never ranked against a CRM assistant.",
    href: "/competitive-intel",
    cta: "Compare the providers",
    then: "Competitive Intel",
  },
  {
    question: "What will it cost, and what do we get for it?",
    detail:
      "Independent benchmark scores against published list prices, with the efficiency frontier picked out: the models no cheaper option beats.",
    href: "/price-performance",
    cta: "See price against capability",
    then: "Price / Performance",
  },
  {
    question: "What binds us legally, and where is the risk?",
    detail:
      "AI regulation by jurisdiction with a vendor lens, plus each vendor's evidence-graded governance and security posture.",
    href: "/trust-rank",
    cta: "Check the obligations",
    then: "Trust Rank",
  },
  {
    question: "Who depends on whom? Where is our lock-in?",
    detail:
      "The dependency graph across the AI stack: who supplies whom, which relationships are verified, and which are only seed evidence.",
    href: "/ecosystem-navigator",
    cta: "Trace the dependencies",
    then: "AI Ecosystem Navigator",
  },
];

export default function StartPage() {
  return (
    <>
      <PageHeader
        title="Start here"
        subtitle="Independent intelligence on the enterprise AI market, for people buying it. Pick the question closest to yours."
        lanes={["aie-live", "live"]}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {JOBS.map((j) => (
          <Link
            key={j.href}
            href={j.href}
            className="group flex flex-col rounded-lg border border-base-300 bg-base-100 p-4 transition hover:border-primary"
          >
            <h2 className="text-[14px] font-bold leading-snug group-hover:text-primary">
              {j.question}
            </h2>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-muted">
              {j.detail}
            </p>
            <p className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-primary">
              {j.cta}
              <span aria-hidden>&rarr;</span>
              {j.then ? (
                <span className="ml-auto font-mono text-[9.5px] font-normal text-muted">
                  {j.then}
                </span>
              ) : null}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-5 rounded-lg border border-base-300 bg-base-200/40 p-4">
        <MicroLabel
          label="How to read anything here"
          tooltip="The conventions used across every page."
        />
        <ul className="mt-2 grid grid-cols-1 gap-1.5 text-[12px] text-muted sm:grid-cols-2">
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
              A purple edge means the delivery channel.
            </span>{" "}
            Systems integrators deliver AI but do not build it, and those panels
            are marked so the two are never confused.
          </li>
        </ul>
      </section>
    </>
  );
}

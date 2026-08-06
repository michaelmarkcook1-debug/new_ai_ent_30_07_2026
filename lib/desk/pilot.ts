// The capability-fit pilot.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/pilot.ts, commit b9bb51c),
// read-only and unmodified at source. Editorial punctuation adapted to the
// house rule.
//
// WHY THIS EXISTS. The Shield scores verified data and IP posture and
// deliberately does not score capability, because there is no honest
// per-vendor capability number to publish: public benchmarks are gamed and
// rarely resemble a particular workload. Refusing to invent one leaves a real
// hole in a buyer's decision, and this is the other half of the answer. It is
// a method the buyer runs on their own data.
//
// It is methodology, never results. Nothing below asserts how any vendor
// performs. Every step is the standard of a defensible enterprise bake-off,
// and every probe is the failure mode a particular workload hides behind a
// good demo.
//
// NOT PORTED. The source carries a further 50 probes keyed to its own
// ten-industry use-case list. This repository has a larger and better tagged
// 75-workflow library of its own (`lib/aie/use-cases.ts`), and the two
// vocabularies overlap on two labels out of sixty-three. Porting the source's
// industry list alongside the existing library would give the product two
// taxonomies that disagree, so only the thirteen horizontal probes come
// across, matching the use cases the sourcing flow actually offers.

export interface PilotStep {
  title: string;
  why: string;
  how: string;
}

/** Ordered, because this is a real sequence: the set has to exist before it
 *  can be scored. The numbering carries information rather than decoration. */
export const PILOT_STEPS: PilotStep[] = [
  {
    title: "Build a representative eval set",
    why: "Capability only means capability on YOUR distribution. Vendor demos are curated; your inbox is not.",
    how: "Pull 50 to 100 real tasks from the actual workload, including the messy, ambiguous and edge cases. No synthetic prompts.",
  },
  {
    title: "Commit a rubric before you look",
    why: "Without a pre-committed definition of correct, reviewers grade to their prior and the winner is whoever they already liked.",
    how: "Write golden answers or a 0 to 3 rubric (accuracy, completeness, format, tone) up front, frozen before any output is seen.",
  },
  {
    title: "Run blind and side by side",
    why: "Brand halo skews human grading. Knowing it is GPT, or that it is Claude, moves scores before the text is read.",
    how: "Send identical prompts to every shortlisted model, then anonymise and shuffle the outputs before a human scores them.",
  },
  {
    title: "Probe the failure modes, not the average",
    why: "Average-case wins hide catastrophic tails: the one hallucinated clause or fabricated number that creates the liability.",
    how: "Test hallucination on out-of-scope questions, refusal rate, prompt-injection resistance, and behaviour on deliberately ambiguous inputs.",
  },
  {
    title: "Measure cost and latency at real volume",
    why: "A model that wins on quality can lose on unit economics at scale, and the spread between the cheapest and dearest token is very large.",
    how: "Compute token cost per task multiplied by your monthly volume, and p50 and p95 latency under realistic concurrency rather than a single quiet call.",
  },
  {
    title: "Keep humans in the loop, and measure their noise",
    why: "Capability judgements are noisy. A single grader is a single point of bias, and you cannot tell a real gap from reviewer variance.",
    how: "Use two or more reviewers per task and report inter-rater agreement. If graders disagree a lot, tighten the rubric before trusting the ranking.",
  },
  {
    title: "Set the go or no-go threshold up front",
    why: "Thresholds chosen after the results rationalise whatever won. Decide what good enough means while you are still honest.",
    how: "Fix the minimum score, the maximum cost per task and the maximum p95 latency BEFORE the run. A model either clears the bar or it does not.",
  },
];

// The capability trap specific to each workload: the one failure mode a glossy
// demo will not show and production will. Add these to the eval set.
export const USE_CASE_PROBES: Record<string, string> = {
  "Customer support automation":
    "Resolution rate on real past tickets, and escalation judgement on the ones that SHOULD go to a human rather than the ones it can answer.",
  "Coding & developer tooling":
    "Compile and test pass-rate on your own repository's real issues rather than toy katas, and the rate of hallucinated APIs that do not exist.",
  "Knowledge & document search (RAG)":
    "Faithfulness to the retrieved passages, and the abstention rate when the answer simply is not in your corpus. Confident wrong answers are the killer.",
  "Data analysis & reporting":
    "Numeric accuracy against your real schemas, and SQL that actually runs as against plausible but wrong queries.",
  "Agents & workflow automation":
    "Task-completion rate across full multi-step traces, and recovery when a tool call fails mid-task rather than looping or giving up.",
  "Content generation & marketing":
    "Brand-voice adherence, and how many factual claims it invents that would need legal or compliance review.",
  "Document processing & extraction":
    "Field-level extraction accuracy on your worst-scanned and most irregular documents, and the rate of hallucinated fields that were never on the page.",
  "Translation & localization":
    "Domain-term fidelity rather than general fluency, tested with back-translation drift on your specialised vocabulary.",
  "Sales & CRM automation":
    "Data-entry accuracy from real call notes, and fabricated CRM fields. A confidently wrong contact record is worse than a blank one.",
  "Fraud & risk detection":
    "False-positive rate at your target recall, and the quality of the explanation an analyst gets. An unexplainable flag cannot be actioned.",
  "Voice & transcription":
    "Word error rate on your actual accents, jargon and background noise, plus speaker diarisation on overlapping speech.",
  "Legal & contract review":
    "Clause-identification recall and the missed-obligation rate. The tail it does not flag is exactly what creates downstream liability.",
  "HR & recruiting":
    "Bias probes across protected attributes and consistency on equivalent CVs. The same candidate reworded should not change the outcome.",
};

/** The probes for the buyer's selected use cases, deduped and order-stable. */
export function pilotProbesFor(
  useCases: string[]
): { useCase: string; probe: string }[] {
  const seen = new Set<string>();
  const out: { useCase: string; probe: string }[] = [];
  for (const u of useCases) {
    const probe = USE_CASE_PROBES[u];
    if (probe && !seen.has(u)) {
      seen.add(u);
      out.push({ useCase: u, probe });
    }
  }
  return out;
}

import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  QUESTIONS,
  UNKNOWN_COPY,
  INPUT_KEYS,
  compositeCaveat,
  type Verdict,
  type InputKey,
} from "@/lib/vendor/composite";
import type { VendorScorecard } from "@/lib/vendor/composite-data";

// The three questions, answered in the words a CIO would use.
//
// This format exists because of the data, not in spite of it. Financial
// disclosure covers 18 of 47 vendors and reputation 29 of 47, so any single
// fused number is mostly a reading of capability wearing the authority of a
// three-part assessment. Asking three questions separately lets Unknown be an
// answer rather than a hole: "no AI revenue disclosed" is itself a finding
// about a vendor, and it is one the market rewards knowing.

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  yes: { label: "Yes", cls: "border-good/55 text-good" },
  mixed: { label: "Mixed", cls: "border-warn/55 text-warn" },
  no: { label: "No", cls: "border-error/55 text-error" },
  unknown: { label: "Unknown", cls: "border-base-300 text-muted" },
};

export function ThreeQuestions({ card }: { card: VendorScorecard }) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Three questions"
          tooltip="What a buyer actually needs to know, answered separately rather than averaged into one number."
        />
        <span className="font-mono text-sm text-muted">
          {compositeCaveat(card.result)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 @2xl:grid-cols-3">
        {INPUT_KEYS.map((k) => (
          <QuestionCard key={k} k={k} card={card} />
        ))}
      </div>

      <div className="mt-3">
        <DerivationDrawer title="How these are answered">
          <p>
            Each question is answered from one source and never from the other
            two. Is it winning comes from assessed capability across ten
            dimensions; do people trust it from published customer, developer
            and employee reputation; will it still exist from what the company
            discloses about its own finances.
          </p>
          <p>
            Yes, Mixed and No are cut against the tracked set rather than an
            absolute scale, because the measures do not share one. Capability
            means run 47.7 to 75.5 and reputation means run 68.3 to 82.0, so a
            single fixed threshold would mark almost every vendor trusted and
            almost none winning, which would say more about the scales than
            about the vendors.
          </p>
          <p className="text-muted">
            The third question is answered from disclosure, not from a solvency
            forecast. Nobody publishes runway. A listed company filing audited
            accounts reads Yes; a private company with a disclosed round reads
            Mixed; a company that discloses nothing reads Unknown rather than
            No, because an absence in our data is not evidence about their
            business. No tracked vendor currently discloses distress, so No is
            a verdict this question cannot presently return.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

function QuestionCard({ k, card }: { k: InputKey; card: VendorScorecard }) {
  const verdict = card.verdicts[k];
  const style = VERDICT_STYLE[verdict];
  const value = card.inputs[k];

  return (
    <article className={`rounded-lg border-2 p-4 ${style.cls}`}>
      <h3 className="text-sm font-bold text-base-content">
        {QUESTIONS[k].question}
      </h3>
      <p className={`mt-1.5 text-2xl font-bold ${style.cls.split(" ")[1]}`}>
        {style.label}
      </p>
      {verdict === "unknown" ? (
        // An Unknown has to say what is missing. "Unknown" alone reads as a
        // rendering failure; the reason reads as a finding.
        <p className="measure mt-1 text-sm text-muted">{UNKNOWN_COPY[k]}</p>
      ) : (
        <p className="measure mt-1 text-sm text-muted">
          {QUESTIONS[k].source}
          {value !== null ? (
            <>
              {" "}
              &middot;{" "}
              <span className="font-mono text-base-content/80">
                {value.toFixed(1)}
              </span>
            </>
          ) : null}
        </p>
      )}
    </article>
  );
}

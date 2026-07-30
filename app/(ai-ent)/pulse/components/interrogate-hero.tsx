"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionChips } from "@/lib/ui/cards";

// The hero band: Interrogate front and centre on the daily read. Typing a
// situation here carries it straight into /interrogate.
export function InterrogateHero({ questions }: { questions: string[] }) {
  const router = useRouter();
  const [input, setInput] = useState("");

  const go = () => {
    const q = input.trim();
    router.push(q ? `/interrogate?q=${encodeURIComponent(q)}` : "/interrogate");
  };

  return (
    <section className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 via-base-100 to-base-100 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="micro-label text-primary">Interrogate</span>
        <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
          source-cited
        </span>
      </div>
      <h2 className="mt-1.5 font-display text-xl font-extrabold tracking-tight">
        Tell me your situation. I will ask sharp questions, then write you a
        tailored, cited finding.
      </h2>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="Who you are, what you have, where you want to get to with AI..."
          className="flex-1 rounded-full border border-base-300 bg-base-100 px-4 py-2.5 text-[13px] outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={go}
          className="rounded-full bg-primary px-6 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Interrogate
        </button>
      </div>
      <div className="mt-3">
        <QuestionChips questions={questions} />
      </div>
    </section>
  );
}

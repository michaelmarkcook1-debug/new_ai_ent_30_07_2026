"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LaneBadge } from "@/lib/ui/badges";
import { PositionChip } from "@/lib/position/save-position";
import {
  latestPosition,
  matchPosition,
  openingLine,
  toContext,
  type PositionContext,
  type SavedPosition,
} from "@/lib/position/store";

interface Tier {
  tier: string;
  role: string;
  mode: string;
  tokens?: number;
}

interface Turn {
  role: "user" | "engine";
  kind: "situation" | "question" | "answer" | "finding" | "error";
  text: string;
  // Fixed at creation so the label never renumbers when later turns arrive.
  index?: number;
  citations?: { source: string; kind: string }[];
  tiers?: Tier[];
  tokens?: number;
  mode?: string;
  links?: { label: string; href: string }[];
}

const EXAMPLES = [
  "We are a European bank exploring agentic AI for client onboarding, worried about the EU AI Act.",
  "Global manufacturer, 60,000 staff, choosing between Copilot and a frontier lab API for engineering.",
  "Public sector body needing data residency and a defensible vendor decision for a citizen assistant.",
  "Energy company piloting maintenance AI; the board wants to know who delivers it and what it costs.",
];

export function InterrogateView({ liveKey = false }: { liveKey?: boolean }) {
  const params = useSearchParams();
  const [depth, setDepth] = useState<"quick" | "comprehensive">("quick");
  const [situation, setSituation] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  // The questions already put, kept beside the answers and sent with them.
  // The engine used to see only the answers, so it had no memory of its own
  // turns and re-used the framing it had just used.
  const [asked, setAsked] = useState<string[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"start" | "asking" | "done">("start");
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  // The saved position offered in the start panel, and the one actually
  // attached to the running interrogation. They are not the same thing: the
  // offer is whatever was researched last, and the attachment is whichever
  // saved company the reader's own words turned out to name.
  const [offered, setOffered] = useState<SavedPosition | null>(null);
  const [attached, setAttached] = useState<PositionContext | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const call = async (
    sit: string,
    ans: string[],
    conclude = false,
    /** Passed explicitly on the first call, because setAttached has not
        committed by then. Later calls read it from state. */
    ctx: PositionContext | null = attached
  ) => {
    setBusy(true);
    try {
      const res = await fetch("/api/interrogate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          situation: sit,
          answers: ans,
          depth,
          conclude,
          position: ctx,
          // The questions already put. Without these the engine only ever saw
          // the answers, so it had no memory of its own turns and re-used the
          // framing it had just used: two consecutive questions opening
          // "Across supply chain, HR and payroll, which functions..." was the
          // report that led here.
          asked,
        }),
      });

      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        // Live mode finding, streamed.
        let text = "";
        let citations: Turn["citations"] = [];
        setTurns((t) => [...t, { role: "engine", kind: "finding", text: "" }]);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            const evt = JSON.parse(part.slice(6));
            if (evt.type === "delta") text += evt.text;
            if (evt.type === "meta") citations = evt.citations;
            const patch: Partial<Turn> =
              evt.type === "done"
                ? { tiers: evt.tiers, tokens: evt.tokens, mode: evt.mode, links: evt.links }
                : {};
            setTurns((t) => {
              const copy = [...t];
              copy[copy.length - 1] = {
                ...copy[copy.length - 1],
                text,
                citations,
                ...patch,
              };
              return copy;
            });
            if (evt.type === "error") {
              setTurns((t) => {
                const copy = [...t];
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  text: text + `\n\n(${evt.message})`,
                };
                return copy;
              });
            }
          }
        }
        setPhase("done");
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setTurns((t) => [...t, { role: "engine", kind: "error", text: `Interrogate failed (${data.code ?? res.status}).` }]);
        return;
      }
      if (data.type === "question") {
        setAsked((a) => (a.includes(data.question) ? a : [...a, data.question]));
        setTurns((t) => [
          ...t,
          {
            role: "engine",
            kind: "question",
            text: data.question,
            index: data.asked ?? ans.length + 1,
            tiers: data.tiers,
            mode: data.mode,
          },
        ]);
        setPhase("asking");
      } else {
        setTurns((t) => [
          ...t,
          {
            role: "engine",
            kind: "finding",
            text: data.finding,
            citations: data.citations,
            tiers: data.tiers,
            tokens: data.tokens,
            mode: data.mode,
            links: data.links,
          },
        ]);
        setPhase("done");
      }
    } catch {
      setTurns((t) => [...t, { role: "engine", kind: "error", text: "Network problem reaching the Interrogate engine." }]);
    } finally {
      setBusy(false);
    }
  };

  const start = (text: string) => {
    const sit = text.trim();
    if (!sit || busy) return;
    // Whether this situation is about a company already researched. Matched on
    // the reader's own words rather than on the prefill, so typing "Ocado are
    // rolling out agents" reaches the same research as clicking through from
    // Your AI Position did. Nothing is attached when nothing matches.
    const hit = matchPosition(sit);
    const ctx = hit ? toContext(hit) : null;
    setAttached(ctx);
    setSituation(sit);
    setAnswers([]);
    setAsked([]);
    setTurns([{ role: "user", kind: "situation", text: sit }]);
    setInput("");
    void call(sit, [], false, ctx);
  };

  const answer = (text: string) => {
    const a = text.trim();
    if (!a || busy) return;
    const next = [...answers, a];
    setAnswers(next);
    setTurns((t) => [...t, { role: "user", kind: "answer", text: a }]);
    setInput("");
    void call(situation, next);
  };

  // Prefill from ?q= (the Pulse hero and chips).
  useEffect(() => {
    const q = params.get("q");
    const d = params.get("depth");
    if (d === "comprehensive") setDepth("comprehensive");
    if (q && !started.current) {
      started.current = true;
      start(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Open with the last company researched in Your AI Position already named.
  //
  // It writes PART of the situation and stops: who they are, which the research
  // established, leaving what they are trying to decide, which only the reader
  // knows. Filling the whole box would get submitted unread and answer a
  // question nobody asked.
  //
  // A ?q= link is an explicit instruction from wherever the reader came from
  // and wins, which is why this runs after that effect and defers to
  // started.current. It also never overwrites typing already in progress.
  useEffect(() => {
    if (started.current) return;
    const p = latestPosition();
    if (!p) return;
    setOffered(p);
    setInput((cur) => (cur.trim() ? cur : openingLine(p)));
    // Once, on mount. Re-running would re-fill a box the reader had cleared.
  }, []);

  const reset = () => {
    setPhase("start");
    setTurns([]);
    setAnswers([]);
    setAsked([]);
    setSituation("");
    setAttached(null);
    // Starting over offers the saved position again, since the reader is back
    // at the same blank box they first met.
    const p = latestPosition();
    setOffered(p);
    setInput(p ? openingLine(p) : "");
  };

  return (
    <div className="mx-auto max-w-3xl">
      {phase === "start" ? (
        <div className="py-6">
          <div className="flex items-center gap-2">
            <span className="micro-label text-primary">Interrogate</span>
            {liveKey ? (
              <span className="rounded bg-ok-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-ok">
                Live analyst
              </span>
            ) : (
              <span className="rounded bg-warn-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-warn">
                Scripted sample mode (no API key)
              </span>
            )}
          </div>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            Tell me your situation.
          </h2>
          <p className="mt-2 measure text-base leading-relaxed text-muted">
            One or two sentences: who you are, what you have, and where you
            want to get to with AI. I will ask a few sharp questions, each
            shaped by your last answer, then write a tailored finding grounded
            only in cited sources. Where the data is thin, I say so rather
            than guess.
          </p>
          {/* Shown whenever the box was opened for them, so a prefilled
              situation is never mistaken for something they typed. */}
          {offered ? (
            <div className="mt-4">
              <PositionChip
                position={offered}
                onClear={() => {
                  setOffered(null);
                  setInput("");
                }}
              />
              <p className="measure mt-2 text-sm text-muted">
                Finish the sentence with what you are trying to decide. A
                question naming {offered.name} is answered against what the
                sources in Your AI Position actually said about them, and that
                is stated in the finding rather than blended in.
              </p>
            </div>
          ) : null}
          <div className="mt-4 flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start(input);
                }
              }}
              rows={3}
              placeholder="Who you are, what you have, where you want to get to..."
              className="flex-1 resize-none rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-base outline-none focus:border-primary"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-base-300 p-0.5">
              {(["quick", "comprehensive"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDepth(d)}
                  title={
                    d === "quick"
                      ? "One question, then the finding written by Sonnet."
                      : "Up to three questions, and the finding written by Opus."
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${depth === d ? "bg-primary text-white" : "text-muted hover:text-base-content"}`}
                >
                  {d === "quick" ? "Quick response" : "Comprehensive"}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => start(input)}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              Start
            </button>
          </div>
          <div className="mt-6">
            <p className="micro-label mb-2">Or try an example</p>
            <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => start(ex)}
                  className="rounded-lg border border-base-300 p-4 text-left text-sm leading-snug text-base-content/80 transition hover:border-primary hover:text-base-content"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 py-4">
          {/* What the engine was given beyond what the reader typed.
              Matching a company name is string work and cannot tell a firm
              called Apple from apple juice, so the safeguard is that a wrong
              match is visible here rather than silent, and starting over drops
              it. */}
          {attached ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-insight/30 bg-insight/[0.06] px-3 py-2">
              <span className="micro-label text-insight">
                Answering with your research on
              </span>
              <span className="text-sm font-semibold">{attached.name}</span>
              <span className="text-sm text-muted">
                from Your AI Position, kept separate from this workspace&apos;s
                own sources in the finding
              </span>
              <button
                type="button"
                onClick={reset}
                className="ml-auto rounded-full px-2 py-0.5 text-sm text-muted underline underline-offset-2 hover:text-base-content"
              >
                Not this company
              </button>
            </div>
          ) : null}
          {turns.map((t, i) => (
            <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                // The finding carries the judgement edge; the questions that
                // led to it do not, because a question is not a conclusion.
                className={`max-w-[90%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  t.role === "user"
                    ? "bg-primary text-white"
                    : t.kind === "finding"
                      ? "finding-strong"
                      : t.kind === "question"
                        ? "border border-primary/40 bg-primary/5"
                        : "border border-base-300 bg-base-100"
                }`}
              >
                {t.kind === "question" ? (
                  <p className="micro-label mb-1 text-primary">
                    Sharp question {t.index ?? 1}
                  </p>
                ) : null}
                {t.kind === "finding" ? (
                  <p className="micro-label mb-1 text-insight">Tailored finding</p>
                ) : null}
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.links && t.links.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-base-300 pt-2">
                    {t.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-full border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {t.tiers ? (
                  <div className="mt-2 border-t border-base-300 pt-1.5">
                    <p className="measure font-mono text-xs uppercase tracking-wider text-muted">
                      {t.tiers.map((x) => `${x.tier}: ${x.role} (${x.mode})`).join(" · ")}
                      {typeof t.tokens === "number" ? ` · ~${t.tokens} tokens indicative` : ""}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy ? (
            <p className="font-mono text-xs text-muted">Working through the grounded sources...</p>
          ) : null}
          {phase === "asking" && !busy ? (
            <div className="flex gap-2 pt-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") answer(input);
                }}
                placeholder="Your answer..."
                className="flex-1 rounded-full border border-base-300 bg-base-100 px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => answer(input)}
                disabled={!input.trim()}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Answer
              </button>
              <button
                type="button"
                onClick={() => void call(situation, answers, true)}
                title="Skip further questions and write the finding from what you have said so far"
                className="rounded-full border border-base-300 px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                Conclude now
              </button>
            </div>
          ) : null}
          {phase === "done" && !busy ? (
            <div className="pt-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-base-300 px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                Start a new interrogation
              </button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-base-300 pt-3">
        <span className="micro-label">Grounding</span>
        <LaneBadge lane="aie-live" />
        <LaneBadge lane="aie" />
        <p className="measure text-xs text-muted">
          Findings draw on the AIE live vendor read, the ported AIE dataset,
          the preloaded documents and any documents you upload, with citations
          on every claim. Your own documents rank above every other source in
          that corpus. The Shell exemplar was removed from it, so no finding
          rests on one sample company's figures. Tiered routing: Haiku shapes
          the questions, and the finding is written by Sonnet on a quick
          response or by Opus on a comprehensive one. Opus never runs unless
          you ask for it.
        </p>
      </div>
    </div>
  );
}

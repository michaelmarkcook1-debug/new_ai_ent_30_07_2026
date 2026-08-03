"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";

interface AnswerMeta {
  tiers: { tier: string; role: string; mode: string }[];
  tokens: number;
  mode: string;
  citations: { source: string; kind: string }[];
}

interface Message {
  role: "user" | "assistant";
  text: string;
  meta?: AnswerMeta;
}

interface UploadInfo {
  name: string;
  size: number;
  parsed: boolean;
}

const SUGGESTED = [
  "Which vendor configuration is under assessment?",
  "What does the EU AI Act require of our high-risk use cases?",
  "How should we select delivery partners?",
  "Where are our readiness gaps?",
];

export function AnalystView({ preloaded }: { preloaded: string[] }) {
  const params = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const ask = async (question: string, deep = false) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, deep }),
      });

      // Live mode streams SSE; scripted mode returns JSON.
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        let text = "";
        let meta: AnswerMeta = { tiers: [], tokens: 0, mode: "live", citations: [] };
        setMessages((m) => [...m, { role: "assistant", text: "" }]);
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
            if (evt.type === "delta") {
              text += evt.text;
            } else if (evt.type === "meta") {
              meta = { ...meta, citations: evt.citations ?? [] };
            } else if (evt.type === "done") {
              meta = { ...meta, tiers: evt.tiers ?? [], tokens: evt.tokens ?? 0, mode: evt.mode ?? "live" };
            } else if (evt.type === "error") {
              text += `\n\n(The live analyst call failed: ${evt.message})`;
            }
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", text, meta };
              return copy;
            });
          }
        }
        setBusy(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: data.answer,
            meta: {
              tiers: data.tiers,
              tokens: data.tokens,
              mode: data.mode,
              citations: data.citations,
            },
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: `The analyst could not answer (${data.code ?? res.status}).` },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Network problem reaching the analyst route." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Prefill from ?q= (the suggested-question chips across the app).
  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      void ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch("/api/analyst/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data.success) {
      setUploads(data.uploads);
    } else {
      setUploadError(`${data.error} (${data.code})`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
      {/* Chat column */}
      <section className="@container flex min-h-[480px] flex-col rounded-lg border border-base-300 bg-base-100 @4xl:col-span-2">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="AI Analyst"
            tooltip="Grounded in your uploads first, then the preloaded documents, the Shell fixture and the AIE dataset. Answers cite their sources and say plainly when the answer is not in the data."
          />
          <span className="rounded bg-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">
            Scripted sample mode (no API key)
          </span>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="py-6 text-center">
              <p className="measure text-[13px] text-muted">
                Ask about the vendor decision, regulation, talent or delivery.
                Answers come only from the grounded sources.
              </p>
              <div className="mx-auto mt-3 grid max-w-lg grid-cols-1 gap-2 @xl:grid-cols-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-full border border-base-300 px-3 py-2 text-[12px] transition hover:border-primary hover:text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-white"
                      : "border border-base-300 bg-base-200/60"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.meta ? (
                    <div className="mt-2 border-t border-base-300 pt-1.5">
                      <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        {m.meta.tiers.map((t) => `${t.tier}: ${t.role} (${t.mode})`).join(" · ")}
                      </p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-muted">
                        ~{m.meta.tokens} tokens indicative · mode: {m.meta.mode}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {busy ? (
            <p className="font-mono text-[11px] text-muted">Analysing grounded sources...</p>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-base-300 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void ask(input);
              }}
              placeholder="Ask the AI Analyst..."
              className="flex-1 rounded-full border border-base-300 bg-base-100 px-4 py-2 text-[13px] outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => ask(input)}
              className="rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Ask
            </button>
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => ask(input, true)}
              title="Runs the Opus tier. Never automatic: deep analysis costs materially more per question."
              className="rounded-full border border-primary px-3 py-2 text-[12px] font-semibold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
            >
              Run deep analysis
            </button>
          </div>
          <p className="measure mt-1.5 font-mono text-[9.5px] text-muted">
            Tiered routing: Haiku classifies and retrieves, Sonnet synthesises,
            Opus only behind the deep-analysis button (cost note applies).
          </p>
        </div>
      </section>

      {/* Grounding column */}
      <aside className="space-y-3">
        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <div className="flex items-center justify-between">
            <MicroLabel label="Grounding sources" tooltip="Priority order: your uploads, preloaded documents, the Shell fixture, the AIE dataset." />
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[12px]">
            <li>Your uploads ({uploads.length})</li>
            <li>Preloaded documents ({preloaded.length})</li>
            <li>Shell fixture context <LaneBadge lane="sample" /></li>
            <li>AIE dataset <LaneBadge lane="aie" /></li>
          </ol>
        </div>

        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <MicroLabel label="Preloaded documents" tooltip="Three sample documents ship with the demo so it works with zero uploads." />
          <ul className="mt-2 space-y-1.5">
            {preloaded.map((d) => (
              <li key={d} className="flex items-center gap-2 text-[12px]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><path d="M14 3v5h5M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg>
                {d}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-base-300 bg-base-100 p-3">
          <MicroLabel label="Upload documents" tooltip="PDF, DOCX, TXT or MD. Max 10 MB each, max 5 files. Validated server-side, held in memory for this session only." />
          <label className="mt-2 flex cursor-pointer items-center justify-center rounded border border-dashed border-base-300 px-3 py-4 text-[12px] text-muted transition hover:border-primary hover:text-primary">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
            Choose files (PDF, DOCX, TXT, MD)
          </label>
          {uploadError ? (
            <p className="mt-1.5 text-[11px] text-error">{uploadError}</p>
          ) : null}
          {uploads.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {uploads.map((u) => (
                <li key={u.name} className="flex items-center justify-between text-[11.5px]">
                  <span className="truncate">{u.name}</span>
                  <span className="ml-2 shrink-0 font-mono text-[9.5px] text-muted">
                    {u.parsed ? "parsed" : "listed (parse on live mode)"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { analystApiKey, approxTokens, buildCorpus, retrieve } from "./lib";

// AI Analyst answer route (spec Section 8). With no ANTHROPIC_API_KEY the
// panel runs in scripted sample mode: extractive answers assembled only
// from grounded chunks, clearly badged, no model call, no generated figure.
// With a key present the same grounding flows into tiered live calls
// (Haiku classify and retrieve, Sonnet synthesise, Opus only behind the
// explicit deep-analysis button).

export async function POST(request: NextRequest) {
  let body: { question?: string; deep?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }
  const question = (body.question ?? "").trim();
  if (!question || question.length > 2000) {
    return NextResponse.json(
      { success: false, error: "Question is required (max 2000 chars)", code: "BAD_QUESTION" },
      { status: 400 }
    );
  }

  const sid = request.cookies.get("eai_sid")?.value ?? "anon";
  const corpus = await buildCorpus(sid);
  const hits = retrieve(corpus, question, body.deep ? 6 : 4);

  const live = Boolean(await analystApiKey());
  if (!live) {
    // Scripted sample mode: extractive answer with citations.
    let answer: string;
    if (hits.length === 0) {
      answer =
        "That answer is not in the grounded sources (uploads, the preloaded documents, the Shell fixture or the AIE dataset). Rather than guess, I am saying so plainly. Try rephrasing towards vendor assessment, regulation, talent or delivery.";
    } else {
      const intro = body.deep
        ? "Deep scripted read of the grounded sources on that question:"
        : "From the grounded sources:";
      answer =
        intro +
        "\n\n" +
        hits
          .map((h, i) => `${i + 1}. "${h.chunk.text}" (${h.chunk.source})`)
          .join("\n\n") +
        "\n\nEach numbered extract cites its source directly; nothing above is generated.";
    }
    const tiers = [
      { tier: "Haiku", role: "query classification and retrieval", mode: "scripted" },
      {
        tier: body.deep ? "Opus" : "Sonnet",
        role: body.deep ? "deep analysis (explicit request)" : "answer synthesis",
        mode: "scripted",
      },
    ];
    return NextResponse.json({
      success: true,
      mode: "scripted",
      answer,
      citations: hits.map((h) => ({ source: h.chunk.source, kind: h.chunk.sourceKind })),
      tiers,
      tokens: approxTokens(answer),
      note: "Scripted sample mode: no ANTHROPIC_API_KEY set. Answers are extractive quotes from grounded sources only.",
    });
  }

  // Live mode: tiered Anthropic calls, streamed as SSE.
  const key = await analystApiKey();
  const { liveAnswer } = await import("./live");
  return liveAnswer(key as string, question, corpus, Boolean(body.deep));
}

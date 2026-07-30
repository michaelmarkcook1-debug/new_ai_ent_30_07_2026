import { NextRequest, NextResponse } from "next/server";
import { analystApiKey, approxTokens } from "../analyst/lib";
import {
  interrogateCorpus,
  nextQuestion,
  scriptedFinding,
  type InterrogateState,
} from "./lib";

// Interrogate answer route. POST body: { situation, answers[], depth }.
// Returns either the next sharp question or the tailored finding. Scripted
// sample mode runs with no key; live mode routes Haiku for question
// selection and Sonnet for the finding (streamed as SSE by ./live).

export async function POST(request: NextRequest) {
  let body: {
    situation?: string;
    answers?: string[];
    depth?: string;
    conclude?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const situation = (body.situation ?? "").trim();
  if (!situation || situation.length > 4000) {
    return NextResponse.json(
      { success: false, error: "Situation is required (max 4000 chars)", code: "BAD_SITUATION" },
      { status: 400 }
    );
  }
  const state: InterrogateState = {
    situation,
    answers: (body.answers ?? []).map((a) => String(a).slice(0, 2000)),
    depth: body.depth === "comprehensive" ? "comprehensive" : "quick",
  };

  const sid = request.cookies.get("eai_sid")?.value ?? "anon";
  const live = Boolean(await analystApiKey());

  if (live) {
    const { liveInterrogate } = await import("./live");
    return liveInterrogate(
      (await analystApiKey()) as string,
      state,
      sid,
      Boolean(body.conclude)
    );
  }

  // Scripted sample mode.
  const question = body.conclude ? null : nextQuestion(state);
  if (question) {
    return NextResponse.json({
      success: true,
      mode: "scripted",
      type: "question",
      question,
      asked: state.answers.length + 1,
      tiers: [{ tier: "Haiku", role: "facet detection and question selection", mode: "scripted" }],
      note: "Scripted sample mode: no ANTHROPIC_API_KEY set. Questions come from a curated bank keyed to what your answers have not yet covered.",
    });
  }

  const corpus = await interrogateCorpus(sid);
  const { finding, citations } = scriptedFinding(state, corpus);
  return NextResponse.json({
    success: true,
    mode: "scripted",
    type: "finding",
    finding,
    citations,
    tiers: [
      { tier: "Haiku", role: "facet detection and retrieval", mode: "scripted" },
      { tier: "Sonnet", role: "finding synthesis", mode: "scripted" },
    ],
    tokens: approxTokens(finding),
    links: [
      { label: "Vendor rankings", href: "/vendor-view" },
      { label: "Trust Rank", href: "/trust-rank" },
      { label: "Assess and Decide", href: "/assess-decide" },
    ],
  });
}

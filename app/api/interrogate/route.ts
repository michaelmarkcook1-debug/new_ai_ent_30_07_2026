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

/**
 * The saved position, rebuilt from whatever the client sent.
 *
 * The client clamps this too, and that is not the point: this text is pasted
 * into a model prompt, so the only clamp that counts is the one on this side of
 * the wire. Fields are taken one at a time rather than spread, lengths are
 * fixed here, and anything unrecognised is dropped rather than forwarded.
 *
 * Content is NOT trusted merely because it arrived. It originates in retrieved
 * web pages, so live.ts frames it as the reader's own prior research and tells
 * the model to treat it as claims to weigh, never as instructions to follow.
 */
function sanitisePosition(raw: unknown): InterrogateState["position"] {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";
  const list = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x) => typeof x === "string").slice(0, 6).map((x) => (x as string).slice(0, 400))
      : [];

  const name = str(p.name, 120).trim();
  if (!name) return null;
  return {
    name,
    industry: str(p.industry, 200),
    what: str(p.what, 400),
    aiFindings: list(p.aiFindings),
    findings: list(p.findings),
  };
}

export async function POST(request: NextRequest) {
  let body: {
    situation?: string;
    answers?: string[];
    depth?: string;
    conclude?: boolean;
    position?: unknown;
    asked?: unknown;
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
    // The questions already put, so the engine does not repeat itself.
    asked: Array.isArray(body.asked)
      ? body.asked
          .filter((q): q is string => typeof q === "string")
          .slice(0, 6)
          .map((q) => q.slice(0, 500))
      : [],
    position: sanitisePosition(body.position),
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
      { label: "Your three vendors, and what next", href: "/decision-desk?tool=shortlist" },
      // /assess-decide was folded into the Decision Desk on 3 August 2026 and
      // this link was still pointing at the old route.
      { label: "Score it against your weights", href: "/decision-desk?tool=assess" },
      { label: "Trust Rank", href: "/trust-rank" },
      { label: "Vendor rankings", href: "/vendor-view" },
    ],
  });
}

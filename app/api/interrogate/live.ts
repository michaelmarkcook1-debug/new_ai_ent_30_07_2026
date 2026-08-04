import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "../analyst/lib";
import {
  detectFacets,
  interrogateCorpus,
  nextQuestion,
  type InterrogateState,
} from "./lib";

// Live Interrogate. Haiku decides whether another sharp question is needed
// and writes it; the finding is streamed as SSE, grounded only in the cited
// chunks. The same grounding rule as the analyst applies: no figure or claim
// outside the sources.

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-5";
const OPUS = "claude-opus-5";

// What this workspace can actually answer.
//
// The question phase used to see the situation and the answers and nothing
// else, so it was shaping questions without knowing what the product could do
// with them. A sharper model asking into ground the corpus does not cover is
// still a wasted turn, which is why this list matters more than the tier that
// reads it.
//
// Deliberately not the corpus itself. Loading it here would put an upstream
// fetch in front of the one screen the user is actively waiting on; the
// finding phase already pays that cost, where streaming hides it.
const WORKSPACE_COVERS = [
  "vendor capability scores, evidence-graded, comparable only within a market category",
  "AI regulation by jurisdiction, including the EU AI Act, with the obligations that bind a given deployment",
  "published model prices against independent benchmark scores, and the efficiency frontier",
  "security posture and open risks per vendor",
  "reputation across customer, developer and employee pillars",
  "supply and partnership dependencies across the stack",
  "role and workflow to model-tier fit, with the cost of running it",
].join("; ");

export async function liveInterrogate(
  apiKey: string,
  state: InterrogateState,
  sid: string,
  conclude: boolean
): Promise<Response> {
  const client = new Anthropic({ apiKey });
  const maxQuestions = state.depth === "quick" ? 1 : 3;

  // Question phase: Haiku, JSON response, bounded by the depth setting.
  if (!conclude && state.answers.length < maxQuestions) {
    const scriptedFallback = nextQuestion(state);
    // What the buyer has already told us, so the question never asks again.
    // Cheap and local: string matching over what they typed, no model call.
    const facets = detectFacets([state.situation, ...state.answers].join("\n"));
    const known = [
      facets.industry ? `industry: ${facets.industry}` : null,
      facets.scale ? "scale: stated" : null,
      facets.constraint ? `binding constraint: ${facets.constraint}` : null,
      facets.stack.length > 0 ? `existing stack: ${facets.stack.join(", ")}` : null,
    ].filter(Boolean);
    const missing = [
      facets.industry ? null : "industry and regulatory context",
      facets.scale ? null : "scale of the deployment",
      facets.constraint ? null : "the binding constraint",
      facets.stack.length > 0 ? null : "what is already in the estate",
    ].filter(Boolean);

    try {
      const res = await client.messages.create({
        model: HAIKU,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              `You are interrogating an enterprise AI buyer to shape a tailored finding.`,
              ``,
              `Their situation: "${state.situation}"`,
              `Their answers so far: ${JSON.stringify(state.answers)}`,
              ``,
              `Already established, do not ask again: ${known.length ? known.join("; ") : "nothing yet"}.`,
              `Still unknown: ${missing.length ? missing.join("; ") : "nothing material"}.`,
              ``,
              `The finding will be written only from what this workspace holds: ${WORKSPACE_COVERS}.`,
              `So ask about something that changes which of those the finding draws on, or how it reads them. A question whose answer the workspace cannot act on is a wasted turn.`,
              ``,
              `If one more sharp, nuanced question would materially improve the finding, return {"ask": "<the question>"}. If you have enough, return {"ask": null}. JSON only. The question must be specific to what they said, never generic.`,
            ].join("\n"),
          },
        ],
      });
      const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
      const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
      if (parsed.ask && typeof parsed.ask === "string") {
        return Response.json({
          success: true,
          mode: "live",
          type: "question",
          question: parsed.ask,
          asked: state.answers.length + 1,
          tiers: [
            {
              tier: "Haiku",
              role: "question shaping",
              mode: "live",
              tokens: res.usage.input_tokens + res.usage.output_tokens,
            },
          ],
        });
      }
    } catch {
      if (scriptedFallback) {
        return Response.json({
          success: true,
          mode: "live",
          type: "question",
          question: scriptedFallback,
          asked: state.answers.length + 1,
          tiers: [{ tier: "Haiku", role: "question shaping (fallback bank)", mode: "live" }],
        });
      }
    }
  }

  // Finding phase: Sonnet, streamed.
  const corpus = await interrogateCorpus(sid);
  const combined = [state.situation, ...state.answers].join("\n");
  const hits = retrieve(corpus, combined, 8);
  const grounding = hits
    .map((h, i) => `<chunk index="${i + 1}" source="${h.chunk.source}">${h.chunk.text}</chunk>`)
    .join("\n");

  // The finding is the output a buyer actually reads and judges, so it is the
  // one place a stronger model earns its cost. Comprehensive gets Opus.
  //
  // Tied to the depth control rather than always on, for two reasons. The
  // product's stated rule is that Opus never runs without an explicit deep
  // request, and Comprehensive is that request, chosen by the reader. And the
  // demo is a public URL spending a single key, so the expensive path should
  // be the one somebody asked for rather than the default on every click.
  const deep = state.depth === "comprehensive";
  const synthModel = deep ? OPUS : SONNET;
  const synthTier = deep ? "Opus" : "Sonnet";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        send({
          type: "meta",
          citations: hits.map((h) => ({ source: h.chunk.source, kind: h.chunk.sourceKind })),
        });
        const synth = client.messages.stream({
          model: synthModel,
          max_tokens: 2048,
          system: `You are the Interrogate engine in the AI Enterprise demo: you write a tailored, source-cited finding for an enterprise AI buyer. Ground EVERY claim in the chunks provided, citing the source name in brackets after the claim. Where the chunks do not cover something, say so plainly rather than guessing; never invent a figure. Structure: a one-paragraph reading of their situation, then the finding with citations, then one line pointing to the vendor rankings, Trust Rank, and Assess and Decide pages in this workspace. British English. No em-dashes: use commas, colons or parentheses.`,
          messages: [
            {
              role: "user",
              content: `Buyer situation: ${state.situation}\n\nTheir answers to your questions: ${JSON.stringify(state.answers)}\n\nGrounded chunks:\n${grounding}`,
            },
          ],
        });
        for await (const event of synth) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "delta", text: event.delta.text });
          }
        }
        const final = await synth.finalMessage();
        send({
          type: "done",
          mode: "live",
          tiers: [
            { tier: "Haiku", role: "question shaping", mode: "live" },
            {
              tier: synthTier,
              role: "finding synthesis",
              mode: "live",
              tokens: final.usage.input_tokens + final.usage.output_tokens,
            },
          ],
          tokens: final.usage.input_tokens + final.usage.output_tokens,
          links: [
            { label: "Vendor rankings", href: "/vendor-view" },
            { label: "Trust Rank", href: "/trust-rank" },
            { label: "Assess and Decide", href: "/assess-decide" },
          ],
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Anthropic.APIError ? `${err.status}: ${err.name}` : "Live Interrogate call failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
  });
}

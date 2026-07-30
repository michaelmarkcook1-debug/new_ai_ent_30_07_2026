import Anthropic from "@anthropic-ai/sdk";
import { retrieve } from "../analyst/lib";
import {
  interrogateCorpus,
  nextQuestion,
  type InterrogateState,
} from "./lib";

// Live Interrogate (runs only when ANTHROPIC_API_KEY is set in .env.local).
// Haiku decides whether another sharp question is needed and writes it;
// Sonnet writes the tailored finding, streamed as SSE, grounded only in the
// cited chunks. The same grounding rule as the analyst applies: no figure
// or claim outside the sources.

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-5";

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
    try {
      const res = await client.messages.create({
        model: HAIKU,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `You are interrogating an enterprise AI buyer to shape a tailored finding. Their situation: "${state.situation}". Their answers so far: ${JSON.stringify(state.answers)}. If one more sharp, nuanced question would materially improve the finding, return {"ask": "<the question>"}. If you have enough, return {"ask": null}. JSON only. The question must be specific to what they said, never generic.`,
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
          model: SONNET,
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
              tier: "Sonnet",
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

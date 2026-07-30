import Anthropic from "@anthropic-ai/sdk";
import type { Chunk } from "./lib";
import { retrieve } from "./lib";

// Live tiered analyst (spec Section 8), used only when ANTHROPIC_API_KEY is
// set in .env.local. Routing, demonstrated visibly in the UI:
//   Haiku tier: query classification plus chunk selection (cheap, fast)
//   Sonnet tier: answer synthesis for interactive questions (default)
//   Opus tier: only behind the explicit deep-analysis button
// Grounding rule: answer only from the sources, cite chunks, say plainly
// when the answer is not in the data, never invent figures.

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-5";
const OPUS = "claude-opus-5";

interface TierRecord {
  tier: string;
  role: string;
  mode: string;
  tokens?: number;
}

export async function liveAnswer(
  apiKey: string,
  question: string,
  corpus: Chunk[],
  deep: boolean
): Promise<Response> {
  const client = new Anthropic({ apiKey });

  // Candidate chunks from keyword retrieval, refined by the Haiku tier.
  const candidates = retrieve(corpus, question, 10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const tiers: TierRecord[] = [];
      try {
        // Haiku tier: classify the query and select grounding chunks.
        let selected = candidates.map((c) => c.chunk);
        if (candidates.length > 0) {
          const listing = candidates
            .map((c, i) => `[${i}] (${c.chunk.source}) ${c.chunk.text.slice(0, 240)}`)
            .join("\n");
          const haiku = await client.messages.create({
            model: HAIKU,
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: `Question: ${question}\n\nCandidate grounding chunks:\n${listing}\n\nReturn JSON only: {"topic": "<one of: vendor-assessment, regulation, talent, delivery, market, other>", "chunkIndices": [<indices of the chunks that genuinely help answer, max 5>]}`,
              },
            ],
          });
          const text = haiku.content.find((b) => b.type === "text")?.text ?? "{}";
          try {
            const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
            if (Array.isArray(parsed.chunkIndices) && parsed.chunkIndices.length > 0) {
              selected = parsed.chunkIndices
                .filter((i: unknown): i is number => typeof i === "number" && i >= 0 && i < candidates.length)
                .map((i: number) => candidates[i].chunk);
            }
          } catch {
            // keep keyword-ranked selection when Haiku's JSON does not parse
          }
          tiers.push({
            tier: "Haiku",
            role: "query classification and retrieval",
            mode: "live",
            tokens: haiku.usage.input_tokens + haiku.usage.output_tokens,
          });
        } else {
          tiers.push({ tier: "Haiku", role: "query classification and retrieval", mode: "live", tokens: 0 });
        }

        send({
          type: "meta",
          citations: selected.map((c) => ({ source: c.source, kind: c.sourceKind })),
        });

        if (selected.length === 0) {
          send({
            type: "delta",
            text: "That answer is not in the grounded sources (uploads, preloaded documents, the Shell fixture or the AIE dataset). Rather than guess, I am saying so plainly.",
          });
          send({ type: "done", tiers, tokens: tiers.reduce((n, t) => n + (t.tokens ?? 0), 0), mode: "live" });
          controller.close();
          return;
        }

        // Synthesis tier: Sonnet by default, Opus only for explicit deep runs.
        const model = deep ? OPUS : SONNET;
        const grounding = selected
          .map((c, i) => `<chunk index="${i + 1}" source="${c.source}">${c.text}</chunk>`)
          .join("\n");
        const synth = client.messages.stream({
          model,
          max_tokens: deep ? 4096 : 2048,
          system: `You are the AG AI Analyst inside the New AI.Ent demo. Answer ONLY from the grounded chunks provided. Cite the source name in brackets after each claim, like [Shell AI vendor assessment brief (sample)]. If the chunks do not contain the answer, say plainly that the answer is not in the grounded sources; never guess and never invent a figure. British English. No em-dashes: use commas, colons or parentheses. Keep answers focused and concise.`,
          messages: [
            {
              role: "user",
              content: `Grounded chunks:\n${grounding}\n\nQuestion: ${question}`,
            },
          ],
        });
        for await (const event of synth) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send({ type: "delta", text: event.delta.text });
          }
        }
        const final = await synth.finalMessage();
        tiers.push({
          tier: deep ? "Opus" : "Sonnet",
          role: deep ? "deep analysis (explicit request)" : "answer synthesis",
          mode: "live",
          tokens: final.usage.input_tokens + final.usage.output_tokens,
        });
        send({
          type: "done",
          tiers,
          tokens: tiers.reduce((n, t) => n + (t.tokens ?? 0), 0),
          mode: "live",
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Anthropic.APIError ? `${err.status}: ${err.name}` : "Live analyst call failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

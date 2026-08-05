import { NextRequest } from "next/server";
import { researchCompany, type ResearchStage } from "@/lib/research/company";
import { positionInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";
import { loadPulseMetrics } from "@/app/(ai-ent)/pulse/data";

// Company research, streamed, so the wheel shows something true.
//
// The first version of this held jobs in a module-level Map and polled for
// them. On Vercel that does not work and the failure is total: every poll
// lands on whichever instance is free, the job is never found, and the wheel
// spins forever starting runs it can never see again. Measured, not assumed.
//
// So progress is streamed down the request that is doing the work. Each stage
// emits as it begins, which means the percentage is a report rather than an
// animation. The client holds the finished result, which is what makes leaving
// the tab safe: coming back reads it from the browser instead of paying for
// the research again.
//
// What this does not survive is leaving mid-run, because the work lives in the
// request. Surviving that needs the job in Postgres, which the catalogue
// already uses and which needs a service key this app is not given. That is
// the next step and it is a real one, not a shrug.

const PERCENT: Record<ResearchStage, number> = {
  "searching-business": 20,
  "searching-ai": 40,
  reading: 65,
  "reading-retry": 85,
};

const LABEL: Record<ResearchStage, string> = {
  "searching-business": "Searching public sources",
  "searching-ai": "Searching for AI evidence",
  reading: "Reading what came back",
  "reading-retry": "Narrowing the read",
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  if (company.length < 2) {
    return new Response(
      JSON.stringify({ error: "Name a company to research" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ percent: 5, label: "Starting", done: false });
      try {
        const result = await researchCompany(company, (stage) =>
          send({ percent: PERCENT[stage], label: LABEL[stage], done: false })
        );

        // The reading that sets this company against the tracked market. It
        // travels in the same stream rather than in a second request, so the
        // findings and the interpretation of them arrive together.
        let insight = null;
        if (result.profile) {
          send({ percent: 92, label: "Reading it against the market", done: false });
          const [metrics, news] = await Promise.all([
            loadPulseMetrics(),
            analystNews(),
          ]);
          const written = await authorInsight(
            positionInsight(
              metrics,
              { movedSignals: 0, watchedVendors: 0 },
              pickNews(news.items, { minImpact: 70 })
            ),
            "market position",
            metrics.vendors.slice(0, 12).map((v) => v.name),
            {
              label: `${result.profile.name} (${result.profile.industry})`,
              facts: [
                result.profile.what,
                ...result.findings.map((f) => f.statement),
                ...result.aiFindings.map((f) => f.statement),
              ].filter(Boolean),
            }
          );
          insight = { data: written.value, authorship: written.authorship };
        }

        send({ percent: 100, label: "Done", done: true, result, insight });
      } catch {
        send({
          percent: 100,
          label: "Finished without a reading",
          done: true,
          result: null,
          insight: null,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

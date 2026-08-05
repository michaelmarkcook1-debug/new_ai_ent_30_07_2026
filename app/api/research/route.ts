import { NextRequest, NextResponse } from "next/server";
import {
  startOrAttach,
  getJob,
  getJobForCompany,
  STAGE_LABEL,
  type ResearchJob,
} from "@/lib/research/jobs";

// Start a company research run, or look at one already going.
//
// POST starts or reattaches: asking twice for the same company joins the run
// in progress rather than beginning a second, which is what lets a reader
// leave the tab and come back to a finished answer instead of a fresh wait.
//
// GET reports progress. It is polled, so it stays cheap: a status read touches
// an in-process record and never the search or the model.

function shape(job: ResearchJob) {
  return {
    success: true,
    id: job.id,
    company: job.company,
    stage: job.stage,
    label: STAGE_LABEL[job.stage],
    percent: job.percent,
    done: job.stage === "done" || job.stage === "failed",
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    result: job.result,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const company = typeof body?.company === "string" ? body.company.trim() : "";
  if (company.length < 2) {
    return NextResponse.json(
      { success: false, error: "Name a company to research", code: "NO_COMPANY" },
      { status: 400 }
    );
  }
  return NextResponse.json(shape(startOrAttach(company)));
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("job");
  const company = request.nextUrl.searchParams.get("company");

  const job = id ? getJob(id) : company ? getJobForCompany(company) : null;
  if (!job) {
    // Not an error. A job this instance never held, or one that has aged out,
    // simply is not here, and the client starts a fresh run.
    return NextResponse.json({ success: true, found: false }, { status: 200 });
  }
  return NextResponse.json({ ...shape(job), found: true });
}

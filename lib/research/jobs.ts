import { researchCompany, type CompanyResearch } from "./company";

// Research that keeps running when the reader walks away.
//
// A company takes the better part of a minute: two web searches and up to two
// readings of what comes back. Awaiting that inside the page render meant the
// tab hung with nothing on it, and a reader who navigated away lost the work
// entirely and started it again on return.
//
// So the work is started, not awaited. The page gets a job id immediately, the
// browser polls for progress, and the result is held here under the company
// name. Coming back to the tab reattaches to the same job: if it finished
// while the reader was elsewhere, the answer is already waiting.
//
// The honest limit. This store lives in the server process, so a job is
// visible to the instance that started it. On a cold instance the same company
// starts a fresh run rather than finding the old one, which is correct but
// slower. Surviving that would mean putting jobs in Postgres, which the
// catalogue already uses; it is the right upgrade and it is not this change.

export type JobStage =
  | "queued"
  | "searching-business"
  | "searching-ai"
  | "reading"
  | "reading-retry"
  | "done"
  | "failed";

export interface ResearchJob {
  id: string;
  company: string;
  stage: JobStage;
  /** 0 to 100, for the wheel. Advanced as each stage begins, never faked. */
  percent: number;
  startedAt: number;
  finishedAt: number | null;
  result: CompanyResearch | null;
}

const STAGE_PERCENT: Record<JobStage, number> = {
  queued: 5,
  "searching-business": 20,
  "searching-ai": 40,
  reading: 65,
  "reading-retry": 85,
  done: 100,
  failed: 100,
};

export const STAGE_LABEL: Record<JobStage, string> = {
  queued: "Starting",
  "searching-business": "Searching public sources",
  "searching-ai": "Searching for AI evidence",
  reading: "Reading what came back",
  "reading-retry": "Narrowing the read",
  done: "Done",
  failed: "Finished without a reading",
};

// Two hours: long enough that a reader who leaves the tab and returns after a
// meeting still finds their answer, short enough not to serve stale research.
const TTL_MS = 2 * 60 * 60 * 1000;

const jobs = new Map<string, ResearchJob>();
const byCompany = new Map<string, string>();

const keyOf = (company: string) => company.trim().toLowerCase();

function sweep(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.startedAt > TTL_MS) {
      jobs.delete(id);
      if (byCompany.get(keyOf(job.company)) === id) {
        byCompany.delete(keyOf(job.company));
      }
    }
  }
}

function advance(job: ResearchJob, stage: JobStage): void {
  job.stage = stage;
  job.percent = STAGE_PERCENT[stage];
}

/**
 * The job for this company, starting one if none is running or finished.
 *
 * Returning the existing job rather than starting a second is what makes
 * navigating away safe: the tab reattaches instead of duplicating the work.
 */
export function startOrAttach(company: string): ResearchJob {
  sweep();
  const key = keyOf(company);
  const existingId = byCompany.get(key);
  const existing = existingId ? jobs.get(existingId) : undefined;
  if (existing) return existing;

  const id = `${key.replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${jobs.size}-${Date.now().toString(36)}`;
  const job: ResearchJob = {
    id,
    company: company.trim(),
    stage: "queued",
    percent: STAGE_PERCENT.queued,
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
  };
  jobs.set(id, job);
  byCompany.set(key, id);

  // Deliberately not awaited. The caller returns the job immediately and the
  // browser watches it; the work carries on in this process either way.
  void run(job);
  return job;
}

async function run(job: ResearchJob): Promise<void> {
  try {
    const result = await researchCompany(job.company, (stage) =>
      advance(job, stage)
    );
    job.result = result;
    advance(job, result.profile ? "done" : "failed");
  } catch {
    // A thrown error is still an ending, and the reader is told about it
    // rather than left on a wheel that never completes.
    job.result = null;
    advance(job, "failed");
  } finally {
    job.finishedAt = Date.now();
  }
}

export function getJob(id: string): ResearchJob | null {
  sweep();
  return jobs.get(id) ?? null;
}

export function getJobForCompany(company: string): ResearchJob | null {
  sweep();
  const id = byCompany.get(keyOf(company));
  return id ? (jobs.get(id) ?? null) : null;
}

export const PRODUCTION_DOMAIN: string;

export interface ReleaseStateFacts {
  fetched: boolean;
  branch: string | null;
  dirty: string[];
  head: string | null;
  origin: string | null;
  subject?: string;
}

export interface ReleaseStateVerdict {
  ok: boolean;
  sha: string | null;
  blockers: string[];
}

export interface StepVerdict {
  ok: boolean;
  blockers: string[];
}

export interface ExportedRelease {
  dir: string;
  files: number;
  cleanup: () => void | Promise<void>;
}

export interface VerifyResult extends StepVerdict {
  deploymentId: string | null;
  url?: string;
  adminStatus?: number | null;
}

export interface ReleaseResult {
  ok: boolean;
  steps: string[];
  deployed: boolean;
  sha?: string | null;
  step?: string;
  blockers?: string[];
  check?: boolean;
  files?: number;
  deploymentId?: string | null;
  url?: string | null;
}

export interface ReleaseDeps {
  readState?: () => Promise<ReleaseStateFacts> | ReleaseStateFacts;
  preflight?: () => Promise<StepVerdict> | StepVerdict;
  prerequisites?: () => Promise<StepVerdict> | StepVerdict;
  exportCommit?: (sha: string) => Promise<ExportedRelease> | ExportedRelease;
  deploy?: (arg: { sha: string; dir: string }) => Promise<unknown> | unknown;
  verify?: (arg: { sha: string }) => Promise<VerifyResult> | VerifyResult;
  log?: (message: string) => void;
}

export function readReleaseState(run?: (args: string[]) => string): ReleaseStateFacts;
export function decideReleaseState(facts: ReleaseStateFacts): ReleaseStateVerdict;
export function deployArgs(sha: string): string[];
export function exportRelease(sha: string, run?: (args: string[]) => string): ExportedRelease;
export function runPrerequisites(spawn?: unknown): StepVerdict;
export function parseInspect(text: string): Record<string, string>;
export function parseList(text: string): string[];
export function verifyRelease(arg: {
  sha: string;
  vercel?: (args: string[]) => string;
  fetchImpl?: typeof fetch;
  domain?: string;
}): Promise<VerifyResult>;
export function deployProduction(
  arg: { sha: string; dir: string },
  spawn?: unknown
): { url: string | null; stdout: string };
export function release(opts?: { check?: boolean }, deps?: ReleaseDeps): Promise<ReleaseResult>;

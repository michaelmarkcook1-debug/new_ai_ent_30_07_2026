export function modelFromSource(src: string): string | null;
export interface KeyCheck { status: number | null; type: string | null; message: string | null }
export interface Verdict {
  ok: boolean;
  stages: { key: string; auth: string; model: string; credit: string };
  blockers: string[];
}
export function decide(input: { hasKey: boolean; check: KeyCheck | null; model: string | null }): Verdict;
export function checkKey(apiKey: string, model: string, fetchImpl?: typeof fetch): Promise<KeyCheck>;
export function pullProductionEnv(): Promise<Record<string, string>>;
export function runPreflight(deps?: {
  pullEnv?: () => Promise<Record<string, string>> | Record<string, string>;
  fetchImpl?: typeof fetch;
  source?: () => string;
  log?: (message: string) => void;
}): Promise<Verdict & { model: string | null; check: KeyCheck | null }>;

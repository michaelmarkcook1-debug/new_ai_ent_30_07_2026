export function modelFromSource(src: string): string | null;
export function decide(input: {
  hasKey: boolean;
  keyStatus: number | null;
  hasCronSecret: boolean;
  model: string | null;
}): { ok: boolean; blockers: string[] };
export function checkKey(apiKey: string, model: string, fetchImpl?: typeof fetch): Promise<number>;

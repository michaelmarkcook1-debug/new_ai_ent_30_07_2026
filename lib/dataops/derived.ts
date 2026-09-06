import { execFileSync } from "node:child_process";
import type { DerivedStep } from "./ingest";

// The three artefacts derived from the canonical payloads, regenerated the
// same way scripts/sync-aie-fixtures.mjs regenerates them after a sync.
// Server-side, on an operator's checkout only: the store refuses to write on
// Vercel before this is ever reached.

export async function runDerivedArtefacts(cwd: string = process.cwd()): Promise<DerivedStep[]> {
  const steps: DerivedStep[] = [];
  const run = (step: string, cmd: string, args: string[], env: Record<string, string> = {}) => {
    try {
      const out = execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 180_000 });
      steps.push({ step, ok: true, output: out.trim().split("\n").slice(-3).join(" | ") });
    } catch (err) {
      steps.push({ step, ok: false, output: err instanceof Error ? err.message.split("\n")[0] : String(err) });
    }
  };
  run("lib/aie/vendor-directory.ts", "node", ["--import", "./scripts/alias-hook.mjs", "scripts/generate-vendor-directory.mjs"]);
  run("fixtures/signal-snapshot.json + signal-changes.json", "node", ["--import", "./scripts/alias-hook.mjs", "scripts/snapshot-signals.mjs"]);
  run("reports/scorecard-ledger.json", "npx", ["vitest", "run", "tests/scorecard-ledger.test.ts"], { WRITE_LEDGER: "1" });
  return steps;
}

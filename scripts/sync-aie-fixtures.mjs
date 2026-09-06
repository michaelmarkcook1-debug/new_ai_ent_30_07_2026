// Re-pulls every AIE fixture from the live API and reports what moved.
//
// Two things this deliberately does NOT do:
//
//   1. It does not overwrite a fixture with a payload that is older than the
//      one on disk. The pricing endpoint answers on request but serves a
//      capture dated 2026-06-02 whatever day it is asked, so "re-pull" and
//      "refresh" are not the same thing. Writing an older capture over a newer
//      one because the request succeeded would lose data.
//
//   2. It does not report a sync as successful when the payload came back
//      identical. A source that has not moved is a finding worth printing, not
//      a no-op to hide.
//
// Usage:  node scripts/sync-aie-fixtures.mjs
//         node scripts/sync-aie-fixtures.mjs --dry

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
// The endpoint list lives in lib/dataops/sources.ts since 6 September 2026,
// shared with the Data Operations discovery; this script is run through the
// alias hook (npm run sync:aie) so it can import it.
import { ENDPOINT_OF, SCRIPT_CAPTURED } from "@/lib/dataops/sources";

const BASE =
  process.env.AIE_BASE ?? "https://newaient30072026.vercel.app/api/aie";
const DRY = process.argv.includes("--dry");

const MAP = ENDPOINT_OF;
const NO_ENDPOINT = SCRIPT_CAPTURED;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const dateIn = (o) =>
  o?.capturedAt ?? o?.asOf ?? o?.generatedAt ?? o?.provenance?.capturedAt ?? null;

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
    } catch {
      /* retried */
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}

const day = (v) => (typeof v === "string" ? v.slice(0, 10) : null);

let changed = 0,
  same = 0,
  failed = 0,
  refused = 0;

for (const [file, endpoint] of Object.entries(MAP)) {
  const path = `fixtures/aie-live/${file}`;
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  const beforeObj = before ? JSON.parse(before) : null;

  const fresh = await getJson(`${BASE}/${endpoint}`);
  if (!fresh) {
    console.error(`  FAILED   ${file.padEnd(24)} no answer from ${endpoint}`);
    failed += 1;
    continue;
  }

  const beforeDate = day(dateIn(beforeObj));
  const afterDate = day(dateIn(fresh));

  // Never write an older capture over a newer one.
  if (beforeDate && afterDate && afterDate < beforeDate) {
    console.error(
      `  REFUSED  ${file.padEnd(24)} API serves ${afterDate}, disk holds ${beforeDate}. Keeping disk.`
    );
    refused += 1;
    continue;
  }

  const next = JSON.stringify(fresh, null, 1);
  if (before && hash(before) === hash(next)) {
    console.error(
      `  same     ${file.padEnd(24)} unchanged${afterDate ? ` (capture ${afterDate})` : ""}`
    );
    same += 1;
    continue;
  }

  if (!DRY) writeFileSync(path, next);
  console.error(
    `  UPDATED  ${file.padEnd(24)} ${beforeDate ?? "?"} -> ${afterDate ?? "?"}`
  );
  changed += 1;
}

console.error("");
for (const [file, how] of Object.entries(NO_ENDPOINT)) {
  const path = `fixtures/aie-live/${file}`;
  const d = existsSync(path) ? day(dateIn(JSON.parse(readFileSync(path, "utf8")))) : null;
  console.error(
    `  no endpoint  ${file.padEnd(24)} ${how}${d ? `, holds ${d}` : ""}`
  );
}

console.error(
  `\n${changed} updated, ${same} unchanged, ${refused} refused as older, ${failed} failed${DRY ? "  (dry run, nothing written)" : ""}`
);

// Two artefacts are derived from the fixtures and go stale silently if they
// are not rebuilt with them. That is exactly how the July port drifted into
// showing 88 for a vendor the source scored 68.3, so they are regenerated
// here rather than left to be remembered.
if (!DRY && changed > 0) {
  const { execFileSync } = await import("node:child_process");
  for (const script of [
    "scripts/generate-vendor-directory.mjs",
    "scripts/snapshot-signals.mjs",
  ]) {
    try {
      // --import the alias hook: these scripts reach into lib/, and lib/ is
      // written against the "@/" tsconfig path that plain node cannot resolve.
      // Without it snapshot-signals.mjs died on its first import and this loop
      // reported a failed sync on every otherwise-good run.
      const out = execFileSync(
        "node",
        ["--import", "./scripts/alias-hook.mjs", script],
        { encoding: "utf8" }
      );
      console.error(`\n  ran ${script}`);
      console.error(
        out.trim().split("\n").map((l) => `    ${l}`).join("\n")
      );
    } catch (err) {
      console.error(
        `\n  FAILED ${script}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
      );
      console.error(
        "    The fixtures moved but a derived artefact did not. Run it before trusting the app."
      );
    }
  }

  // The scorecard ledger is derived from the same fixtures and is committed, so
  // it drifts the moment they move. It is regenerated by its own test under an
  // environment flag rather than by a script, which is the existing convention
  // and is left alone; what was missing was anything calling it. Without this
  // the first sync of the day left "matches the committed report" failing, and
  // a red suite after a sync is indistinguishable from a sync that broke
  // something real.
  try {
    execFileSync("npx", ["vitest", "run", "tests/scorecard-ledger.test.ts"], {
      encoding: "utf8",
      env: { ...process.env, WRITE_LEDGER: "1" },
    });
    console.error("\n  regenerated reports/scorecard-ledger.json");
  } catch (err) {
    console.error(
      `\n  FAILED to regenerate the scorecard ledger: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`
    );
  }
}

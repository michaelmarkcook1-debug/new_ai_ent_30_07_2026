#!/usr/bin/env node
// Refuse to deploy a release that production cannot author.
//
// WHAT THIS CAUGHT ALREADY, IN REVERSE. Between 2 and 3 September 2026 the
// production ANTHROPIC_API_KEY was revoked at Anthropic's end. Nothing noticed
// for two days: every build logged a 401 and shipped, every insight fell back
// to computed prose, and company research failed for every company. The
// symptom a reader saw was one word changing on a badge. This check runs
// BEFORE `vercel --prod` and answers the only three questions that matter:
// is the key there, does Anthropic accept it, and can it reach the model the
// code pins. Any "no" blocks the deploy with the reason. It never prints a
// value.
//
// It also checks CRON_SECRET exists, because since 5 September 2026 the warm
// endpoint refuses everyone, the scheduler included, when it is unset.
//
// Usage:  node scripts/preflight-production.mjs
// Runs first in `npm run deploy`. Needs the Vercel CLI logged in and the
// project linked, which the deploy step needs anyway.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The model the code pins, read from the source so this cannot drift from it. */
export function modelFromSource(src) {
  const m = src.match(/^const MODEL = "([^"]+)";/m);
  return m ? m[1] : null;
}

/** The verdict, pure so the fail-closed rule can be tested. */
export function decide({ hasKey, keyStatus, hasCronSecret, model }) {
  const blockers = [];
  if (!hasKey) {
    blockers.push("ANTHROPIC_API_KEY is not set in production");
  } else if (keyStatus === 401 || keyStatus === 403) {
    blockers.push(`ANTHROPIC_API_KEY is rejected by Anthropic (HTTP ${keyStatus}); rotate it in Vercel before deploying`);
  } else if (keyStatus === 404) {
    blockers.push(`the pinned model ${model} is not accessible to the production key (HTTP 404)`);
  } else if (keyStatus === 400) {
    // Seen 5 September 2026 on the working key: Anthropic answers 400 with
    // "credit balance is too low" once the account is out of credit. The key
    // is valid and production still cannot author a single reading.
    blockers.push("Anthropic rejected an authenticated one-token request (HTTP 400), which is what an exhausted credit balance returns; check Plans & Billing");
  } else if (keyStatus !== 200) {
    blockers.push(`the authentication check returned HTTP ${keyStatus ?? "no response"}`);
  }
  if (!hasCronSecret) {
    blockers.push("CRON_SECRET is not set in production, so /api/warm will refuse the scheduler and nothing will be kept warm");
  }
  return { ok: blockers.length === 0, blockers };
}

/** One authenticated, one-token request against the pinned model. Status only. */
export async function checkKey(apiKey, model, fetchImpl = fetch) {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ok" }] }),
    signal: AbortSignal.timeout(30_000),
  });
  return res.status;
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aie-preflight-"));
  const envFile = path.join(dir, "production.env");
  try {
    // Pulled to a private temp file that is removed in `finally`, never into
    // the repo. The values are read into memory for one request and nothing
    // here ever writes or prints one.
    execFileSync("vercel", ["env", "pull", envFile, "--environment", "production", "--yes"], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    fs.chmodSync(envFile, 0o600);
    const env = parseEnv(fs.readFileSync(envFile, "utf8"));
    const model = modelFromSource(fs.readFileSync("lib/analyst/llm.ts", "utf8"));
    const hasKey = Boolean(env.ANTHROPIC_API_KEY);
    const keyStatus = hasKey ? await checkKey(env.ANTHROPIC_API_KEY, model) : null;
    const hasCronSecret = Boolean(env.CRON_SECRET);

    console.log(`  model pinned in code:        ${model}`);
    console.log(`  ANTHROPIC_API_KEY present:   ${hasKey ? "yes" : "NO"}`);
    console.log(`  authenticated request:       ${keyStatus === null ? "not attempted" : `HTTP ${keyStatus}`}`);
    console.log(`  CRON_SECRET present:         ${hasCronSecret ? "yes" : "NO"}`);

    const verdict = decide({ hasKey, keyStatus, hasCronSecret, model });
    if (!verdict.ok) {
      console.error("\nDEPLOYMENT BLOCKED");
      for (const b of verdict.blockers) console.error(`  - ${b}`);
      process.exit(1);
    }
    console.log("\nPREFLIGHT PASSED: production can author with the pinned model.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === "preflight-production.mjs") {
  main().catch((err) => {
    console.error(`\nDEPLOYMENT BLOCKED: preflight could not run (${err instanceof Error ? err.message : String(err)})`);
    process.exit(1);
  });
}

#!/usr/bin/env node
// Refuse to deploy a release that production cannot author.
//
// WHAT THIS CAUGHT ALREADY, IN REVERSE. Between 2 and 3 September 2026 the
// production ANTHROPIC_API_KEY was revoked at Anthropic's end. Nothing noticed
// for two days: every build logged a 401 and shipped, every insight fell back
// to computed prose, and company research failed for every company. This
// runs BEFORE `vercel --prod` and answers the four questions that matter, in
// order: is the key there, does Anthropic accept it, can it reach the model
// the code pins, and will Anthropic serve a request on the account's credit.
// Any "no" blocks the deploy with the stage that failed. It never prints a
// value, and the whole check is one one-token request.
//
// Auth and credit are different failures and are reported as such: a
// revoked key is a 401; an exhausted balance is a 400 on a perfectly valid key
// (seen on 5 September 2026), and the fix is a different person's job.
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

/**
 * One one-token request against the pinned model. Returns what Anthropic
 * said about it: the status, and the error type and (trimmed) message when
 * there was one. Never the key, never a reading.
 */
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
  let type = null;
  let message = null;
  try {
    const j = await res.json();
    if (j && j.type === "error") {
      type = typeof j.error?.type === "string" ? j.error.type : null;
      message = typeof j.error?.message === "string" ? j.error.message.slice(0, 160) : null;
    }
  } catch {
    // A body that is not JSON carries nothing this needs.
  }
  return { status: res.status, type, message };
}

/**
 * The verdict, stage by stage, pure so the fail-closed rules can be tested.
 * `check` is what checkKey returned, or null when no key was present.
 */
export function decide({ hasKey, check, model }) {
  const stages = { key: hasKey ? "ok" : "missing", auth: "not checked", model: "not checked", credit: "not checked" };
  const blockers = [];
  if (!hasKey) {
    blockers.push("ANTHROPIC_API_KEY is not set in production");
    return { ok: false, stages, blockers };
  }
  const { status = null, type = null, message = null } = check ?? {};
  if (status === 401 || status === 403 || type === "authentication_error" || type === "permission_error") {
    stages.auth = "failed";
    blockers.push(`ANTHROPIC_API_KEY is rejected by Anthropic (HTTP ${status}); rotate it in Vercel before deploying`);
    return { ok: false, stages, blockers };
  }
  stages.auth = "ok";
  if (status === 404 || type === "not_found_error") {
    stages.model = "inaccessible";
    blockers.push(`the pinned model ${model} is not accessible to the production key (HTTP ${status})`);
    return { ok: false, stages, blockers };
  }
  stages.model = "ok";
  if (status === 400 && /credit|billing|balance/i.test(message ?? "")) {
    stages.credit = "blocked";
    blockers.push(`authenticated, but Anthropic refused the request on credit: ${message}`);
    return { ok: false, stages, blockers };
  }
  if (status === 200) {
    stages.credit = "ok";
    return { ok: true, stages, blockers };
  }
  stages.credit = "unknown";
  blockers.push(`the one-token request returned HTTP ${status ?? "no response"}${type ? ` (${type})` : ""}`);
  return { ok: false, stages, blockers };
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
    // the repo. The value is read into memory for one request and nothing
    // here ever writes or prints it.
    execFileSync("vercel", ["env", "pull", envFile, "--environment", "production", "--yes"], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    fs.chmodSync(envFile, 0o600);
    const env = parseEnv(fs.readFileSync(envFile, "utf8"));
    const model = modelFromSource(fs.readFileSync("lib/analyst/llm.ts", "utf8"));
    const hasKey = Boolean(env.ANTHROPIC_API_KEY);
    const check = hasKey ? await checkKey(env.ANTHROPIC_API_KEY, model) : null;
    const verdict = decide({ hasKey, check, model });

    console.log(`  key present:              ${verdict.stages.key}`);
    console.log(`  authentication:           ${verdict.stages.auth}`);
    console.log(`  model access (${model}): ${verdict.stages.model}`);
    console.log(`  credit:                   ${verdict.stages.credit}`);
    if (check) console.log(`  one-token request:        HTTP ${check.status}${check.type ? ` (${check.type})` : ""}`);

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

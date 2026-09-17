#!/usr/bin/env node
// The one way AI Enterprise reaches production.
//
// WHAT CHANGED ON 17 SEPTEMBER 2026. Pushing to main used to publish
// production by itself, through Vercel's GitHub integration, which meant the
// Anthropic preflight was skipped by the ordinary act of pushing code: a
// release could go out with a revoked key, an exhausted balance, or a model
// the account cannot reach. vercel.json now tells Vercel not to deploy commits
// on main, scripts/release-guard.mjs fails any production build that no
// release started, and this script is the only thing that starts one.
//
// THE ORDER IS THE POINT. Each step must pass before the next begins, and the
// free checks come before the expensive ones:
//
//   1  release state   on main, clean, and exactly the commit GitHub holds
//   2  preflight       one one-token request: key, auth, model, credit
//   3  prerequisites   typecheck and the full test suite
//   4  re-check state  nothing moved while 2 and 3 were running
//   5  export          a pristine checkout of the release commit
//   6  deploy          vercel --prod from that checkout, carrying RELEASE_SHA
//   7  verify          the production domain now serves the release
//
// WHY IT DEPLOYS FROM AN EXPORT RATHER THAN THE WORKING FOLDER. Measured on
// 17 September 2026: the repository tracks 583 files and the last CLI deploy
// uploaded 1,480. The difference is about 915 files of stale copies under
// .claude/worktrees, which git excludes through .git/info/exclude, a file the
// upload does not read. Those files are not routed, but a release has to be a
// commit and nothing else, so `git worktree` makes a clean checkout of the
// release SHA and the deploy runs from there.
//
// Usage:  npm run deploy              release to production
//         npm run deploy -- --check   every check, stopping before the deploy

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPreflight } from "./preflight-production.mjs";

export const PRODUCTION_DOMAIN = "newaient30072026.vercel.app";

const SHA = /^[0-9a-f]{40}$/;
const short = (s) => (typeof s === "string" ? s.slice(0, 7) : "?");
const git = (args, cwd = process.cwd()) => execFileSync("git", args, { cwd, encoding: "utf8" });

/** What the release state decision needs, read from git. */
export function readReleaseState(run = git) {
  let fetched = true;
  try {
    run(["fetch", "origin", "main", "--quiet"]);
  } catch {
    fetched = false;
  }
  const read = (args, fallback = null) => {
    try {
      return run(args).trim();
    } catch {
      return fallback;
    }
  };
  let dirty;
  try {
    dirty = run(["status", "--porcelain", "--untracked-files=all"]).split("\n").filter(Boolean);
  } catch {
    // Fail closed: a status we cannot read is not a clean tree.
    dirty = ["git status could not be read"];
  }
  const branch = read(["rev-parse", "--abbrev-ref", "HEAD"]);
  return {
    fetched,
    branch: branch === "HEAD" ? null : branch,
    dirty,
    head: read(["rev-parse", "HEAD"]),
    origin: fetched ? read(["rev-parse", "origin/main"]) : null,
    subject: read(["log", "-1", "--format=%s"], ""),
  };
}

/**
 * May we release from this state? Pure, and it names every reason it says no.
 * The rule is narrow on purpose: a release is one commit, on main, already on
 * GitHub, so the SHA in the report is the SHA a reader can go and look at.
 */
export function decideReleaseState({ fetched, branch, dirty, head, origin }) {
  const blockers = [];
  if (branch !== "main") {
    blockers.push(`releases are cut from main; this checkout is on ${branch ?? "a detached HEAD"}`);
  }
  if (dirty.length > 0) {
    const shown = dirty.slice(0, 3).map((l) => l.trim()).join(", ");
    blockers.push(
      `the working tree has ${dirty.length} uncommitted change${dirty.length === 1 ? "" : "s"} (${shown}${dirty.length > 3 ? ", ..." : ""}); commit or remove them, because a release is a commit`
    );
  }
  if (!SHA.test(head ?? "")) {
    blockers.push("HEAD is not a commit");
  } else if (!fetched) {
    blockers.push("origin could not be fetched, so this commit cannot be confirmed as the one GitHub holds");
  } else if (head !== origin) {
    blockers.push(
      `HEAD ${short(head)} is not origin/main ${short(origin)}; push or pull first, so the release is what GitHub holds`
    );
  }
  return { ok: blockers.length === 0, sha: blockers.length === 0 ? head : null, blockers };
}

/** The arguments that carry the release into the build and onto the record. */
export function deployArgs(sha) {
  return ["--prod", "--yes", "--build-env", `RELEASE_SHA=${sha}`, "--meta", `releaseSha=${sha}`];
}

/** A pristine checkout of the release commit, and the link file the CLI needs. */
export function exportRelease(sha, run = git) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aie-release-"));
  run(["worktree", "add", "--detach", dir, sha]);
  fs.mkdirSync(path.join(dir, ".vercel"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), ".vercel", "project.json"),
    path.join(dir, ".vercel", "project.json")
  );
  const files = run(["ls-tree", "-r", "--name-only", sha]).split("\n").filter(Boolean).length;
  return {
    dir,
    files,
    cleanup: () => {
      try {
        run(["worktree", "remove", "--force", dir]);
      } catch {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Typecheck and the full suite. Vercel builds and typechecks; it does not run tests. */
export function runPrerequisites(spawn = spawnSync) {
  for (const [name, cmd, args] of [
    ["typecheck", "npx", ["tsc", "--noEmit"]],
    ["tests", "npx", ["vitest", "run"]],
  ]) {
    const r = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"], encoding: "utf8" });
    if (r.status !== 0) return { ok: false, blockers: [`${name} failed, so nothing was deployed`] };
  }
  return { ok: true, blockers: [] };
}

export function parseInspect(text) {
  const out = {};
  for (const m of text.matchAll(/^\s+(id|url|target|status)\s+(.+)$/gm)) {
    out[m[1]] = m[2].trim().replace(/^●\s*/, "");
  }
  return out;
}

export function parseList(text) {
  return [...text.matchAll(/https:\/\/[a-z0-9.-]+\.vercel\.app/g)].map((m) => m[0]);
}

/**
 * Did the release actually become production? The deployment is found by its
 * own metadata rather than by parsing the deploy command's output, so a change
 * in what the CLI prints cannot make a failed release look like a good one.
 */
export async function verifyRelease({
  sha,
  vercel = (args) => execFileSync("vercel", args, { encoding: "utf8" }),
  fetchImpl = fetch,
  domain = PRODUCTION_DOMAIN,
}) {
  const urls = parseList(vercel(["ls", "--prod", "-m", `releaseSha=${sha}`]));
  if (urls.length === 0) {
    return { ok: false, blockers: [`no production deployment carries releaseSha=${sha}`], deploymentId: null };
  }
  const url = urls[0];
  const deployment = parseInspect(vercel(["inspect", url]));
  const live = parseInspect(vercel(["inspect", domain]));
  const blockers = [];
  if (deployment.status !== "Ready") blockers.push(`the release deployment is ${deployment.status ?? "in an unknown state"}`);
  if (deployment.target !== "production") blockers.push(`the release deployment targets ${deployment.target ?? "nothing"}`);
  if (live.id !== deployment.id) {
    blockers.push(
      `${domain} still serves ${live.id ?? "an unknown deployment"} rather than the release ${deployment.id ?? "?"}. After a rollback Vercel stops assigning the domain automatically; promote this deployment to undo that.`
    );
  }
  let adminStatus = null;
  try {
    adminStatus = (await fetchImpl(`https://${domain}/admin`, { signal: AbortSignal.timeout(30_000) })).status;
  } catch {
    adminStatus = null;
  }
  if (adminStatus !== 200) {
    blockers.push(`https://${domain}/admin answered ${adminStatus ?? "nothing"}; it is public by design and should answer 200`);
  }
  return { ok: blockers.length === 0, blockers, deploymentId: deployment.id ?? null, url, adminStatus };
}

/** One production deployment from the checkout, carrying the release SHA. */
export function deployProduction({ sha, dir }, spawn = spawnSync) {
  const r = spawn("vercel", deployArgs(sha), {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (r.status !== 0) throw new Error(`vercel exited ${r.status}`);
  return { url: parseList(r.stdout ?? "")[0] ?? null, stdout: r.stdout ?? "" };
}

/**
 * The release itself. Every step is injectable so the refusals can be tested
 * without a deployment, and the defaults are the real thing.
 */
export async function release(opts = {}, deps = {}) {
  const {
    readState = () => readReleaseState(),
    preflight = () => runPreflight(),
    prerequisites = () => runPrerequisites(),
    exportCommit = (sha) => exportRelease(sha),
    deploy = (arg) => deployProduction(arg),
    verify = (arg) => verifyRelease(arg),
    log = console.log,
  } = deps;
  const steps = [];
  const stop = (step, blockers, sha = null) => ({ ok: false, step, blockers, steps, deployed: false, sha });

  steps.push("release state");
  const facts = await readState();
  const first = decideReleaseState(facts);
  if (!first.ok) return stop("release state", first.blockers);
  const sha = first.sha;
  log(`  release state    main at ${short(sha)}, clean, matching origin/main`);

  steps.push("preflight");
  const pre = await preflight();
  if (!pre.ok) return stop("preflight", pre.blockers, sha);

  steps.push("prerequisites");
  const req = await prerequisites();
  if (!req.ok) return stop("prerequisites", req.blockers, sha);

  // Nothing may have moved while the preflight and the suite ran: a test that
  // writes a file, or a commit landing in another window, would otherwise be
  // uploaded under a SHA that no longer describes it.
  steps.push("re-check");
  const again = decideReleaseState(await readState());
  if (!again.ok) return stop("release state (re-check)", again.blockers, sha);
  if (again.sha !== sha) {
    return stop("release state (re-check)", [`HEAD moved from ${short(sha)} to ${short(again.sha)} while the checks ran`], sha);
  }

  steps.push("export");
  const exported = await exportCommit(sha);
  try {
    if (opts.check) {
      steps.push("safe point");
      return { ok: true, check: true, sha, files: exported.files, steps, deployed: false };
    }
    steps.push("deploy");
    await deploy({ sha, dir: exported.dir });
  } catch (err) {
    return stop("deploy", [err instanceof Error ? err.message : String(err)], sha);
  } finally {
    await exported.cleanup();
  }

  steps.push("verify");
  const verified = await verify({ sha });
  if (!verified.ok) {
    return {
      ok: false,
      step: "verify",
      blockers: verified.blockers,
      steps,
      deployed: true,
      sha,
      deploymentId: verified.deploymentId ?? null,
    };
  }
  return {
    ok: true,
    sha,
    steps,
    deployed: true,
    files: exported.files,
    deploymentId: verified.deploymentId,
    url: verified.url,
  };
}

async function main() {
  const check = process.argv.includes("--check");
  console.log(check ? "Release check. Nothing will be deployed.\n" : "Releasing AI Enterprise to production.\n");
  const result = await release({ check });

  if (!result.ok) {
    console.error(`\nRELEASE BLOCKED at ${result.step}`);
    for (const b of result.blockers) console.error(`  - ${b}`);
    console.error(
      result.deployed
        ? "\nThe deployment was made but did not verify. Production may still be serving the previous release."
        : "\nNothing was deployed."
    );
    process.exit(1);
  }
  if (result.check) {
    console.log(
      `\nSAFE POINT: ${short(result.sha)} passed every check. ${result.files} tracked files would be uploaded. Nothing was deployed.`
    );
    return;
  }
  console.log(`\nRELEASED ${short(result.sha)} as ${result.deploymentId}`);
  console.log(`  ${result.url}`);
  console.log(`  https://${PRODUCTION_DOMAIN} now serves it, and /admin answered 200.`);
}

if (process.argv[1] && path.basename(process.argv[1]) === "release.mjs") {
  main().catch((err) => {
    console.error(`\nRELEASE BLOCKED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}

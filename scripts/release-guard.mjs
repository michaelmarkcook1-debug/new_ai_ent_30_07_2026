#!/usr/bin/env node
// A production build that no release started does not build.
//
// WHAT THIS IS FOR. Until 17 September 2026 a push to main published
// production on its own: Vercel's GitHub integration created a Production
// deployment for every commit (`vercel[bot]`, verified on GitHub for 992db7a
// through b7250a4), which skipped the Anthropic preflight entirely. The first
// half of the fix is `git.deploymentEnabled` in vercel.json, which stops
// Vercel starting those builds at all. This is the second half, and it is
// deliberately a different mechanism: it fails the BUILD, so anything that
// still manages to start a production build outside `npm run deploy` never
// reaches the production domain, because Vercel only assigns domains to a
// build that succeeded. A push whose config was somehow ignored, a bare
// `vercel --prod`, and a dashboard promote of a preview (which the docs say
// rebuilds) all land here.
//
// It runs from the `build` script, which is what Vercel runs: the project's
// Framework Settings say `npm run vercel-build` or `npm run build`, and there
// is no vercel-build script. tests/release-control.test.ts pins both.
//
// The guard asks one question: did scripts/release.mjs start this build? That
// script passes RELEASE_SHA through `vercel --build-env`, and only after the
// release state, the preflight and the test suite have all passed.
//
// PREVIEWS AND LOCAL BUILDS ARE UNTOUCHED. Only VERCEL_ENV === "production" is
// gated, so every branch still previews and `npm run build` still works on a
// laptop. A missing VERCEL_ENV allows the build: this is a release gate, not a
// sandbox, and a variable that failed to arrive must not break previews.

import path from "node:path";

const SHA = /^[0-9a-f]{40}$/;

/**
 * The verdict for one build environment. Pure, so the rule can be tested
 * without making a deployment.
 */
export function guardVerdict(env = process.env) {
  const target = env.VERCEL_ENV ?? null;
  if (target !== "production") {
    return { ok: true, message: `${target ?? "local"} build: no release gate applies` };
  }
  const sha = env.RELEASE_SHA ?? "";
  if (!SHA.test(sha)) {
    return {
      ok: false,
      message:
        "BLOCKED: a production build that no release started. Production is released only by `npm run deploy` (scripts/release.mjs), which checks the release state, runs the Anthropic preflight and the test suite, and then passes RELEASE_SHA to the build. A push to main, a bare `vercel --prod`, or promoting a preview from the dashboard all arrive here instead.",
    };
  }
  const commit = env.VERCEL_GIT_COMMIT_SHA;
  if (commit && commit !== sha) {
    return {
      ok: false,
      message: `BLOCKED: the release says ${sha} but this build was made from ${commit}. Nothing ships while those two disagree.`,
    };
  }
  return { ok: true, message: `production build of release ${sha}` };
}

if (process.argv[1] && path.basename(process.argv[1]) === "release-guard.mjs") {
  const verdict = guardVerdict(process.env);
  (verdict.ok ? console.log : console.error)(`[release-guard] ${verdict.message}`);
  process.exit(verdict.ok ? 0 : 1);
}

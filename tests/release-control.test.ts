import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { guardVerdict } from "../scripts/release-guard.mjs";
import {
  decideReleaseState,
  deployArgs,
  parseInspect,
  parseList,
  release,
  verifyRelease,
  type ReleaseDeps,
  type ReleaseStateFacts,
} from "../scripts/release.mjs";
import { decide, runPreflight } from "../scripts/preflight-production.mjs";

// Pushing code and publishing production are two different acts. 17 September 2026.
//
// They were one act until today: Vercel's GitHub integration created a
// Production deployment for every commit on main (verified on GitHub for
// 992db7a through b7250a4, creator vercel[bot]), so the Anthropic preflight
// could be skipped by the ordinary act of pushing. Two mechanisms separate
// them, and this file pins both, plus the release path that replaced the old
// one-line deploy script.

const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
const pkg = () => (JSON.parse(src("package.json")) as { scripts: Record<string, string> }).scripts;
const vercelJson = () =>
  JSON.parse(src("vercel.json")) as {
    crons?: unknown[];
    git?: { deploymentEnabled?: Record<string, boolean> | boolean };
  };
const workflows = () =>
  readdirSync(path.join(process.cwd(), ".github", "workflows")).map((f) =>
    src(path.join(".github", "workflows", f))
  );

const SHA = "b7250a44c1c7722e8918e850c7b89fde8dd22ba5";
const OTHER = "0813ba7fc4f3a8a01bfc1574d0c7875a25a024e5";

// ------------------------------------------------------- push is not release

describe("a push to main cannot publish production", () => {
  it("1. Vercel is told not to deploy commits on main", () => {
    // The smallest supported mechanism: git.deploymentEnabled, documented as
    // "specify branches that should not trigger a deployment upon commits".
    expect(vercelJson().git?.deploymentEnabled).toEqual({ main: false });
  });

  it("2. and only main: every other branch still previews", () => {
    const enabled = vercelJson().git?.deploymentEnabled;
    // A bare `false`, or a "*" rule, would disable previews too. The docs are
    // explicit that unspecified branches default to true, so main is the only
    // key allowed here.
    expect(typeof enabled).toBe("object");
    expect(Object.keys(enabled as Record<string, boolean>)).toEqual(["main"]);
  });

  it("3. a production build that no release started is refused", () => {
    const v = guardVerdict({ VERCEL_ENV: "production" });
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/npm run deploy/);
  });

  it("4. previews and local builds are untouched by the guard", () => {
    expect(guardVerdict({ VERCEL_ENV: "preview" }).ok).toBe(true);
    expect(guardVerdict({ VERCEL_ENV: "development" }).ok).toBe(true);
    expect(guardVerdict({}).ok).toBe(true);
  });

  it("5. the guard wants a real commit, and one that matches the build", () => {
    expect(guardVerdict({ VERCEL_ENV: "production", RELEASE_SHA: "yes-please" }).ok).toBe(false);
    expect(guardVerdict({ VERCEL_ENV: "production", RELEASE_SHA: SHA }).ok).toBe(true);
    expect(
      guardVerdict({ VERCEL_ENV: "production", RELEASE_SHA: SHA, VERCEL_GIT_COMMIT_SHA: OTHER }).ok
    ).toBe(false);
  });

  it("6. the guard runs inside the build Vercel actually runs", () => {
    // Vercel's Framework Settings for this project say `npm run vercel-build`
    // or `npm run build`. A vercel-build script would win and skip the guard.
    expect(pkg().build.startsWith("node scripts/release-guard.mjs &&")).toBe(true);
    expect(pkg()["vercel-build"]).toBeUndefined();
  });

  it("7. and it refuses at the process level, not just in a unit test", () => {
    const { RELEASE_SHA: _drop, ...clean } = process.env;
    void _drop;
    const blocked = spawnSync("node", ["scripts/release-guard.mjs"], {
      env: { ...clean, VERCEL_ENV: "production" },
      encoding: "utf8",
    });
    expect(blocked.status).toBe(1);
    expect(`${blocked.stderr}`).toMatch(/BLOCKED/);

    const allowed = spawnSync("node", ["scripts/release-guard.mjs"], {
      env: { ...clean, VERCEL_ENV: "production", RELEASE_SHA: SHA },
      encoding: "utf8",
    });
    expect(allowed.status).toBe(0);
    expect(`${allowed.stdout}`).toMatch(new RegExp(SHA));
  });

  it("8. a data-only push is under the same rule as a code push", () => {
    // The fixture sync commits to main as github-actions. deploymentEnabled is
    // per branch, not per file, so those commits do not deploy either, and the
    // workflow itself never calls vercel.
    const sync = workflows().find((w) => /sync-aie-fixtures|Sync AIE fixtures/.test(w));
    expect(sync, "the fixture sync workflow is missing").toBeTruthy();
    expect(sync).toMatch(/git push/);
    // Its comments discuss Vercel; no step may run it.
    for (const step of (sync ?? "").split("\n").filter((l) => /^\s*(- )?run:/.test(l))) {
      expect(step).not.toMatch(/vercel/i);
    }
    expect(vercelJson().git?.deploymentEnabled).toEqual({ main: false });
  });
});

// ------------------------------------------------------------ the release path

const cleanState: ReleaseStateFacts = {
  fetched: true,
  branch: "main",
  dirty: [],
  head: SHA,
  origin: SHA,
  subject: "a commit",
};

function harness(over: Partial<ReleaseDeps> & { state?: ReleaseStateFacts } = {}) {
  const calls: string[] = [];
  const deps: ReleaseDeps = {
    readState: () => {
      calls.push("state");
      return over.state ?? cleanState;
    },
    preflight: async () => {
      calls.push("preflight");
      return over.preflight ? await over.preflight() : { ok: true, blockers: [] };
    },
    prerequisites: async () => {
      calls.push("prerequisites");
      return over.prerequisites ? await over.prerequisites() : { ok: true, blockers: [] };
    },
    exportCommit: (sha) => {
      calls.push(`export:${sha.slice(0, 7)}`);
      return {
        dir: "/tmp/release",
        files: 583,
        cleanup: () => {
          calls.push("cleanup");
        },
      };
    },
    deploy: ({ sha, dir }) => {
      calls.push(`deploy:${sha.slice(0, 7)}:${dir}`);
    },
    verify: () => {
      calls.push("verify");
      return { ok: true, blockers: [], deploymentId: "dpl_test", url: "https://test.vercel.app" };
    },
    log: () => {},
    ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== "state")),
  };
  return { calls, deps };
}

/** A preflight built from the real decide(), so the refusals are the real ones. */
const preflightFrom = (status: number, type: string | null, message: string | null = null) => {
  const verdict = decide({ hasKey: true, check: { status, type, message }, model: "claude-fable-5-1" });
  return async () => verdict;
};

describe("the release path refuses before it deploys", () => {
  it("9. the preflight runs before the deploy, and nothing can skip it", async () => {
    const { calls, deps } = harness();
    const r = await release({}, deps);
    expect(r.ok).toBe(true);
    expect(calls.indexOf("preflight")).toBeLessThan(calls.findIndex((c) => c.startsWith("deploy:")));
    // No flag exists to go round it: --check is the only one the script reads,
    // and it stops earlier than the deploy rather than skipping a check.
    const script = src("scripts/release.mjs");
    expect(script).not.toMatch(/skip[-_ ]?preflight|no[-_]preflight|--skip\b/i);
    expect([...script.matchAll(/process\.argv\.includes\("([^"]+)"\)/g)].map((m) => m[1])).toEqual(["--check"]);
  });

  it("10. a rejected key blocks the deploy", async () => {
    const { calls, deps } = harness({ preflight: preflightFrom(401, "authentication_error", "invalid x-api-key") });
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(r.step).toBe("preflight");
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("11. an exhausted balance blocks the deploy, and is not called an auth failure", async () => {
    const verdict = decide({
      hasKey: true,
      check: { status: 400, type: "invalid_request_error", message: "Your credit balance is too low" },
      model: "claude-fable-5-1",
    });
    expect(verdict.stages.auth).toBe("ok");
    expect(verdict.stages.credit).toBe("blocked");
    const { calls, deps } = harness({ preflight: async () => verdict });
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(r.blockers?.join(" ")).toMatch(/credit/i);
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("12. a model the key cannot reach blocks the deploy", async () => {
    const { calls, deps } = harness({ preflight: preflightFrom(404, "not_found_error", "model: claude-fable-5-1") });
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("13. a failing test suite blocks the deploy", async () => {
    const { calls, deps } = harness({
      prerequisites: async () => ({ ok: false, blockers: ["tests failed, so nothing was deployed"] }),
    });
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(r.step).toBe("prerequisites");
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("14. an unclean or unpushed tree blocks everything, before a token is spent", async () => {
    for (const state of [
      { ...cleanState, dirty: [" M lib/analyst/llm.ts"] },
      { ...cleanState, head: SHA, origin: OTHER },
      { ...cleanState, branch: "release-control" },
      { ...cleanState, branch: null },
      { ...cleanState, fetched: false, origin: null },
    ] as ReleaseStateFacts[]) {
      const { calls, deps } = harness({ state });
      const r = await release({}, deps);
      expect(r.ok, JSON.stringify(state)).toBe(false);
      expect(r.step).toBe("release state");
      expect(calls).toEqual(["state"]);
    }
  });

  it("15. a HEAD that moves while the checks run blocks the deploy", async () => {
    let call = 0;
    const { calls, deps } = harness();
    deps.readState = () => {
      calls.push("state");
      call += 1;
      return call === 1 ? cleanState : { ...cleanState, head: OTHER, origin: OTHER };
    };
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(r.step).toBe("release state (re-check)");
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("16. --check runs every check and stops at the safe point", async () => {
    const { calls, deps } = harness();
    const r = await release({ check: true }, deps);
    expect(r.ok).toBe(true);
    expect(r.check).toBe(true);
    expect(r.deployed).toBe(false);
    expect(calls).toContain("preflight");
    expect(calls).toContain("prerequisites");
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
    expect(calls).toContain("cleanup");
  });

  it("17. the release carries the exact commit into the build and onto the record", async () => {
    expect(deployArgs(SHA)).toEqual([
      "--prod",
      "--yes",
      "--build-env",
      `RELEASE_SHA=${SHA}`,
      "--meta",
      `releaseSha=${SHA}`,
    ]);
    const { calls, deps } = harness();
    const r = await release({}, deps);
    expect(r.sha).toBe(SHA);
    expect(calls).toContain(`export:${SHA.slice(0, 7)}`);
    expect(calls).toContain(`deploy:${SHA.slice(0, 7)}:/tmp/release`);
    // 40 hex, not an abbreviation: the report names a commit anyone can look up.
    expect(decideReleaseState(cleanState).sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it("18. a deployment that does not become production is reported as such", async () => {
    const { deps } = harness({
      verify: async () => ({
        ok: false,
        blockers: ["newaient30072026.vercel.app still serves dpl_old"],
        deploymentId: "dpl_new",
      }),
    });
    const r = await release({}, deps);
    expect(r.ok).toBe(false);
    expect(r.step).toBe("verify");
    expect(r.deployed).toBe(true);
  });

  it("19. verification finds the release by its own metadata, and checks the domain moved", async () => {
    const seen: string[][] = [];
    const vercel = (args: string[]) => {
      seen.push(args);
      if (args[0] === "ls") return `  2m  project  https://aie-new-abc.vercel.app  ● Ready`;
      if (args[1] === "https://aie-new-abc.vercel.app") return "    id\t\tdpl_new\n    target\tproduction\n    status\t● Ready\n";
      return "    id\t\tdpl_new\n    target\tproduction\n    status\t● Ready\n";
    };
    const r = await verifyRelease({
      sha: SHA,
      vercel,
      fetchImpl: (async () => new Response("", { status: 200 })) as typeof fetch,
    });
    expect(seen[0]).toEqual(["ls", "--prod", "-m", `releaseSha=${SHA}`]);
    expect(r.ok).toBe(true);
    expect(r.deploymentId).toBe("dpl_new");
  });

  it("20. and refuses when the domain still serves the previous release", async () => {
    const vercel = (args: string[]) => {
      if (args[0] === "ls") return "https://aie-new-abc.vercel.app";
      if (args[1] === "https://aie-new-abc.vercel.app") return "    id\t\tdpl_new\n    target\tproduction\n    status\t● Ready\n";
      return "    id\t\tdpl_old\n    target\tproduction\n    status\t● Ready\n";
    };
    const r = await verifyRelease({
      sha: SHA,
      vercel,
      fetchImpl: (async () => new Response("", { status: 200 })) as typeof fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/still serves dpl_old/);
  });

  it("parses what the CLI actually prints", () => {
    expect(parseInspect("    id\t\tdpl_x\n    status\t● Ready\n    target\tproduction\n")).toMatchObject({
      id: "dpl_x",
      status: "Ready",
      target: "production",
    });
    expect(parseList("  10d  proj  https://a-b-c.vercel.app  ● Ready")).toEqual(["https://a-b-c.vercel.app"]);
  });
});

// ------------------------------------------------- the real preflight, no network

describe("the preflight itself, wired as the release calls it", () => {
  const source = () => 'const MODEL = "claude-fable-5-1";';
  const pullEnv = async () => ({ ANTHROPIC_API_KEY: "test-placeholder-never-sent" });
  const answering = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

  it("21. a 401 is an auth failure and blocks", async () => {
    const v = await runPreflight({
      pullEnv,
      source,
      log: () => {},
      fetchImpl: answering(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
    });
    expect(v.ok).toBe(false);
    expect(v.stages.auth).toBe("failed");
    const { calls, deps } = harness({ preflight: async () => v });
    expect((await release({}, deps)).ok).toBe(false);
    expect(calls.some((c) => c.startsWith("deploy:"))).toBe(false);
  });

  it("22. a credit refusal is not an auth failure, and still blocks", async () => {
    const v = await runPreflight({
      pullEnv,
      source,
      log: () => {},
      fetchImpl: answering(400, {
        type: "error",
        error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." },
      }),
    });
    expect(v.stages.auth).toBe("ok");
    expect(v.stages.credit).toBe("blocked");
    expect(v.ok).toBe(false);
  });

  it("23. a missing key blocks before any request is made", async () => {
    let called = false;
    const v = await runPreflight({
      pullEnv: async () => ({}),
      source,
      log: () => {},
      fetchImpl: (async () => {
        called = true;
        return new Response("", { status: 200 });
      }) as typeof fetch,
    });
    expect(v.ok).toBe(false);
    expect(v.stages.key).toBe("missing");
    expect(called).toBe(false);
  });

  it("24. only a 200 on the pinned model passes", async () => {
    const v = await runPreflight({ pullEnv, source, log: () => {}, fetchImpl: answering(200, { stop_reason: "max_tokens" }) });
    expect(v).toMatchObject({ ok: true, model: "claude-fable-5-1" });
    expect(v.stages).toEqual({ key: "ok", auth: "ok", model: "ok", credit: "ok" });
  });
});

// ------------------------------------------------------------- nothing automatic

describe("no automatic production path remains", () => {
  it("25. npm run deploy is the only deployment command in the project", () => {
    expect(pkg().deploy).toBe("node scripts/release.mjs");
    const others = Object.entries(pkg()).filter(
      ([name, body]) => name !== "deploy" && /vercel\s+(deploy|--prod)|--target[= ]production/.test(body)
    );
    expect(others).toEqual([]);
  });

  it("26. no workflow deploys, and none is scheduled", () => {
    for (const w of workflows()) {
      expect(w).not.toMatch(/^\s*schedule:/m);
      for (const step of w.split("\n").filter((l) => /^\s*(- )?run:/.test(l))) {
        expect(step).not.toMatch(/vercel/i);
      }
    }
  });

  it("27. nothing in the repository holds a deploy hook", () => {
    const hooks = spawnSync(
      "git",
      ["grep", "-lI", "-e", "api.vercel.com/v1/integrations/deploy", "--", "."],
      { encoding: "utf8" }
    );
    expect(`${hooks.stdout}`.trim()).toBe("");
  });

  it("28. no Analyst Insight cron, no discovery cron, no ingestion cron", () => {
    expect(vercelJson().crons ?? []).toEqual([]);
    expect(existsSync(path.join(process.cwd(), "app", "api", "warm"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "app", "api", "cron"))).toBe(false);
    // Discovery and ingestion are POST handlers a person triggers from /admin/data.
    for (const route of ["discover", "validate", "ingest"]) {
      const file = src(path.join("app", "api", "admin", "dataops", route, "route.ts"));
      expect(file).toMatch(/export async function POST/);
      expect(file).not.toMatch(/schedule|cron/i);
    }
  });
});

// -------------------------------------------------------------- /admin is public

describe("/admin stays public", () => {
  it("29. nothing gates it by path", () => {
    expect(src("middleware.ts")).not.toMatch(/\/admin/);
    const dir = path.join(process.cwd(), "app", "(ai-ent)", "admin");
    const files = readdirSync(dir, { recursive: true }) as string[];
    for (const f of files.filter((x) => /\.tsx?$/.test(String(x)))) {
      expect(src(path.join("app", "(ai-ent)", "admin", String(f)))).not.toMatch(
        /getServerSession|requireAuth|withAuth|unauthorized\(\)/
      );
    }
  });

  it("30. and this release adds no protection of its own", () => {
    const config = JSON.stringify(vercelJson());
    expect(config).not.toMatch(/ssoProtection|passwordProtection|trustedIps/i);
  });
});

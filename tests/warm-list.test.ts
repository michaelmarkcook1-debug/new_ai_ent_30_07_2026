import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { WARM_PAGES } from "@/lib/analyst/warm-list";

// The list of pages that author a reading, and the one thing that reads it.
//
// Until 6 September 2026 the list lived twice, because a plain-JS post-deploy
// script could not import it, and a cron read it from a route. Now the manual
// warm script loads it through the alias hook, the route and the cron are
// gone, and there is exactly one warm entry point that a person has to start.

describe("the warm list", () => {
  it("names every page that authors a reading", () => {
    expect(WARM_PAGES.length).toBe(10);
  });

  it("holds only pages whose source calls an author entry point", () => {
    // /trust-rank sat here until 5 September 2026 without ever authoring, so
    // each warm rendered it for nothing. A page earns its place by calling one
    // of the four entry points exported by lib/analyst/author.ts, anywhere
    // under its route directory: Today's Pulse does so from its components.
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        return statSync(full).isDirectory() ? sources(full) : [full];
      });
    const calls = /\b(authorInsight|authorPulse|authorSince|authorActions)\(/;
    for (const page of WARM_PAGES) {
      const dir = path.join(process.cwd(), "app", "(ai-ent)", page.slice(1));
      const authors = sources(dir).some((f) => /\.tsx?$/.test(f) && calls.test(readFileSync(f, "utf8")));
      expect(authors, `${page} is on the warm list but nothing under ${dir} calls an author entry point`).toBe(true);
    }
  });

  it("does not warm /trust-rank, which never authors", () => {
    expect(WARM_PAGES).not.toContain("/trust-rank");
  });

  it("holds real routes, each rooted, with no duplicates", () => {
    for (const p of WARM_PAGES) {
      expect(p.startsWith("/"), p).toBe(true);
      expect(p).not.toContain("//");
    }
    expect(new Set(WARM_PAGES).size).toBe(WARM_PAGES.length);
  });
});

describe("the manual warm is the only warm", () => {
  const script = readFileSync(path.join(process.cwd(), "scripts", "warm.mjs"), "utf8");

  it("reads the list from its one source rather than holding a copy", () => {
    expect(script).toMatch(/from "@\/lib\/analyst\/warm-list"/);
    expect(script).not.toMatch(/const PAGES = \[/);
  });

  it("is a plan, and fetches nothing, unless a person passes --yes", () => {
    expect(script).toMatch(/args\.includes\("--yes"\)/);
    expect(script).toMatch(/if \(!yes\)[\s\S]*process\.exit\(0\)/);
  });

  it("has no route and no cron behind it", () => {
    expect(existsSync(path.join(process.cwd(), "app", "api", "warm"))).toBe(false);
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as { crons?: unknown[] };
    expect(vercel.crons ?? []).toEqual([]);
  });

  it("replaced the post-deploy script outright", () => {
    expect(existsSync(path.join(process.cwd(), "scripts", "warm-insights.mjs"))).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// The back office is in the sidebar, and stays there.
//
// From 5 August to 7 October 2026 /admin and /admin/data were live but linked
// from nowhere, by an early decision that the operations view need not be in
// the menu. Once Data operations became the only way upstream data enters the
// product, an unlinked page was a page the owner could not find. These pin the
// fix: read from the source, because the sidebar is a client component and the
// question is simply whether the links are declared.

const shell = readFileSync(path.join(process.cwd(), "lib/ui/shell.tsx"), "utf8");
const navBlock = shell.slice(shell.indexOf("export const NAV_GROUPS"), shell.indexOf("function ThemeToggle"));

describe("the back office is visible", () => {
  it("has its own sidebar group", () => {
    expect(navBlock).toMatch(/label: "Back office"/);
  });

  it("links Data operations and Admin", () => {
    expect(navBlock).toMatch(/\{ label: "Data operations", href: "\/admin\/data"/);
    expect(navBlock).toMatch(/\{ label: "Admin", href: "\/admin"/);
  });

  it("links pages that exist", () => {
    for (const p of ["admin", "admin/data"]) {
      expect(existsSync(path.join(process.cwd(), "app", "(ai-ent)", p, "page.tsx")), p).toBe(true);
    }
  });

  it("lights only the most specific item, so /admin/data does not also light Admin", () => {
    expect(shell).toMatch(/i\.href\.length > href\.length/);
  });

  it("adds no gate to /admin: it stays public", () => {
    expect(readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8")).not.toMatch(/\/admin/);
  });
});

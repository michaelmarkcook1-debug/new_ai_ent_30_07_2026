// Teaches plain node the "@/" path alias the app source uses.
//
// THE PROBLEM. tsconfig maps "@/x" to the repo root, and every module under
// lib/ is written that way. Node knows nothing about tsconfig, so any script
// importing a lib module dies on the first aliased specifier it meets:
//
//   Cannot find package '@/lib' imported from lib/changes/snapshot.ts
//
// That is why scripts/snapshot-signals.mjs could not run at all, and because
// scripts/sync-aie-fixtures.mjs calls it as a post-step, the fixture sync
// always ended in a failure line even when every fetch had succeeded. A tool
// that reports failure on a good run is a tool nobody runs, which is the
// likeliest reason the fixtures sat two weeks out of date.
//
// The alternative was rewriting the aliased imports in lib/ to relative paths.
// That would put a second import convention into application code to suit a
// script, and would have to be maintained forever. A resolver hook is fifteen
// lines and keeps the convention in one place.
//
// Node strips the TypeScript types itself; this only answers the question of
// where the file is.
//
// Usage:  node --import ./scripts/alias-hook.mjs scripts/whatever.mjs

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.cwd();

// The extensions tried, in the order tsconfig's own resolver would try them.
const CANDIDATES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const rel = specifier.slice(2);
    for (const suffix of CANDIDATES) {
      const abs = path.join(ROOT, rel + suffix);
      if (suffix !== "" && existsSync(abs)) {
        return nextResolve(pathToFileURL(abs).href, context);
      }
    }
    // Nothing matched. Let node report it against the original specifier
    // rather than against a path this hook invented.
    return nextResolve(specifier, context);
  },
});

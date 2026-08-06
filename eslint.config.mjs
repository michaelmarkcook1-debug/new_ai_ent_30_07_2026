import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// The lint gate.
//
// Until now `npm run lint` called `next lint` with no ESLint installed, so it
// prompted for an interactive install and hung: a gate that could never run
// and had therefore never caught anything. TypeScript strict mode and the test
// suite were doing all the real work.
//
// This is deliberately the Next preset and nothing more. A house style layered
// on top of an app this size would report hundreds of findings in code that is
// already reviewed and shipped, and a gate that cries wolf on its first run is
// one nobody looks at twice. The preset catches the class of thing types and
// tests cannot: unescaped entities, bad hook dependencies, misused next/image
// and next/link.

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Keep the two characters that genuinely break JSX, drop the two that do
      // not.
      //
      // `>` and `}` can silently terminate an element or an expression, so
      // they stay errors. An apostrophe in prose renders correctly and always
      // has; the default rule flagged eight of them in sentences like "the
      // vendor's own score". This product is mostly prose, so leaving that on
      // would have meant either eight permanent errors or rewriting British
      // English copy to suit a linter. Neither is worth it.
      "react/no-unescaped-entities": [
        "error",
        { forbid: [">", "}"] },
      ],
    },
  },
  {
    ignores: [
      // `**/` matters on all of these. Scoping them to the top level only let
      // the first run report 8,065 problems, of which the overwhelming
      // majority came from a stale agent worktree under .claude that carries
      // its own built .next: generated code, in a directory that is not the
      // project, drowning the few hundred findings that were actually ours.
      "**/.next/**",
      "**/node_modules/**",
      "**/out/**",
      "**/next-env.d.ts",
      // Other sessions' worktrees. Copies of this repo, linted on their own
      // terms if at all.
      ".claude/worktrees/**",
      // Vendored from the ranking engine and the Python reference. Not ours to
      // restyle, and the parity tests are what guard it.
      "vendor/**",
    ],
  },
];

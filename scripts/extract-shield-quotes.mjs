// Extract every curly-quoted span from The Security Desk's Shield ledger and
// pin it as a fixture.
//
// The Shield's whole value is that each mark is the vendor's own wording. The
// editorial sentences around a quotation were repunctuated when the ledger was
// ported into this repository (house no-em-dash rule), and that is exactly the
// kind of edit that can walk into a quotation without anybody noticing. So the
// quoted spans are extracted from the source once, committed, and asserted by
// tests/shield-quotes.test.ts on every run.
//
// Run this again only when the source ledger is re-verified and re-ported:
//   node scripts/extract-shield-quotes.mjs
// It reads the source repository read-only and writes nothing to it.

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const SOURCE = path.join(
  homedir(),
  "Documents",
  "Dev Projects",
  "the-desk",
  "lib",
  "shield-data.ts"
);
const OUT = path.join(
  process.cwd(),
  "tests",
  "fixtures",
  "shield-quotes.json"
);

const src = readFileSync(SOURCE, "utf8");

// Curly-quoted spans only. Straight quotes are TypeScript string delimiters
// here, so they would match the code rather than the vendors' wording.
const spans = [...src.matchAll(/“([^”]+)”/g)].map((m) => m[1]);

const unique = [...new Set(spans)];

const version = src.match(/SHIELD_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? null;

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      note: "Curly-quoted spans from the vendors' own documents, extracted from the-desk/lib/shield-data.ts at port time. Each must appear byte-identical in lib/shield/data.ts. Regenerate with scripts/extract-shield-quotes.mjs.",
      sourceRepo: "the-desk",
      sourcePath: "lib/shield-data.ts",
      shieldVersion: version,
      count: unique.length,
      quotes: unique,
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${unique.length} quoted spans (Shield ${version}) to ${OUT}`);

#!/usr/bin/env node
// Research what a sector does to a shared role, and write it as deltas.
//
// This continues scripts/research-missing-industries.py by the same discipline
// and for the same reason. That script filled empty capability profiles for
// seven industries; this one annotates profiles that already exist with what a
// named sector changes about them. Its rule is inherited verbatim:
//
//     Never fill a field from general knowledge alone.
//
// A model asked "is a bank contact centre more regulated than a shop's" will
// answer yes, fluently, every time, and that answer is worth nothing. What is
// worth something is DISP 1.6.2R with its URL. So the pipeline is search first,
// score second, and a proposed delta that cannot name a source is emitted at
// class E and expected to be struck out in review.
//
// WHY THE PILOT WAS DONE BY HAND. The six sectors already in
// data/role-verticals/customer-operations.json were researched directly rather
// than by running this script, because this machine has no ANTHROPIC_API_KEY
// and no search key: the key is set in the deployed environment, not here. That
// is the same constraint research-missing-industries.py records in its own
// header. The hand pass is also what calibrated this script's prompts, and it
// turned up two facts a model would have got wrong from recall, both of which
// are now regression-tested:
//
//   - Ofcom cut the ADR escalation window from eight weeks to six on
//     8 April 2026. Eight is the figure of long standing and is now wrong.
//   - The EU AI Act Omnibus, in force 27 July 2026, pushed Annex III high-risk
//     obligations to 2 December 2027, while Article 50 transparency did start
//     on 2 August 2026. A plan written against the original dates is wrong in
//     both directions at once.
//
// OUTPUT IS A PROPOSAL, NOT A DATASET. Nothing here writes into the pilot file.
// It writes a candidate to disk for a human to read, because the cost of this
// job was never the API spend. 1,287 profiles is roughly 23,000 requirement
// level evidence claims, and a claim labelled A that is really E is worse than
// no claim at all: the engine floors recommendation confidence at the worst
// class among the deciding requirements, so a wrong class propagates into
// numbers on screen.
//
// Usage:
//   node scripts/research-role-verticals.mjs --vertical insurance
//   node scripts/research-role-verticals.mjs --vertical insurance --roles ROLE-0045,ROLE-0047
//   node scripts/research-role-verticals.mjs --vertical insurance --dry-run
//
// Needs ANTHROPIC_API_KEY. Needs TAVILY_API_KEY unless --no-search, which is
// only for testing the scoring prompt and always produces class E.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = process.cwd();
const PILOT = path.join(ROOT, "data", "role-verticals", "customer-operations.json");
const OUT_DIR = path.join(ROOT, "data", "role-verticals", "proposed");

// Retrieval is cheap and repetitive; scoring is the judgement. Splitting them
// is what keeps the run in the tens of dollars rather than the hundreds.
const RETRIEVAL_MODEL = process.env.RESEARCH_RETRIEVAL_MODEL ?? "claude-haiku-4-5";
const SCORING_MODEL = process.env.RESEARCH_SCORING_MODEL ?? "claude-sonnet-5";

const EVIDENCE_RULE = `
EVIDENCE CLASSES. Every requirement you score carries its own class, not one
class for the role.

  A  A statute, statutory instrument, or a regulator rule or licence condition
     that states the requirement. You must be able to name it and give a URL.
  B  A professional body framework, or a requirement that follows directly from
     a class A rule without that rule stating it in terms. Name the rule.
  D  Job descriptions or employer materials.
  E  Reasoned judgement and nothing else.

Class E is a legitimate answer. A fluent argument that a sector "clearly"
raises a requirement, with no rule behind it, is class E, and saying so is
correct behaviour rather than failure. Do not reach for A or B because they
sound stronger. A claim labelled A that is really E is the single worst output
this pipeline can produce.

NEVER fill a field from general knowledge alone.
`.trim();

function parseArgs(argv) {
  const args = { roles: null, vertical: null, dryRun: false, noSearch: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vertical") args.vertical = argv[++i];
    else if (a === "--roles") args.roles = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-search") args.noSearch = true;
  }
  return args;
}

/** The rubric the scores mean something against. Read, never recalled. */
function loadRubric() {
  const src = readFileSync(path.join(ROOT, "lib", "model-fit", "rubric.ts"), "utf8");
  const start = src.indexOf("{", src.indexOf("export const RUBRIC"));
  const body = src.slice(start, src.lastIndexOf("}") + 1);
  return JSON.parse(body.replace(/;\s*$/, ""));
}

/** Base profiles for the roles being lensed, from the library itself. */
function loadRoles(ids) {
  const roles = JSON.parse(
    readFileSync(path.join(ROOT, "lib", "model-fit", "data", "roles.json"), "utf8")
  );
  const out = {};
  for (const id of ids) {
    const r = roles[id];
    if (!r) throw new Error(`Role ${id} is not in the library`);
    out[id] = {
      name: r.name,
      function: r.function,
      profile: Object.fromEntries(
        Object.entries(r.profile ?? {}).map(([cap, v]) => [cap, v.score])
      ),
    };
  }
  return out;
}

async function search(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 5,
      include_raw_content: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const json = await res.json();
  return (json.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}

/**
 * What rules govern this work in this sector.
 *
 * Deliberately asks for the regime and not for scores. Letting one call both
 * find the evidence and decide what it implies is how a search result becomes
 * a justification for a conclusion already reached.
 */
async function gatherEvidence(client, vertical, roleName, fn) {
  const queries = [
    `${vertical} sector regulator complaint handling rules statutory deadline`,
    `${vertical} ${roleName} regulatory obligations customer service record keeping`,
    `${vertical} vulnerable customers duty regulator licence condition`,
    `${vertical} sector data protection special category customer records`,
  ];

  const hits = [];
  for (const q of queries) {
    try {
      hits.push(...(await search(q)));
    } catch (err) {
      console.error(`  search failed: ${q}: ${err.message}`);
    }
  }
  if (hits.length === 0) return { regime: null, sources: [] };

  const res = await client.messages.create({
    model: RETRIEVAL_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Below are search results about ${vertical} and the work of a ${roleName} in ${fn}.

Identify only the STATUTES, STATUTORY INSTRUMENTS, REGULATOR RULES and LICENCE
CONDITIONS that govern this work in this sector. Ignore commentary, law firm
summaries and vendor marketing except as a pointer to the rule itself.

For each, return the instrument's own name, the specific rule or condition
reference where the results give one, a one sentence quotation of what it
requires, and the URL. If the results contain no such instrument, return an
empty list. Do not supply rules from your own knowledge that are not in these
results.

Return JSON only:
{"regime": "one sentence naming the governing regime, or null",
 "sources": [{"title": "...", "rule": "...", "cite": "...", "url": "..."}]}

RESULTS:
${hits.map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.content}`).join("\n\n")}`,
      },
    ],
  });

  const text = res.content.find((c) => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text.replace(/^```json\n?|\n?```$/g, ""));
  } catch {
    return { regime: null, sources: [] };
  }
}

/** Score the sector's effect on one role, against evidence already gathered. */
async function scoreRole(client, vertical, roleId, role, rubric, evidence) {
  const res = await client.messages.create({
    model: SCORING_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: `Role: ${role.name} (${roleId}), function ${role.function}.
Sector: ${vertical}.

BASE PROFILE, from the role library. These scores describe the role as it is
performed in ANY sector. Your job is to say which of them the named sector
changes, and to prove it.

${JSON.stringify(role.profile, null, 2)}

RUBRIC. A score states how much of one requirement the work involves. The bands
are anchored; use the anchor wording to justify a move.

${JSON.stringify(rubric, null, 2)}

EVIDENCE GATHERED FOR THIS SECTOR. This is what you may reason from.

${JSON.stringify(evidence, null, 2)}

${EVIDENCE_RULE}

Return ONLY requirements the sector actually changes, plus any requirement
governed by a rule that recently changed even where the band stays put (set
"to" equal to "from" and explain, so the change stays visible).

Most sectors move a MINORITY of the eighteen requirements. A response moving
most of them is almost certainly reasoning from plausibility rather than from
the evidence. Returning an empty object is a valid and useful answer.

Return JSON only:
{"CAP-10": {"from": 70, "to": 90, "class": "A", "source_url": "...",
            "why": "one or two sentences citing the rule and the band anchor"}}`,
      },
    ],
  });

  const text = res.content.find((c) => c.type === "text")?.text ?? "{}";
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\n?|\n?```$/g, ""));
  } catch {
    return { deltas: {}, rejected: ["unparseable response"] };
  }

  // The guard that makes the class mean something. A delta claiming a published
  // rule must carry the URL of one, and a `from` that disagrees with the
  // library was scored against a profile that does not exist.
  const deltas = {};
  const rejected = [];
  for (const [cap, d] of Object.entries(parsed)) {
    if (!rubric[cap]) {
      rejected.push(`${cap}: not a requirement in the rubric`);
      continue;
    }
    if (d.from !== role.profile[cap]) {
      rejected.push(
        `${cap}: from ${d.from} but the library says ${role.profile[cap]}`
      );
      continue;
    }
    if ((d.class === "A" || d.class === "B") && !d.source_url) {
      rejected.push(`${cap}: class ${d.class} with no source, demoted to E`);
      deltas[cap] = { ...d, class: "E" };
      continue;
    }
    deltas[cap] = d;
  }
  return { deltas, rejected };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.vertical) {
    console.error("--vertical is required");
    process.exit(1);
  }

  const pilot = JSON.parse(readFileSync(PILOT, "utf8"));
  if (pilot.verticals[args.vertical]) {
    console.error(
      `${args.vertical} is already in the pilot. Delete it there first if you mean to redo it.`
    );
    process.exit(1);
  }

  const roleIds = args.roles ?? pilot.meta.roles;
  const roles = loadRoles(roleIds);
  const rubric = loadRubric();

  if (args.dryRun) {
    console.log(`Would research ${args.vertical} across ${roleIds.length} roles:`);
    for (const [id, r] of Object.entries(roles)) console.log(`  ${id}  ${r.name}`);
    console.log(`\nRetrieval: ${RETRIEVAL_MODEL}   Scoring: ${SCORING_MODEL}`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set. It is set in the deployed environment " +
        "rather than on a development machine, which is why the pilot sectors " +
        "were researched by hand."
    );
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  const proposal = {
    meta: {
      vertical: args.vertical,
      generated: new Date().toISOString(),
      retrievalModel: RETRIEVAL_MODEL,
      scoringModel: SCORING_MODEL,
      status: "PROPOSED, NOT REVIEWED",
      reviewNote:
        "Every class A and B claim must be opened and read against its source " +
        "before this is merged into customer-operations.json. The class is the " +
        "product; the score is downstream of it.",
    },
    rejected: [],
    deltas: {},
  };

  console.log(`Gathering evidence for ${args.vertical}`);
  const first = roles[roleIds[0]];
  const evidence = args.noSearch
    ? { regime: null, sources: [] }
    : await gatherEvidence(client, args.vertical, first.name, first.function);
  console.log(`  ${evidence.sources?.length ?? 0} instruments found`);
  if (!evidence.sources?.length) {
    console.log(
      "  No governing instrument found. Every delta from here would be class E."
    );
  }

  for (const id of roleIds) {
    process.stdout.write(`  ${id} ${roles[id].name}: `);
    const { deltas, rejected } = await scoreRole(
      client,
      args.vertical,
      id,
      roles[id],
      rubric,
      evidence
    );
    proposal.deltas[id] = deltas;
    for (const r of rejected) proposal.rejected.push(`${id} ${r}`);
    const n = Object.keys(deltas).length;
    console.log(`${n} delta${n === 1 ? "" : "s"}${rejected.length ? `, ${rejected.length} rejected` : ""}`);
  }

  proposal.evidence = evidence;

  mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `${args.vertical}.json`);
  writeFileSync(out, JSON.stringify(proposal, null, 2) + "\n");

  const classes = { A: 0, B: 0, D: 0, E: 0 };
  for (const d of Object.values(proposal.deltas))
    for (const v of Object.values(d)) classes[v.class] = (classes[v.class] ?? 0) + 1;

  console.log(`\nWritten to ${path.relative(ROOT, out)}`);
  console.log(
    `Classes: A ${classes.A}  B ${classes.B}  D ${classes.D}  E ${classes.E}`
  );
  if (proposal.rejected.length) {
    console.log(`\n${proposal.rejected.length} rejected:`);
    for (const r of proposal.rejected) console.log(`  ${r}`);
  }
  console.log(
    "\nPROPOSED, NOT MERGED. Read every class A and B claim against its source " +
      "before this goes into the pilot file."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

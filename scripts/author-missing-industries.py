#!/usr/bin/env python3
"""Author requirement profiles for the seven industries the package left uncovered.

    python3 scripts/author-missing-industries.py

INTEGRATION.md section 6 lists these seven as the largest remaining gap:
Agriculture, Airlines, Gaming, Higher Education, Management Consulting, Real
Estate and Renewable Energy. Their 36 roles exist in the taxonomy
(roles_full_library.json) with a name, a function definition, a seniority, a
decision authority and an O*NET occupational analogue, but no requirement
profile, so the tool cannot answer for any of them.

WHAT THESE ARE, AND WHAT THEY ARE NOT.

The 258 profiles that shipped with the package are evidence class D: "Labour
market - convergent evidence from multiple current job descriptions", produced
by a four-stage research pipeline that read those descriptions.

These 36 are evidence class E: "Reasoned judgement - assessor inference from the
role definition. No external source." They are authored against the same rubric,
using the same five anchored bands, grounded in each role's function definition
and its O*NET analogue - but nobody read a job advert to write them, and no SME
has reviewed them. The rubric is explicit that class E is legitimate and often
necessary, and equally explicit that it must never be presented as A to D.

So they carry E, the interface shows the class per requirement, and the engine
floors a recommendation's confidence at the worst class among the requirements
that decided it. A recommendation resting on these will say so on its face.

AUTHORING RULES, from 03_pipeline/PROMPTS.md:
  - Five bands only: 10, 30, 50, 70, 90.
  - A profile is low on most requirements and high on a few. A flat profile is
    almost always wrong.
  - Mandatory is a high bar; default to Desirable. Following the shipped data,
    where Mandatory holds exactly when the score is 70 or above.
  - The role must be distinguishable from its neighbours. If two profiles come
    out identical, the reading was not close enough - and the suite checks it.
  - CAP-11 and CAP-15 carry the most weight, because they set the consequence
    tier that shifts every capability threshold.

Requirement order below is CAP-01 to CAP-18:
  01 general intelligence   02 multi-step reasoning  03 domain reasoning
  04 coding                 05 agentic               06 quantitative
  07 research & synthesis   08 writing               09 context handling
  10 instruction following  11 accuracy              12 tool reliability
  13 latency                14 data sensitivity      15 risk & assurance
  16 visual interpretation  17 speech and audio      18 cross-language
"""
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/Downloads/pkg")
DATA = os.path.join(REPO, "lib", "model-fit", "data")
TAXONOMY = os.path.join(PKG, "01_data", "roles_full_library.json")

CAPS = [f"CAP-{i:02d}" for i in range(1, 19)]

# role_id: (headcount, [18 scores], "one line on what drives the profile")
AUTHORED = {
    # ---- Agriculture & Food Production ----------------------------------
    "ROLE-0286": (8, [50, 50, 70, 30, 50, 50, 50, 50, 50, 50, 50, 50, 30, 30, 30, 70, 10, 10],
                  "Agronomy is expert domain knowledge applied to field imagery; a wrong "
                  "recommendation costs a season, not a life."),
    "ROLE-0288": (12, [50, 50, 50, 10, 70, 50, 30, 30, 50, 50, 50, 50, 50, 30, 50, 50, 10, 30],
                  "Runs multi-stage operations independently across a seasonal workforce."),
    "ROLE-0289": (6, [50, 70, 70, 10, 50, 50, 50, 70, 70, 90, 90, 50, 50, 50, 90, 50, 10, 10],
                  "HACCP is prescribed to the letter and an undetected error is a "
                  "foodborne illness, so accuracy and assurance both sit at the top band."),
    "ROLE-0287": (10, [50, 50, 70, 10, 70, 30, 30, 30, 50, 70, 70, 50, 50, 30, 70, 70, 10, 10],
                  "Animal welfare regulation plus visual assessment of condition as a core task."),
    "ROLE-0290": (14, [50, 50, 50, 10, 70, 50, 30, 30, 50, 70, 70, 70, 70, 30, 70, 50, 10, 30],
                  "Line orchestration where a failed handoff stops production within minutes."),

    # ---- Airlines & Aviation --------------------------------------------
    "ROLE-0241": (18, [30, 70, 70, 10, 50, 50, 30, 30, 70, 90, 90, 70, 50, 30, 90, 30, 10, 10],
                  "Airworthiness directives are prescribed to the letter and an undetected "
                  "error is a safety event; seven mandatory requirements make it broad too."),
    "ROLE-0244": (25, [50, 70, 50, 10, 50, 50, 30, 50, 70, 70, 70, 70, 90, 30, 50, 30, 50, 30],
                  "Recovery decisions in seconds, over radio, with money and passengers moving."),
    "ROLE-0239": (30, [50, 70, 70, 10, 50, 50, 30, 30, 70, 90, 90, 70, 90, 30, 70, 30, 70, 30],
                  "The most demanding profile in this set: safety-critical, prescribed, "
                  "real-time and spoken all at once."),
    "ROLE-0240": (20, [50, 50, 50, 10, 70, 30, 30, 30, 50, 70, 70, 50, 70, 30, 70, 50, 50, 30],
                  "Turnaround management against a clock, under a safety regime."),
    "ROLE-0242": (10, [70, 70, 50, 50, 50, 70, 50, 50, 70, 50, 50, 50, 30, 30, 50, 30, 10, 10],
                  "Network economics: novel problems, forecasting, and routine SQL."),
    "ROLE-0243": (8, [70, 70, 70, 30, 50, 90, 50, 50, 70, 50, 70, 70, 50, 30, 50, 10, 10, 10],
                  "Pricing science at method level, where the technique itself is chosen "
                  "and defended."),

    # ---- Gaming & Interactive Entertainment ------------------------------
    "ROLE-0229": (14, [70, 50, 50, 30, 50, 50, 30, 70, 50, 30, 30, 30, 10, 10, 10, 70, 30, 10],
                  "Novel problems and visual composition; errors are rework, not harm."),
    "ROLE-0230": (40, [50, 70, 50, 70, 50, 50, 30, 30, 70, 50, 50, 70, 30, 10, 30, 50, 30, 10],
                  "Production software against an interdependent codebase."),
    "ROLE-0231": (10, [50, 50, 50, 30, 70, 70, 30, 50, 50, 50, 50, 70, 70, 30, 30, 30, 10, 30],
                  "Live service: metrics-driven, orchestrated, and waiting on nobody."),
    "ROLE-0233": (12, [30, 30, 30, 10, 50, 30, 30, 70, 30, 50, 50, 30, 70, 30, 30, 30, 30, 50],
                  "External voice to a global player base, routinely across languages."),
    "ROLE-0232": (22, [50, 50, 50, 30, 50, 30, 50, 50, 50, 70, 70, 50, 50, 70, 70, 70, 50, 70],
                  "Special-category reports, image and voice moderation, and translation "
                  "where meaning must survive: the only role here demanding on all three "
                  "modalities."),

    # ---- Higher Education & Research -------------------------------------
    "ROLE-0265": (6, [50, 50, 50, 70, 50, 50, 50, 50, 70, 70, 70, 70, 30, 70, 70, 10, 10, 30],
                  "Research data under governance: pipelines, retention and audit."),
    "ROLE-0262": (35, [90, 90, 90, 50, 70, 70, 90, 70, 70, 30, 70, 30, 10, 50, 50, 50, 10, 50],
                  "Work defined by problems nobody has framed, in a field that is unsettled."),
    "ROLE-0263": (7, [50, 50, 50, 10, 50, 50, 70, 70, 70, 70, 50, 30, 30, 30, 50, 10, 10, 30],
                  "Funder rules are strict and the submission is a binding persuasive document."),
    "ROLE-0264": (16, [30, 30, 30, 10, 50, 30, 30, 50, 50, 70, 70, 70, 50, 70, 50, 10, 10, 30],
                  "Student records carry immigration and funding consequence."),
    "ROLE-0261": (45, [70, 70, 90, 30, 50, 50, 70, 70, 50, 50, 50, 30, 10, 50, 50, 30, 70, 30],
                  "Authority-level domain knowledge delivered as live spoken interaction."),

    # ---- Management Consulting -------------------------------------------
    "ROLE-0280": (5, [30, 30, 30, 30, 50, 30, 70, 50, 70, 50, 50, 70, 30, 50, 50, 30, 10, 30],
                  "Systematic review across a large client corpus."),
    "ROLE-0279": (30, [70, 70, 50, 10, 70, 50, 50, 70, 70, 50, 70, 50, 50, 50, 50, 30, 30, 10],
                  "Runs client programmes independently, and is answerable for the read."),
    "ROLE-0278": (18, [50, 70, 50, 30, 50, 70, 90, 70, 70, 50, 70, 50, 30, 50, 30, 30, 10, 30],
                  "Establishes what is known in a market and where the gaps are."),
    "ROLE-0276": (24, [90, 90, 50, 10, 50, 70, 70, 90, 70, 50, 70, 30, 30, 70, 50, 30, 30, 10],
                  "Board-facing language where exact wording carries market consequence, "
                  "on material non-public information."),
    "ROLE-0277": (26, [70, 70, 50, 30, 70, 50, 50, 70, 50, 50, 50, 50, 30, 50, 50, 30, 30, 10],
                  "Change delivery: broad but not as sharp-edged as strategy."),

    # ---- Real Estate & Property Services ---------------------------------
    "ROLE-0285": (15, [30, 30, 50, 10, 70, 30, 30, 30, 50, 70, 70, 50, 70, 30, 70, 50, 30, 10],
                  "Statutory building compliance, and incidents that will not wait."),
    "ROLE-0284": (11, [50, 50, 50, 10, 50, 50, 30, 70, 50, 50, 70, 30, 30, 50, 50, 30, 30, 10],
                  "Lease terms are binding documents and an error is expensive."),
    "ROLE-0281": (9, [50, 70, 50, 10, 50, 70, 50, 50, 70, 50, 70, 50, 30, 50, 50, 30, 10, 10],
                  "Asset strategy on modelled returns across an interdependent portfolio."),
    "ROLE-0282": (28, [30, 30, 30, 10, 50, 30, 30, 50, 30, 70, 70, 50, 50, 50, 70, 30, 30, 30],
                  "Statutory duties on tenant safety and deposits, on personal data."),
    "ROLE-0283": (13, [50, 70, 70, 10, 50, 70, 70, 70, 70, 70, 90, 30, 30, 50, 90, 70, 10, 10],
                  "A registered valuer is individually accountable and a negligent "
                  "valuation is a legal liability: ten mandatory requirements, the "
                  "broadest profile in this set."),

    # ---- Renewable Energy -------------------------------------------------
    "ROLE-0200": (7, [50, 50, 50, 30, 70, 70, 30, 50, 50, 50, 50, 70, 50, 30, 50, 30, 10, 10],
                  "Portfolio performance against contracted availability."),
    "ROLE-0199": (6, [50, 70, 50, 70, 50, 90, 30, 30, 50, 50, 70, 70, 70, 30, 50, 10, 10, 10],
                  "Method-level forecasting where the technique is chosen and defended, "
                  "and an error is an imbalance charge within the hour."),
    "ROLE-0198": (9, [50, 70, 70, 30, 50, 70, 50, 50, 70, 70, 70, 50, 30, 30, 70, 50, 10, 10],
                  "Grid codes are strict and a connection study is checked by the operator."),
    "ROLE-0196": (12, [70, 70, 50, 10, 70, 50, 70, 70, 70, 50, 50, 30, 10, 30, 50, 50, 30, 10],
                  "Consent is won on contested evidence and persuasive written submissions."),
    "ROLE-0197": (16, [50, 50, 50, 10, 70, 50, 30, 30, 50, 70, 70, 70, 70, 30, 70, 50, 30, 10],
                  "Safety-critical generation assets under a real-time control regime."),
}


def main():
    with open(os.path.join(DATA, "roles.json")) as f:
        roles = json.load(f)
    with open(TAXONOMY) as f:
        taxonomy = json.load(f)

    added = 0
    for rid, (headcount, scores, note) in AUTHORED.items():
        if rid in roles:
            print(f"  skip {rid}: already profiled")
            continue
        t = taxonomy[rid]
        if len(scores) != 18:
            raise SystemExit(f"{rid} has {len(scores)} scores, expected 18")
        if any(s not in (10, 30, 50, 70, 90) for s in scores):
            raise SystemExit(f"{rid} has a score off the rubric bands")
        roles[rid] = {
            "role_id": rid,
            "name": t["name"],
            "industry": t["industries"][0],
            "function": t["function"],
            "profile": {
                cap: {
                    "score": s,
                    # Same convention as the shipped data: Mandatory exactly when
                    # the role cannot be performed acceptably below band 4.
                    "critical": "Mandatory" if s >= 70 else "Desirable",
                    # Reasoned judgement from the role definition. Never D.
                    "evidence_class": "E",
                }
                for cap, s in zip(CAPS, scores)
            },
            "headcount": headcount,
            "seniority": t["seniority"],
            "authority": t["decision_authority"],
            "note": note,
            "profile_source": "authored against the rubric, evidence class E, no SME review",
            "onet_analogue": t.get("onet_title"),
        }
        added += 1

    # The suite checks this, and the specification calls two roles returning the
    # same answer the failure that broke the previous build.
    seen = {}
    for rid, r in roles.items():
        key = tuple(v["score"] for v in r["profile"].values())
        if key in seen:
            raise SystemExit(f"duplicate profile: {rid} is identical to {seen[key]}")
        seen[key] = rid

    for rid, r in roles.items():
        if len(r["profile"]) != 18:
            raise SystemExit(f"{rid} has {len(r['profile'])} requirements")

    with open(os.path.join(DATA, "roles.json"), "w") as f:
        json.dump(roles, f, indent=1)
    print(f"added {added} roles, {len(roles)} total, all profiles unique and complete")


if __name__ == "__main__":
    main()

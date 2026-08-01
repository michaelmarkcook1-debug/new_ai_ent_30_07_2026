# Model allocation: what the evidence actually supports

**Question asked:** what share of enterprise work should run on frontier, mid-tier
and low-cost models? The Pulse currently shows 10 / 75 / 15 as an illustrative
split. This is the attempt to replace it with something measured.

**Answer: it cannot be replaced with a measured figure, and the reason is
substantive rather than a gap in the search.** What follows is what was looked
for, what was found, and what can honestly be said instead.

Researched 1 August 2026.

---

## Why no such number exists

The allocation ratio is not a property of work. It is a property of *work
measured against current model capability*, and that denominator moves every
few months. A figure measured today expires when the next model ships. Nobody
publishes it because it is not a stable quantity, and any source that did
publish one would be publishing a snapshot with a very short shelf life.

This is worth stating plainly to anyone who asks where the numbers came from.
The split is a planning assumption. It should be argued for, not cited.

## What was searched, and what came back

| Source | Status | Why it did not answer the question |
|---|---|---|
| O*NET Job Zones (db 30.0) | **Obtained**, 923 occupations | Occupation counts, not work volume. Useless without employment weights. |
| BLS OEWS employment weights | **Blocked** | 403 on every route: direct download, `download.bls.gov`, the v2 public API, and a separate network path. |
| Autor / Levy / Murnane task-content literature | Found, not usable | Establishes the routine vs non-routine framework and its direction of travel, but published shares are indexed to a base year rather than given as a workforce split. |
| Anthropic Economic Index | **Obtained**, useful | Measures complexity continuously, not in tiers. Does not give an allocation, but bounds the question usefully. See below. |

The O*NET Job Zone distribution by occupation count is 3.6 / 32.3 / 23.1 / 24.4
/ 16.7 per cent across zones 1 to 5. **This was deliberately not used.** It
counts occupation types, and there is no reason to think occupation types are
distributed like hours worked. Using it would repeat exactly the error already
avoided with the internal workflow catalogue, where 42 of 75 catalogued
workflows are "complex" without that saying anything about how much complex
work an enterprise does.

## What the evidence does support

These are real, current, citable, and they bear on the decision even though
none of them is the allocation.

**Tasks brought to AI are harder than average work.** Mean predicted education
required is 13.2 years for tasks in the economy, and 14.4 years for tasks
appearing in Claude usage. People do not reach for AI on a representative slice
of their work; they reach for it on the harder end.

**Model success falls as complexity rises, but not steeply.** 70 per cent on
sub-high-school tasks against 66 per cent on college-level tasks. The
four-point spread is smaller than the price spread between tiers, which is the
central argument for tiering.

**Usage is concentrated in a small slice of the workforce.** Computer and
mathematical occupations are about 4 per cent of US employment but 30 per cent
of surveyed AI usage. Management is 7 per cent of employment against 23 per
cent of usage. Any allocation drawn from observed usage would describe those
occupations, not an enterprise.

**Output mix, April to June 2026.** Artifacts appear in 93 per cent of
conversations. Conversational output and written deliverables are each roughly
a third; code and technical work about a sixth.

**Expectations run ahead of practice.** Over a third of respondents expect AI
to handle most or nearly all their work tasks within 12 months, while reported
current exposure sits about 10 percentage points lower in high-income
countries.

## What this means for the product

1. The split stays **illustrative and configurable**, and stays badged SAMPLE.
   That was already the case and this research confirms it was the right call.
2. The drawer now carries these findings and their sources, so the assumption
   is defensible rather than arbitrary. A reader who asks "where does 10 per
   cent come from" gets an honest answer: it is a planning assumption, here is
   what is actually measured nearby, and here is why the precise figure cannot
   be sourced.
3. **The 4-point success gap against the price gap is the real argument**, and
   it is now the one the section leads with. It does not depend on knowing the
   allocation. It says: capability barely degrades across tiers while price
   moves by an order of magnitude, so the burden of proof belongs on using the
   expensive tier, not on avoiding it.

## If you want a measured figure later

The obtainable version is an employment-weighted O*NET Job Zone distribution,
which needs BLS OEWS employment by SOC code. That is a single CSV, blocked from
this environment but downloadable manually from
`bls.gov/oes/tables.htm`. Dropped into `fixtures/`, the derivation is
straightforward and the Job Zone file is already obtained.

It would still measure *occupational preparation*, not task complexity, and
still would not be the allocation. It would be a better-grounded proxy than a
flat assumption.

## Sources

- Anthropic Economic Index, January 2026: <https://www.anthropic.com/research/anthropic-economic-index-january-2026-report>
- Anthropic Economic Index (Cadences), June 2026, covering 10 April to 10 June 2026: <https://www.anthropic.com/research/economic-index-june-2026-report>
- O*NET Job Zones, database 30.0: <https://www.onetcenter.org/dl_files/database/db_30_0_text/Job%20Zones.txt>
- O*NET Job Zone classification procedure: <https://www.onetcenter.org/dl_files/JobZoneProcedureUpdate.pdf>
- Autor, Levy and Murnane, *The Skill Content of Recent Technological Change*: <https://www.nber.org/papers/w8337>
- BLS OEWS tables (blocked from this environment, downloadable manually): <https://www.bls.gov/oes/tables.htm>

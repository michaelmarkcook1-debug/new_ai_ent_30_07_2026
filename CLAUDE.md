# AI Enterprise: working rules for documentation

Scoped to the docs and their Drive exports. The project's standing rules
(MERIDIAN codename, zero fabrication, lane badging, no em-dashes, never touch
an existing AnalystGenius repository) apply everywhere and are not restated
here.

---

## Two audiences, two records, two folders

**The pod is the development team.** Michael is not a developer. These are two
genuinely different readers, and one document serving both serves neither.

| Record | Reader | Register |
|---|---|---|
| `docs/CAPABILITY-HISTORY.md` | Michael | Plain language. What the product can do and when that changed. No implementation detail |
| `docs/RULES-AND-CALCULATIONS.md` | The pod | The data links, APIs, rules and calculations underneath, quoted from the code with file and line |

The six other files in `docs/` (ARCHITECTURE, API, DATA-SOURCES, RUNBOOK,
MVP-SCOPE, REVENUE_METHODOLOGY and the two notes) are all pod-facing and belong
with the technical record.

## Where the documentation lives

`docs/*.md` in this repository is the **source of truth**. Nothing else is.
Drive holds timestamped snapshots, which are read-only and go stale the moment
the repo moves on.

## Why Drive is folders and not documents

The Drive connector can create files and copy files. It cannot update one.
There is no permission that changes this; there is simply no update tool to
grant permission to. So a Doc cannot be refreshed at its existing URL.

The permanent links are therefore **the two folders**. They never change.
Inside them the folders stay flat and **each file carries the date and time it
was taken**, so the newest snapshot of any document is the current one and its
predecessors sit beside it in order.

Both folders already exist. Add to them, never create a third:

- Capability history, for Michael:
  <https://drive.google.com/drive/folders/12rt-uFIvUdaQoTM3ITW4MNnqTxRV9ss6>
- Technical record, for the pod:
  <https://drive.google.com/drive/folders/1E4vvvZqGAYMtZm4iRYfxV3yU2Gvo2hio>

```
AI Enterprise Capability History/        <- permanent link, never changes
├── CAPABILITY-HISTORY 2026-08-05 1956
└── CAPABILITY-HISTORY 2026-08-12 0930   <- newest is current

AI Enterprise Technical Record/          <- permanent link, never changes
├── RULES-AND-CALCULATIONS 2026-08-05 1956
├── ARCHITECTURE 2026-08-05 1956
└── ...
```

Naming: `DOCUMENT-NAME YYYY-MM-DD HHMM`, document first so sorting by name
groups every version of one document in date order. Take the time from the
system clock, never from memory, and state the timezone in the document header.

## What triggers what

Three tiers. Most work is tier 0. The point of the ladder is that a prompt
never creates a file, and a commit never creates a file.

### Tier 0: nothing happens

Bug fixes, copy edits, refactors, renames of internal symbols, comment
corrections, added tests, dependency bumps, styling, layout. About two thirds
of all commits. These leave no trace outside the commit itself.

### Tier 1: a line in one of the two records

A user-facing capability was **added, removed, renamed, or materially
changed** goes in `CAPABILITY-HISTORY.md`. Test: could a returning user notice
without being told? If no, it is tier 0.

A **constant, threshold, weight, formula, endpoint or data source** changed
goes in `RULES-AND-CALCULATIONS.md`, in the same commit as the code. See
faithfulness below: this one is not optional and not deferrable.

Many changes are one or the other. Some are both, and then both get a line.

### Tier 2: a new timestamped file in Drive

All three conditions must hold.

1. **Something the reader of that folder would need to re-read has changed.**
   Mechanically checkable: `git diff --stat <last-export> -- docs/` returning
   nothing means no export.
2. **At most one snapshot per document per day.** A 48-commit day produces one
   file per changed document, not 48.
3. **The user said yes.** Never export unprompted.

The two folders export independently. A week of pure refactoring updates the
technical record and leaves the capability history untouched, which is correct
and not an oversight.

## Faithfulness of the technical record

`RULES-AND-CALCULATIONS.md` is the one document where being approximately right
is worse than being absent, because the pod will act on it without re-deriving
it.

- **Quote, do not summarise.** Every constant carries the file and line it was
  read from. A paraphrased threshold is a threshold that will drift.
- **Read the code, never recall it.** Extract constants with a grep or a read
  at the moment of writing.
- **Same commit as the change.** A register updated later was wrong in between.
- **Name the test where one pins the constant.** A number with a test behind it
  is a different kind of fact from one without.
- **Cite the commit** the snapshot was verified against, in the header.

## Who does the noticing

Claude, not the user. The user should never have to remember to ask. When
tier 2 conditions 1 and 2 are met, say so plainly and once, name what changed
since the last snapshot, and wait. Do not repeat the offer in the same session
if declined.

This is the whole point of the ladder: the noticing is automatic, the file
creation is not.

## Before any export

Exports propagate whatever is in the docs into a second surface, so the
standing rules are checked at the boundary rather than after:

- **No em-dashes.** Scan every file under `docs/` for codepoint U+2014; the
  count must be zero. The codepoint is named here rather than typed, so this
  file does not trip the check it defines.
- **No fabricated figures.** Every number in the docs is live, dataset-badged,
  or marked sample, the same rule the app itself follows.
- **No secrets.** No key, token or connection string, including in examples.
  `.env.example` values stay empty.
- **Right folder.** Plain-language records never go in the technical folder and
  vice versa. A document in the wrong folder is read by the wrong person.

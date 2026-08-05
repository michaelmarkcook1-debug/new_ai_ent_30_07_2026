# AI Enterprise: working rules for documentation

Scoped to the docs and their Drive exports. The project's standing rules
(MERIDIAN codename, zero fabrication, lane badging, no em-dashes, never touch
an existing AnalystGenius repository) apply everywhere and are not restated
here.

---

## Where the documentation lives

`docs/*.md` in this repository is the **source of truth**. Nothing else is.
Google Drive holds dated exports of it, and those exports are read-only
snapshots that go stale the moment the repo moves on.

## Why Drive is a folder and not a document

The Drive connector can create files and copy files. It cannot update one.
There is no permission that changes this; there is simply no update tool to
grant permission to. So a Google Doc cannot be refreshed at its existing URL,
and every revision would otherwise mint a new link.

The permanent link is therefore **the folder**, not any file inside it. Drive
maintains the index for free: a new dated subfolder appears, sorted by date,
and the folder URL never changes. One bookmark, forever.

The folder already exists. Add to it, never create a second one:
<https://drive.google.com/drive/folders/1joyMbQdmdIvBjDabZHLe0oTsp-yBJbI3>

```
AI Enterprise Dev Docs/            <- the permanent link, never changes
├── 2026-08-05/                    <- one subfolder per export
│   ├── CHANGELOG
│   ├── ARCHITECTURE
│   └── ...
└── 2026-08-12/
    └── ...
```

## What triggers what

Three tiers. Most work is tier 0. The point of the ladder is that a prompt
never creates a file, and a commit never creates a file.

### Tier 0: nothing happens

Bug fixes, copy edits, refactors, renames of internal symbols, comment
corrections, added tests, dependency bumps, styling, layout. About two thirds
of all commits. These leave no trace outside the commit itself.

### Tier 1: a line in `docs/CHANGELOG.md`

A user-facing capability was **added, removed, renamed, or materially
changed**. A new tab. A panel dropped. A module renamed in the navigation. A
chart that answers a question it could not answer before.

Test: could a returning user notice without being told? If no, it is tier 0.

### Tier 2: a new dated folder in Drive

All three conditions must hold.

1. **Something a developer would need to re-read has changed.** A new
   subsystem, a new data source, a new external dependency, a change to how
   data is sourced, guarded, badged or cached, or a `docs/*.md` file materially
   rewritten. Mechanically checkable: `git diff --stat <last-export-tag> -- docs/`
   returning nothing means no export.
2. **At most one folder per calendar day.** A 48-commit day produces one
   folder, not 48. If a same-day export is genuinely wanted, it lands in that
   day's folder with a `-v2` suffix rather than creating a second folder.
3. **The user said yes.** Never export unprompted.

## Who does the noticing

Claude, not the user. The user should never have to remember to ask. When
tier 2 conditions 1 and 2 are met, say so plainly and once, name what changed
since the last export, and wait. Do not repeat the offer in the same session
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

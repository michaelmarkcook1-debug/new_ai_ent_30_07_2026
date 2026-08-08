# onet-job-zones.txt: where it came from, and why nothing reads it

Written 8 August 2026, after a data-source audit could not establish this
file's provenance from the repository alone. The answer existed in
`docs/model-allocation-research.md` and in the commit that added the file
(`30669cd`), but not next to the file, so anyone meeting it here had no way to
know what it was. That is what this note fixes.

## What it is

O*NET Job Zones, database 30.0. 923 occupations, each assigned to one of five
zones by the preparation the occupation requires.

- Downloaded from
  <https://www.onetcenter.org/dl_files/database/db_30_0_text/Job%20Zones.txt>
- Classification procedure:
  <https://www.onetcenter.org/dl_files/JobZoneProcedureUpdate.pdf>
- Obtained during the model-allocation research, committed in `30669cd`
- **Re-verified 8 August 2026: byte-for-byte identical to the upstream file at
  that URL.** Nothing has been edited, reformatted or filtered.

Tab-separated, with the upstream's own header row:
`O*NET-SOC Code`, `Job Zone`, `Date`, `Domain Source`.

## Why no code reads it

Deliberately, and the reason is worth keeping.

It counts **occupation types, not hours worked**. The distribution across zones
1 to 5 is 3.6 / 32.3 / 23.1 / 24.4 / 16.7 per cent by occupation count, and
there is no reason to think occupation types are distributed like the work an
enterprise actually does. Using it as a proxy for how work splits across model
tiers would repeat exactly the error already avoided with the internal workflow
catalogue, where 42 of 75 catalogued workflows are "complex" without that
saying anything about how much complex work an organisation performs.

So the figure it would produce would look measured and would not be. It is kept
rather than deleted because it is one join away from being useful.

## What would make it usable

Employment weights by SOC code, from the BLS Occupational Employment and Wage
Statistics. Join on the SOC code, weight each zone by employment rather than by
occupation count, and the distribution becomes employment-weighted.

**When the research ran, every BLS route returned 403**: the direct download,
`download.bls.gov`, the v2 public API and a separate network path. That block
is why this file has sat unused.

**Re-tested 8 August 2026, and the block has lifted:**

| Route | Then | Now |
|---|---|---|
| `bls.gov/oes/tables.htm` | 403 | **200** |
| `download.bls.gov/pub/time.series/oe/` | 403 | **200** |
| `bls.gov/oes/special-requests/oesm23nat.zip` | not reached | **200** |
| `api.bls.gov/publicAPI/v2/...` | 403 | 503 |

The national OEWS archives are reachable. Nobody has acted on that yet, and it
should not be acted on quietly: see below.

## The caveat that survives the join

Even employment-weighted, this measures **occupational preparation, not task
complexity**, and it still is not the model-allocation split. The research
concluded that split cannot be measured at all, because it is a property of
work measured against current model capability, and that denominator moves
every time a model ships.

So an employment-weighted Job Zone distribution would be a better-grounded
proxy than a flat assumption, and it would still be a proxy. Anything derived
from it has to be badged as what it is rather than promoted to a measurement
because the inputs got harder to obtain.

The allocation on screen stays illustrative, configurable and badged SAMPLE
until somebody decides otherwise deliberately.

## Related

- `docs/model-allocation-research.md`: the full research, what was tried, and
  what it concluded
- `lib/pulse/allocation.ts`: the illustrative split this file was meant to
  replace and does not

# Estimating revenue for companies that publish nothing

**Working document.** Companion to [DATA-SOURCES.md](DATA-SOURCES.md). The
rules below are enforced in code (`lib/finance/private-revenue.ts`) and held by
tests (`tests/private-revenue.test.ts`), so this document describes what the
product actually does, not what it aspires to.

The product's hard rule is zero fabricated figures. Estimating undisclosed
revenues is the single easiest place to break that rule while appearing not
to, because arithmetic launders assumptions into numbers. The methodology
below exists to make every assumption visible at the point of use.

---

## The lanes, in evidence order

A vendor's revenue is presented on exactly one of four footings, and the
footing is always named on screen. Higher lanes beat lower ones; lanes are
never blended into a single figure.

### Lane 1: REPORTED

A named publisher put the figure on the record. The figure is shown with the
verbatim sentence it was read from, the publisher, and the date.

Rules, all test-enforced:

- **Basis is carried, never normalised.** A run-rate (one month × 12), an ARR
  figure (contracted, not recognised), a GAAP annual figure and a projection
  are four different quantities. Each record declares which it is, and the
  display prints the source's own framing.
- **The latest non-projection figure wins.** These companies' revenues move
  fast enough that a year-old figure presented as current would be wrong by
  design. The full dated series is kept and shown: the trajectory is often
  more informative than the point.
- **A projection never becomes the figure.** "Expects to reach $X" is a hope
  with a date on it. A vendor whose only record is a projection falls through
  to Lane 2 rather than wearing the projection as fact.
- **Floors stay floors.** "Above $400M" is rendered as "above $400M", and
  anything derived from it says so.

### Lane 2: IMPLIED (valuation ÷ multiple band)

No revenue figure is on the record, but a valuation is. Revenue is then
inferred as valuation ÷ multiple, where the multiple is the one input nobody
outside the company knows. So:

- The multiple is a **visible control**, not a buried constant. The reader
  moves it and watches the range move.
- The output is **always a range across the band, never a point**. The width
  of the range is presented as the finding: outside these companies, nobody
  knows, and anyone quoting a single figure is guessing.
- The band is anchored by **observed pairs only**: vendors where both a
  valuation and a non-projection revenue are on the record. Each valuation is
  paired with the revenue figure nearest in time to it.
- **Calibration classes.** Pairs only calibrate the band for their own vendor
  class (`frontier_lab` / `data_platform` / `other`). A data platform priced
  at 15× must never lend its multiple to a frontier lab priced at 50×, and
  vice versa: mixing them would smuggle one business's economics into
  another's estimate under cover of arithmetic.
- An **in-talks valuation is carried but flagged**: everything derived from it
  inherits "reported intention", not "fact".

### Lane 3: CROSS-CHECK (share of a measured market)

Where an independent measurement exists (Menlo Ventures' $8.4B enterprise LLM
spend, with reported vendor shares), share × market size gives a bracket for
one **slice** of a vendor's revenue.

- Shown as a **separate lane, never blended** into Lanes 1–2.
- Explicitly labelled with what the slice covers and what it cannot: an
  enterprise-API spend measure says nothing about consumer subscriptions,
  and treating it as total revenue would understate every vendor with a
  consumer business.
- **When the lanes disagree by an order of magnitude, the gap is the
  finding.** Live example: a ~40% share of Menlo's $8.4B implies ~$3.4B for
  Anthropic's enterprise-API slice, against a reported $47B total run-rate.
  The panel says what that means: most of the reported total sits outside
  what the enterprise-API measure can see, rather than reconciling it away
  or letting the reader assume one of the numbers must be wrong.

### Lane 4: NO BASIS

Nothing published and nothing inferable. The absence is reported as an
absence, with the reason. This is the normal state for a private company and
is never "filled".

---

## What is refused outright

| Refused | Why |
|---|---|
| Compute/infrastructure commitments as valuations | An eight-year AWS deal says nothing about worth or earnings. Dividing it by a multiple is meaningless, however large the headline. The record carries these under `notValuations` with the reason. |
| Projections as current figures | A hope with a date on it. Carried in the series, excluded from the disclosed lane and from calibration. |
| Point estimates from single-route inference | A single number from valuation ÷ assumed multiple would be the most confidently wrong figure on the platform. |
| Cross-class multiple calibration | Databricks' economics are not Anthropic's. Test-enforced. |
| Headcount × revenue-per-employee | Double-unknown arithmetic: neither the headcount nor the sector RPE for these companies is on the record with any reliability. Rejected rather than shown with a caveat. |
| Undated figures | An observation without a time cannot go on a timeline. Every record carries the date the figure was true. |

---

## How figures enter the record

1. Candidate figures are mined from the AIE news feed and named-publisher web
   reporting, never from memory.
2. Each candidate is **adversarially verified** before entering the record:
   reality (can a reader follow the citation), basis classification, date,
   double-counting against existing records, and not-a-figure checks
   (compute commitments, funding mistaken for revenue, in-talks upgraded to
   closed).
3. Survivors land in `lib/finance/data/private-figures.json` with publisher,
   date, verbatim quote, basis, floor flag, vendor class and caveats.
   Tests reject records missing any of these.
4. The same file feeds the movement catalogue as dated observations:
   `observed_at` is when the figure was true, one metric per basis so
   movement never compares a run-rate to a GAAP annual figure, and in-talks
   valuations get a separate metric from closed rounds.

---

## What verification actually changed (a worked example)

The record was mined from the AIE news feed, then each load-bearing figure was
reality-checked against independent reporting before entry. The checks were
not ceremonial: every category of error the methodology anticipates showed up
in the first mining pass:

| Check | What it caught |
|---|---|
| **Date** | The feed re-reported Anthropic's April "$30B surpassed" on 2 July, and its June "$47B crossed" on 15 June. Read off feed dates, the two looked like an unresolved contradiction with $30B latest; verified against primary reporting they are a trajectory ($9B Dec → $30B Apr → $47B Jun) and the June figure is the current one. |
| **Not-a-figure** | xAI's "potentially over $40 billion in revenue" is a contracted compute stream sold to a single customer through 2029: carried as context, refused as revenue. |
| **Wrong company** | A $28M DoD contract reported for "Cohere Technologies" belongs to a wireless OTFS firm, not Cohere AI. Recorded in the exclusions so it cannot be transcribed again. |
| **Garbled item** | A feed item crediting Databricks with a "$4B run-rate Series K" in June 2026 contradicted the company's own December PR ($4.8B, Series L) and CNBC's June figure ($6.9B). Discarded. |
| **State inflation** | Databricks' $188B round is a signed term sheet, not a closed round; the feed's framing implied closed. Recorded as reported, with the caveat travelling into every derived figure. |
| **Fake corroboration** | Cohere's $240M ARR appears in three outlets, all citing one CNBC investor memo: one source, not three, and the record says so. |

## Reading an estimate

Treat every range as an order of magnitude, not a forecast. The panel exists
to answer "is this a hundred-million or a ten-billion business", and it will
not settle anything finer. When two lanes disagree, the disagreement is the
finding.

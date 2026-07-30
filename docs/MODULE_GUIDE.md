# MODULE_GUIDE.md (internal build guide)

How every module in this repo is built. Written for parallel module builds;
follow it exactly so the app reads as one product.

## Hard rules (from the spec, non-negotiable)

1. The work engine is referred to ONLY as MERIDIAN, everywhere.
2. Zero fabrication: every number is (a) live BoardRadar, (b) AIE dataset
   from lib/aie/ with its native labels, or (c) SAMPLE badged. Missing data
   renders an honest empty state ("Awaiting public disclosure"), never an
   invented figure.
3. No quadrant charts, no wave charts, no league-table or medal styling.
   Never the words Magic Quadrant, Wave or PEAK. Third-party analyst
   recognitions only under a "Third-party signals" divider, attributed,
   never blended into an AG score.
3b. **Comparability: rank within a market category, never across one.** A
   chip foundry, a cloud platform and a CRM assistant do not share a
   yardstick, so one ordered list containing all three asserts a comparison
   the evidence cannot support. Any surface that ranks, sorts or compares
   vendors MUST group by the dataset's own `category` field and order only
   inside a group. Use `groupByCategory`, `categoryOf`, `categoriesPresent`,
   `COMPARABILITY_NOTE` and `THIN_CATEGORY_NOTE` from `lib/comparability`;
   never hand-roll the rule. Where a category holds fewer than three
   tracked vendors, mark it thin and say the order is a tier, not a rank.
   Sorting controls must reorder within a category, never merge categories.
4. British English in ALL UI copy ("per cent", "analyse", "colour"). No
   em-dashes anywhere: use commas, colons, parentheses or "to". Code
   comments in American English.
5. Secrets stay server-side; all BoardRadar traffic goes through
   /api/br/[...path]; never fetch the upstream API directly from a page.

## Module anatomy

Each module lives in `app/(ai-ent)/<module>/` with:
- `page.tsx`: server component; metadata title "<Module> | AI Enterprise".
- `data.ts`: the module's data adapter (fixture loading, AIE imports,
  proxy paths). Modules import ONLY from `lib/` and their own folder.
- `components/*.tsx`: module components, client where interactive.
- Sample fixtures go in `fixtures/sample/<module>.json` and conform to the
  relevant type; every invented value carries the provenance envelope with
  `sourceBasis: "sample"`.

## Shared building blocks (lib/ui)

- `PageHeader` (title, dated subtitle, `lanes` prop for the provenance
  legend), `EmptyState`, `StubState`, `DemoFooter` from `lib/ui/page`.
- `LaneBadge` (live | aie | sample | mock | stub), `ProvenanceBadge` (API
  envelope passed through), `SeverityBadge`, `CategoryChip`, `HorizonTag`,
  `SentimentPill` from `lib/ui/badges`.
- `ScorePill` (0 to 100 banded, `estimated` adds "est.", null renders the
  locked no-disclosure state), `KpiGauge`, `DerivationDrawer` from
  `lib/ui/score`. EVERY score must be adjacent to a DerivationDrawer.
- `EditorialBanner`, `InsightCard`, `QuestionChips` from `lib/ui/cards`.
- `NewsList` from `lib/ui/news`; `Accordion` from `lib/ui/accordion`.
- `MicroLabel` from `lib/ui/micro` for ALL-CAPS metric labels.

## Data access

- Client components: `brFetch<T>("path", { ticker: "MSFT" })` from
  `lib/br-client`; it reports `source` ("live" | "mock") so you MUST swap
  the LaneBadge to `mock` ("Cached sample") when source is mock, and render
  the friendly error state with the `code` when it fails.
- AIE dataset: import from `lib/aie/*` (barrel: `lib/aie`). Badge with
  `<LaneBadge lane="aie" />` and keep the dataset's own confidence labels
  visible where present. AIE evidence language: "confidence-labelled",
  "derived signal", claims "below the strong-evidence bar" are suppressed.
- The tracked vendor roster: `TRACKED_VENDORS` from `lib/aie/vendors`
  (layer, isPublic, ticker, brTicker). brTicker non-null means the vendor
  is live in BoardRadar for financials/reputation/cyber (see
  DATA_COVERAGE.md for the exact matrix).

## Look and feel

- Page rhythm: PageHeader, then (on dashboards) EditorialBanner, then KPI
  strip, then primary visual, then supporting tables, then insight columns
  or accordions, then news. Small cards: rounded-lg, border-base-300,
  bg-base-100, p-4.
- Typography: headings inherit Plus Jakarta Sans; figures and micro labels
  use font-mono (JetBrains Mono); body 14px Inter.
- Text sizes in use: page h1 text-2xl font-extrabold; card h3 text-[13px]
  or text-[15px] font-bold; body text-[13px]; captions text-[11px]
  text-muted; micro labels via .micro-label.
- Colours only via the theme tokens (bg-base-100/200, border-base-300,
  text-base-content, text-muted, bg-primary, text-good/warn/error and the
  *-bg variants). Never hex values in components.
- Every page must render correctly in dark mode (tokens handle it; avoid
  hard-coded whites/blacks).
- Charts: inline SVG or Recharts, no other libraries. Date-stamp fast-
  moving data (micro label GENERATED plus a date).

## Calls to action

Dashboards link into deeper modules (e.g. vendor names link to
/vendor-view/<id>; delivery content links to /ecosystem-navigator). No dead
ends: unfinished areas render StubState, never a broken link.

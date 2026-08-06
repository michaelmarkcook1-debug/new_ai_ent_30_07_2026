import Link from "next/link";
import { MicroLabel } from "@/lib/ui/micro";
import { LaneBadge } from "@/lib/ui/badges";
import type { Brief, BriefLine, Health } from "@/lib/desk/brief";

// Today's Brief.
//
// Ported from The Security Desk, 6 August 2026. The thing worth copying is not
// the layout: it is that every row pairs a fact with what to do about it, and
// that the verdict at the top is computed from the reader's own shortlist
// rather than asserted about the market.
//
// This carries the `finding` edge because the verdict genuinely is AG's
// conclusion, drawn from named inputs. The rows beneath it are not: each one
// links the source it came from, and the colour on a row is semantic (whose
// problem it is) rather than decorative.
//
// An empty portfolio is stated, never rendered blank. A reader with nothing
// shortlisted is told what the market read is and invited to build one, the
// same rule the rest of the Pulse follows: a blank panel teaches somebody the
// feature is broken rather than unfilled.

const HEALTH: Record<
  Health,
  { dot: string; chip: string; label: string }
> = {
  green: {
    dot: "bg-good",
    chip: "border-good/50 bg-good-bg text-good",
    label: "Clear",
  },
  amber: {
    dot: "bg-warn",
    chip: "border-warn/50 bg-warn-bg text-warn",
    label: "Watch",
  },
  red: {
    dot: "bg-error",
    chip: "border-error/60 bg-bad-bg text-error",
    label: "Action",
  },
  unset: {
    dot: "bg-muted",
    chip: "border-base-300 bg-base-200/60 text-muted",
    label: "Not set",
  },
};

// A shade per beat, so the eye learns the rhythm of the page.
const SECTION_TONE: Record<string, string> = {
  security: "text-warn",
  regulation: "text-primary",
  shipped: "text-good",
  encroachment: "text-secondary",
};

function Line({ line }: { line: BriefLine }) {
  const body = (
    <>
      <p className="text-[13px] font-medium leading-snug">
        {line.fact}
        {line.yours ? (
          <span className="ml-1.5 whitespace-nowrap rounded border border-primary/40 bg-primary/10 px-1 py-0 align-middle font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
            yours
          </span>
        ) : null}
      </p>
      <p className="measure mt-0.5 text-[12.5px] leading-relaxed text-muted">
        {line.act}
      </p>
      <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-primary">
        {line.source.name} →
      </span>
    </>
  );
  return (
    <li className="border-b border-base-300/50 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      {line.href ? (
        <Link href={line.href} className="block hover:opacity-80">
          {body}
        </Link>
      ) : (
        <a
          href={line.source.url}
          target="_blank"
          rel="noreferrer"
          className="block hover:opacity-80"
        >
          {body}
        </a>
      )}
    </li>
  );
}

export function TodaysBrief({ brief }: { brief: Brief }) {
  const h = HEALTH[brief.health];

  return (
    // `finding`, not `finding-strong`. The verdict here is genuinely AG's
    // conclusion, so it keeps the judgement edge, but globals.css reserves the
    // strong treatment for "the hero judgement on a page: the Pulse", and that
    // is Today's Pulse further down. This panel shipped as finding-strong and
    // sat directly above it, which gave the page two heroes competing at the
    // same weight and displaced the one the rule names. First thing Michael
    // noticed. Order still puts the overnight read first, which is right; the
    // emphasis does not.
    <section className="finding rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Today's brief"
          tooltip="What changed since yesterday, each fact paired with what to do about it, judged against the vendors you shortlisted."
          heading
        />
        <div className="flex flex-wrap items-center gap-2">
          <LaneBadge lane="derived" />
          <span
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${h.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} aria-hidden />
            Portfolio · {h.label}
          </span>
        </div>
      </div>

      <h2 className="mt-2 text-lg font-bold">{brief.headline}</h2>
      <p className="measure mt-1 text-[13px] leading-relaxed">{brief.reason}</p>

      {brief.watched === 0 ? (
        <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
          <b>Nothing here is filtered to you yet.</b> Shortlist the vendors you
          actually run and the verdict above becomes one about your portfolio,
          with incidents, retirements and weak contract terms called out by
          name.{" "}
          <Link
            href="/vendor-view"
            className="font-semibold text-primary hover:underline"
          >
            Pick your vendors
          </Link>
          .
        </p>
      ) : null}

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {brief.sections.map((s) => (
          <div key={s.key}>
            <p
              className={`micro-label mb-1 ${SECTION_TONE[s.key] ?? "text-muted"}`}
            >
              {s.label}
            </p>
            <ul>
              {s.lines.map((l, i) => (
                <Line key={`${s.key}-${i}`} line={l} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* What the brief could and could not read. A thin brief should read as
          a quiet day or a dark source, never as a broken page. */}
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted">
        {brief.statusesRead} of {brief.statusesAttempted} status pages answered
        · {brief.newsRead} stor{brief.newsRead === 1 ? "y" : "ies"} across five
        feeds · regulation from the tracked register
        {brief.statusesRead < brief.statusesAttempted
          ? " · a source that did not answer shows nothing rather than something invented"
          : ""}
      </p>
    </section>
  );
}

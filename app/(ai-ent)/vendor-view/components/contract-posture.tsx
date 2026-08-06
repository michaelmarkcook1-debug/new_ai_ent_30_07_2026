import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import type { VendorDossier } from "@/lib/desk/dossier";
import type { Mark, MarkState } from "@/lib/shield/data";
import { FLAG_LABEL, type SovereigntyFlag } from "@/lib/shield/sovereignty";

// Contract posture: the half of a vendor profile that comes from their lawyers
// rather than from an assessment.
//
// Ported from The Security Desk, 6 August 2026. Everything else on this page
// is AG's reading of a vendor. This is the vendor's own reading of itself, in
// their words, with the document it was read from. The two answer different
// questions and are kept visually apart for that reason.
//
// A surface with no entry says so. Groq is in the tracked directory and its
// terms have not been read; that renders as an absence with a reason, never as
// a blank or a zero, because a zero here would read as a verdict.

const MARK_GLYPH: Record<MarkState, string> = {
  protective: "●",
  conditional: "◐",
  adverse: "○",
  unverified: "–",
};
const MARK_TONE: Record<MarkState, string> = {
  protective: "text-good",
  conditional: "text-warn",
  adverse: "text-error",
  unverified: "text-muted",
};
const MARK_LABEL: Record<MarkState, string> = {
  protective: "Protective",
  conditional: "Conditional",
  adverse: "Adverse",
  unverified: "Not established",
};
const FLAG_TONE: Record<SovereigntyFlag, string> = {
  "hard-stop": "border-error/50 bg-bad-bg text-error",
  consideration: "border-warn/50 bg-warn-bg text-warn",
  none: "border-base-300 bg-base-200/60 text-muted",
};

function MarkRow({ label, mark }: { label: string; mark: Mark }) {
  return (
    <div className="border-b border-base-300/60 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={`font-mono text-[15px] leading-none ${MARK_TONE[mark.state]}`}
          aria-hidden
        >
          {MARK_GLYPH[mark.state]}
        </span>
        <span className="text-[12.5px] font-semibold">{label}</span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${MARK_TONE[mark.state]}`}
        >
          {MARK_LABEL[mark.state]}
        </span>
      </div>
      <p className="measure mt-1 pl-5 text-[12.5px] leading-relaxed text-muted">
        {mark.note}
      </p>
      {mark.source ? (
        <a
          href={mark.source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 ml-5 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
        >
          {mark.source.name} →
        </a>
      ) : (
        <p className="mt-1 ml-5 font-mono text-[10px] uppercase tracking-wider text-muted">
          No receipt obtained this pass
        </p>
      )}
    </div>
  );
}

export function ContractPostureSection({
  dossier,
  vendorName,
}: {
  dossier: VendorDossier;
  vendorName: string;
}) {
  const { shield, sovereignty, deprecations, encroachedBy, encroachesOn } =
    dossier;

  if (dossier.empty) {
    return (
      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Contract posture"
            tooltip="What this vendor's own published terms permit, read from the documents themselves."
          />
        </div>
        <p className="measure mt-2 text-[13px] leading-relaxed">
          <b>{vendorName}&apos;s terms have not been read.</b> The Privacy &amp;
          IP Shield covers the model providers whose own terms govern customer
          data; nothing here is a judgement about {vendorName}, only a statement
          that we hold no receipt for it.{" "}
          <Link href="/trust-rank" className="text-primary hover:underline">
            See who is covered
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Contract posture"
          tooltip="What this vendor's own published terms permit, quoted from the documents, plus which legal system reaches them and what they are retiring."
          heading
        />
        <div className="flex flex-wrap items-center gap-2">
          <LaneBadge lane="cited" />
          {shield ? (
            <span className="font-mono text-[11px] tabular-nums text-muted">
              Shield {shield.score}/4 · {shield.coverage}/4 read
            </span>
          ) : null}
        </div>
      </div>

      <p className="measure mt-2 text-[13px] leading-relaxed">
        Everything else on this page is our reading of {vendorName}. This is
        theirs: each line below is quoted from a document they published, with a
        link to it.
      </p>

      {shield ? (
        <div className="mt-3">
          <MarkRow
            label="Will not train on our data"
            mark={shield.marks.training}
          />
          <MarkRow
            label="Retention / zero-retention"
            mark={shield.marks.retention}
          />
          <MarkRow label="Output IP indemnity" mark={shield.marks.indemnity} />
          <MarkRow label="Data residency" mark={shield.marks.residency} />
        </div>
      ) : (
        <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
          Not on the Privacy &amp; IP Shield. Its terms have not been read, so
          there is no grade rather than a zero.
        </p>
      )}

      {sovereignty ? (
        <div className="mt-4">
          <p className="micro-label">Who can compel access</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${FLAG_TONE[sovereignty.flag]}`}
            >
              {FLAG_LABEL[sovereignty.flag]}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              {sovereignty.hqJurisdiction}
            </span>
          </div>
          <p className="measure mt-1 text-[12.5px] leading-relaxed text-muted">
            {sovereignty.flagNote}
          </p>
        </div>
      ) : null}

      {deprecations.length > 0 ? (
        <div className="mt-4">
          <p className="micro-label">
            Retiring · after the date, these calls fail
          </p>
          <ul className="mt-1 grid gap-1">
            {deprecations.map((d) => (
              <li
                key={d.model}
                className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]"
              >
                <span
                  className={`font-mono tabular-nums ${d.daysAway <= 30 ? "font-semibold text-warn" : "text-muted"}`}
                >
                  T minus {d.daysAway}d
                </span>
                <span className="font-mono">{d.model}</span>
                <span className="text-muted">to {d.replacement}</span>
                <a
                  href={d.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
                >
                  {d.source.name} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {encroachedBy.length > 0 || encroachesOn.length > 0 ? (
        <div className="mt-4">
          <p className="micro-label">Encroachment</p>
          <ul className="mt-1 grid gap-1.5">
            {encroachedBy.map((e) => (
              <li
                key={`${e.actor}-${e.against}`}
                className="text-[12.5px] leading-relaxed"
              >
                <b>{e.actor}</b> supplies {vendorName} and competes with it:{" "}
                <span className="text-muted">{e.note}</span>{" "}
                <a
                  href={e.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
                >
                  {e.source.name} →
                </a>
              </li>
            ))}
            {encroachesOn.map((e) => (
              <li
                key={`on-${e.actor}-${e.against}`}
                className="text-[12.5px] leading-relaxed"
              >
                {vendorName} competes with <b>{e.against}</b>, which it also
                depends on: <span className="text-muted">{e.note}</span>{" "}
                <a
                  href={e.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
                >
                  {e.source.name} →
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

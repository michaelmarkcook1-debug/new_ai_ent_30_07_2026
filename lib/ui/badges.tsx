import type {
  DataLane,
  ProvenanceEnvelope,
} from "@/lib/provenance";
import { LANE_LABEL } from "@/lib/provenance";

// Source-class badge: every figure on screen carries one (spec rule 4).
export function LaneBadge({ lane }: { lane: DataLane }) {
  const styles: Record<DataLane, string> = {
    live: "bg-good-bg text-good border-good/30",
    aie: "bg-aie-bg text-aie border-aie/30",
    // AIE content pulled live: the dataset's blue, with the live green ring.
    "aie-live": "bg-aie-bg text-aie border-good/60",
    // Quoted from the source's own document. Given the same neutral treatment
    // as derived, because both are honest about not being a live feed, and a
    // green badge on a legal term read three weeks ago would overstate it.
    cited: "bg-base-200 text-secondary border-secondary/40",
    // Computed by us, from real inputs. Neutral rather than green or amber,
    // because it is neither someone else's published figure nor an invented one.
    derived: "bg-base-200 text-secondary border-secondary/40",
    sample: "bg-warn-bg text-warn border-warn/30",
    mock: "bg-warn-bg text-warn border-warn/30",
    stub: "bg-base-200 text-muted border-base-300",
  };
  const label = LANE_LABEL[lane];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider border ${styles[lane]}`}
      title={
        lane === "live"
          ? "Live from the BoardRadar API"
          : lane === "aie"
            ? "Real AI Enterprise dataset content, re-used from the ranking-engine repository"
            : lane === "aie-live"
              ? "Current AI Enterprise content, pulled live from the deployed app's public API through our proxy"
              : lane === "cited"
                ? "Quoted from the vendor's own published document, carrying the URL it was read from and the date a human read it. Legal terms have no feed to poll, so the honest claim is the citation and its age, not a live badge"
                : lane === "derived"
                ? "Computed by AG from named inputs that can be re-fetched and checked. No source publishes this figure directly, and nothing in it is invented"
                : lane === "mock"
                ? "Recorded response served because live data was unavailable"
                : lane === "stub"
                  ? "Module in development"
                  : "Illustrative sample value, not a real measurement"
      }
    >
      {label}
    </span>
  );
}

// Provenance badge rendering the API envelope untouched.
export function ProvenanceBadge({ env }: { env: ProvenanceEnvelope }) {
  const colour: Record<string, string> = {
    disclosed: "bg-good-bg text-good",
    estimated: "bg-warn-bg text-warn",
    inferred: "bg-warn-bg text-warn",
    unavailable: "bg-base-200 text-muted",
    sample: "bg-warn-bg text-warn",
  };
  const note = [
    env.sourceNote ?? null,
  ]
    .filter(Boolean)
    .join(". ");
  const inner = (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs uppercase tracking-wider ${colour[env.sourceBasis] ?? "bg-base-200 text-muted"}`}
      title={note || env.sourceBasis}
    >
      {env.sourceBasis}
    </span>
  );
  if (env.sourceUrl) {
    return (
      <a href={env.sourceUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {inner}
      </a>
    );
  }
  return inner;
}

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function SeverityBadge({ severity }: { severity: Severity }) {
  const styles: Record<Severity, string> = {
    CRITICAL: "bg-bad-bg text-error",
    HIGH: "bg-warn-bg text-warn",
    MEDIUM: "bg-base-200 text-base-content",
    LOW: "bg-base-200 text-muted",
  };
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

export function CategoryChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-base-300 px-2 py-0.5 text-xs text-muted">
      {label}
    </span>
  );
}

export function HorizonTag({ horizon }: { horizon: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-muted">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      {horizon}
    </span>
  );
}

export function SentimentPill({ sentiment }: { sentiment: "Positive" | "Negative" | "Neutral" }) {
  const styles = {
    Positive: "bg-good-bg text-good",
    Negative: "bg-bad-bg text-error",
    Neutral: "bg-base-200 text-muted",
  } as const;
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[sentiment]}`}>
      {sentiment}
    </span>
  );
}

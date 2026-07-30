import { LaneBadge } from "@/lib/ui/badges";
import type { DataLane } from "@/lib/provenance";

export function PageHeader({
  title,
  subtitle,
  lanes,
  actions,
}: {
  title: string;
  subtitle?: string;
  lanes?: DataLane[];
  actions?: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{today}</p>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-[13px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
      {lanes && lanes.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="micro-label">Data lanes on this page</span>
          {lanes.map((l) => (
            <LaneBadge key={l} lane={l} />
          ))}
        </div>
      ) : null}
    </header>
  );
}

// Honest empty state: where data does not exist we say so (spec rule 4).
export function EmptyState({
  title = "Awaiting public disclosure",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-300 bg-base-200/50 px-4 py-8 text-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <p className="mt-2 text-[13px] font-semibold text-base-content/80">{title}</p>
      {detail ? <p className="mt-1 max-w-sm text-[11px] text-muted">{detail}</p> : null}
    </div>
  );
}

export function StubState({ module: moduleName }: { module: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-base-300 bg-base-200/50 px-4 py-16 text-center">
      <span className="micro-label">In development</span>
      <p className="mt-2 max-w-md text-[13px] text-muted">
        {moduleName} is scoped for this workspace and under active build. The
        navigation stays live so nothing dead-ends; content lands here next.
      </p>
    </div>
  );
}

export function DemoFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-base-300 bg-base-200/95 px-4 py-1 text-center font-mono text-[10px] text-muted backdrop-blur">
      Demo build. Sample data is badged.
    </footer>
  );
}

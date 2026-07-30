import { LaneBadge } from "@/lib/ui/badges";
import { CompanyTabs } from "./components/tabs";

export default function CompanyViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <header className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-warn-bg font-display text-[13px] font-extrabold text-warn">
            S
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">Shell</h1>
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
            Exemplar buyer
          </span>
          <LaneBadge lane="sample" />
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted">{today}</p>
        <p className="mt-1 max-w-3xl text-[12px] text-muted">
          The tailored view a customer sees of their own organisation. Shell is
          not in the coverage universe, so every figure here is a SAMPLE shaped
          exactly like the live response schemas: wiring a real buyer is a data
          swap, not a rebuild.
        </p>
      </header>
      <CompanyTabs />
      <div className="mt-4">{children}</div>
    </div>
  );
}

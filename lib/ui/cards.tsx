import {
  CategoryChip,
  HorizonTag,
  SeverityBadge,
  type Severity,
} from "@/lib/ui/badges";

// Editorial banner: "Analyst Insight" strip at the top of dashboard pages
// with a titled, dated narrative paragraph (house idiom).
export function EditorialBanner({
  title,
  date,
  children,
  badge,
}: {
  title: string;
  date: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="micro-label text-primary">Analyst Insight</span>
          {badge}
        </div>
        <span className="font-mono text-[10px] text-muted">{date}</span>
      </div>
      <h2 className="mt-1 text-[15px] font-bold">{title}</h2>
      <div className="mt-1 text-[13px] leading-relaxed text-base-content/85">
        {children}
      </div>
    </section>
  );
}

export interface Insight {
  severity: Severity;
  category: string;
  title: string;
  detail?: string;
  horizon: string;
}

// Insight card: severity badge, category chip, short title, time-horizon tag.
export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-lg border border-base-300 bg-base-100 p-3">
      <div className="flex items-center gap-2">
        <SeverityBadge severity={insight.severity} />
        <CategoryChip label={insight.category} />
      </div>
      <p className="mt-2 text-[13px] font-semibold leading-snug">{insight.title}</p>
      {insight.detail ? (
        <p className="mt-1 text-[12px] leading-snug text-muted">{insight.detail}</p>
      ) : null}
      <div className="mt-2">
        <HorizonTag horizon={insight.horizon} />
      </div>
    </div>
  );
}

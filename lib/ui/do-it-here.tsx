import Link from "next/link";
import { TOOLS, type ToolKey } from "./tools";

// The row that turns advice into something a reader can act on now.
//
// Rendered under a "what to do", never instead of it. The advice still has to
// stand on its own: this is the shortcut for someone who has read it and
// wants to start, not a replacement for saying what to start.

export function DoItHere({
  tools,
  label = "Do this here",
  className = "",
}: {
  tools: readonly ToolKey[];
  label?: string;
  className?: string;
}) {
  if (tools.length === 0) return null;
  return (
    <p className={`mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm ${className}`}>
      <span className="font-mono uppercase tracking-wider text-muted">
        {label}
      </span>
      {tools.map((k, i) => {
        const t = TOOLS[k];
        return (
          <span key={k} className="inline-flex items-baseline gap-2">
            {i > 0 ? <span className="text-muted/60">·</span> : null}
            <Link
              href={t.href}
              title={`${t.label}: ${t.does}.`}
              className="font-medium text-primary hover:underline"
            >
              {t.label}
            </Link>
          </span>
        );
      })}
    </p>
  );
}

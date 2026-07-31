import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import type { AllianceEdgeView } from "../data";

// Partnership depth distribution: how the tracked alliances split across
// depth bands, and how much of that is independently verified.
//
// Depth comes from the dataset's own strengthScore. The band boundaries are
// set here, and the drawer says so plainly, because the source publishes a
// continuous score and no banding of its own.

const SIZE = 140;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 54;
const STROKE = 20;

interface Band {
  key: string;
  label: string;
  colour: string;
  test: (s: number) => boolean;
  help: string;
}

const BANDS: Band[] = [
  {
    key: "deep",
    label: "Deep",
    colour: "var(--ag-primary)",
    test: (s) => s >= 0.75,
    help: "strengthScore of 0.75 or above: named, material and current.",
  },
  {
    key: "established",
    label: "Established",
    colour: "#2b50c8",
    test: (s) => s >= 0.5 && s < 0.75,
    help: "strengthScore from 0.5 up to 0.75: a working relationship with public evidence.",
  },
  {
    key: "emerging",
    label: "Emerging",
    colour: "#b45309",
    test: (s) => s < 0.5,
    help: "strengthScore below 0.5: recorded, but thin or early.",
  },
];

function arcPath(from: number, to: number): string {
  // Circumference-based dash would be simpler, but an explicit arc keeps each
  // segment independently hoverable.
  const a0 = (from * 2 * Math.PI) - Math.PI / 2;
  const a1 = (to * 2 * Math.PI) - Math.PI / 2;
  const x0 = CX + R * Math.cos(a0);
  const y0 = CY + R * Math.sin(a0);
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY + R * Math.sin(a1);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1}`;
}

export function DepthDonut({ edges }: { edges: AllianceEdgeView[] }) {
  const total = edges.length;
  const counts = BANDS.map((b) => ({
    band: b,
    count: edges.filter((e) => b.test(e.strengthScore)).length,
  }));

  const verified = edges.filter((e) => e.confidence !== "seed").length;
  const verifiedPct = total ? Math.round((verified / total) * 100) : 0;

  let cursor = 0;
  const segments = counts.map(({ band, count }) => {
    const from = cursor;
    const share = total ? count / total : 0;
    cursor += share;
    return { band, count, from, to: cursor, share };
  });

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-center gap-2">
        <MicroLabel
          label="Partnership depth"
          tooltip="How the tracked alliances distribute across depth bands, derived from the dataset's strengthScore."
        />
        <LaneBadge lane="aie" />
      </div>

      {total === 0 ? (
        <p className="mt-3 text-[12px] text-muted">
          No alliance edges are recorded.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="h-36 w-36 shrink-0"
            role="img"
            aria-label={`Partnership depth distribution across ${total} alliances`}
          >
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--ag-base-300)"
              strokeWidth={STROKE}
              opacity={0.45}
            />
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <path
                  key={s.band.key}
                  d={arcPath(s.from, s.to)}
                  fill="none"
                  stroke={s.band.colour}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                >
                  <title>
                    {s.band.label}: {s.count} of {total} (
                    {Math.round(s.share * 100)}%)
                  </title>
                </path>
              ))}
            <text
              x={CX}
              y={CY - 2}
              textAnchor="middle"
              className="fill-current"
              fontSize={22}
              fontWeight={800}
            >
              {total}
            </text>
            <text
              x={CX}
              y={CY + 13}
              textAnchor="middle"
              className="fill-[var(--ag-muted)]"
              fontSize={9}
            >
              alliances
            </text>
          </svg>

          <div className="min-w-[9rem] flex-1">
            <ul className="space-y-1">
              {segments.map((s) => (
                <li
                  key={s.band.key}
                  className="flex items-center justify-between gap-2 text-[12px]"
                  title={s.band.help}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: s.band.colour }}
                      aria-hidden
                    />
                    {s.band.label}
                  </span>
                  <span className="font-mono text-[11.5px] font-semibold">
                    {s.count}
                    <span className="ml-1 font-normal text-muted">
                      {Math.round(s.share * 100)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 border-t border-base-300 pt-1.5 font-mono text-[10px] text-muted">
              {verified} of {total} ({verifiedPct}%) above seed confidence
            </p>
          </div>
        </div>
      )}

      <div className="mt-2">
        <DerivationDrawer title="How depth is banded">
          <p>
            Depth is the dataset&apos;s own <code>strengthScore</code>, a
            continuous 0 to 1 value. The three bands are drawn here, not
            published by the source: deep is 0.75 and above, established is 0.5
            up to 0.75, emerging is below 0.5. The boundaries are stated so the
            banding can be checked rather than taken on trust.
          </p>
          <p className="text-muted">
            Depth is not confidence. A deep alliance can still be seed-graded if
            the evidence behind it has not been independently verified, which is
            why the verified count is reported separately rather than folded
            into the bands.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

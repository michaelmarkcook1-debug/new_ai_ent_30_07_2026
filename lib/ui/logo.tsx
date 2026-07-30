// The AnalystGenius house mark, traced from the supplied artwork on
// 30 July 2026. Fills with currentColor so one component serves every
// context: white inside the primary chip, brand-coloured on a plain
// background. The same artwork is mirrored at public/brand/ag-mark.svg for
// use outside React (favicon, exports); if the original vector turns up,
// update both path strings and nothing else changes.

export function AgMark({
  className = "",
  title = "AnalystGenius",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 376 376"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      {/* Sail: straight left edge up to the apex, convex right edge sweeping
          back down, with the triangular counter cut out (even-odd). */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M190 12 L8 352 L232 352 C232 352 268 300 268 208 C268 116 190 12 190 12 Z M190 190 L142 279 L238 279 Z"
      />
      {/* Detached foot: the parallelogram at the lower right. */}
      <path fill="currentColor" d="M256 279 L332 279 L370 352 L294 352 Z" />
    </svg>
  );
}

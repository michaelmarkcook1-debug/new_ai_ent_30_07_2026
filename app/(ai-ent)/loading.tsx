// What a reader sees while a tab is still assembling.
//
// There were no loading states anywhere in this app. Every route here is
// server-rendered on demand and several of them fetch live sources before the
// first byte, so a reader clicked a tab and got the previous page, motionless,
// until the new one arrived whole. Trust Rank takes one to two seconds doing
// real work: it pulls vendor status and overnight news at open. Measured 16
// August 2026.
//
// That silence is expensive here for a reason specific to this product. It
// spent a week genuinely broken, with pages taking thirty-eight seconds because
// a cache key carried a fetch timestamp, so a reader who waits with no feedback
// has recent grounds to believe it has happened again. A page that says it is
// working is not decoration; it is the difference between "slow" and "dead".
//
// This mirrors the real PageHeader rather than showing a generic spinner: the
// title block, the date line and the lane row all land in the same places, so
// the layout does not jump when the page replaces it.
//
// One file at the route-group level covers all eighteen tabs. Anything more
// specific would be eighteen skeletons to keep in step with eighteen layouts,
// and a stale skeleton is worse than an honest generic one.

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading this page</span>

      <header className="mb-4">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton mt-2 h-3 w-44 rounded" />
        <div className="skeleton mt-2.5 h-4 w-full max-w-[52rem] rounded" />
        <div className="skeleton mt-1.5 h-4 w-3/4 max-w-[40rem] rounded" />
        <div className="mt-3 flex items-center gap-1.5">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-4 w-16 rounded-full" />
          <div className="skeleton h-4 w-16 rounded-full" />
        </div>
      </header>

      <div className="rounded-lg border border-base-300 bg-base-100 p-5">
        <div className="skeleton h-4 w-48 rounded" />
        <div className="skeleton mt-3 h-4 w-full rounded" />
        <div className="skeleton mt-2 h-4 w-11/12 rounded" />
        <div className="skeleton mt-2 h-4 w-4/5 rounded" />

        <div className="mt-5 grid grid-cols-2 gap-3 @2xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-base-300 bg-base-200/40 p-3"
            >
              <div className="skeleton h-3 w-20 rounded" />
              <div className="skeleton mt-2 h-6 w-16 rounded" />
              <div className="skeleton mt-2 h-3 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Said plainly rather than left to the shapes. A reader who has waited
          thirty-eight seconds on this product before deserves to be told the
          difference between working and broken. */}
      <p className="measure mt-3 font-mono text-sm text-muted">
        Assembling this page. Live sources are being read now.
      </p>
    </div>
  );
}

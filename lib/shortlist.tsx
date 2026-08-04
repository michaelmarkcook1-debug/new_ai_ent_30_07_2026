"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// The buyer's own shortlist, held in the browser.
//
// Every surface in this app could tell you who was strong at something, and
// none of them let you keep the answer. You would find Harvey on the Legal
// workflow, Glean on Customer, and then have nowhere to put them.
//
// Deliberately localStorage and not a backend: this is the user's working set,
// it belongs to them, and a demo should not require an account to make a list.
//
// It is also mirrored into a cookie, which is the whole reason "since you last
// looked" can be rendered on the server. localStorage is invisible to a server
// component, so a watchlist held only there can personalise nothing above the
// fold: the page would have to ship every change and filter after hydration,
// which is both slower and a flash of the wrong content.
//
// The cookie is the watchlist, not an identity. There is no account here and
// no server-side store, so the list lives on this browser and nowhere else:
// it survives a reload and a restart, and it does not follow the user to
// another machine, and nothing can be posted to them because nothing knows
// who they are. That is the honest limit of a watchlist without a login.

const KEY = "ag_shortlist";
const MAX = 12;

/** Read by the server to personalise. Same value, readable in a request. */
export const SHORTLIST_COOKIE = "ag_shortlist";
/** When this browser last opened the Pulse, so changes can be "since". */
export const LAST_SEEN_COOKIE = "ag_last_seen";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function writeCookie(name: string, value: string) {
  try {
    // Lax rather than Strict: a link from the digest into the app should still
    // arrive with the watchlist attached.
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Cookies can be refused. The in-memory list still works; only the
    // server-rendered personalisation degrades.
  }
}

interface ShortlistState {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** False until the browser value has been read, so SSR and first paint agree. */
  ready: boolean;
  full: boolean;
}

const Ctx = createContext<ShortlistState | null>(null);

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Read after mount. Reading during render would differ between the server
  // and the client and produce a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((x) => typeof x === "string").slice(0, MAX);
          setIds(clean);
          // Re-seed the cookie for anyone who built a list before it existed,
          // otherwise their watchlist stays invisible to the server forever.
          writeCookie(SHORTLIST_COOKIE, JSON.stringify(clean));
        }
      }
    } catch {
      // A corrupt value should not break the app; start empty.
    }
    setReady(true);
  }, []);

  // Keep other open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setIds(parsed);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Takes an updater rather than a finished array, so the next list is always
  // derived from the current one inside React's own queue.
  //
  // Computing it from the `ids` captured at render time loses writes: two
  // clicks that land before React commits a re-render both read the same stale
  // list, and the second overwrites the first in state and in localStorage. On
  // a chart-heavy page with a busy main thread that is an ordinary double
  // click, and the add silently does nothing.
  const persist = useCallback((update: (prev: string[]) => string[]) => {
    setIds((prev) => {
      const next = update(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private browsing can refuse writes. The in-memory list still works.
      }
      // Mirrored so the server can read it on the next request.
      writeCookie(SHORTLIST_COOKIE, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<ShortlistState>(
    () => ({
      ids,
      ready,
      full: ids.length >= MAX,
      has: (id) => ids.includes(id),
      toggle: (id) =>
        persist((prev) =>
          prev.includes(id)
            ? prev.filter((x) => x !== id)
            : prev.length >= MAX
              ? prev
              : [...prev, id]
        ),
      remove: (id) => persist((prev) => prev.filter((x) => x !== id)),
      clear: () => persist(() => []),
    }),
    [ids, ready, persist]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShortlist(): ShortlistState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useShortlist must be used inside ShortlistProvider");
  }
  return ctx;
}

export const SHORTLIST_MAX = MAX;

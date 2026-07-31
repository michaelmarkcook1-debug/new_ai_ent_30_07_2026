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
// It also means the list survives a reload but never leaves the machine.

const KEY = "ag_shortlist";
const MAX = 12;

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
          setIds(parsed.filter((x) => typeof x === "string").slice(0, MAX));
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

  const persist = useCallback((next: string[]) => {
    setIds(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse writes. The in-memory list still works.
    }
  }, []);

  const value = useMemo<ShortlistState>(
    () => ({
      ids,
      ready,
      full: ids.length >= MAX,
      has: (id) => ids.includes(id),
      toggle: (id) =>
        persist(
          ids.includes(id)
            ? ids.filter((x) => x !== id)
            : ids.length >= MAX
              ? ids
              : [...ids, id]
        ),
      remove: (id) => persist(ids.filter((x) => x !== id)),
      clear: () => persist([]),
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

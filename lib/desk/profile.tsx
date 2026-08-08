"use client";

import { useCallback, useSyncExternalStore } from "react";

// The reader's desk: two taps, no account, no uploads.
//
// Ported in spirit from The Security Desk's 60-second profile
// (~/Documents/Dev Projects/the-desk, lib/profile.ts, commit b9bb51c), read-only
// at source. Two deliberate differences.
//
// TWO TAPS, NOT THREE. The Desk asks for industry, region and company size.
// This asks for industry and region only, because those are the two dimensions
// the uptake data behind Peer Insights is actually cut by. Offering a size
// selector that changed nothing on screen would be a control that pretends to
// personalise, which is worse than not offering it.
//
// SAME TAXONOMY AS PEER INSIGHTS. The industry and region values are the ones
// `ADOPTION_SEGMENTS` and `ADOPTION_REGIONS` already define, so a reader who
// sets their desk here sees the same cohort they would have selected by hand
// there. A second, prettier list would eventually disagree with the first.
//
// Stored like the shortlist: localStorage for the browser, mirrored into a
// cookie so the server can personalise above the fold without a round trip.
// It is not an identity. There is no account and no server-side store, so this
// lives on this browser and nowhere else, and nothing can be sent to the
// reader because nothing knows who they are.

const KEY = "ag_desk_profile";
export const PROFILE_COOKIE = "ag_desk_profile";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export interface DeskProfile {
  /** `apiValue` from ADOPTION_SEGMENTS, exactly as the uptake API expects. */
  industry: string;
  /** A value from ADOPTION_REGIONS, or null meaning all regions. */
  region: string | null;
}

export function parseProfile(raw: string | undefined): DeskProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<DeskProfile>;
    if (typeof parsed?.industry !== "string" || !parsed.industry) return null;
    return {
      industry: parsed.industry,
      region: typeof parsed.region === "string" ? parsed.region : null,
    };
  } catch {
    // A corrupt cookie means no profile, not a broken page.
    return null;
  }
}

function writeCookie(value: string | null) {
  try {
    document.cookie =
      value === null
        ? `${PROFILE_COOKIE}=; path=/; max-age=0; samesite=lax`
        : `${PROFILE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  } catch {
    // Cookies can be refused. The in-memory value still works; only the
    // server-rendered personalisation degrades.
  }
}

// ONE store, not one per caller.
//
// This hook shipped holding the profile in its own `useState`, which meant
// every component calling it got a private copy. Two of them render on Trust
// Rank at once, so setting your desk in "For firms like yours" left "Start
// from your industry" still asking for it, and neither knew about a second
// browser window. That is the bug Michael reported as "data does not persist
// across tabs", and it was both kinds of tab at once.
//
// The shortlist solved the same problem with a context provider. A provider
// would work here too but has to be threaded through the shell, and these
// panels can appear anywhere. An external store does the same job with no
// wrapper: every caller subscribes to one value, and `useSyncExternalStore` is
// React's own answer for state that lives outside the tree.
//
// The `storage` event carries the other half. It fires in every OTHER document
// on the origin, so a desk set in one window reaches the rest without either
// side polling.

let store: DeskProfile | null = null;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readStorage(): DeskProfile | null {
  try {
    return parseProfile(localStorage.getItem(KEY) ?? undefined);
  } catch {
    // Private browsing can refuse reads. Start empty rather than break.
    return null;
  }
}

/** Idempotent, and safe to call during render: it only reads. */
function ensureInit() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  store = readStorage();
  // Re-seed the cookie for anyone who set a desk before it existed, otherwise
  // their profile stays invisible to the server forever.
  if (store) writeCookie(JSON.stringify(store));
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== KEY) return;
  const next = readStorage();
  // Compare by value: a fresh object with identical fields would otherwise
  // re-render every subscriber on every unrelated storage write.
  if (
    next?.industry === store?.industry &&
    next?.region === store?.region
  ) {
    return;
  }
  store = next;
  emit();
}

/** Subscribe to profile changes. Exported because the store is the real API
 *  here and the hook below is a thin React binding over it: that keeps the
 *  sharing behaviour testable without a DOM library, which is what the
 *  original bug needed and did not have. */
export function subscribeToDeskProfile(cb: () => void): () => void {
  ensureInit();
  listeners.add(cb);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** The current profile. Returns the cached object rather than a new one, so
 *  the snapshot is referentially stable and React does not loop. */
export function readDeskProfileNow(): DeskProfile | null {
  ensureInit();
  return store;
}

/** Write the profile and tell every subscriber, in this document and others. */
export function saveDeskProfile(next: DeskProfile | null): void {
  store = next;
  initialised = true;
  try {
    if (next === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing can refuse writes. The in-memory value still works.
  }
  writeCookie(next === null ? null : JSON.stringify(next));
  // localStorage does not fire `storage` in the document that wrote it, so
  // this document's own subscribers are notified here, and the other windows
  // by the event.
  emit();
}

/** Reset the module store. Tests only: a module-level store survives between
 *  test cases, and a leaked profile would make the next case pass for the
 *  wrong reason. */
export function __resetDeskProfileForTests(): void {
  store = null;
  initialised = false;
  listeners.clear();
}

const subscribe = subscribeToDeskProfile;
const getSnapshot = readDeskProfileNow;

/** Null on the server: there is no localStorage there, and the cookie is read
 *  by `profile-server.ts` for anything that has to render server-side. */
function getServerSnapshot(): DeskProfile | null {
  return null;
}

const subscribeReady = (cb: () => void) => subscribe(cb);

/** Read the profile in the browser, and write it. Every caller sees the same
 *  value, and a change in one window reaches the others. */
export function useDeskProfile() {
  const profile = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  // False during SSR and hydration, true once mounted, so a panel does not
  // flash "no desk set" at a reader who has one.
  const ready = useSyncExternalStore(
    subscribeReady,
    () => true,
    () => false
  );

  const save = useCallback(
    (next: DeskProfile | null) => saveDeskProfile(next),
    []
  );

  return { profile, ready, save };
}

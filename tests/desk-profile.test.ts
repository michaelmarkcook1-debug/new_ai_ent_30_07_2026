import { beforeEach, describe, expect, it, vi } from "vitest";

// The desk profile store.
//
// The bug these exist for: the hook originally held the profile in its own
// `useState`, so every component calling it got a private copy. Two of them
// render on Trust Rank at once, and setting the desk in one left the other
// still asking for it. A second browser window never found out at all.
//
// Both halves are asserted below. The tests run in node with the three
// browser globals stubbed, which is deliberate: the sharing behaviour is a
// property of the store, not of React, and pinning it here needs no DOM
// library and no new dependency.

interface FakeStorage {
  store: Map<string, string>;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function fakeLocalStorage(): FakeStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const handlers = new Map<string, ((e: unknown) => void)[]>();

function installBrowserGlobals() {
  handlers.clear();
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = fakeLocalStorage();
  g.document = { cookie: "" };
  g.window = {
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      handlers.set(type, [...(handlers.get(type) ?? []), cb]);
    },
    removeEventListener: (type: string, cb: (e: unknown) => void) => {
      handlers.set(
        type,
        (handlers.get(type) ?? []).filter((h) => h !== cb)
      );
    },
  };
}

/** Fire a storage event the way another browser window would. */
function fireStorageEvent(key: string | null) {
  for (const h of handlers.get("storage") ?? []) h({ key });
}

installBrowserGlobals();

const {
  subscribeToDeskProfile,
  readDeskProfileNow,
  saveDeskProfile,
  parseProfile,
  __resetDeskProfileForTests,
  PROFILE_COOKIE,
} = await import("@/lib/desk/profile");

beforeEach(() => {
  installBrowserGlobals();
  __resetDeskProfileForTests();
});

const DESK = { industry: "Financial services", region: "Europe & UK" };

describe("one store, not one per caller", () => {
  it("tells every subscriber about a write, which is the bug that was reported", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeToDeskProfile(a);
    subscribeToDeskProfile(b);

    saveDeskProfile(DESK);

    // Both panels on Trust Rank, not just the one that was clicked.
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(readDeskProfileNow()).toEqual(DESK);
  });

  it("serves the same value to a caller that subscribed later", () => {
    saveDeskProfile(DESK);
    const late = vi.fn();
    subscribeToDeskProfile(late);
    expect(readDeskProfileNow()).toEqual(DESK);
  });

  it("returns a referentially stable snapshot, so React cannot loop", () => {
    saveDeskProfile(DESK);
    expect(readDeskProfileNow()).toBe(readDeskProfileNow());
  });

  it("stops notifying once a caller unsubscribes", () => {
    const gone = vi.fn();
    const unsub = subscribeToDeskProfile(gone);
    unsub();
    saveDeskProfile(DESK);
    expect(gone).not.toHaveBeenCalled();
  });
});

describe("a second browser window", () => {
  it("picks up a desk set in another window", () => {
    const here = vi.fn();
    subscribeToDeskProfile(here);
    // Another document wrote it: localStorage changed underneath us and the
    // event fired, which is the only signal this window gets.
    (globalThis as unknown as { localStorage: FakeStorage }).localStorage.setItem(
      "ag_desk_profile",
      JSON.stringify(DESK)
    );
    fireStorageEvent("ag_desk_profile");

    expect(readDeskProfileNow()).toEqual(DESK);
    expect(here).toHaveBeenCalledTimes(1);
  });

  it("ignores a storage write for some other key", () => {
    const here = vi.fn();
    subscribeToDeskProfile(here);
    fireStorageEvent("ag_shortlist");
    expect(here).not.toHaveBeenCalled();
  });

  it("does not re-render everybody when the value did not actually change", () => {
    saveDeskProfile(DESK);
    const here = vi.fn();
    subscribeToDeskProfile(here);
    // Same fields, different object: a naive implementation would emit.
    (globalThis as unknown as { localStorage: FakeStorage }).localStorage.setItem(
      "ag_desk_profile",
      JSON.stringify({ ...DESK })
    );
    fireStorageEvent("ag_desk_profile");
    expect(here).not.toHaveBeenCalled();
  });

  it("clears here when another window clears it", () => {
    saveDeskProfile(DESK);
    const here = vi.fn();
    subscribeToDeskProfile(here);
    (globalThis as unknown as { localStorage: FakeStorage }).localStorage.removeItem(
      "ag_desk_profile"
    );
    fireStorageEvent("ag_desk_profile");
    expect(readDeskProfileNow()).toBeNull();
    expect(here).toHaveBeenCalledTimes(1);
  });
});

describe("the server can still read it", () => {
  it("mirrors into the cookie the server parses", () => {
    saveDeskProfile(DESK);
    const doc = (globalThis as unknown as { document: { cookie: string } })
      .document;
    expect(doc.cookie).toContain(PROFILE_COOKIE);
    const raw = decodeURIComponent(
      doc.cookie.split("=").slice(1).join("=").split(";")[0]
    );
    expect(parseProfile(raw)).toEqual(DESK);
  });

  it("expires the cookie when the desk is cleared", () => {
    saveDeskProfile(DESK);
    saveDeskProfile(null);
    const doc = (globalThis as unknown as { document: { cookie: string } })
      .document;
    expect(doc.cookie).toContain("max-age=0");
    expect(readDeskProfileNow()).toBeNull();
  });
});

describe("a corrupt value is not a broken page", () => {
  it("reads as no profile rather than throwing", () => {
    (globalThis as unknown as { localStorage: FakeStorage }).localStorage.setItem(
      "ag_desk_profile",
      "{not json"
    );
    expect(readDeskProfileNow()).toBeNull();
  });

  it("rejects a value with no industry", () => {
    expect(parseProfile(JSON.stringify({ region: "APAC" }))).toBeNull();
    expect(parseProfile(undefined)).toBeNull();
  });
});

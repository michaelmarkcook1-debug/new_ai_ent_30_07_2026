import { describe, it, expect, beforeEach } from "vitest";

// What the reader decided about an opportunity, kept in this browser.
//
// Two properties matter more than the rest. Take-forward state is scoped to the
// company it belongs to, because a reader who researches two firms must not see
// one firm's ownership decisions attached to the other. And deselecting must
// not throw away the roles they chose: collapsing a row is a change of view,
// not a change of mind.
//
// Same in-memory stand-in as tests/position-store.test.ts, for the same reason:
// localStorage does not exist in Node and this project keeps its dependency
// list short rather than pulling in jsdom.

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
const listeners = new Map<string, Set<() => void>>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  addEventListener(type: string, fn: () => void) {
    const set = listeners.get(type) ?? new Set();
    set.add(fn);
    listeners.set(type, set);
  },
  removeEventListener(type: string, fn: () => void) {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent(evt: { type: string }) {
    for (const fn of listeners.get(evt.type) ?? []) fn();
    return true;
  },
};
if (typeof (globalThis as { Event?: unknown }).Event === "undefined") {
  (globalThis as { Event?: unknown }).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

const {
  entryFor,
  entriesFor,
  setTakeForward,
  setRole,
  takenForwardCount,
  TAKE_FORWARD_CHANGED,
} = await import("@/lib/position/take-forward");

beforeEach(() => storage.clear());

describe("taking an opportunity forward", () => {
  it("starts with nothing taken forward", () => {
    const e = entryFor("boots", "fraud_detection");
    expect(e.takeForward).toBe(false);
    expect(e.roles).toEqual({});
    expect(takenForwardCount("boots")).toBe(0);
  });

  it("remembers the decision", () => {
    setTakeForward("boots", "fraud_detection", true);
    expect(entryFor("boots", "fraud_detection").takeForward).toBe(true);
    expect(takenForwardCount("boots")).toBe(1);
  });

  it("survives a reload, which is the whole point of storing it", () => {
    setTakeForward("boots", "fraud_detection", true);
    setRole("boots", "fraud_detection", "governanceOwner", "Chief Risk Officer");
    // A fresh read is what a reload does.
    const e = entryFor("boots", "fraud_detection");
    expect(e.takeForward).toBe(true);
    expect(e.roles.governanceOwner).toBe("Chief Risk Officer");
  });

  // The property that stops one company's decisions appearing on another.
  it("scopes decisions to the company they were made about", () => {
    setTakeForward("boots", "fraud_detection", true);
    expect(entryFor("fortnum & mason", "fraud_detection").takeForward).toBe(false);
    expect(takenForwardCount("fortnum & mason")).toBe(0);
    expect(takenForwardCount("boots")).toBe(1);
  });

  it("keeps other areas untouched when one is taken forward", () => {
    setTakeForward("boots", "fraud_detection", true);
    setTakeForward("boots", "demand_forecasting", true);
    setTakeForward("boots", "fraud_detection", false);
    expect(entryFor("boots", "demand_forecasting").takeForward).toBe(true);
    expect(takenForwardCount("boots")).toBe(1);
  });
});

describe("overriding a recommended role", () => {
  it("stores only the override, never the recommendation", () => {
    setTakeForward("boots", "x", true);
    setRole("boots", "x", "businessOwner", "Chief Financial Officer");
    const e = entryFor("boots", "x");
    // One column overridden, the other two left to the recommendation so they
    // follow the catalogue rather than freezing a stale pick.
    expect(e.roles).toEqual({ businessOwner: "Chief Financial Officer" });
  });

  it("replaces an override rather than accumulating them", () => {
    setRole("boots", "x", "governanceOwner", "Chief Risk Officer");
    setRole("boots", "x", "governanceOwner", "Privacy Counsel");
    expect(entryFor("boots", "x").roles.governanceOwner).toBe("Privacy Counsel");
  });

  // Collapsing a row is a change of view, not a change of mind.
  it("keeps chosen roles when the area is deselected", () => {
    setTakeForward("boots", "x", true);
    setRole("boots", "x", "deliveryOwner", "Chief Data Officer");
    setTakeForward("boots", "x", false);
    const e = entryFor("boots", "x");
    expect(e.takeForward).toBe(false);
    expect(e.roles.deliveryOwner).toBe("Chief Data Officer");
    // And it comes back on re-expanding.
    setTakeForward("boots", "x", true);
    expect(entryFor("boots", "x").roles.deliveryOwner).toBe("Chief Data Officer");
  });
});

describe("telling the page it changed", () => {
  it("fires on every write, so an open row can refresh itself", () => {
    let heard = 0;
    const onChange = () => (heard += 1);
    (window as unknown as { addEventListener: (t: string, f: () => void) => void })
      .addEventListener(TAKE_FORWARD_CHANGED, onChange);
    try {
      setTakeForward("boots", "x", true);
      expect(heard).toBe(1);
      setRole("boots", "x", "businessOwner", "Chief Operating Officer");
      expect(heard).toBe(2);
    } finally {
      (window as unknown as { removeEventListener: (t: string, f: () => void) => void })
        .removeEventListener(TAKE_FORWARD_CHANGED, onChange);
    }
  });

  it("survives a store holding something it cannot read", () => {
    storage.setItem("ag_take_forward_v1", "not json");
    expect(() => entriesFor("boots")).not.toThrow();
    expect(entriesFor("boots")).toEqual({});
  });
});

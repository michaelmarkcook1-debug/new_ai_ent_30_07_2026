import type { CompanyResearch } from "@/lib/research/company";

// Saved positions: the outcome of Your AI Position, kept so another tool can
// use it.
//
// WHERE THIS LIVES AND WHY. In the browser, under localStorage, not in Postgres.
// There is no user identity in this product beyond a shared demo credential, so
// a server-side store would be a single shared drawer that every reader writes
// into and reads out of, which is worse than useless: your saved position would
// be whatever the last person researched. Per-browser is the honest scope, and
// it is stated on screen rather than implied.
//
// The consequence, which the UI says plainly: clearing site data loses these,
// and they do not follow you to another machine.
//
// SEPARATE FROM THE SESSION CACHE. research-runner.tsx already holds a finished
// run in sessionStorage so that leaving the tab does not pay for the research
// twice. That is a cache: per tab, dies with it, and never asked for. This is a
// save: the reader chooses it, it outlives the tab, and another page reads it.
// Two different things, deliberately not merged.

const KEY = "ag_positions_v1";
/** Bounded so a heavy user cannot fill the origin's storage quota. */
const MAX = 8;

export interface SavedPosition {
  /** Normalised name, and the key a Decision Desk situation is matched on. */
  key: string;
  /** What the reader typed into Your AI Position. */
  query: string;
  /** The name as the sources gave it, which is what gets shown. */
  name: string;
  what: string;
  industry: string;
  sectorTag: string | null;
  /** Statements only. The citations stay in Your AI Position, where the
      sources they point at are also on screen. */
  aiFindings: string[];
  findings: string[];
  recommendations: string[];
  /** ISO. Shown so a stale position can be recognised as one. */
  savedAt: string;
}

/**
 * Company names reduced to something two spellings of the same company agree
 * on.
 *
 * Deliberately conservative. It strips legal suffixes and punctuation and
 * nothing else, so "Ocado Retail Ltd." and "ocado retail" match while "Ocado"
 * and "Ocado Retail" stay distinct: collapsing those would let a saved position
 * for a subsidiary answer a question about the parent.
 */
export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(
      /\b(ltd|limited|plc|inc|incorporated|corp|corporation|llc|llp|gmbh|sa|nv|ag|co)\b/g,
      ""
    )
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function read(): SavedPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPosition[]) : [];
  } catch {
    // Blocked, full or holding something this version cannot read. A reader
    // with no saved positions is a working reader, so this is not surfaced.
    return [];
  }
}

function write(list: SavedPosition[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    // Quota or a blocked store. Returned rather than thrown so the button can
    // say it did not save instead of claiming it did.
    return false;
  }
}

/** Newest first. */
export function listPositions(): SavedPosition[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function latestPosition(): SavedPosition | null {
  return listPositions()[0] ?? null;
}

/**
 * Build a saved position from a finished run.
 *
 * Returns null when the research established no profile. There is nothing to
 * carry into another tool from a run that could not name the company, and
 * saving an empty shell would put a company on the Decision Desk that the
 * sources never described.
 */
export function toPosition(
  research: CompanyResearch,
  now = new Date()
): SavedPosition | null {
  const p = research.profile;
  if (!p?.name) return null;
  return {
    key: normaliseName(p.name),
    query: research.query,
    name: p.name,
    what: p.what,
    industry: p.industry,
    sectorTag: p.sector?.tag ?? null,
    aiFindings: research.aiFindings.map((f) => f.statement),
    findings: research.findings.map((f) => f.statement),
    recommendations: research.recommendations,
    savedAt: now.toISOString(),
  };
}

/** Saves, replacing any existing position for the same company. */
export function savePosition(position: SavedPosition): boolean {
  const rest = read().filter((p) => p.key !== position.key);
  return write([position, ...rest]);
}

export function removePosition(key: string): boolean {
  return write(read().filter((p) => p.key !== key));
}

export function isSaved(name: string): boolean {
  const k = normaliseName(name);
  return read().some((p) => p.key === k);
}

/**
 * The saved position a free-text situation is about, if any.
 *
 * Matching is on a word boundary against the normalised text, because a
 * substring match makes "Apple" fire on "apple juice" and attaches a technology
 * company's research to a drinks question. Where several match, the longest
 * name wins: a situation naming "Ocado Retail" should get that and not a
 * separately saved "Ocado".
 *
 * Names under three characters are never matched. Two-letter initialisms
 * collide with ordinary words far too often to be worth the one case they
 * catch.
 */
export function matchPosition(text: string): SavedPosition | null {
  const hay = ` ${normaliseName(text)} `;
  let best: SavedPosition | null = null;
  for (const p of read()) {
    if (p.key.length < 3) continue;
    if (!hay.includes(` ${p.key} `) && !hay.includes(` ${p.key}`)) continue;
    // Re-check on a true word boundary rather than the cheap contains above.
    const bounded = new RegExp(`(^| )${escapeRe(p.key)}( |$)`);
    if (!bounded.test(normaliseName(text))) continue;
    if (!best || p.key.length > best.key.length) best = p;
  }
  return best;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The opening the Decision Desk puts in the situation box.
 *
 * Deliberately PART of a situation and not a whole one. It states who they are,
 * which the research established, and stops at the point where only the reader
 * knows the answer: what they are actually trying to decide. A complete
 * pre-written situation would get submitted unread and the finding would answer
 * a question nobody asked.
 */
export function openingLine(p: SavedPosition): string {
  const what = p.what?.trim().replace(/\.$/, "");
  const who = what ? `${p.name}, ${lowerFirst(what)}` : p.name;
  return `We are ${who}. `;
}

function lowerFirst(s: string): string {
  // Only when the word is not itself a name or initialism, so "UK grocery
  // retailer" keeps its capital and "Online grocery retail" loses it.
  if (/^[A-Z]{2,}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * The position as the interrogate engine receives it.
 *
 * Clamped hard. This is pasted into a prompt, so an unbounded field here is an
 * unbounded prompt, and the statements are already summaries rather than source
 * text.
 */
export interface PositionContext {
  name: string;
  industry: string;
  what: string;
  aiFindings: string[];
  findings: string[];
}

export function toContext(p: SavedPosition): PositionContext {
  const clamp = (s: string) => s.slice(0, 400);
  return {
    name: p.name.slice(0, 120),
    industry: p.industry.slice(0, 200),
    what: clamp(p.what),
    aiFindings: p.aiFindings.slice(0, 6).map(clamp),
    findings: p.findings.slice(0, 6).map(clamp),
  };
}

// Is this discovered entity one we already know under another name?
//
// Nothing here merges. It produces candidates with a stated reason and a
// score, names the single best one only when it is clearly best, and calls
// the case ambiguous when two candidates are close. The operator decides.
// The one lookup that is a fact rather than a similarity is an identical id.

const LEGAL_SUFFIXES = new Set([
  "inc", "inc.", "ltd", "ltd.", "llc", "corp", "corp.", "corporation", "plc", "ag", "sa", "gmbh",
  "labs", "technologies", "technology", "group", "holdings", "co", "co.",
  // "Mistral AI", "Sakana AI": the trailing AI names the field, not the firm.
  "ai",
]);

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9()&+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalise(s).replace(/[()&+]/g, " ").split(" ").filter(Boolean);
}

function withoutSuffix(ts: string[]): string[] {
  const out = [...ts];
  while (out.length > 1 && LEGAL_SUFFIXES.has(out[out.length - 1])) out.pop();
  return out;
}

/**
 * Every name a canonical entity answers to: its name, the name without a
 * legal suffix, anything in brackets ("Cohere (incl. Aleph Alpha)" answers to
 * "aleph alpha"), its id, and its id with dashes as spaces.
 */
export function aliasesOf(name: string, id: string): string[] {
  const out = new Set<string>();
  const n = normalise(name);
  out.add(n);
  const bracket = n.match(/\(([^)]+)\)/);
  const base = n.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  if (base) out.add(base);
  if (bracket) {
    for (const part of bracket[1].split(/,|\bincl\.?\b|\band\b|\bformerly\b/)) {
      const p = part.replace(/\s+/g, " ").trim();
      if (p && p.length > 1) out.add(p);
    }
  }
  out.add(withoutSuffix(tokens(base || n)).join(" "));
  out.add(normalise(id));
  out.add(normalise(id.replace(/[-_]+/g, " ")));
  return [...out].filter(Boolean);
}

export interface MatchCandidate {
  id: string;
  name: string;
  reason: string;
  score: number;
}

export interface MatchResult {
  candidates: MatchCandidate[];
  /** The one canonical id this is very probably the same as, or null. Never applied by itself. */
  suggestion: string | null;
  /** Two candidates too close to call. Blocks until a person chooses. */
  ambiguous: boolean;
}

function initials(name: string): string {
  return withoutSuffix(tokens(name)).map((t) => t[0]).join("");
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

export function matchExisting(
  discovered: { id: string; name: string },
  canonical: readonly { id: string; name: string }[]
): MatchResult {
  const dName = normalise(discovered.name);
  const dId = normalise(discovered.id);
  const dTokens = withoutSuffix(tokens(discovered.name));
  const candidates: MatchCandidate[] = [];
  for (const c of canonical) {
    const aliases = aliasesOf(c.name, c.id);
    let best: MatchCandidate | null = null;
    const consider = (score: number, reason: string) => {
      if (!best || score > best.score) best = { id: c.id, name: c.name, reason, score };
    };
    if (normalise(c.id) === dId) consider(1, "identical id");
    if (aliases.includes(dName)) consider(0.95, `"${discovered.name}" is a name ${c.name} already answers to`);
    if (dName.length >= 2 && dName === initials(c.name)) consider(0.9, `"${discovered.name}" is the abbreviation of ${c.name}`);
    const cName = normalise(c.name);
    if (cName.length >= 2 && cName === initials(discovered.name)) consider(0.9, `${c.name} is the abbreviation of "${discovered.name}"`);
    const j = jaccard(dTokens, withoutSuffix(tokens(c.name)));
    if (j >= 0.6) consider(0.6 + (j - 0.6) * 0.5, `shares ${Math.round(j * 100)}% of its name tokens with ${c.name}`);
    if (best) candidates.push(best);
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const second = candidates[1];
  const ambiguous = Boolean(top && second && top.score - second.score < 0.15);
  const suggestion = top && top.score >= 0.9 && !ambiguous ? top.id : null;
  return { candidates: candidates.slice(0, 5), suggestion, ambiguous };
}

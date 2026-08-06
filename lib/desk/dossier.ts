// The per-vendor dossier: everything this product knows about one vendor.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/dossier.ts, commit b9bb51c),
// read-only and unmodified at source.
//
// WHAT IT DOES. It invents nothing. It is a join across datasets that each
// already carry their own receipts, so every fact in a dossier is the fact the
// owning surface publishes, reached from the vendor a reader is looking at
// rather than from the surface that happens to hold it.
//
// The vendor profile in this repository already joins the AIE datasets:
// scores, capabilities, dependencies, models, reputation and sources. What it
// could not reach was the newly ported material, which is the half a buyer
// asks about first: what this vendor's own contract permits, which legal
// system reaches it, and whether anything they run is being switched off. That
// is what this adds.
//
// THE WRINKLE IS NAMING, AND IT IS THE WHOLE TRICK. Each surface names vendors
// its own way: the Shield keys on `openai-api`, the directory on `openai`, a
// deprecation page says "OpenAI", an encroachment receipt says "Anthropic".
// Two mapping tables already exist for that (`lib/shield/vendor-map.ts` and
// `lib/desk/vendor-map.ts`) and this uses both rather than adding a third.
//
// A SURFACE WITH NO ENTRY IS AN HONEST EMPTY STATE. Every field below is
// nullable or empty-able, and the caller renders the absence. Reka is on the
// Shield and not in the directory; Groq is in the directory and not on the
// Shield. Neither is a bug, and neither should be filled in.

import { SHIELD, shieldScore, shieldCoverage, type VendorShield } from "@/lib/shield/data";
import { vendorIdForSlug } from "@/lib/shield/vendor-map";
import { sovereigntyRows, type SovereigntyRow } from "@/lib/shield/sovereignty";
import { upcomingDeprecations, type Deprecation } from "./deprecations";
import { ENCROACHMENTS, type Encroachment } from "./encroachment";
import { vendorIdForName } from "./vendor-map";

export interface VendorDossier {
  vendorId: string;
  /** The Shield entry, or null when this vendor's terms have not been read. */
  shield: (VendorShield & { score: number; coverage: number }) | null;
  sovereignty: SovereigntyRow | null;
  /** Retirements still ahead, soonest first. */
  deprecations: (Deprecation & { daysAway: number })[];
  /** Suppliers encroaching on this vendor, and this vendor encroaching on others. */
  encroachedBy: Encroachment[];
  encroachesOn: Encroachment[];
  /** True when nothing newly ported holds anything about this vendor. */
  empty: boolean;
}

export function buildDossier(vendorId: string, today: Date): VendorDossier {
  const shieldEntry = SHIELD.find((s) => vendorIdForSlug(s.slug) === vendorId);
  const shield = shieldEntry
    ? {
        ...shieldEntry,
        score: shieldScore(shieldEntry),
        coverage: shieldCoverage(shieldEntry),
      }
    : null;

  const sovereignty = shieldEntry
    ? (sovereigntyRows().find((r) => r.slug === shieldEntry.slug) ?? null)
    : null;

  const deprecations = upcomingDeprecations(today).filter(
    (d) => vendorIdForName(d.vendor) === vendorId
  );

  const encroachedBy = ENCROACHMENTS.filter(
    (e) => vendorIdForName(e.against) === vendorId
  );
  const encroachesOn = ENCROACHMENTS.filter(
    (e) => vendorIdForName(e.actor) === vendorId
  );

  return {
    vendorId,
    shield,
    sovereignty,
    deprecations,
    encroachedBy,
    encroachesOn,
    empty:
      shield === null &&
      deprecations.length === 0 &&
      encroachedBy.length === 0 &&
      encroachesOn.length === 0,
  };
}

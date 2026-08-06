// Today's Brief: every fact paired with what to do about it.
//
// ORIGIN. The shape is ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/brief.ts, commit b9bb51c), read-only
// and unmodified at source. The regulation leg is NOT ported: this repository
// already holds a far better register than The Desk's two EU milestones, so
// the brief reads `lib/aie/regulation/obligations.ts` instead. Porting the
// weaker dataset alongside the stronger one would have given the product two
// regulatory answers that could disagree.
//
// WHAT THIS IS FOR. A date on its own is a diary entry. Every line here pairs
// a fact with what to do about it, and answers in one read:
//
//   Is my portfolio healthy?      a verdict on YOUR vendors, with the reason
//   What happened in security?    and what to do about it
//   What is coming in regulation? and who it actually binds
//   What did the labs ship?       from the lab itself, primary source
//   Who is encroaching on whom?   the structural risk under the market
//
// HEALTH IS COMPUTED, NEVER ASSERTED. The verdict comes from real signals
// about the vendors the reader shortlisted, and the reason for the colour is
// always stated on screen. With nothing shortlisted there is no portfolio, so
// it says that rather than inventing a verdict about a market the reader may
// not be in.

import type { StatusRow, SourceRef } from "./status";
import type { DeskNewsItem } from "./news";
import { upcomingDeprecations } from "./deprecations";
import { ENCROACHMENTS } from "./encroachment";
import { isWatched } from "./vendor-map";
import { SHIELD, shieldScore } from "@/lib/shield/data";
import { vendorIdForSlug } from "@/lib/shield/vendor-map";
import {
  OBLIGATIONS,
  daysUntil,
  type Obligation,
} from "@/lib/aie/regulation/obligations";

export type Health = "green" | "amber" | "red" | "unset";

export interface BriefLine {
  fact: string;
  /** What to DO about it. The whole point of a brief. */
  act: string;
  /** True when this lands on a vendor the reader shortlisted. */
  yours: boolean;
  source: SourceRef;
  /** Where to go next inside the product, when somewhere is useful. */
  href?: string;
}

export interface BriefSection {
  key: "security" | "regulation" | "shipped" | "encroachment";
  label: string;
  lines: BriefLine[];
}

export interface Brief {
  health: Health;
  headline: string;
  reason: string;
  sections: BriefSection[];
  watched: number;
  /** Sources that answered, over sources attempted, so a thin brief can say
   *  which it is: a quiet day, or a feed that did not reach anybody. */
  statusesRead: number;
  statusesAttempted: number;
  newsRead: number;
}

/** Days inside which a retirement is an emergency rather than a plan. */
const URGENT_DAYS = 30;
/** Days inside which it needs to be on the roadmap. */
const SOON_DAYS = 90;
/** A Shield score at or below this is a vendor worth a second look. */
const WEAK_SHIELD = 2;
/** A statutory date inside this window has stopped being a horizon. */
const REG_URGENT_DAYS = 30;

function shieldScoreForVendorId(vendorId: string): number | null {
  const v = SHIELD.find((s) => vendorIdForSlug(s.slug) === vendorId);
  return v ? shieldScore(v) : null;
}

export function assembleBrief(
  statuses: StatusRow[],
  statusesAttempted: number,
  news: DeskNewsItem[],
  watchedVendorIds: string[],
  today: Date
): Brief {
  const watched = new Set(watchedVendorIds);
  const deprs = upcomingDeprecations(today);

  // Portfolio health, computed.
  const myIncidents = statuses.filter(
    (s) => !s.operational && isWatched(s.provider, watched)
  );
  const myUrgentDeprs = deprs.filter(
    (d) => d.daysAway <= URGENT_DAYS && isWatched(d.vendor, watched)
  );
  const mySoonDeprs = deprs.filter(
    (d) =>
      d.daysAway > URGENT_DAYS &&
      d.daysAway <= SOON_DAYS &&
      isWatched(d.vendor, watched)
  );
  const myWeak = watchedVendorIds
    .map((id) => ({ id, score: shieldScoreForVendorId(id) }))
    .filter((x) => x.score !== null && x.score <= WEAK_SHIELD);

  // Only obligations that land on the reader count towards urgency. One that
  // binds the model provider is their vendor's problem to solve, and colouring
  // the reader's portfolio amber for it would be telling them to act on
  // somebody else's duty.
  const onMe = (o: Obligation) => o.binds === "deployer" || o.binds === "both";
  const regSoon = OBLIGATIONS.filter(onMe).filter((o) => {
    const d = daysUntil(o, today);
    return d > 0 && d <= REG_URGENT_DAYS;
  });

  let health: Health;
  let headline: string;
  let reason: string;

  if (watchedVendorIds.length === 0) {
    health = "unset";
    headline = "No portfolio set";
    reason =
      "Shortlist the vendors you actually run and this becomes a verdict on yours rather than the market's.";
  } else if (myIncidents.length > 0 || myUrgentDeprs.length > 0) {
    health = "red";
    const bits = [
      myIncidents.length > 0
        ? `${myIncidents.length} live incident${myIncidents.length === 1 ? "" : "s"}`
        : null,
      myUrgentDeprs.length > 0
        ? `${myUrgentDeprs.length} retirement${myUrgentDeprs.length === 1 ? "" : "s"} inside ${URGENT_DAYS} days`
        : null,
    ].filter(Boolean);
    headline = "Action needed";
    reason = `${bits.join(" and ")} on vendors you shortlisted.`;
  } else if (
    mySoonDeprs.length > 0 ||
    myWeak.length > 0 ||
    regSoon.length > 0
  ) {
    health = "amber";
    const bits = [
      mySoonDeprs.length > 0
        ? `${mySoonDeprs.length} retirement${mySoonDeprs.length === 1 ? "" : "s"} in ${URGENT_DAYS} to ${SOON_DAYS} days`
        : null,
      myWeak.length > 0
        ? `${myWeak.length} vendor${myWeak.length === 1 ? "" : "s"} scoring ${WEAK_SHIELD} or below out of 4 on the Shield`
        : null,
      regSoon.length > 0
        ? `${regSoon.length} obligation${regSoon.length === 1 ? "" : "s"} landing on you inside ${REG_URGENT_DAYS} days`
        : null,
    ].filter(Boolean);
    headline = "Plan, do not panic";
    reason = `${bits.join("; ")}.`;
  } else {
    health = "green";
    headline = "Portfolio is clear";
    reason = `No live incident, no retirement inside ${SOON_DAYS} days, nothing scoring ${WEAK_SHIELD} or below on the Shield, and no obligation landing on you inside ${REG_URGENT_DAYS} days, among the vendors you shortlisted.`;
  }

  const sections: BriefSection[] = [];

  // Security: live incidents first, then the security press.
  const secLines: BriefLine[] = [];
  for (const s of statuses.filter((x) => !x.operational)) {
    const mine = isWatched(s.provider, watched);
    secLines.push({
      fact: `${s.provider} is degraded: ${s.description}`,
      act: mine
        ? "Yours. Check your failover path now and assume these calls fail."
        : "Not yours today, but the same failure is one procurement away.",
      yours: mine,
      source: s.source,
    });
  }
  news
    .filter((x) => x.security)
    .slice(0, 2)
    .forEach((n, i) => {
      secLines.push({
        fact: n.title,
        act:
          i === 0
            ? "Read it before it reaches your board. If it names a vendor you run, it is a question you will be asked."
            : "The pattern behind the headline: assume the same technique targets whatever you have deployed.",
        yours: false,
        source: { name: n.source, url: n.url },
      });
    });
  if (secLines.length)
    sections.push({ key: "security", label: "Security", lines: secLines });

  // Regulation, from this repository's own register. Soonest first, and the
  // ones that bind the reader lead, because those are the ones they can act
  // on without waiting for a vendor.
  const regLines: BriefLine[] = [...OBLIGATIONS]
    .map((o) => ({ o, d: daysUntil(o, today) }))
    .filter((x) => x.d > 0)
    .sort(
      (a, b) =>
        Number(onMe(b.o)) - Number(onMe(a.o)) || a.d - b.d
    )
    .slice(0, 2)
    .map(({ o, d }) => {
      const mine = o.affectedVendorIds.some((v) => watched.has(v));
      return {
        fact: `${o.regime}${o.provision ? ` ${o.provision}` : ""}: T minus ${d} days`,
        act: onMe(o)
          ? d <= REG_URGENT_DAYS
            ? "This one binds you, not your vendor, and it is inside 30 days. Confirm who owns it."
            : "This one binds you, not your vendor. Far enough out to plan properly, so roadmap it."
          : "This binds the model provider. Ask yours what they are doing about it before they are asked by somebody else.",
        yours: mine,
        source: { name: o.source.name, url: o.source.url },
        href: "/trust-rank",
      };
    });
  if (regLines.length)
    sections.push({ key: "regulation", label: "Regulation", lines: regLines });

  // What the labs shipped, from their own newsrooms.
  const shipLines: BriefLine[] = news
    .filter((n) => n.kind === "vendor")
    .slice(0, 2)
    .map((n) => ({
      fact: n.title,
      act: "A capability shift from the lab itself. Know it before a vendor pitches it to you as new.",
      yours: false,
      source: { name: n.source, url: n.url },
    }));
  if (shipLines.length)
    sections.push({
      key: "shipped",
      label: "The labs shipped",
      lines: shipLines,
    });

  // Encroachment: structural, never breaking. The reader's own suppliers lead.
  const encLines: BriefLine[] = [...ENCROACHMENTS]
    .map((e) => ({
      e,
      mine: isWatched(e.against, watched) || isWatched(e.actor, watched),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine))
    .slice(0, 2)
    .map(({ e, mine }) => ({
      fact: `${e.actor} encroaches on ${e.against}: ${e.note}`,
      act: "Your supplier is becoming your vendor's competitor. That is leverage moving, so price it into the renewal.",
      yours: mine,
      source: e.source,
      href: "/ecosystem-navigator",
    }));
  if (encLines.length)
    sections.push({
      key: "encroachment",
      label: "Encroachment: suppliers competing with vendors",
      lines: encLines,
    });

  return {
    health,
    headline,
    reason,
    sections,
    watched: watchedVendorIds.length,
    statusesRead: statuses.length,
    statusesAttempted,
    newsRead: news.length,
  };
}

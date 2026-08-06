"use client";

import { useCallback, useEffect, useState } from "react";

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

/** Read the profile in the browser, and write it. Mirrors the shortlist's
 *  contract, including `ready` so first paint and SSR agree. */
export function useDeskProfile() {
  const [profile, setProfile] = useState<DeskProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = parseProfile(raw);
        if (parsed) {
          setProfile(parsed);
          // Re-seed the cookie for anyone who set a desk before it existed.
          writeCookie(JSON.stringify(parsed));
        }
      }
    } catch {
      // Start empty rather than break.
    }
    setReady(true);
  }, []);

  const save = useCallback((next: DeskProfile | null) => {
    setProfile(next);
    try {
      if (next === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private browsing can refuse writes.
    }
    writeCookie(next === null ? null : JSON.stringify(next));
  }, []);

  return { profile, ready, save };
}

"use client";

import { useEffect } from "react";

// Moves the "last looked" marker to today, after the page has rendered.
//
// The order matters. The panel above was built on the server from the marker's
// previous value, so this visit still shows everything that moved since the
// last one. Only once that is on screen does the marker advance, which is what
// makes the next visit say "since today" rather than repeating itself.
//
// Writing it on the server instead would be wrong twice over: a Server
// Component cannot set a cookie during render, and doing it in a route handler
// would advance the marker before the reader had seen anything.

const LAST_SEEN_COOKIE = "ag_last_seen";
const MAX_AGE = 60 * 60 * 24 * 180;

export function MarkSeen() {
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      document.cookie = `${LAST_SEEN_COOKIE}=${today}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    } catch {
      // Cookies refused: the panel simply keeps showing the latest capture.
    }
  }, []);
  return null;
}

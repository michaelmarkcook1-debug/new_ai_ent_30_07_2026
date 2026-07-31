// Which company the Company View is showing, and where its figures come from.
//
// Kept free of any Node import on purpose: the header is a client component
// and imports resolveCompany, so pulling the fixture loader in here would
// drag "fs" into the browser bundle.
//
// Shell is the spec's exemplar buyer, and it is an energy major. The
// BoardRadar universe is 161 technology, financial services and telecoms
// companies, so Shell is not in it and never will be: its tab content is
// sample shaped like the live response schemas.
//
// The layout used to claim that wiring a real buyer was "a data swap, not a
// rebuild". This module makes that true. Pass ?company=TICKER and the tabs
// that have a live BoardRadar equivalent fetch it for real; omit it and the
// Shell exemplar renders as before, badged sample.

export const EXEMPLAR = {
  ticker: null,
  name: "Shell",
  initial: "S",
  label: "Exemplar buyer",
} as const;

export interface CompanySelection {
  /** null for the Shell exemplar, a BoardRadar ticker otherwise. */
  ticker: string | null;
  name: string;
  initial: string;
  /** True when figures come from BoardRadar rather than the Shell fixture. */
  live: boolean;
}

// Tickers are uppercase alphanumerics with optional dots and dashes. Anything
// else is rejected rather than forwarded to the proxy.
const TICKER_RE = /^[A-Z0-9][A-Z0-9.-]{0,9}$/;

export function resolveCompany(
  raw: string | string[] | undefined
): CompanySelection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const ticker = value?.trim().toUpperCase();

  if (!ticker || ticker === "SHELL" || !TICKER_RE.test(ticker)) {
    return {
      ticker: null,
      name: EXEMPLAR.name,
      initial: EXEMPLAR.initial,
      live: false,
    };
  }
  return {
    ticker,
    name: ticker,
    initial: ticker.slice(0, 1),
    live: true,
  };
}

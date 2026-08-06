// The cited corpus: what the Resident Analyst is allowed to answer from.
//
// ORIGIN. The idea is ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/analyst.ts, commit b9bb51c),
// read-only and unmodified at source, where a compact evidence corpus is
// assembled from the same verified datasets the screens render and the model
// may use only that.
//
// WHY THIS MATTERS HERE. The analyst already had guards against inventing a
// figure and against inventing a vendor name. Neither helps if the evidence in
// front of it is thin: a model grounded in three sample memos and a one-line
// description per vendor will answer a contract question by reaching for what
// it remembers rather than what it was given, and every guard downstream is
// checking the wrong thing. The strongest evidence in this product is now the
// quoted material, so it belongs in the corpus.
//
// These chunks are deliberately built as sentences rather than as records. The
// retriever scores on term overlap with the reader's question, so "Anthropic
// will not train on customer data" has to contain the words somebody would
// actually type. A JSON blob retrieves badly and reads worse when quoted back.
//
// Every chunk carries the document name it came from, and the analyst's own
// citation list shows it, so an answer about a contract term points at the
// contract.

import { SHIELD, type MarkState } from "@/lib/shield/data";
import { sovereigntyRows, FLAG_LABEL } from "@/lib/shield/sovereignty";
import { DEPRECATIONS } from "./deprecations";
import { ENCROACHMENTS } from "./encroachment";

export interface CitedChunk {
  source: string;
  text: string;
}

const MARK_PHRASE: Record<MarkState, string> = {
  protective: "protective, verified in the vendor's own words",
  conditional: "conditional: the protection exists but is gated",
  adverse: "adverse: a verified fact that works against the customer",
  unverified: "not established, because no receipt was obtained",
};

const DIM_PHRASE: Record<string, string> = {
  training: "whether it trains on customer data",
  retention: "how long it retains customer data, and whether zero retention is available",
  indemnity: "whether it indemnifies the customer on output IP and copyright claims",
  residency: "where customer data is processed and stored, its data residency",
};

/** One chunk per Shield mark, plus the sovereignty, deprecation and
 *  encroachment material. Each is a sentence a reader's question can match. */
export function citedChunks(): CitedChunk[] {
  const out: CitedChunk[] = [];

  for (const v of SHIELD) {
    for (const dim of ["training", "retention", "indemnity", "residency"] as const) {
      const mark = v.marks[dim];
      const src = mark.source?.name ?? "Privacy & IP Shield, no receipt obtained";
      out.push({
        source: src,
        text: `${v.vendor}, on ${DIM_PHRASE[dim]}: ${MARK_PHRASE[mark.state]}. ${mark.note}`,
      });
    }
  }

  for (const r of sovereigntyRows()) {
    out.push({
      source: "Sovereignty Lens, derived from the Privacy & IP Shield",
      text: `${r.vendor} sovereignty: ${FLAG_LABEL[r.flag]}. Jurisdiction ${r.hqJurisdiction}. ${r.flagNote}`,
    });
  }

  for (const d of DEPRECATIONS) {
    out.push({
      source: d.source.name,
      text: `${d.vendor} is retiring the model ${d.model} on ${d.retire}, replaced by ${d.replacement}. After that date, calls to it fail.`,
    });
  }

  for (const e of ENCROACHMENTS) {
    out.push({
      source: e.source.name,
      text: `Encroachment: ${e.actor} supplies ${e.against} and competes with it. ${e.note}. ${e.fact}`,
    });
  }

  return out;
}

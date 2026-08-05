import { redirect } from "next/navigation";

// The Security Desk was folded into Trust Rank on 5 August 2026.
//
// Security posture and regulatory exposure answer one question for a buyer —
// "can I defend this choice" — and splitting them across two tabs meant a
// reader answering it had to know to visit both. The cyber-risk panel and the
// lab postures now render inside the daily brief.
//
// This redirect stays rather than the route being deleted: the page was linked
// from the shortlist, from Trust Rank itself and from anything a reader
// bookmarked, and a 404 is a worse answer than the content they were after.
export default function SecurityDeskPage() {
  redirect("/trust-rank");
}

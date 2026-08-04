import { redirect } from "next/navigation";

// Interrogate lives on the Decision Desk now (3 August 2026), as step one of
// the decision: the cited finding. This route survives so older links, the
// Ask AI menu in cached pages and the demo script never dead-end, and it
// carries the query string across because arriving with ?q= is the whole
// point of those links.
export default async function InterrogateRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ tool: "finding" });
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && k !== "tool") qs.set(k, v);
  }
  redirect(`/decision-desk?${qs.toString()}`);
}

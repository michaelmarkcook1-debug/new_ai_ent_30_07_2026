import { redirect } from "next/navigation";

// Folded into Your AI Position on 6 August 2026.
//
// This tab ran a third search on the same company and printed the passages it
// got back. What a reader wanted from it, which of their functions AI has
// already reached, is now answered on the overview by a derivation over the
// role library rather than by a second pile of links. Keeping a tab that
// re-searched the same company to say less was costing a reader a click and a
// minute to arrive somewhere thinner.
//
// The address still resolves, because a link a reader already has should not
// break, and the company travels with it so the redirect lands on their
// company rather than on an empty box.
export default async function AiExposureRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).company;
  const company = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  redirect(company ? `/company-view?company=${encodeURIComponent(company)}` : "/company-view");
}

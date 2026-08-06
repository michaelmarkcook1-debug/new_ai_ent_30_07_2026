import { redirect } from "next/navigation";

// Folded into Your AI Position on 6 August 2026. See the note on the
// ai-exposure redirect: the workforce question is now answered on the overview
// by the exposure panel and the company's own published headcount, which is
// more than this tab could say from a third search of the same sources.
export default async function TalentRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).company;
  const company = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  redirect(company ? `/company-view?company=${encodeURIComponent(company)}` : "/company-view");
}

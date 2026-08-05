import { PageHeader } from "@/lib/ui/page";
import { loadShellFixture } from "@/lib/shell-fixture";
import { DecisionDeskView } from "./decision-desk-view";
import { cookies } from "next/headers";
import { getUploads } from "@/app/api/analyst/lib";
import Link from "next/link";

export const metadata = { title: "Decision Desk | AI Enterprise" };

// The Decision Desk (3 August 2026). Interrogate and Assess and Decide were
// separate top-level tabs, which read as two products; they are one moment in
// the CIO's journey — converging on a call that must survive a board or a
// procurement committee — so they now sit together as numbered steps. The old
// routes redirect here with their query strings intact.
export default async function DecisionDeskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = await loadShellFixture();
  // Documents the reader has uploaded this session. They are already the
  // highest-weighted source in the finding's corpus; this says so, because a
  // reader who cannot see that their own document was used has no reason to
  // believe the finding is about them.
  const sid = (await cookies()).get("eai_sid")?.value ?? "anon";
  const uploads = getUploads(sid);
  // Arriving with a situation to interrogate opens the finding tool whatever
  // the tool parameter says: the visitor brought a question, answer it.
  const initialTool =
    sp.tool === "assess" && !sp.q && !sp.situation ? "assess" : "finding";
  return (
    <>
      <PageHeader
        title="Decision Desk"
        subtitle="Converge on a call you can defend: describe your situation for a source-cited finding, then score the decision against your own weights with the derivation open. Nothing here invents a figure."
        lanes={["aie-live", "aie", "sample"]}
      />
      <section className="mb-4 rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="measure text-sm">
          {uploads.length > 0 ? (
            <>
              <span className="font-semibold">
                {uploads.length} of your documents
              </span>{" "}
              {uploads.length === 1 ? "is" : "are"} in the corpus behind the
              finding below and rank above every other source in it:{" "}
              {uploads.map((u) => u.name).join(", ")}.
            </>
          ) : (
            <>
              <span className="font-semibold">No documents uploaded.</span> The
              finding below rests on the tracked dataset alone. Upload your own
              policy, contract or board paper and it becomes the
              highest-weighted source in it.
            </>
          )}{" "}
          <Link
            href="/company-view/analyst"
            className="font-medium text-primary hover:underline"
          >
            {uploads.length > 0 ? "Manage documents" : "Upload documents"}
          </Link>
        </p>
      </section>

      <DecisionDeskView assessment={f.assess.assessment} initialTool={initialTool} />
    </>
  );
}

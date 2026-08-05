import { redirect } from "next/navigation";

// The tool is named ModelEngine. This address predates that name and still
// resolves, because a link a reader already has should not break.
// The page itself stays at /market-view, which is where every existing link,
// bookmark and nav entry already points; moving it would break those to gain
// nothing a redirect does not already give.
export default function ModelForRoleRedirect() {
  redirect("/market-view");
}

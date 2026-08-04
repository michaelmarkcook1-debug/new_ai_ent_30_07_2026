import { redirect } from "next/navigation";

// Assess and Decide lives on the Decision Desk now (3 August 2026), as step
// two of the decision: the weighted score. The route survives so older links
// and the company-view tab strip in cached pages never dead-end.
export default function AssessDecideRedirect() {
  redirect("/decision-desk?tool=assess");
}

import { redirect } from "next/navigation";

// Assess and Decide was promoted to its own top-level tab on 30 July 2026;
// this route survives so older links and the original demo path never dead-end.
export default function AssessRedirect() {
  redirect("/assess-decide");
}

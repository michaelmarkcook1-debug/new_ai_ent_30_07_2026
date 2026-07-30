import { Suspense } from "react";
import { AnalystView } from "./analyst-view";

export const metadata = { title: "AI Analyst: Shell | New AI.Ent" };

const PRELOADED = [
  "Shell AI vendor assessment brief (sample)",
  "EU AI Act readiness note (sample)",
  "Integrator shortlist memo (sample)",
];

export default function AnalystPage() {
  return (
    <Suspense>
      <AnalystView preloaded={PRELOADED} />
    </Suspense>
  );
}

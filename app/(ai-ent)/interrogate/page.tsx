import { Suspense } from "react";
import { PageHeader } from "@/lib/ui/page";
import { InterrogateView } from "./interrogate-view";

export const metadata = { title: "Interrogate | AI Enterprise" };

// The hero piece: adaptive questioning that ends in a tailored,
// source-cited finding, mirroring the deployed AI Enterprise app's
// Interrogate pattern inside the AG shell.
export default function InterrogatePage() {
  return (
    <>
      <PageHeader
        title="Interrogate"
        subtitle="Describe your situation; get sharp questions and a tailored, source-cited finding, grounded only in evidence. Never a guess, never an invented figure."
        lanes={["aie-live", "aie", "sample"]}
      />
      <Suspense>
        <InterrogateView />
      </Suspense>
    </>
  );
}

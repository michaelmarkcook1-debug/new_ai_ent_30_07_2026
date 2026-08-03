import { Shell } from "@/lib/ui/shell";
import { DemoFooter } from "@/lib/ui/page";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";

export default function AiEntLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The footer is fixed, so it sits outside the Shell's content column:
    // that column is a container query root and would become its containing
    // block, pinning the footer to the column rather than the window.
    <>
      <Shell scopeLabel={`${TRACKED_VENDORS.length} vendors`}>{children}</Shell>
      <DemoFooter />
    </>
  );
}

import { Shell } from "@/lib/ui/shell";
import { DemoFooter } from "@/lib/ui/page";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";

export default function AiEntLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Shell scopeLabel={`${TRACKED_VENDORS.length} vendors`}>
      {children}
      <DemoFooter />
    </Shell>
  );
}

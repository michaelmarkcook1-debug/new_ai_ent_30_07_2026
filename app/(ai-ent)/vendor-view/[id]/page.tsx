import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/lib/ui/page";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";
import { getVendorProfile } from "../data";
import {
  CapabilitiesSection,
  DependencySection,
  ModelsSection,
  ProfileFacts,
  ReputationSection,
  ScoreBlock,
  SourcesSection,
} from "../components/profile-sections";

export function generateStaticParams() {
  return TRACKED_VENDORS.map((vendor) => ({ id: vendor.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = getVendorProfile(id);
  return {
    title: profile
      ? `${profile.intel.name} | Vendor View | AI Enterprise`
      : "Vendor View | AI Enterprise",
  };
}

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = getVendorProfile(id);
  if (!profile) notFound();

  return (
    <>
      <PageHeader
        title={profile.intel.name}
        subtitle={profile.intel.description}
        lanes={["aie"]}
        actions={
          <Link
            href="/vendor-view"
            className="rounded-full border border-base-300 px-3 py-2 text-xs text-base-content/85 transition hover:border-primary hover:text-primary"
          >
            All vendors
          </Link>
        }
      />
      <div className="space-y-4 pb-8">
        <ProfileFacts profile={profile} />
        <ScoreBlock profile={profile} />
        <CapabilitiesSection profile={profile} />
        <DependencySection profile={profile} />
        <ModelsSection profile={profile} />
        <ReputationSection profile={profile} />
        <SourcesSection profile={profile} />
      </div>
    </>
  );
}

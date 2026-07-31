import { aieServerFetch, type AieLane } from "@/lib/aie-server";

// Security and governance posture per vendor, from the real AI Enterprise
// capability assessments.
//
// This replaces what used to be illustrative prose on two surfaces (The
// Security Desk's private-lab cards and Trust Rank's governance block). The
// dataset assesses all 47 tracked vendors on both Security and Governance,
// each row carrying a maturity score, a status, an evidence grade and the
// evidence note behind it. That is a real, citable reading, so those surfaces
// no longer have to say "no source exists".
//
// What it is not: a cyber-incident analysis. BoardRadar's /cyber-risk covers
// the public platform companies and reports incidents and exposure. This is a
// capability assessment of the vendor's published security and governance
// practice. The two are different measurements and are never merged.

export type PostureKind = "security" | "governance";

export interface VendorPosture {
  vendorId: string;
  vendorName: string;
  category: string;
  /** 0 to 100 capability maturity from the assessment. */
  maturity: number | null;
  /** The dataset's own row status: verified, tested, documented, inferred. */
  status: string | null;
  /** Evidence grade E1 (strongest) to E5. */
  evidenceGrade: string | null;
  /** The evidence excerpt the assessment records for this row. */
  note: string | null;
  lastVerified: string | null;
  /** Open risks the vendor record lists, carried across verbatim. */
  riskProfile: string[];
}

export interface PostureView {
  rows: VendorPosture[];
  kind: PostureKind;
  lane: AieLane;
  assessedCount: number;
}

interface RawCap {
  vendorId: string;
  capabilityId: string;
  status: string | null;
  maturityScore: number | null;
  evidenceGrade: string | null;
  lastVerified: string | null;
  notes: string | null;
}
interface RawVendor {
  id: string;
  name: string;
  category: string;
  riskProfile?: string[] | null;
}

export async function loadVendorPostures(
  kind: PostureKind,
  vendorIds?: string[]
): Promise<PostureView> {
  const [capsRes, vendorsRes] = await Promise.all([
    aieServerFetch<{ vendorCapabilities: RawCap[] }>("capabilities"),
    aieServerFetch<{ vendors: RawVendor[] }>("vendors"),
  ]);

  const vendors = new Map(
    (vendorsRes.data?.vendors ?? []).map((v) => [v.id, v])
  );
  const wanted = vendorIds ? new Set(vendorIds) : null;

  const rows: VendorPosture[] = (capsRes.data?.vendorCapabilities ?? [])
    .filter((c) => c.capabilityId === kind)
    .filter((c) => !wanted || wanted.has(c.vendorId))
    .map((c) => {
      const v = vendors.get(c.vendorId);
      return {
        vendorId: c.vendorId,
        vendorName: v?.name ?? c.vendorId,
        category: v?.category ?? "",
        maturity:
          typeof c.maturityScore === "number"
            ? Math.round(c.maturityScore * 10) / 10
            : null,
        status: c.status,
        evidenceGrade: c.evidenceGrade,
        note: c.notes?.trim() || null,
        lastVerified: c.lastVerified,
        riskProfile: v?.riskProfile ?? [],
      };
    })
    .sort((a, b) => (b.maturity ?? -1) - (a.maturity ?? -1));

  return {
    rows,
    kind,
    lane: capsRes.lane === "aie" || vendorsRes.lane === "aie" ? "aie" : "aie-live",
    assessedCount: rows.length,
  };
}

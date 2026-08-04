import {
  ALLIANCE_VENTURES,
  CHANNEL_LINKS,
  type AllianceVenture,
  type ChannelLink,
} from "@/lib/aie/alliances/seed";

// Module adapter for the AI x GSI Alliance Explorer.

export interface AlliancesData {
  links: ChannelLink[];
  ventures: AllianceVenture[];
  /** Every industry any link names, for the focus filter. */
  industries: string[];
  citedCount: number;
  partnerCount: number;
}

export function getAlliancesData(): AlliancesData {
  const industries = [
    ...new Set(CHANNEL_LINKS.flatMap((l) => l.industries)),
  ].sort();
  return {
    links: CHANNEL_LINKS,
    ventures: ALLIANCE_VENTURES,
    industries,
    citedCount:
      CHANNEL_LINKS.filter((l) => l.spotlight).length + ALLIANCE_VENTURES.length,
    partnerCount: new Set(CHANNEL_LINKS.map((l) => l.partnerId)).size,
  };
}

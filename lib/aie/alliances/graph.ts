import type { ChannelLink, PartnerKind } from "./seed";

// Turning the channel links into a topology.
//
// Kept out of the component so it can be tested without a DOM: everything
// upstream of the pixels is ordinary data work, and that is the part worth
// pinning.

export interface GraphNode {
  id: string;
  label: string;
  kind: "vendor" | PartnerKind;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  direct: boolean;
}

export const GRAPH_W = 1000;
export const GRAPH_H = 620;

// Mulberry32. Small, fast, and identical in Node and the browser, which is
// what makes the layout reproducible across a server render and a rehydrate,
// and what stops a screenshot in a report drifting from the live product.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildGraph(links: ChannelLink[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(`v:${l.vendorId}`, (degree.get(`v:${l.vendorId}`) ?? 0) + 1);
    degree.set(`p:${l.partnerId}`, (degree.get(`p:${l.partnerId}`) ?? 0) + 1);
  }

  const seen = new Map<string, GraphNode>();
  const rand = seeded(20260804);
  const add = (id: string, label: string, kind: GraphNode["kind"]) => {
    if (seen.has(id)) return;
    // Vendors start near the middle, partners on a ring around them, which
    // gives the solver a sane starting shape instead of a random cloud.
    const isVendor = kind === "vendor";
    const angle = rand() * Math.PI * 2;
    const radius = isVendor ? 60 + rand() * 70 : 210 + rand() * 130;
    seen.set(id, {
      id,
      label,
      kind,
      degree: degree.get(id) ?? 1,
      x: GRAPH_W / 2 + Math.cos(angle) * radius,
      y: GRAPH_H / 2 + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      fixed: false,
    });
  };

  for (const l of links) {
    add(`v:${l.vendorId}`, l.vendorName, "vendor");
    add(
      `p:${l.partnerId}`,
      l.partnerName,
      l.platformHybrid ? "platform_hybrid" : l.partnerKind
    );
  }

  const edges: GraphEdge[] = links.map((l) => ({
    source: `v:${l.vendorId}`,
    target: `p:${l.partnerId}`,
    direct: l.tier === "direct_named",
  }));

  return { nodes: [...seen.values()], edges };
}

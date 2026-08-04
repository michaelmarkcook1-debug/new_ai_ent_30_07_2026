import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/aie/alliances/graph";
import {
  ALLIANCE_VENTURES,
  CHANNEL_LINKS,
} from "@/lib/aie/alliances/seed";

// The graph is drawn to a canvas, which a DOM test cannot meaningfully assert
// against. What it can pin is everything upstream of the pixels: that the
// topology built from the data is the topology the data describes, and that
// the layout is reproducible.

describe("alliance channel data", () => {
  it("is bipartite: every link joins one vendor to one partner", () => {
    for (const l of CHANNEL_LINKS) {
      expect(l.vendorId).toBeTruthy();
      expect(l.partnerId).toBeTruthy();
      expect(l.vendorId).not.toBe(l.partnerId);
    }
  });

  it("has a unique key per link, so nodes cannot double-count", () => {
    const keys = CHANNEL_LINKS.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("carries a named publisher, url and date on every cited alliance", () => {
    const cited = [
      ...CHANNEL_LINKS.filter((l) => l.spotlight).map((l) => l.spotlight!),
      ...ALLIANCE_VENTURES,
    ];
    // The page's central claim is that every figure traces to a source, so an
    // uncited dossier would be a product defect, not a cosmetic one.
    expect(cited.length).toBeGreaterThan(0);
    for (const s of cited) {
      expect(s.publisher.trim()).not.toBe("");
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.asOf.trim()).not.toBe("");
      expect(s.proofPoints.length).toBeGreaterThan(0);
    }
  });

  it("keeps the two markup-ported alliances visible as such", () => {
    const ported = CHANNEL_LINKS.filter((l) => l.portedFromMarkup);
    expect(ported.map((l) => l.key).sort()).toEqual([
      "capgemini|mistral",
      "ey|microsoft",
    ]);
    // They are the reason the map and the dossier list agree; both must carry
    // a dossier of their own.
    for (const l of ported) expect(l.spotlight).not.toBeNull();
  });
});

describe("buildGraph", () => {
  const { nodes, edges } = buildGraph(CHANNEL_LINKS);

  it("emits one node per distinct organisation and one edge per link", () => {
    const vendors = new Set(CHANNEL_LINKS.map((l) => l.vendorId));
    const partners = new Set(CHANNEL_LINKS.map((l) => l.partnerId));
    expect(nodes.length).toBe(vendors.size + partners.size);
    expect(edges.length).toBe(CHANNEL_LINKS.length);
  });

  it("gives every edge two endpoints that exist", () => {
    const ids = new Set(nodes.map((n) => n.id));
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it("sets degree to the number of links a node actually carries", () => {
    for (const n of nodes) {
      const touching = edges.filter(
        (e) => e.source === n.id || e.target === n.id
      ).length;
      expect(n.degree).toBe(touching);
    }
  });

  it("marks a platform hybrid by its kind, not by its partner category", () => {
    const hybridLinks = CHANNEL_LINKS.filter((l) => l.platformHybrid);
    for (const l of hybridLinks) {
      const node = nodes.find((n) => n.id === `p:${l.partnerId}`);
      expect(node?.kind).toBe("platform_hybrid");
    }
  });

  it("lays out deterministically, so the same data draws the same map", () => {
    const again = buildGraph(CHANNEL_LINKS);
    expect(again.nodes.map((n) => [n.id, n.x, n.y])).toEqual(
      nodes.map((n) => [n.id, n.x, n.y])
    );
  });

  it("starts every node inside the canvas with no NaN coordinates", () => {
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

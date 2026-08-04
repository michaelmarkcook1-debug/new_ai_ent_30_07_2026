"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChannelLink } from "@/lib/aie/alliances/seed";
import {
  buildGraph,
  GRAPH_H as H,
  GRAPH_W as W,
  type GraphNode,
} from "@/lib/aie/alliances/graph";

// The alliance topology, as a force-directed map you can pull apart.
//
// Canvas rather than SVG: 73 nodes and 51 edges re-drawn every frame is a few
// hundred DOM mutations per tick in SVG, and the simulation is the point of
// the picture. Canvas draws the same scene in one pass.
//
// The physics is deliberately plain, and hand-rolled rather than pulled from a
// library: repulsion between every pair, springs along the edges, a weak pull
// to centre so nothing drifts off, and heavy damping so it settles rather than
// oscillating. That is enough for a readable topology and it costs no
// dependency.
//
// Determinism matters here. Node starting positions come from a seeded
// generator, not Math.random, so the same data always lays out the same way:
// a reader who returns to this page sees the map they remember, and a
// screenshot in a report still matches the product a week later.

// Which token paints each node kind. Vendors take the judgement purple
// because they are the subject of the map; everything that delivers them
// takes the channel teal, which means the same thing here as it does on every
// other page. A platform hybrid gets the brand navy instead: it sells its own
// platform as well as carrying someone else's, and that conflict is the point
// of separating it.
const NODE_FILL: Record<GraphNode["kind"], string> = {
  vendor: "--ag-insight",
  global_si: "--ag-channel",
  strategy_consultancy: "--ag-channel",
  platform_hybrid: "--ag-primary",
  regional_si: "--ag-channel",
};

export function AllianceGraph({
  links,
  highlight,
  selected,
  onSelect,
}: {
  links: ChannelLink[];
  /** Node ids to keep at full strength; everything else dims. */
  highlight: Set<string> | null;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [running, setRunning] = useState(true);

  const graph = useMemo(() => buildGraph(links), [links]);
  const nodesRef = useRef(graph.nodes);
  useEffect(() => {
    nodesRef.current = graph.nodes;
    setRunning(true);
  }, [graph]);

  const radiusOf = useCallback(
    (n: GraphNode) => 9 + Math.min(11, Math.sqrt(n.degree) * 4),
    []
  );

  // One simulation step. Split out so "Stabilise" can run it to convergence
  // without waiting on animation frames.
  const step = useCallback(
    (nodes: GraphNode[], alpha: number) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            // Coincident nodes have no direction to separate along, so give
            // them one rather than dividing by zero.
            dx = 0.5;
            dy = 0.5;
            d2 = 0.5;
          }
          const d = Math.sqrt(d2);
          const rep = (5200 * alpha) / d2;
          const fx = (dx / d) * rep;
          const fy = (dy / d) * rep;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      for (const e of graph.edges) {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        // Named alliances pull tighter, so the strong relationships read as
        // structure rather than as one more line in the mesh.
        const rest = e.direct ? 130 : 190;
        const k = (d - rest) * 0.012 * alpha;
        const fx = (dx / d) * k;
        const fy = (dy / d) * k;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }
      for (const n of nodes) {
        if (n.fixed) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (W / 2 - n.x) * 0.0016 * alpha;
        n.vy += (H / 2 - n.y) * 0.0016 * alpha;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
        const r = radiusOf(n);
        n.x = Math.max(r + 4, Math.min(W - r - 4, n.x));
        n.y = Math.max(r + 4, Math.min(H - r - 4, n.y));
      }
    },
    [graph.edges, radiusOf]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const v = (name: string) => css.getPropertyValue(name).trim();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const nodes = nodesRef.current;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const lit = (id: string) => !highlight || highlight.has(id);

    for (const e of graph.edges) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      const on = lit(e.source) && lit(e.target);
      ctx.globalAlpha = on ? (e.direct ? 0.75 : 0.32) : 0.06;
      ctx.strokeStyle = e.direct ? v("--ag-insight") : v("--ag-muted");
      ctx.lineWidth = e.direct ? 1.9 : 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    for (const n of nodes) {
      const r = radiusOf(n);
      const on = lit(n.id);
      const isSel = n.id === selected || n.id === hover;
      ctx.globalAlpha = on ? 1 : 0.16;
      const fill = v(NODE_FILL[n.kind]);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (n.kind === "vendor") {
        ctx.fillStyle = fill;
        ctx.fill();
      } else {
        ctx.fillStyle = v("--ag-base-100");
        ctx.fill();
        ctx.strokeStyle = fill;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
      if (isSel && on) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = v("--ag-base-content");
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.globalAlpha = on ? 1 : 0.2;
      ctx.fillStyle = v("--ag-base-content");
      ctx.font = `${n.kind === "vendor" ? "700" : "500"} 12px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(n.label, n.x, n.y + r + 4);
    }
    ctx.globalAlpha = 1;
  }, [graph.edges, highlight, hover, radiusOf, selected]);

  // Paint once, synchronously, on every mount and whenever the tab comes back.
  //
  // requestAnimationFrame does not fire in a hidden document, so a canvas that
  // mounts in a background tab is never sized and never drawn: it stays at the
  // 300x150 HTML default and shows nothing until something else forces a
  // render. Switching to the directory and back is enough to hit that, because
  // the canvas unmounts and the new one mounts into a tab the user may since
  // have left. Drawing here rather than only inside the loop also means the
  // first paint does not wait a frame.
  useEffect(() => {
    draw();
    const onVisible = () => {
      if (!document.hidden) draw();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [draw]);

  // The loop. Cools over time and stops itself, so an idle tab is not burning
  // a frame budget on a settled graph.
  useEffect(() => {
    let alpha = 1;
    let ticks = 0;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Solve it without animating, then draw once.
      for (let i = 0; i < 240; i++) step(nodesRef.current, 1 - i / 260);
      draw();
      setRunning(false);
      return;
    }
    const loop = () => {
      if (running || dragRef.current) {
        step(nodesRef.current, dragRef.current ? 0.35 : alpha);
        ticks += 1;
        alpha = Math.max(0.02, alpha * 0.985);
        if (ticks > 420 && !dragRef.current) setRunning(false);
      }
      draw();
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [draw, running, step]);

  const pointAt = (evt: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / rect.width) * W,
      y: ((evt.clientY - rect.top) / rect.height) * H,
    };
  };

  const hitTest = (x: number, y: number) => {
    // Back to front, so the node drawn on top is the one you grab.
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(n.x - x, n.y - y) <= radiusOf(n) + 3) return n;
    }
    return null;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="micro-label">Interactive canvas</span>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-full border border-base-300 px-3 py-1 text-xs font-semibold transition hover:border-primary hover:text-primary"
          >
            {running ? "Freeze layout" : "Stabilise graph"}
          </button>
        </div>
        <p className="text-xs text-muted">
          {hover
            ? nodesRef.current.find((n) => n.id === hover)?.label
            : "Drag a node to pull the topology apart. Click one to lock its connections."}
        </p>
      </div>

      <canvas
        ref={canvasRef}
        style={{ aspectRatio: `${W} / ${H}` }}
        className="mt-2 w-full cursor-grab touch-none rounded-lg border border-base-300 bg-base-200/40 active:cursor-grabbing"
        role="img"
        aria-label={`Alliance topology: ${graph.nodes.length} organisations connected by ${graph.edges.length} channel links. The directory tab below lists every link as text.`}
        onPointerDown={(e) => {
          const { x, y } = pointAt(e);
          const n = hitTest(x, y);
          if (!n) {
            onSelect(null);
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          n.fixed = true;
          dragRef.current = { id: n.id, dx: n.x - x, dy: n.y - y };
          onSelect(n.id);
        }}
        onPointerMove={(e) => {
          const { x, y } = pointAt(e);
          const d = dragRef.current;
          if (d) {
            const n = nodesRef.current.find((q) => q.id === d.id);
            if (n) {
              n.x = x + d.dx;
              n.y = y + d.dy;
            }
            return;
          }
          const n = hitTest(x, y);
          setHover(n ? n.id : null);
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          if (d) {
            const n = nodesRef.current.find((q) => q.id === d.id);
            // Released nodes rejoin the simulation rather than pinning where
            // they were dropped, so the map re-settles around the change.
            if (n) n.fixed = false;
          }
          dragRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}

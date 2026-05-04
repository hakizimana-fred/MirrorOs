"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import type { GraphData, GraphNode, GraphEdge } from "@/app/types/system";

interface Props {
  data: GraphData;
  width?: number;
  height?: number;
  title?: string;
}

const EDGE_COLOR: Record<string, string> = {
  accesses: "#6366f133",
  parent_of: "#f59e0b44",
  writes:    "#ef444433",
};
const EDGE_COLOR_FOCUSED: Record<string, string> = {
  accesses: "#6366f1cc",
  parent_of: "#f59e0bcc",
  writes:    "#ef4444cc",
};

type NodeSel = d3.Selection<SVGGElement,  GraphNode, SVGGElement, unknown>;
type LinkSel = d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>;

// Apply or clear focus-mode opacity on existing selections
function applyFocus(
  focusedId: string | null,
  nodeSel: NodeSel,
  linkSel: LinkSel,
) {
  if (!focusedId) {
    nodeSel.style("opacity", "1");
    linkSel
      .attr("stroke", (d) => EDGE_COLOR[d.edgeType] || "#ffffff22")
      .attr("stroke-width", (d) => d.weight + 0.5)
      .style("opacity", "1");
    return;
  }

  // Find all IDs reachable in one hop
  const connected = new Set<string>([focusedId]);
  linkSel.each((d) => {
    const s = ((d.source as unknown) as GraphNode).id ?? (d.source as string);
    const t = ((d.target as unknown) as GraphNode).id ?? (d.target as string);
    if (s === focusedId) connected.add(t);
    if (t === focusedId) connected.add(s);
  });

  nodeSel.style("opacity", (d) => (connected.has(d.id) ? "1" : "0.08"));
  linkSel
    .style("opacity", (d) => {
      const s = ((d.source as unknown) as GraphNode).id ?? (d.source as string);
      const t = ((d.target as unknown) as GraphNode).id ?? (d.target as string);
      return s === focusedId || t === focusedId ? "1" : "0.04";
    })
    .attr("stroke", (d) => {
      const s = ((d.source as unknown) as GraphNode).id ?? (d.source as string);
      const t = ((d.target as unknown) as GraphNode).id ?? (d.target as string);
      return s === focusedId || t === focusedId
        ? (EDGE_COLOR_FOCUSED[d.edgeType] || "#ffffff88")
        : (EDGE_COLOR[d.edgeType] || "#ffffff11");
    })
    .attr("stroke-width", (d) => {
      const s = ((d.source as unknown) as GraphNode).id ?? (d.source as string);
      const t = ((d.target as unknown) as GraphNode).id ?? (d.target as string);
      return s === focusedId || t === focusedId ? d.weight + 2 : 0.5;
    });
}

export default function SystemGraph({ data, width = 800, height = 600, title }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const simRef    = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);
  const posCache  = useRef<Map<string, { x: number; y: number }>>(new Map());
  const nodeSelRef = useRef<NodeSel | null>(null);
  const linkSelRef = useRef<LinkSel | null>(null);
  const focusRef  = useRef<string | null>(null);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusLabel, setFocusLabel] = useState<string>("");

  // ── Focus effect (runs without rebuilding the simulation) ───────────────────
  useEffect(() => {
    focusRef.current = focusedId;
    if (nodeSelRef.current && linkSelRef.current) {
      applyFocus(focusedId, nodeSelRef.current, linkSelRef.current);
    }
    if (focusedId) {
      const node = data.nodes.find((n) => n.id === focusedId);
      setFocusLabel(node?.label ?? "");
    } else {
      setFocusLabel("");
    }
  }, [focusedId, data.nodes]);

  // ── Main build (runs when data / dimensions change) ─────────────────────────
  const build = useCallback(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();

    const { nodes: rawNodes, edges: rawEdges } = data;
    if (!rawNodes.length) return;

    // Restore cached positions so layout persists across data updates
    const nodes: GraphNode[] = rawNodes.map((n) => {
      const c = posCache.current.get(n.id);
      return {
        ...n,
        x: c?.x ?? width  / 2 + (Math.random() - 0.5) * 200,
        y: c?.y ?? height / 2 + (Math.random() - 0.5) * 200,
      };
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const edges: GraphEdge[] = rawEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ ...e }));

    // ── Defs ──────────────────────────────────────────────────────────────────
    const defs = svg.append("defs");
    defs.append("filter").attr("id", "glow-soft").html(
      `<feGaussianBlur stdDeviation="2.5" result="b"/>
       <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`
    );
    defs.append("filter").attr("id", "glow-hot").html(
      `<feGaussianBlur stdDeviation="5" result="b"/>
       <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`
    );
    // Radial gradient for background
    const rg = defs.append("radialGradient")
      .attr("id", "bg-vignette")
      .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
    rg.append("stop").attr("offset", "60%").attr("stop-color", "transparent");
    rg.append("stop").attr("offset", "100%").attr("stop-color", "#030712").attr("stop-opacity", 0.6);

    const container = svg.append("g");

    // Vignette overlay
    svg.append("rect")
      .attr("width", width).attr("height", height)
      .attr("fill", "url(#bg-vignette)")
      .attr("pointer-events", "none");

    // Click background → clear focus
    svg.on("click", () => setFocusedId(null));

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.08, 5])
        .on("zoom", (ev) => container.attr("transform", ev.transform))
    );

    // ── Links ─────────────────────────────────────────────────────────────────
    const link = container
      .append("g")
      .selectAll<SVGLineElement, GraphEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => EDGE_COLOR[d.edgeType] || "#ffffff22")
      .attr("stroke-width", (d) => d.weight + 0.5)
      .attr("stroke-linecap", "round");

    // ── Nodes ─────────────────────────────────────────────────────────────────
    const node = container
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
          .on("end",  (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    // Click node → focus
    node.on("click", (ev, d) => {
      ev.stopPropagation();
      setFocusedId((prev) => (prev === d.id ? null : d.id));
    });

    // Outer glow halo (hot nodes only)
    node.filter((d) => !!d.isHot || (d.cpuPercent ?? 0) > 10)
      .append("circle")
      .attr("r", (d) => d.size * 1.8)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.07)
      .attr("pointer-events", "none");

    // Main circle
    node.append("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.88)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("filter", (d) =>
        (d.cpuPercent ?? 0) > 15 || d.isHot ? "url(#glow-hot)" : "url(#glow-soft)"
      );

    // Fast pulse ring (very hot)
    node.filter((d) => (d.cpuPercent ?? 0) > 15 || (!!d.isHot && (d.accessCount ?? 0) > 10))
      .append("circle")
      .attr("r", (d) => d.size + 5)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5)
      .attr("pointer-events", "none")
      .attr("class", "pulse-fast");

    // Slow pulse ring (active)
    node.filter((d) => (d.cpuPercent ?? 0) > 3 || !!d.isHot)
      .append("circle")
      .attr("r", (d) => d.size + 3)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .attr("pointer-events", "none")
      .attr("class", "pulse-slow");

    // Label
    node.append("text")
      .text((d) => (d.label.length > 16 ? d.label.slice(0, 14) + "…" : d.label))
      .attr("dy", (d) => d.size + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#94a3b8")
      .attr("pointer-events", "none");

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const tooltip = d3.select("body")
      .selectAll<HTMLDivElement, unknown>(".sm-tooltip")
      .data([1])
      .join("div")
      .attr("class", "sm-tooltip")
      .style("position", "fixed")
      .style("background", "#0f172a")
      .style("border", "1px solid #1e293b")
      .style("border-radius", "8px")
      .style("padding", "10px 14px")
      .style("font-size", "12px")
      .style("color", "#e2e8f0")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "9999")
      .style("box-shadow", "0 4px 24px rgba(0,0,0,0.6)");

    node
      .on("mouseover", (ev, d) => {
        const connCount = edges.filter((e) => {
          const s = e.source as unknown as GraphNode;
          const t = e.target as unknown as GraphNode;
          return (s.id ?? e.source) === d.id || (t.id ?? e.target) === d.id;
        }).length;
        let html = `<div style="font-weight:600;margin-bottom:4px">${d.label}</div>`;
        html += `<div style="color:#64748b;font-size:10px;margin-bottom:6px">${d.nodeType.toUpperCase()}</div>`;
        if (d.cpuPercent !== undefined)
          html += `<div>CPU <span style="color:#a5b4fc">${d.cpuPercent.toFixed(1)}%</span></div>`;
        if (d.memoryMb !== undefined)
          html += `<div>Mem <span style="color:#a5b4fc">${d.memoryMb.toFixed(1)} MB</span></div>`;
        if (d.accessCount !== undefined)
          html += `<div>Accesses <span style="color:#6ee7b7">${d.accessCount}</span></div>`;
        if (connCount) html += `<div>Links <span style="color:#c4b5fd">${connCount}</span></div>`;
        if (d.isHot)    html += `<div style="color:#f87171;margin-top:4px">🔥 Hot</div>`;
        html += `<div style="color:#475569;font-size:10px;margin-top:6px">Click to focus</div>`;
        tooltip.html(html)
          .style("left", ev.clientX + 14 + "px")
          .style("top",  ev.clientY - 28 + "px")
          .transition().duration(120).style("opacity", 1);
      })
      .on("mousemove", (ev) => {
        tooltip.style("left", ev.clientX + 14 + "px").style("top", ev.clientY - 28 + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(180).style("opacity", 0);
      });

    // ── Physics ───────────────────────────────────────────────────────────────
    const sim = d3.forceSimulation<GraphNode>(nodes)
      .alphaDecay(0.015)     // slow convergence → organic drift
      .velocityDecay(0.25)   // low friction
      .force("link",
        d3.forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance((d) => d.edgeType === "parent_of" ? 60 : 95)
          .strength(0.35)
      )
      .force("charge", d3.forceManyBody().strength((d) => -150 - (d as GraphNode).size * 4))
      .force("center",    d3.forceCenter(width / 2, height / 2).strength(0.04))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.size + 8).strength(0.8));

    simRef.current = sim;

    // Periodic gentle reheat for organic movement
    const reheatId = setInterval(() => {
      if (simRef.current && simRef.current.alpha() < 0.03) {
        simRef.current.alpha(0.06).restart();
      }
    }, 7000);

    sim.on("tick", () => {
      // Cache positions
      nodes.forEach((n) => {
        if (n.x != null && n.y != null) posCache.current.set(n.id, { x: n.x, y: n.y });
      });

      link
        .attr("x1", (d) => ((d.source as unknown) as GraphNode).x ?? 0)
        .attr("y1", (d) => ((d.source as unknown) as GraphNode).y ?? 0)
        .attr("x2", (d) => ((d.target as unknown) as GraphNode).x ?? 0)
        .attr("y2", (d) => ((d.target as unknown) as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Store selections in refs so focus effect can update without rebuild
    nodeSelRef.current = node;
    linkSelRef.current = link;

    // Apply current focus state immediately after build
    applyFocus(focusRef.current, node, link);

    return () => {
      sim.stop();
      clearInterval(reheatId);
    };
  }, [data, width, height]);

  useEffect(() => {
    const cleanup = build();
    return () => {
      cleanup?.();
      simRef.current?.stop();
    };
  }, [build]);

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden border border-gray-800">
      {title && (
        <div className="absolute top-3 left-4 text-xs font-semibold text-gray-500 uppercase tracking-widest z-10">
          {title}
        </div>
      )}

      {/* Focus mode badge */}
      {focusedId && (
        <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-indigo-950/90 border border-indigo-800 rounded-full px-3 py-1 text-xs text-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Focus: <span className="font-semibold ml-1">{focusLabel}</span>
          </div>
          <button
            onClick={() => setFocusedId(null)}
            className="text-gray-600 hover:text-gray-300 text-xs bg-gray-900 border border-gray-800 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Node count */}
      <div className="absolute bottom-3 right-4 text-[10px] text-gray-700 z-10">
        {data.nodes.length} nodes · {data.edges.length} edges
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{ background: "transparent" }}
      />

      <style>{`
        @keyframes pulse-fast {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes pulse-slow {
          0%   { transform: scale(1);   opacity: 0.35; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .pulse-fast {
          animation: pulse-fast 1.2s ease-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        .pulse-slow {
          animation: pulse-slow 2.4s ease-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>
    </div>
  );
}

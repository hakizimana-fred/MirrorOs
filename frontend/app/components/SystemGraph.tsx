"use client";
import { useEffect, useRef, useCallback } from "react";
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
  writes: "#ef444433",
};

export default function SystemGraph({ data, width = 800, height = 600, title }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null);

  const build = useCallback(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll("*").remove();

    const { nodes: rawNodes, edges: rawEdges } = data;
    if (!rawNodes.length) return;

    // Deep-clone so D3 can mutate position fields
    const nodes: GraphNode[] = rawNodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Only include edges where both endpoints exist
    const edges: GraphEdge[] = rawEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ ...e }));

    const defs = svg.append("defs");
    defs
      .append("filter")
      .attr("id", "glow")
      .html(
        `<feGaussianBlur stdDeviation="3" result="blur"/>
         <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`
      );

    const container = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (ev) => container.attr("transform", ev.transform))
    );

    const link = container
      .append("g")
      .selectAll<SVGLineElement, GraphEdge>("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d) => EDGE_COLOR[d.edgeType] || "#ffffff22")
      .attr("stroke-width", (d) => d.weight + 0.5);

    const node = container
      .append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on("start", (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (ev, d) => {
            d.fx = ev.x;
            d.fy = ev.y;
          })
          .on("end", (ev, d) => {
            if (!ev.active) simRef.current?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1.5)
      .attr("filter", "url(#glow)");

    // Pulse ring for hot nodes
    node
      .filter((d) => !!d.isHot || (d.cpuPercent ?? 0) > 5)
      .append("circle")
      .attr("r", (d) => d.size + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.4)
      .attr("class", "pulse-ring");

    node
      .append("text")
      .text((d) => (d.label.length > 16 ? d.label.slice(0, 14) + "…" : d.label))
      .attr("dy", (d) => d.size + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#cbd5e1")
      .attr("pointer-events", "none");

    // Tooltip
    const tooltip = d3
      .select("body")
      .selectAll<HTMLDivElement, unknown>(".sm-tooltip")
      .data([1])
      .join("div")
      .attr("class", "sm-tooltip")
      .style("position", "fixed")
      .style("background", "#1e293b")
      .style("border", "1px solid #334155")
      .style("border-radius", "6px")
      .style("padding", "8px 12px")
      .style("font-size", "12px")
      .style("color", "#e2e8f0")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", "9999");

    node
      .on("mouseover", (ev, d) => {
        let html = `<strong>${d.label}</strong><br/><em>${d.nodeType}</em>`;
        if (d.cpuPercent !== undefined)
          html += `<br/>CPU: ${d.cpuPercent.toFixed(1)}%`;
        if (d.memoryMb !== undefined)
          html += `<br/>Mem: ${d.memoryMb.toFixed(1)} MB`;
        if (d.accessCount !== undefined)
          html += `<br/>Accesses: ${d.accessCount}`;
        if (d.isHot) html += `<br/><span style="color:#ef4444">🔥 Hot file</span>`;
        tooltip
          .html(html)
          .style("left", ev.clientX + 14 + "px")
          .style("top", ev.clientY - 28 + "px")
          .transition()
          .duration(150)
          .style("opacity", 1);
      })
      .on("mousemove", (ev) => {
        tooltip
          .style("left", ev.clientX + 14 + "px")
          .style("top", ev.clientY - 28 + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(200).style("opacity", 0);
      });

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(edges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => d.size + 6));

    simRef.current = sim;

    sim.on("tick", () => {
      link
        .attr("x1", (d) => ((d.source as unknown) as GraphNode).x ?? 0)
        .attr("y1", (d) => ((d.source as unknown) as GraphNode).y ?? 0)
        .attr("x2", (d) => ((d.target as unknown) as GraphNode).x ?? 0)
        .attr("y2", (d) => ((d.target as unknown) as GraphNode).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => sim.stop();
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
        <div className="absolute top-3 left-4 text-xs font-semibold text-gray-400 uppercase tracking-widest z-10">
          {title}
        </div>
      )}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{ background: "transparent" }}
      />
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .pulse-ring {
          animation: pulse-ring 2s ease-out infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}

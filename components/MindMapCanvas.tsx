
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card } from '../types';

interface MindMapCanvasProps {
  data: Card;
  onExpand: (id: string, message: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newMessage: string) => void;
  onAddManual: (id: string) => void;
}

const CARD_WIDTH = 200;
const CARD_HEIGHT = 70;
const HORIZONTAL_SPACING = 280;
const VERTICAL_LIST_SPACING = 100;
const INDENT_SIZE = 120; // Increased to allow space for the "Bottom-to-Left" connection

const MindMapCanvas: React.FC<MindMapCanvasProps> = ({ data, onExpand, onDelete, onEdit, onAddManual }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);
  const [zoomLevel, setZoomLevel] = useState(0.8);

  const getDepthColor = (depth: number) => {
    const colors = [
      'bg-indigo-600 border-indigo-700 text-white',
      'bg-indigo-50 border-indigo-200 text-indigo-900',
      'bg-white border-slate-200 text-slate-700',
      'bg-white border-slate-100 text-slate-500',
    ];
    return colors[Math.min(depth, colors.length - 1)];
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      const width = containerRef.current?.clientWidth || 1200;
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity.translate(width / 2, 80).scale(0.8));
    }
  };

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    let g = svg.select<SVGGElement>("g.main-group");
    if (g.empty()) {
      g = svg.append("g").attr("class", "main-group");
    }

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior as any);

    const root = d3.hierarchy(data);

    // --- CUSTOM HYBRID LAYOUT LOGIC ---
    // 1. Root at (0, 0)
    root.x = 0;
    root.y = 0;

    if (root.children) {
      const numLevel2 = root.children.length;
      const totalWidth = (numLevel2 - 1) * HORIZONTAL_SPACING;
      
      root.children.forEach((child, i) => {
        // 2. Level 2 nodes spread horizontally
        child.x = -totalWidth / 2 + i * HORIZONTAL_SPACING;
        child.y = 150;

        // 3. Level 3+ nodes arranged vertically under their parent
        let verticalOffset = 1;
        const layoutSubtree = (node: d3.HierarchyNode<Card>, parentX: number, startY: number) => {
          if (!node.children) return;
          node.children.forEach((leaf) => {
            leaf.x = parentX + INDENT_SIZE;
            leaf.y = startY + verticalOffset * VERTICAL_LIST_SPACING;
            verticalOffset++;
            // Pass the same startY for the branch to keep them relative to the Level 2 node's baseline
            // or pass leaf.y if we want cascading vertical offsets. Here we use leaf.y for the next level.
            layoutSubtree(leaf, leaf.x, startY);
          });
        };
        layoutSubtree(child, child.x, child.y);
      });
    }

    // --- RENDER LINKS ---
    const links = g.selectAll<SVGPathElement, d3.HierarchyLink<Card>>("path.link")
      .data(root.links(), d => (d.target.data as any).id);

    links.enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2)
      .merge(links as any)
      .transition().duration(500)
      .attr("d", (d: any) => {
        if (d.source.depth === 0) {
          // Curved link: Root Bottom -> Level 2 Top
          return d3.linkVertical()
            .source(() => [d.source.x, d.source.y + CARD_HEIGHT / 2])
            .target(() => [d.target.x, d.target.y - CARD_HEIGHT / 2])(d);
        } else {
          // Elbow Link: Parent Bottom -> Child Left
          const startX = d.source.x;
          const startY = d.source.y + CARD_HEIGHT / 2;
          const endX = d.target.x - CARD_WIDTH / 2;
          const endY = d.target.y;
          
          // Move from bottom of parent, straight down to child's vertical level, then right to left edge
          return `M${startX},${startY} V${endY} H${endX}`;
        }
      });

    links.exit().remove();

    // --- RENDER NODES ---
    const nodes = g.selectAll<SVGGElement, d3.HierarchyNode<Card>>("g.node")
      .data(root.descendants(), d => (d.data as any).id);

    const nodeEnter = nodes.enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x},${d.y})`)
      .attr("opacity", 0);

    const fo = nodeEnter.append("foreignObject")
      .attr("width", CARD_WIDTH + 60)
      .attr("height", CARD_HEIGHT + 40)
      .attr("x", -CARD_WIDTH / 2)
      .attr("y", -CARD_HEIGHT / 2);

    fo.append("xhtml:div")
      .attr("class", "p-1 h-full w-full")
      .html((d: any) => {
        const loadingClass = d.data.isExpanding ? 'ring-4 ring-indigo-500/20' : '';
        const shadowClass = d.depth === 0 ? 'shadow-indigo-100' : 'shadow-slate-100';
        const textAlignment = d.depth > 1 ? 'text-left' : 'text-center';
        
        return `
        <div class="card-body group relative flex items-center justify-center w-[${CARD_WIDTH}px] h-[${CARD_HEIGHT}px] px-4 py-2 rounded-xl border-2 shadow-lg transition-all duration-300 hover:scale-105 ${getDepthColor(d.depth)} ${loadingClass} ${shadowClass}">
          <p class="text-[12px] font-bold leading-tight ${textAlignment} select-none truncate-2-lines w-full">${d.data.message}</p>
          
          <div class="absolute -right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <button class="expand-btn w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md hover:bg-indigo-700 active:scale-90">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            <button class="add-manual-btn w-7 h-7 bg-white border border-slate-200 text-slate-400 rounded-lg flex items-center justify-center shadow-md hover:text-indigo-600 active:scale-90">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          ${d.data.isExpanding ? `
            <div class="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
               <div class="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ` : ''}
        </div>
      `});

    nodeEnter.on("click", (e, d) => {
      const target = e.target as HTMLElement;
      if (target.closest('.expand-btn')) onExpand(d.data.id, d.data.message);
      else if (target.closest('.add-manual-btn')) onAddManual(d.data.id);
    });

    nodeEnter.on("dblclick", (e, d) => {
      e.stopPropagation();
      const newMsg = prompt("Rename node:", d.data.message);
      if (newMsg) onEdit(d.data.id, newMsg);
    });

    nodeEnter.on("contextmenu", (e, d) => {
      e.preventDefault();
      if (confirm(`Delete this branch?`)) onDelete(d.data.id);
    });

    nodes.merge(nodeEnter as any)
      .transition().duration(500)
      .attr("opacity", 1)
      .attr("transform", d => `translate(${d.x},${d.y})`);

    nodes.exit().transition().duration(300).attr("opacity", 0).remove();

    if (svg.attr("data-initialized") !== "true") {
      const width = containerRef.current?.clientWidth || 1200;
      svg.call(zoomBehavior.transform as any, d3.zoomIdentity.translate(width / 2, 80).scale(0.8));
      svg.attr("data-initialized", "true");
    }

  }, [data, onExpand, onDelete, onEdit, onAddManual]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-50/50">
      <div className="absolute top-6 right-6 z-20 flex flex-col gap-3">
        <button onClick={handleReset} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:text-indigo-600 transition-all font-bold text-xs flex items-center gap-2">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
           Recenter View
        </button>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default MindMapCanvas;


import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Card } from '../types';

interface MindMapCanvasProps {
  data: Card;
  onExpand: (id: string, message: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newMessage: string) => void;
  onAddManual: (id: string) => void;
}

const CARD_W = 160;
const CARD_H = 46;
const L1_H_GAP = 50; 
const VERTICAL_STEP = 32; 
const CHILD_V_GAP = 12; 

interface RenderNode extends Card {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  children: RenderNode[];
}

const MindMapCanvas: React.FC<MindMapCanvasProps> = ({ data, onExpand, onDelete, onEdit, onAddManual }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const renderNodesRef = useRef<RenderNode[]>([]);
  
  // 处理高清缩放
  const getDpr = () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  // 计算子树总高度
  const getSubTreeHeight = useCallback((node: RenderNode): number => {
    if (!node.children || node.children.length === 0) return CARD_H;
    let h = CARD_H + CHILD_V_GAP;
    node.children.forEach(c => {
      h += getSubTreeHeight(c) + CHILD_V_GAP;
    });
    return h;
  }, []);

  // 核心布局逻辑：L1横向，L2+右下阶梯
  const calculateLayout = useCallback((node: Card, depth: number, xOffset: number, yOffset: number): RenderNode => {
    const rNode: RenderNode = { 
      ...node, 
      depth, 
      x: xOffset, 
      y: yOffset, 
      width: CARD_W, 
      height: CARD_H,
      children: [] 
    };

    if (!node.children || node.children.length === 0) return rNode;

    if (depth === 0) {
      // Root -> Level 1 (横向)
      let currentX = xOffset;
      rNode.children = node.children.map((child) => {
        const childNode = calculateLayout(child, depth + 1, currentX, yOffset + 140);
        currentX += CARD_W + L1_H_GAP;
        return childNode;
      });
      // 根节点居中于其子节点
      const firstChild = rNode.children[0];
      const lastChild = rNode.children[rNode.children.length - 1];
      rNode.x = (firstChild.x + lastChild.x) / 2;
    } else {
      // Level 1+ -> Level 2+ (阶梯纵向)
      let currentY = yOffset + CARD_H + CHILD_V_GAP;
      rNode.children = node.children.map((child) => {
        const childNode = calculateLayout(child, depth + 1, xOffset + VERTICAL_STEP, currentY);
        currentY += getSubTreeHeight(childNode) + CHILD_V_GAP;
        return childNode;
      });
    }
    return rNode;
  }, [getSubTreeHeight]);

  const flatten = (node: RenderNode, list: RenderNode[]) => {
    list.push(node);
    if (node.children) node.children.forEach(c => flatten(c, list));
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = getDpr();
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.save();
    
    // 应用 Zoom 变换
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    const nodes = renderNodesRef.current;

    // 1. 连线绘制
    ctx.beginPath();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.2;
    nodes.forEach(node => {
      node.children.forEach(child => {
        if (node.depth === 0) {
          // L1 曲线
          ctx.moveTo(node.x + CARD_W / 2, node.y + CARD_H);
          ctx.bezierCurveTo(
            node.x + CARD_W / 2, node.y + 100,
            child.x + CARD_W / 2, child.y - 40,
            child.x + CARD_W / 2, child.y
          );
        } else {
          // L2+ 阶梯线
          const startX = node.x + 20; 
          const startY = node.y + CARD_H;
          const endX = child.x;
          const endY = child.y + CARD_H / 2;
          ctx.moveTo(startX, startY);
          ctx.lineTo(startX, endY);
          ctx.lineTo(endX, endY);
        }
      });
    });
    ctx.stroke();

    // 2. 卡片绘制
    nodes.forEach(node => {
      const { x, y, message, depth, isExpanding } = node;
      
      ctx.save();
      
      // 卡片阴影
      ctx.shadowColor = 'rgba(0,0,0,0.06)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // 卡片圆角矩形
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, 10);
      if (depth === 0) ctx.fillStyle = '#1e293b';
      else if (depth === 1) ctx.fillStyle = '#4f46e5';
      else ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = depth > 1 ? '#e2e8f0' : 'transparent';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 精确文字渲染
      ctx.fillStyle = (depth === 0 || depth === 1) ? '#ffffff' : '#334155';
      ctx.font = `${depth === 0 ? '700' : '500'} 13px "Inter", -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayMsg = message.length > 20 ? message.slice(0, 18) + '...' : message;
      ctx.fillText(displayMsg, x + CARD_W / 2, y + CARD_H / 2);

      // 操作按钮 (+)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x + CARD_W, y + 12, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('+', x + CARD_W, y + 13);

      // AI 按钮
      if (isExpanding) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(x + CARD_W, y + CARD_H - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '8px Arial';
        ctx.fillText('...', x + CARD_W, y + CARD_H - 12);
      } else {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(x + CARD_W, y + CARD_H - 12, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '9px Arial';
        ctx.fillText('AI', x + CARD_W, y + CARD_H - 11);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [transform]);

  useEffect(() => {
    const root = calculateLayout(data, 0, 100, 80);
    const list: RenderNode[] = [];
    flatten(root, list);
    renderNodesRef.current = list;
    render();
  }, [data, calculateLayout, render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const dpr = getDpr();
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr); 
        render();
      }
    };

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => setTransform(event.transform));

    d3.select(canvas).call(zoom);
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    return () => resizeObserver.disconnect();
  }, [render]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = (e.clientX - rect.left - transform.x) / transform.k;
    const mouseY = (e.clientY - rect.top - transform.y) / transform.k;

    for (let i = renderNodesRef.current.length - 1; i >= 0; i--) {
      const node = renderNodesRef.current[i];
      
      const plusBtnDist = Math.hypot(mouseX - (node.x + CARD_W), mouseY - (node.y + 12));
      if (plusBtnDist < 12) {
        onAddManual(node.id);
        return;
      }

      const aiBtnDist = Math.hypot(mouseX - (node.x + CARD_W), mouseY - (node.y + CARD_H - 12));
      if (aiBtnDist < 12) {
        onExpand(node.id, node.message);
        return;
      }

      if (mouseX >= node.x && mouseX <= node.x + CARD_W && mouseY >= node.y && mouseY <= node.y + CARD_H) {
        if (e.altKey) {
          onDelete(node.id);
        } else {
          const newMsg = prompt("修改文本:", node.message);
          if (newMsg) onEdit(node.id, newMsg);
        }
        return;
      }
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#f8fafc] relative overflow-hidden">
      <canvas 
        ref={canvasRef} 
        onClick={handleClick} 
        className="block cursor-grab active:cursor-grabbing touch-none" 
      />
      <div className="absolute top-6 left-6 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">布局说明 (Mixed Layout)</p>
          <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-600"></div> L1: 横向</span>
            <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> L2+: 阶梯</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 backdrop-blur rounded-full text-[10px] text-slate-400 font-mono">
        <span>Canvas Resolution: {(getDpr()).toFixed(1)}x</span>
      </div>
    </div>
  );
};

export default MindMapCanvas;

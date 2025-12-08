/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react"
import styles from "./css/CanvasStage.module.css"
import type { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types"
import { drawGrid, drawNodes, drawReferenceFrameOverlay } from "../lib/ccanvas-draw-bridge"
import AuthRedirect from "./AuthRedirect"
// Type Definitions
type ImageLike = HTMLImageElement | string
type ImageMap = Record<string, ImageLike>
// Lightweight Interaction type (mirrors one in page.tsx)
type Interaction = {
  id: string
  sourceId: string
  targetId: string
  type: "navigation" | "animation"
  trigger: "onClick" | "onTap"
  animation?: {
    name: "none" | "fade" | "slide" | "zoom"
    durationMs?: number
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out"
    direction?: "left" | "right" | "up" | "down"
  } | null
}
  // Constants
const ALIGNMENT_THRESHOLD = 12 // Increased snap distance for easier alignment
const CLICK_DRAG_SLOP = 3
const STORAGE_VERSION = 1
const MAX_STORAGE_AGE = 24 * 60 * 60 * 1000 // 24 hours
const PAN_BUTTON = 1 // Middle mouse button
// Helper Functions
const rectsIntersect = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
// OPTIMIZATION: More performant way to update node positions than structuredClone
const updateNodePositions = (nodes: NodeInput[], moved: Map<string, { dx: number, dy: number }>): NodeInput[] => {
  return nodes.map(node => {
    let hasChanged = false
    const offsets = moved.get(node.id)
    const newChildren = node.children ? updateNodePositions(node.children, moved) : undefined;
    if (newChildren !== node.children) { // Pointer comparison
      hasChanged = true
    }
    if (offsets) {
      hasChanged = true;
      const newX = ((node as any).x ?? 0) + offsets.dx;
      const newY = ((node as any).y ?? 0) + offsets.dy;
      
      const newNode = { 
        ...node, 
        x: newX,
        y: newY,
        children: newChildren 
      } as NodeInput;
      if (newNode.absoluteBoundingBox) {
        newNode.absoluteBoundingBox = {
          ...newNode.absoluteBoundingBox,
          x: (node.absoluteBoundingBox?.x ?? newX) + offsets.dx,
          y: (node.absoluteBoundingBox?.y ?? newY) + offsets.dy,
        };
      }
      
      return newNode;
    }
    if (hasChanged) {
      return { ...node, children: newChildren };
    }
    return node
  })
}
export default function CanvasStage(props: {
  rawRoots: NodeInput[] | null
  setRawRoots: (v: NodeInput[] | null) => void
  drawableNodes: DrawableNode[]
  selectedIds: Set<string>
  setSelectedIds: (v: Set<string>) => void
  scale: number
  setScale: (v: number) => void
  offset: { x: number; y: number }
  setOffset: (v: { x: number; y: number }) => void
  selectedFrame: ReferenceFrame | null
  images?: ImageMap
  interactions?: Interaction[]
  selectedInteractionId?: string | null
  onSelectInteraction?: (id: string) => void
  tool?: "select" | "grid" | "rect" | "pen" | "text" | "ellipse"
}) {
  const {
    rawRoots,
    setRawRoots,
    drawableNodes,
    selectedIds,
    setSelectedIds,
    scale,
    setScale,
    offset,
    setOffset,
    selectedFrame,
    images = {},
    interactions = [],
    selectedInteractionId = null,
    onSelectInteraction,
    tool = "select",
  } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 })
  // State management refs
  const stateRef = useRef({
    scale,
    offset,
    selectedIds,
    isPanning: false,
    isMarquee: false,
    hoveredId: null as string | null,
    alignmentGuides: { 
      verticalLines: [] as Array<{ x: number; parentX: number; parentY: number; parentW: number; parentH: number }>, 
      horizontalLines: [] as Array<{ y: number; parentX: number; parentY: number; parentW: number; parentH: number }> 
    },
    drawableNodes,
    rawRoots,
    interactions,
  })
  // Control flags
  const framePendingRef = useRef(false)
  const hasLoadedFromStorage = useRef(false)
  const hasUserChanges = useRef(false)
  const isInitialized = useRef(false)
  const hasReceivedData = useRef(false)
  // Interaction geometries for hit-testing
  const interactionGeometriesRef = useRef<Array<{
    id: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    control: { x: number; y: number },
    label: { x: number; y: number; w: number; h: number } | null
  }>>([])
  // Sync selection, drawable nodes, rawRoots, offset, and scale on prop changes (before paint)
  useLayoutEffect(() => {
    stateRef.current.selectedIds = selectedIds
    stateRef.current.drawableNodes = drawableNodes
    stateRef.current.rawRoots = rawRoots
    stateRef.current.offset = offset
    stateRef.current.scale = scale
    stateRef.current.interactions = interactions
  }, [selectedIds, drawableNodes, rawRoots, offset, scale, interactions])
  const keysRef = useRef({ ctrl: false, meta: false, shift: false, space: false })
  type Mode = "idle" | "marquee" | "drag" | "click" | "pan"
  const modeRef = useRef<Mode>("idle")
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const downScreenRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartScreen = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ wx: number; wy: number } | null>(null)
  const dragStartWorld = useRef<{ wx: number; wy: number } | null>(null)
  const originalPositions = useRef<Map<string, { x: number, y: number }>>(new Map())
  const panStartOffset = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetsRef = useRef<Map<string, { dx: number, dy: number }>>(new Map())
  // Creation state for tools
  const creatingRef = useRef<null | {
    tool: "rect" | "ellipse" | "text",
    start: { wx: number; wy: number },
    current: { wx: number; wy: number },
    previewId: string,
  }>(null)
  // Debug logging
  useEffect(() => {
    console.log('=== Canvas Debug Info ===');
    console.log('rawRoots:', rawRoots ? 'loaded' : 'null');
    console.log('drawableNodes length:', drawableNodes?.length);
    console.log('scale:', scale);
    console.log('offset:', offset);
    console.log('========================');
  }, [rawRoots, drawableNodes, scale, offset]);
  // Track when we receive actual data from parent
  useEffect(() => {
    if (rawRoots && rawRoots.length > 0 && !hasReceivedData.current) {
      hasReceivedData.current = true;
      console.log('Data received from parent');
    }
  }, [rawRoots]);
  // Image Loading
  const mergedImages = useMemo(() => {
    const out: ImageMap = { ...(images || {}) }
    if (rawRoots) {
      const walk = (node: any) => {
        if (node?.fill?.type === "IMAGE" && typeof node.fill.imageRef === "string") {
          let imageUrl = node.fill.imageRef;
          if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
            imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          }
          out[node.id] = imageUrl;
          if (node.name) out[node.name] = imageUrl;
        }
        node.children?.forEach(walk);
      }
      rawRoots.forEach(walk)
    }
    return out
  }, [images, rawRoots])
  
  const loadedImages = useImageMap(mergedImages)
  
  const { nodeMap, childToParentMap } = useMemo(() => {
    const nodeMap = new Map<string, DrawableNode & { raw: NodeInput }>()
    const childToParentMap = new Map<string, string>()
    if (!rawRoots) return { nodeMap, childToParentMap }
    const walk = (node: NodeInput, parentId: string | null = null) => {
      const drawable = drawableNodes.find(d => d.id === node.id)
      if (drawable) {
        nodeMap.set(node.id, { ...drawable, raw: node })
      }
      if (parentId) {
        childToParentMap.set(node.id, parentId)
      }
      node.children?.forEach(child => walk(child, node.id))
    }
    rawRoots.forEach(root => walk(root))
    return { nodeMap, childToParentMap }
  }, [rawRoots, drawableNodes])
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { wx: 0, wy: 0, sx: 0, sy: 0 }
    
    const { scale, offset } = stateRef.current
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const wx = (sx - offset.x) / scale
    const wy = (sy - offset.y) / scale
    return { wx, wy, sx, sy }
  }, [])
  // State persistence functions
  const saveStateToStorage = useCallback(() => {
    if (!hasUserChanges.current || !isInitialized.current) return
    
    try {
      const state = {
        version: STORAGE_VERSION,
        scale: stateRef.current.scale,
        offset: stateRef.current.offset,
        selectedIds: Array.from(stateRef.current.selectedIds),
        rawRoots: stateRef.current.rawRoots,
        lastModified: Date.now(),
      };
      localStorage.setItem('canvas-stage-state', JSON.stringify(state));
      localStorage.setItem('canvas-session-timestamp', Date.now().toString());
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, []);
  const loadStateFromStorage = useCallback(() => {
    if (hasLoadedFromStorage.current) return;
    
    try {
      const stored = localStorage.getItem('canvas-stage-state');
      if (!stored) return;
      
      const state = JSON.parse(stored);
      
      if (state.version !== STORAGE_VERSION || (Date.now() - state.lastModified) > MAX_STORAGE_AGE) {
        localStorage.removeItem('canvas-stage-state');
        return;
      }
      
      if (!rawRoots || rawRoots.length === 0) {
        if (state.rawRoots?.length > 0) {
          setRawRoots(state.rawRoots);
          window.dispatchEvent(new CustomEvent('canvas-loaded-from-storage', { detail: { hasStoredData: true } }));
        }
      }
      
      if (typeof state.scale === 'number') setScale(state.scale);
      if (typeof state.offset === 'object') setOffset(state.offset);
      if (Array.isArray(state.selectedIds)) setSelectedIds(new Set(state.selectedIds));
      
      hasLoadedFromStorage.current = true;
      console.log('Canvas view state loaded from storage');
    } catch (e) {
      console.warn('Failed to load state:', e);
      localStorage.removeItem('canvas-stage-state');
    }
  }, [setScale, setOffset, setSelectedIds, setRawRoots, rawRoots]);
  const requestRedraw = useCallback(() => {
    if (framePendingRef.current) return
    framePendingRef.current = true
    
    requestAnimationFrame(() => {
      framePendingRef.current = false
      
      const canvas = canvasRef.current
      const overlay = overlayRef.current
      if (!canvas || !overlay) return
      
      const ctx = canvas.getContext("2d")
      const octx = overlay.getContext("2d")
      if (!ctx || !octx) return
      
      const { 
        scale, offset, selectedIds, isMarquee, hoveredId, 
        alignmentGuides, drawableNodes: currentDrawableNodes 
      } = stateRef.current
        
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      octx.clearRect(0, 0, overlay.width, overlay.height)
      
      ctx.fillStyle = "rgba(236, 231, 231, 1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // ✅ PERFORMANCE OPTIMIZATION: View Culling
      // Calculate the visible area in world coordinates.
      const visibleWorldRect = {
        x: -offset.x / scale,
        y: -offset.y / scale,
        w: viewportSize.width / scale,
        h: viewportSize.height / scale,
      };
      // Filter nodes to only include those intersecting the viewport.
      const visibleNodes = currentDrawableNodes.filter(node => 
        rectsIntersect(visibleWorldRect, { x: node.x, y: node.y, w: node.width, h: node.height })
      );
      // Draw grid only if canvas is empty
      if (visibleNodes.length === 0) {
        drawGrid(ctx, viewportSize.width, viewportSize.height, offset, scale, 100, 20)
      }
      
      // Draw only the visible nodes
      drawNodes(ctx, visibleNodes, offset, scale, selectedIds, dragOffsetsRef.current, stateRef.current.rawRoots, hoveredId, loadedImages)
      // Marquee selection
      if (isMarquee && marqueeStart.current && lastPointer.current) {
        const s1x = offset.x + marqueeStart.current.wx * scale
        const s1y = offset.y + marqueeStart.current.wy * scale
        const rect = overlay.getBoundingClientRect()
        const s2x = lastPointer.current.x - rect.left
        const s2y = lastPointer.current.y - rect.top
        const mx = Math.min(s1x, s2x), my = Math.min(s1y, s2y)
        const mw = Math.abs(s2x - s1x), mh = Math.abs(s2y - s1y)
          
        octx.fillStyle = "rgba(16, 185, 129, 0.12)"
        octx.strokeStyle = "#10b981"
        octx.lineWidth = 1.5
        octx.fillRect(mx, my, mw, mh)
        octx.strokeRect(mx, my, mw, mh)
      }
  // Overlays
      if (selectedFrame) drawReferenceFrameOverlay(octx, selectedFrame, offset, scale)
      if (alignmentGuides.verticalLines.length > 0 || alignmentGuides.horizontalLines.length > 0) {
        // Draw alignment guides - purple color, limited span
        octx.strokeStyle = "rgba(147, 51, 234, 0.9)" // Purple color
        octx.lineWidth = 1.5
        octx.setLineDash([4, 2]) // Smaller dash pattern for clarity
        
        // Draw vertical alignment guides (only span to parent bounds)
        alignmentGuides.verticalLines.forEach(guide => {
          const sx = offset.x + guide.x * scale
          octx.beginPath()
          octx.moveTo(sx, offset.y + guide.parentY * scale)
          octx.lineTo(sx, offset.y + (guide.parentY + guide.parentH) * scale)
          octx.stroke()
        })
        
        // Draw horizontal alignment guides (only span to parent bounds)
        alignmentGuides.horizontalLines.forEach(guide => {
          const sy = offset.y + guide.y * scale
          octx.beginPath()
          octx.moveTo(offset.x + guide.parentX * scale, sy)
          octx.lineTo(offset.x + (guide.parentX + guide.parentW) * scale, sy)
          octx.stroke()
        })
        
        octx.setLineDash([])
      }

      // Draw interaction arrows
      const interactions = stateRef.current.interactions || [];
      if (interactions.length > 0) {
        // Build quick lookup for drawable by id
        const byId = new Map<string, DrawableNode>();
        currentDrawableNodes.forEach((n) => byId.set(n.id, n));
        // Reset geometries
        interactionGeometriesRef.current = [];
        const rectIntersects = (a: {x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) => {
          return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
        };

        const drawCurvedArrow = (
          ctx: CanvasRenderingContext2D,
          from: { x: number; y: number },
          to: { x: number; y: number },
          color: string,
          control: { x: number; y: number }
        ) => {
          const headLen = Math.max(8, 12 * Math.min(2, scale));
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          // Arrow head: tangent at end of quadratic curve is 2*(E - C)
          const tx = to.x - control.x;
          const ty = to.y - control.y;
          const angle = Math.atan2(ty, tx);
          ctx.beginPath();
          ctx.moveTo(to.x, to.y);
          ctx.lineTo(
            to.x - headLen * Math.cos(angle - Math.PI / 6),
            to.y - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            to.x - headLen * Math.cos(angle + Math.PI / 6),
            to.y - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };

        const drawSmartLabel = (
          ctx: CanvasRenderingContext2D,
          base: { x: number; y: number },
          text: string,
          srcRect: { x: number; y: number; w: number; h: number },
          tgtRect: { x: number; y: number; w: number; h: number },
          tangent: { x: number; y: number }
        ) => {
          const fontPx = Math.max(10, 12 * Math.min(2, scale));
          ctx.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system`;
          const pad = 4;
          const metrics = ctx.measureText(text);
          const w = metrics.width + pad * 2;
          const h = fontPx + pad * 2;

          // Normal is perpendicular to tangent
          const len = Math.hypot(tangent.x, tangent.y) || 1;
          const nx = -tangent.y / len;
          const ny = tangent.x / len;

          const offsets = [0, 14, -14, 28, -28, 42, -42];
          let lx = base.x - w / 2;
          let ly = base.y - h / 2;
          for (const d of offsets) {
            const rx = base.x + nx * d;
            const ry = base.y + ny * d;
            lx = rx - w / 2; ly = ry - h / 2;
            const labelRect = { x: lx, y: ly, w, h };
            if (!rectIntersects(labelRect, srcRect) && !rectIntersects(labelRect, tgtRect)) break;
          }

          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(lx, ly, w, h);
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.strokeRect(lx, ly, w, h);
          ctx.fillStyle = "#fff";
          ctx.fillText(text, lx + pad, ly + h - pad - 2);
        };

        for (const it of interactions) {
          const src = byId.get(it.sourceId);
          const tgt = byId.get(it.targetId);
          if (!src || !tgt) continue;
          // Rectangles in screen space
          const srcRect = { x: offset.x + src.x * scale, y: offset.y + src.y * scale, w: src.width * scale, h: src.height * scale };
          const tgtRect = { x: offset.x + tgt.x * scale, y: offset.y + tgt.y * scale, w: tgt.width * scale, h: tgt.height * scale };
          // Centers in screen space
          const sCenter = { x: srcRect.x + srcRect.w / 2, y: srcRect.y + srcRect.h / 2 };
          const tCenter = { x: tgtRect.x + tgtRect.w / 2, y: tgtRect.y + tgtRect.h / 2 };

          // Helper: intersection of ray from point in direction (dx,dy) with rect edge
          const edgeIntersection = (
            rect: { x: number; y: number; w: number; h: number },
            from: { x: number; y: number },
            dir: { x: number; y: number }
          ) => {
            const candidates: Array<{ x: number; y: number; t: number }> = [];
            const { x: x1, y: y1, w, h } = rect;
            const x2 = x1 + w, y2 = y1 + h;
            const { x: dx, y: dy } = dir;
            // Vertical sides
            if (dx !== 0) {
              const tL = (x1 - from.x) / dx;
              const yL = from.y + tL * dy;
              if (tL > 0 && yL >= y1 && yL <= y2) candidates.push({ x: x1, y: yL, t: tL });
              const tR = (x2 - from.x) / dx;
              const yR = from.y + tR * dy;
              if (tR > 0 && yR >= y1 && yR <= y2) candidates.push({ x: x2, y: yR, t: tR });
            }
            // Horizontal sides
            if (dy !== 0) {
              const tT = (y1 - from.y) / dy;
              const xT = from.x + tT * dx;
              if (tT > 0 && xT >= x1 && xT <= x2) candidates.push({ x: xT, y: y1, t: tT });
              const tB = (y2 - from.y) / dy;
              const xB = from.x + tB * dx;
              if (tB > 0 && xB >= x1 && xB <= x2) candidates.push({ x: xB, y: y2, t: tB });
            }
            if (candidates.length === 0) return { x: from.x, y: from.y };
            candidates.sort((a, b) => a.t - b.t);
            return { x: candidates[0].x, y: candidates[0].y };
          };

          // Direction from source to target
          const dx = tCenter.x - sCenter.x;
          const dy = tCenter.y - sCenter.y;
          const sEdge = edgeIntersection(srcRect, sCenter, { x: dx, y: dy });
          const tEdge = edgeIntersection(tgtRect, tCenter, { x: -dx, y: -dy });

          // Skip drawing arrows whose endpoints are off-screen (with small margin)
          const margin = 8;
          const inView = (x: number, y: number) => x >= -margin && y >= -margin && x <= viewportSize.width + margin && y <= viewportSize.height + margin;
          if (!inView(sEdge.x, sEdge.y) || !inView(tEdge.x, tEdge.y)) continue;

          const isSelected = !!selectedInteractionId && selectedInteractionId === it.id;
          const baseColor = it.type === "navigation" ? "#10b981" : "#3b82f6"; // green for nav, blue otherwise
          const color = isSelected ? "#f59e0b" : baseColor; // amber highlight when selected
          // Curvature control point: offset midpoint along perpendicular
          const dxs = tEdge.x - sEdge.x;
          const dys = tEdge.y - sEdge.y;
          const dist = Math.hypot(dxs, dys) || 1;
          const ux = dxs / dist, uy = dys / dist;
          // Perpendicular unit
          const px = -uy, py = ux;
          // Stable sign based on ids
          const key = `${it.sourceId}->${it.targetId}`;
          let hash = 0; for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
          const sign = (hash & 1) ? 1 : -1;
          const curveAmt = Math.max(16, Math.min(80, dist * 0.12));
          const mx = (sEdge.x + tEdge.x) / 2;
          const my = (sEdge.y + tEdge.y) / 2;
          const cx = mx + px * curveAmt * sign;
          const cy = my + py * curveAmt * sign;

          if (isSelected) {
            octx.save();
            octx.lineWidth = 4;
            drawCurvedArrow(octx, { x: sEdge.x, y: sEdge.y }, { x: tEdge.x, y: tEdge.y }, color, { x: cx, y: cy });
            octx.restore();
          }
          drawCurvedArrow(octx, { x: sEdge.x, y: sEdge.y }, { x: tEdge.x, y: tEdge.y }, color, { x: cx, y: cy });

          // Label at bezier midpoint: P(0.5) = 0.25*S + 0.5*C + 0.25*E
          const midx = 0.25 * sEdge.x + 0.5 * cx + 0.25 * tEdge.x;
          const midy = 0.25 * sEdge.y + 0.5 * cy + 0.25 * tEdge.y;
          const label = it.type === "navigation" ? "navigation" : it.type;
          // Tangent ~ E - S at t=0.5
          drawSmartLabel(octx, { x: midx, y: midy }, label, srcRect, tgtRect, { x: dxs, y: dys });
          // Measure label rect approximately for hit testing (mirror of drawSmartLabel placement)
          const fontPx = Math.max(10, 12 * Math.min(2, scale));
          octx.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system`;
          const pad = 4;
          const w = octx.measureText(label).width + pad * 2;
          const h = fontPx + pad * 2;
          const len = Math.hypot(dys, dxs) || 1;
          const nx = -dys / len;
          const ny = dxs / len;
          const offsets = [0, 14, -14, 28, -28, 42, -42];
          let lx = midx - w / 2;
          let ly = midy - h / 2;
          for (const d of offsets) {
            const rx = midx + nx * d;
            const ry = midy + ny * d;
            lx = rx - w / 2; ly = ry - h / 2;
            const labelRect = { x: lx, y: ly, w, h };
            if (!rectIntersects(labelRect, srcRect) && !rectIntersects(labelRect, tgtRect)) break;
          }
          interactionGeometriesRef.current.push({
            id: it.id,
            from: { x: sEdge.x, y: sEdge.y },
            to: { x: tEdge.x, y: tEdge.y },
            control: { x: cx, y: cy },
            label: { x: lx, y: ly, w, h },
          });
        }
      }
    })
  }, [viewportSize, selectedFrame, selectedInteractionId])
  // Initialization
  useEffect(() => {
    if (!isInitialized.current && canvasRef.current) {
      if (!hasReceivedData.current) {
        loadStateFromStorage();
      }
      isInitialized.current = true;
      setTimeout(requestRedraw, 100);
    }
  }, [loadStateFromStorage, requestRedraw]);
  // Debounced save
  useEffect(() => {
    if (!isInitialized.current) return;
    const timeoutId = setTimeout(() => {
      if (hasUserChanges.current) saveStateToStorage();
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [scale, offset, selectedIds, rawRoots, saveStateToStorage]);
  // Auth event listeners with auth state management
  const isAuthenticatedRef = useRef(true); // Assume authenticated initially
  useEffect(() => {
    const handleAuthWarning = (e: CustomEvent) => {
      console.warn('Auth warning:', e.detail.message);
      isAuthenticatedRef.current = false;
    };
    const handleAuthConfirmed = () => {
      isAuthenticatedRef.current = true;
      hasUserChanges.current = true;
    };
    window.addEventListener('auth-warning', handleAuthWarning as EventListener);
    window.addEventListener('auth-confirmed', handleAuthConfirmed as EventListener);
    return () => {
      window.removeEventListener('auth-warning', handleAuthWarning as EventListener);
      window.removeEventListener('auth-confirmed', handleAuthConfirmed as EventListener);
    };
  }, []);
  // Canvas setup and resize handling
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setViewportSize({ width: w, height: h });
      const dpr = window.devicePixelRatio || 1;
      [canvasRef.current, overlayRef.current].forEach(c => {
        if (!c) return;
        c.style.width = `${w}px`; c.style.height = `${h}px`;
        c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
      });
      requestRedraw();
    };
    window.addEventListener("resize", handleResize, { passive: true });
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [requestRedraw]);
  // Keyboard handling
  useEffect(() => {
    const handleSpaceKey = (isDown: boolean, e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      keysRef.current.space = isDown;
      
      if (overlayRef.current) {
        overlayRef.current.style.cursor = isDown ? "grab" : "default";
      }
      
      if (!isDown && modeRef.current === "pan") {
        modeRef.current = "idle";
        stateRef.current.isPanning = false;
        lastPointer.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Deselect interaction on Escape
        if (onSelectInteraction) onSelectInteraction("");
      }
      // Don't hijack spacebar when typing in inputs or editable areas
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        (target as HTMLElement).isContentEditable === true
      );
      if (isTyping) return;

      if (e.key === "Control") keysRef.current.ctrl = true;
      if (e.key === "Meta") keysRef.current.meta = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (e.key === " " || e.code === "Space") {
        handleSpaceKey(true, e);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Mirror the same typing guard on keyup
      const target = e.target as HTMLElement | null;
      const isTyping = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        (target as HTMLElement).isContentEditable === true
      );
      if (isTyping) return;

      if (e.key === "Control") keysRef.current.ctrl = false;
      if (e.key === "Meta") keysRef.current.meta = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (e.key === " " || e.code === "Space") {
        handleSpaceKey(false, e);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  
  // ✅ PERFORMANCE OPTIMIZATION: High-performance wheel handler
  // This updates the canvas view directly without triggering React re-renders on every scroll event.
  // The final state is synced back to React after the gesture ends.
  const wheelEndTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const target = overlayRef.current;
    if (!target) return;
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Handle zooming when ctrl/meta is pressed
      if (e.ctrlKey || e.metaKey) {

      const rect = target.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Directly mutate the ref for immediate visual feedback
      const { scale: currentScale, offset: currentOffset } = stateRef.current;

      const DOM_DELTA_PIXEL = 0;
      const DOM_DELTA_LINE = 1;
      const DOM_DELTA_PAGE = 2;

      const deltaFactor = ((): number => {
        if (e.deltaMode === DOM_DELTA_PIXEL) return 1;
        if (e.deltaMode === DOM_DELTA_LINE) return 16; // typical line height
        return window.innerHeight; // page
      })();

      const dX = e.deltaX * deltaFactor;
      const dY = e.deltaY * deltaFactor;

      // Zooming only when ctrl/meta is pressed
      const zoomFactor = Math.exp(-dY * 0.0012);
      const newScale = Math.max(0.05, Math.min(20, currentScale * zoomFactor));
      const worldX = (mouseX - currentOffset.x) / currentScale;
      const worldY = (mouseY - currentOffset.y) / currentScale;
      const newOffset = {
        x: mouseX - worldX * newScale,
        y: mouseY - worldY * newScale
      };
      stateRef.current.scale = newScale;
      stateRef.current.offset = newOffset;
      // Immediately sync React state to avoid stale props on click
      setScale(newScale);
      setOffset(newOffset);
      requestRedraw();
      hasUserChanges.current = true;
      } else {
        // Handle trackpad/wheel panning when ctrl/meta is not pressed
        const newOffset = {
          x: stateRef.current.offset.x - e.deltaX,
          y: stateRef.current.offset.y - e.deltaY
        };
        stateRef.current.offset = newOffset;
        setOffset(newOffset);
        requestRedraw();
        hasUserChanges.current = true;
      }
    };
    
    target.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      target.removeEventListener("wheel", onWheel);
      if (wheelEndTimer.current) clearTimeout(wheelEndTimer.current);
    };
  }, [setScale, setOffset, requestRedraw]);
  // Pointer interactions with RAF throttling
  useEffect(() => {
    const target = overlayRef.current;
    if (!target) return;
    let motionFrameId: number | null = null;
    // Reset: no need to track continuous deltas for pan; we anchor to start
    
    const pointInRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) => {
      const tolerance = 3 / stateRef.current.scale;
      return px >= r.x - tolerance && px <= r.x + r.w + tolerance && py >= r.y - tolerance && py <= r.y + r.h + tolerance;
    };
    const startPanning = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      modeRef.current = "pan";
      stateRef.current.isPanning = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      
      if (overlayRef.current) {
        overlayRef.current.style.cursor = "grabbing";
      }
    };

    const pointToSegDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
      const vx = bx - ax, vy = by - ay;
      const wx = px - ax, wy = py - ay;
      const c1 = vx * wx + vy * wy;
      if (c1 <= 0) return Math.hypot(px - ax, py - ay);
      const c2 = vx * vx + vy * vy;
      if (c2 <= c1) return Math.hypot(px - bx, py - by);
      const t = c1 / c2;
      const projx = ax + t * vx, projy = ay + t * vy;
      return Math.hypot(px - projx, py - projy);
    };
    const hitTestInteraction = (clientX: number, clientY: number): string | null => {
      const rect = target.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const geom = interactionGeometriesRef.current;
      if (!geom || geom.length === 0) return null;
      // Check labels first
      for (let i = geom.length - 1; i >= 0; i--) {
        const g = geom[i];
        if (g.label) {
          const r = g.label;
          if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return g.id;
        }
      }
      // Then check curve by segment sampling
      const tolerance = 8;
      for (let i = geom.length - 1; i >= 0; i--) {
        const g = geom[i];
        const { from, to, control } = g;
        let last = { x: from.x, y: from.y };
        const steps = 24;
        for (let t = 1; t <= steps; t++) {
          const u = t / steps;
          const oneMinus = 1 - u;
          const x = oneMinus * oneMinus * from.x + 2 * oneMinus * u * control.x + u * u * to.x;
          const y = oneMinus * oneMinus * from.y + 2 * oneMinus * u * control.y + u * u * to.y;
          const d = pointToSegDist(sx, sy, last.x, last.y, x, y);
          if (d <= tolerance) return g.id;
          last = { x, y };
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      console.log('Pointer down:', { button: e.button, space: keysRef.current.space });
      
      // Always capture the pointer
      target.setPointerCapture(e.pointerId);
      // Creation tools start: rect/ellipse/text
      if (!keysRef.current.space && (tool === 'rect' || tool === 'ellipse' || tool === 'text')) {
        const { wx, wy } = toWorld(e.clientX, e.clientY);
        const id = `${tool}_${Date.now().toString(36)}`;
        creatingRef.current = {
          tool: tool as any,
          start: { wx, wy },
          current: { wx, wy },
          previewId: id,
        };
        modeRef.current = 'drag';
        hasUserChanges.current = true;
        // Add a temporary node so we can see preview via drawNodes
        if (rawRoots) {
          const w = 1, h = 1;
          const newNode: any = tool === 'text' ? {
            id,
            type: 'TEXT',
            name: 'Text',
            x: wx,
            y: wy,
            width: 200,
            height: 40,
            text: { characters: 'Text', fontSize: 20, color: '#111' },
            children: [],
          } : {
            id,
            type: tool === 'ellipse' ? 'ELLIPSE' : 'FRAME',
            name: tool === 'ellipse' ? 'Ellipse' : 'Rectangle',
            x: wx,
            y: wy,
            width: w,
            height: h,
            w, h,
            fill: { type: 'SOLID', color: '#ffffff' },
            stroke: { color: '#111827', weight: 1 },
            children: [],
          };
          // Insert under selectedFrame if exists
          const parentId = selectedFrame?.id || null;
          if (parentId) {
            const nextRoots = updateNodePositionsForInsert(rawRoots, parentId, newNode);
            setRawRoots(nextRoots);
          } else {
            const nextRoots = ([...(rawRoots || []), newNode] as NodeInput[]);
            setRawRoots(nextRoots);
          }
        }
        requestRedraw();
        return;
      }
      // Try selecting an interaction first unless we are panning
      if (!(e.button === PAN_BUTTON || keysRef.current.space)) {
        const hit = hitTestInteraction(e.clientX, e.clientY);
        if (hit) {
          if (onSelectInteraction) onSelectInteraction(hit);
          if (overlayRef.current) overlayRef.current.style.cursor = 'pointer';
          requestRedraw();
          return;
        }
        // If clicked and no interaction hit, clear interaction selection
        if (onSelectInteraction) onSelectInteraction("");
      }
      
      // Start panning if middle mouse button or space is pressed
      if (e.button === PAN_BUTTON || keysRef.current.space) {
        startPanning(e);
        return;
      }

      const { wx, wy } = toWorld(e.clientX, e.clientY);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      downScreenRef.current = { x: e.clientX, y: e.clientY };

      let hitId: string | null = null;
      // Iterate backwards to hit top-most items first
      for (let i = drawableNodes.length - 1; i >= 0; i--) {
        const n = drawableNodes[i];
        if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
          hitId = n.id;
          break;
        }
      }
      if (hitId) {
        modeRef.current = "click";
        // Store start in screen coordinates so drag math can convert using the
        // current scale at drag time. This is robust if zoom changes between
        // the zoom gesture and the pointer drag/click.
        dragStartScreen.current = { x: e.clientX, y: e.clientY };
        dragStartWorld.current = { wx, wy };
        
        const isCtrl = e.ctrlKey || e.metaKey;
        const currentSelection = stateRef.current.selectedIds;
        const nextSelectedIds = currentSelection.has(hitId) && !isCtrl
            ? currentSelection
            : new Set(isCtrl ? (currentSelection.has(hitId) ? [...currentSelection].filter(id => id !== hitId) : [...currentSelection, hitId]) : [hitId]);
        setSelectedIds(nextSelectedIds);
        
        originalPositions.current.clear();
        nextSelectedIds.forEach(id => {
            const node = nodeMap.get(id);
            if (node) originalPositions.current.set(id, { x: node.x, y: node.y });
        });
        dragOffsetsRef.current.clear();
      } else {
        if (selectedIds.size > 0) setSelectedIds(new Set());
        modeRef.current = "marquee";
        marqueeStart.current = { wx, wy };
        stateRef.current.isMarquee = true;
      }
      requestRedraw();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
      motionFrameId = requestAnimationFrame(() => {
        // Creation preview update
        if (creatingRef.current) {
          const c = creatingRef.current;
          const { wx, wy } = toWorld(e.clientX, e.clientY);
          c.current = { wx, wy };
          // Update the temp node size/position
          const sx = Math.min(c.start.wx, c.current.wx);
          const sy = Math.min(c.start.wy, c.current.wy);
          let w = Math.abs(c.current.wx - c.start.wx);
          let h = Math.abs(c.current.wy - c.start.wy);
          if (e.shiftKey && (c.tool === 'rect' || c.tool === 'ellipse')) {
            const s = Math.max(w, h); w = s; h = s;
          }
          if (rawRoots) {
            const nextRoots = updateTempNode(rawRoots, c.previewId, sx, sy, Math.max(1, w), Math.max(1, h), c.tool);
            setRawRoots(nextRoots);
          }
          requestRedraw();
          return;
        }
        // Hover for interactions when idle
        if (modeRef.current === 'idle' && !keysRef.current.space) {
          const hit = hitTestInteraction(e.clientX, e.clientY);
          if (overlayRef.current) overlayRef.current.style.cursor = hit ? 'pointer' : (keysRef.current.space ? 'grab' : 'default');
        }
        if (!lastPointer.current) {
          // No drag/pan state to update
          return;
        }
        if (modeRef.current === "click") {
          const dxs = e.clientX - downScreenRef.current!.x;
          const dys = e.clientY - downScreenRef.current!.y;
          if (Math.hypot(dxs, dys) >= CLICK_DRAG_SLOP) {
            modeRef.current = "drag";
            hasUserChanges.current = true;
          }
        }
    // Do not update lastPointer here; it will break pan delta
        
        
        if (modeRef.current === "pan" && stateRef.current.isPanning) {
          if (!lastPointer.current) return;

          const dx = e.clientX - lastPointer.current.x;
          const dy = e.clientY - lastPointer.current.y;
          
          console.log('Panning delta:', { dx, dy });
          
          // Update the offset
          const newOffset = {
            x: stateRef.current.offset.x + dx,
            y: stateRef.current.offset.y + dy
          };
          
          // Update both the state ref and React state
          stateRef.current.offset = newOffset;
          setOffset(newOffset);
          
          // Update the last pointer position AFTER applying the delta
          lastPointer.current = { x: e.clientX, y: e.clientY };
          
          requestRedraw();
          hasUserChanges.current = true;
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (modeRef.current === "marquee") {
          requestRedraw();
          return;
        }
        
        if (modeRef.current === "drag" && dragStartScreen.current) {
          // Convert screen delta to world delta using current scale. This keeps
          // drag movement consistent even if scale changes while dragging.
          const sxDelta = e.clientX - dragStartScreen.current.x;
          const syDelta = e.clientY - dragStartScreen.current.y;
          const currentScale = stateRef.current.scale || 1;
          const dx = sxDelta / currentScale;
          const dy = syDelta / currentScale;
          
          const guides = { 
            verticalLines: [] as Array<{ x: number; parentX: number; parentY: number; parentW: number; parentH: number }>, 
            horizontalLines: [] as Array<{ y: number; parentX: number; parentY: number; parentW: number; parentH: number }> 
          };
          let finalDx = dx, finalDy = dy;
          const primaryNodeId = originalPositions.current.keys().next().value;
          
          if (primaryNodeId) {
              const node = nodeMap.get(primaryNodeId)!;
              const originalPos = originalPositions.current.get(primaryNodeId)!;
              
              // Get ONLY the immediate parent, not grandparents
              const parentId = childToParentMap.get(primaryNodeId);
              const parent = parentId ? nodeMap.get(parentId) : null;
              
              if (parent) {
                  // Calculate the center of the dragged node (after movement)
                  const nodeCenterX = originalPos.x + dx + node.width / 2;
                  const nodeCenterY = originalPos.y + dy + node.height / 2;
                  
                  // Calculate the center of the IMMEDIATE parent node
                  const parentCenterX = parent.x + parent.width / 2;
                  const parentCenterY = parent.y + parent.height / 2;
                  
                  // Snap horizontally when close to immediate parent center
                  const hDist = Math.abs(nodeCenterX - parentCenterX);
                  if (hDist < ALIGNMENT_THRESHOLD) {
                      // Snap to immediate parent center
                      finalDx = parentCenterX - node.width / 2 - originalPos.x;
                      guides.verticalLines.push({ 
                        x: parentCenterX,
                        parentX: parent.x,
                        parentY: parent.y,
                        parentW: parent.width,
                        parentH: parent.height
                      });
                  }
                  
                  // Snap vertically when close to immediate parent center
                  const vDist = Math.abs(nodeCenterY - parentCenterY);
                  if (vDist < ALIGNMENT_THRESHOLD) {
                      // Snap to immediate parent center
                      finalDy = parentCenterY - node.height / 2 - originalPos.y;
                      guides.horizontalLines.push({ 
                        y: parentCenterY,
                        parentX: parent.x,
                        parentY: parent.y,
                        parentW: parent.width,
                        parentH: parent.height
                      });
                  }
              }
          }
          
      // Apply the same offset to all selected nodes with snapped values
      dragOffsetsRef.current.clear();
      originalPositions.current.forEach((_pos, id) => {
        dragOffsetsRef.current.set(id, { dx: finalDx, dy: finalDy });
      });
          stateRef.current.alignmentGuides = guides;
          requestRedraw();
          return;
        }
        
        if (modeRef.current === 'idle') {
            const { wx, wy } = toWorld(e.clientX, e.clientY);
            let hitId: string | null = null;
            for (let i = drawableNodes.length - 1; i >= 0; i--) {
                const n = drawableNodes[i];
                if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
                    hitId = n.id;
                    break;
                }
            }
            if (hitId !== stateRef.current.hoveredId) {
                stateRef.current.hoveredId = hitId;
                requestRedraw();
            }
        }
        
        // Update last pointer at the end for non-pan flows
        lastPointer.current = { x: e.clientX, y: e.clientY };
        motionFrameId = null;
      });
    };
    const onPointerUp = (e: PointerEvent) => {
      try { target.releasePointerCapture(e.pointerId); } catch(err) {/* ignore */}
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
      // Finalize creation
      if (creatingRef.current) {
        const c = creatingRef.current;
        creatingRef.current = null;
        // For text tool, focus edit could be implemented later; keep default text for now
        modeRef.current = 'idle';
        requestRedraw();
        return;
      }
      
      // Handle end of panning
      if (modeRef.current === "pan") {
        if (overlayRef.current) {
          overlayRef.current.style.cursor = keysRef.current.space ? "grab" : "default";
        }
        stateRef.current.isPanning = false;
        modeRef.current = "idle";
        lastPointer.current = null;
        e.preventDefault();
        e.stopPropagation();
      } else if (modeRef.current === "drag") {
        const offsets = new Map(dragOffsetsRef.current);
        if (offsets.size > 0 && rawRoots) {
            const next = updateNodePositions(rawRoots, offsets);
            if (next !== rawRoots) {
              setRawRoots(next);
              hasUserChanges.current = true;
            }
        }
      } else if (modeRef.current === 'marquee' && marqueeStart.current) {
        const { wx: endX, wy: endY } = toWorld(e.clientX, e.clientY);
        const sel = {
            x: Math.min(marqueeStart.current.wx, endX), y: Math.min(marqueeStart.current.wy, endY),
            w: Math.abs(endX - marqueeStart.current.wx), h: Math.abs(endY - marqueeStart.current.wy)
        };
    const nextIds = new Set(drawableNodes
      .filter((n: DrawableNode) => rectsIntersect(sel, { x: n.x, y: n.y, w: n.width, h: n.height }))
      .map((n: DrawableNode) => n.id)
    );
        setSelectedIds(nextIds);
      }
      modeRef.current = "idle";
      dragStartWorld.current = null;
      dragOffsetsRef.current.clear();
      stateRef.current.isPanning = false;
      stateRef.current.isMarquee = false;
      stateRef.current.alignmentGuides = { verticalLines: [], horizontalLines: [] };
      requestRedraw();
    };
    target.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    
    return () => {
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
    };
  }, [toWorld, drawableNodes, setRawRoots, setSelectedIds, setOffset, requestRedraw, nodeMap, childToParentMap, rawRoots, selectedIds, onSelectInteraction]);
  // Logout cleanup
  useEffect(() => {
    const handleLogout = () => {
      try {
        localStorage.removeItem('canvas-stage-state');
        localStorage.removeItem('canvas-session-timestamp');
      } catch (e) { console.warn('Failed to clear state:', e); }
    };
    window.addEventListener('logout', handleLogout);
    return () => window.removeEventListener('logout', handleLogout);
  }, []);
  // Redraw when data arrives or changes
  const prevDrawableNodesLengthRef = useRef(0);
  useEffect(() => {
    if (isInitialized.current && drawableNodes.length !== prevDrawableNodesLengthRef.current) {
      prevDrawableNodesLengthRef.current = drawableNodes.length;
      requestRedraw();
    }
  }, [drawableNodes, requestRedraw]);
  // Redraw triggers for view state changes from props
  useEffect(() => {
    if (isInitialized.current) requestRedraw();
  }, [selectedIds, offset, scale, requestRedraw]);
  return (
    <>
      <AuthRedirect />
      <div 
        className={styles.root} 
        style={{ 
          cursor: stateRef.current.isPanning
            ? "grabbing"
            : keysRef.current.space
              ? "grab"
              : tool === "text"
                ? "text"
                : tool === "rect" || tool === "ellipse" || tool === "pen"
                  ? "crosshair"
                  : "default",
          touchAction: "none" // Prevent default touch behaviors
        }}
      >
        <canvas ref={canvasRef} className={styles.canvasBase} />
        <canvas ref={overlayRef} className={styles.canvasOverlay} />
      </div>
    </>
  )
}

// Helper: insert new child under a parent id; if parent not found, no-op
function updateNodePositionsForInsert(roots: NodeInput[], parentId: string, newChild: NodeInput): NodeInput[] {
  const rec = (node: NodeInput): NodeInput => {
    if (node.id === parentId) {
      const children = Array.isArray(node.children) ? [...node.children, newChild] : [newChild];
      return { ...node, children };
    }
    if (node.children && node.children.length) {
      const nextChildren = node.children.map(rec);
      if (nextChildren.some((c, i) => c !== node.children![i])) {
        return { ...node, children: nextChildren };
      }
    }
    return node;
  };
  return roots.map(rec);
}

// Helper: update temporary preview node size/position by id
function updateTempNode(roots: NodeInput[], id: string, x: number, y: number, w: number, h: number, tool: "rect" | "ellipse" | "text"): NodeInput[] {
  const rec = (node: NodeInput): NodeInput => {
    if (node.id === id) {
      const next: any = { ...node };
      next.x = x; next.y = y; next.width = w; next.height = h; next.w = w; next.h = h;
      if (tool !== 'text') {
        next.type = tool === 'ellipse' ? 'ELLIPSE' : 'FRAME';
      }
      return next as NodeInput;
    }
    if (node.children && node.children.length) {
      const nextChildren = node.children.map(rec);
      if (nextChildren.some((c, i) => c !== node.children![i])) {
        return { ...node, children: nextChildren };
      }
    }
    return node;
  };
  return roots.map(rec);
}
// Optimized image loading hook
function useImageMap(map: ImageMap) {
  const [state, setState] = useState<Record<string, HTMLImageElement>>({});
  const mapKey = useMemo(() =>
    Object.entries(map).map(([k, v]) => `${k}:${typeof v === "string" ? v : (v as HTMLImageElement)?.src ?? ""}`).join("|"),
  [map]);
  useEffect(() => {
    let alive = true;
    const next: Record<string, HTMLImageElement> = {};
    const promises: Promise<void>[] = [];
    Object.entries(map).forEach(([key, val]) => {
      if (typeof val !== "string") {
        if (val?.complete && val.naturalWidth > 0) next[key] = val;
        return;
      }
      const promise = new Promise<void>((resolve) => {
        const img = new Image();
        // Don't set crossOrigin for data URLs or blob URLs
        if (!val.startsWith('data:') && !val.startsWith('blob:')) {
          img.crossOrigin = "anonymous";
        }
        img.onload = () => { if (alive) next[key] = img; resolve(); };
        img.onerror = () => { console.warn('Failed to load image:', key, val); resolve(); };
        img.src = val as string;
      });
      promises.push(promise);
    });
    if (promises.length > 0) {
        Promise.all(promises).then(() => {
            if (alive) setState(prev => ({ ...prev, ...next }));
        });
    } else if (Object.keys(next).length > 0) {
        setState(prev => ({ ...prev, ...next }));
    }
    return () => { alive = false; };
  }, [mapKey])
  
  return state;
}

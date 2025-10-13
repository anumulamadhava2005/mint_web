/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import styles from "./css/CanvasStage.module.css"
import type { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types"
import { drawGrid, drawNodes, drawReferenceFrameOverlay } from "../lib/ccanvas-draw-bridge"

// Type Definitions
type ImageLike = HTMLImageElement | string
type ImageMap = Record<string, ImageLike>

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
      hasChanged = true
      const oldBB = node.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 }
      const newBoundingBox = {
        x: (oldBB.x ?? 0) + offsets.dx,
        y: (oldBB.y ?? 0) + offsets.dy,
        width: oldBB.width ?? 0,
        height: oldBB.height ?? 0,
      }
      
      if (hasChanged) {
        return { ...node, absoluteBoundingBox: newBoundingBox, children: newChildren }
      }
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
  } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 })

  const stateRef = useRef({
    scale,
    offset,
    selectedIds,
    isPanning: false,
    isMarquee: false,
    hoveredId: null as string | null,
    alignmentGuides: { verticalLines: [] as any[], horizontalLines: [] as any[] },
    drawableNodes,
    rawRoots,
  })

  useEffect(() => {
    stateRef.current = { ...stateRef.current, scale, offset, selectedIds, drawableNodes, rawRoots }
  }, [scale, offset, selectedIds, drawableNodes, rawRoots])

  const keysRef = useRef({ ctrl: false, meta: false, shift: false, space: false })
  type Mode = "idle" | "pan" | "marquee" | "drag" | "click"
  const modeRef = useRef<Mode>("idle")

  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const downScreenRef = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ wx: number; wy: number } | null>(null)
  const dragStartWorld = useRef<{ wx: number; wy: number } | null>(null)
  const originalPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map())
  const framePendingRef = useRef(false)

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
  
  const ALIGNMENT_THRESHOLD = 8
  const CLICK_DRAG_SLOP = 2

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { scale, offset } = stateRef.current
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const wx = (sx - offset.x) / scale
    const wy = (sy - offset.y) / scale
    return { wx, wy, sx, sy }
  }, [])

  const requestRedraw = useCallback(() => {
    if (framePendingRef.current) return
    framePendingRef.current = true
    
    requestAnimationFrame(() => {
      framePendingRef.current = false
      const canvas = canvasRef.current
      const overlay = overlayRef.current
      const ctx = canvas?.getContext("2d")
      const octx = overlay?.getContext("2d")
      if (!canvas || !overlay || !ctx || !octx) return

      const { scale, offset, selectedIds, isMarquee, hoveredId, alignmentGuides, drawableNodes: currentDrawableNodes } = stateRef.current
      const dpr = window.devicePixelRatio || 1
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      octx.clearRect(0, 0, overlay.width, overlay.height)
      ctx.fillStyle = "rgba(236, 231, 231, 1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      if (currentDrawableNodes.length === 0) {
        drawGrid(ctx, viewportSize.width, viewportSize.height, offset, scale, 100, 20)
      }
      
      // OPTIMIZATION: Consolidated drawing logic now lives in drawNodes
      drawNodes(ctx, currentDrawableNodes, offset, scale, selectedIds, dragOffsetsRef.current, rawRoots, hoveredId)

      if (isMarquee && marqueeStart.current && lastPointer.current) {
        const s1x = offset.x + marqueeStart.current.wx * scale
        const s1y = offset.y + marqueeStart.current.wy * scale
        const rect = overlay.getBoundingClientRect()
        const s2x = lastPointer.current.x - rect.left
        const s2y = lastPointer.current.y - rect.top
        const mx = Math.min(s1x, s2x), my = Math.min(s1y, s2y)
        const mw = Math.abs(s2x - s1x), mh = Math.abs(s2y - s1y)
        octx.fillStyle = "rgba(16, 185, 129, 0.12)"; octx.strokeStyle = "#10b981";
        octx.lineWidth = 1.5; octx.fillRect(mx, my, mw, mh); octx.strokeRect(mx, my, mw, mh);
      }

      if (selectedFrame) drawReferenceFrameOverlay(octx, selectedFrame, offset, scale)

      if (alignmentGuides.verticalLines.length > 0 || alignmentGuides.horizontalLines.length > 0) {
        octx.strokeStyle = "rgba(147, 51, 234, 0.8)"; octx.lineWidth = 1; // Finer line
        octx.setLineDash([2, 3]); octx.beginPath();
        alignmentGuides.verticalLines.forEach(guide => {
          const sx = offset.x + guide.x * scale; octx.moveTo(sx, 0); octx.lineTo(sx, viewportSize.height);
        });
        alignmentGuides.horizontalLines.forEach(guide => {
          const sy = offset.y + guide.y * scale; octx.moveTo(0, sy); octx.lineTo(viewportSize.width, sy);
        });
        octx.stroke(); octx.setLineDash([]);
      }
    })
  }, [viewportSize, selectedFrame, rawRoots, nodeMap, loadedImages])

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = true;
      if (e.key === "Meta") keysRef.current.meta = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (e.key === " ") {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          keysRef.current.space = true;
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = false;
      if (e.key === "Meta") keysRef.current.meta = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (e.key === " ") keysRef.current.space = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
  
  // FIX: Simplified and reliable wheel handler
  useEffect(() => {
    const target = overlayRef.current;
    if (!target) return;
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const { scale: currentScale, offset: currentOffset } = stateRef.current;

      if (e.ctrlKey || e.metaKey) { // Zoom
        const zoomFactor = Math.exp(-e.deltaY * 0.008);
        const newScale = Math.max(0.05, Math.min(20, currentScale * zoomFactor));
        const worldX = (mouseX - currentOffset.x) / currentScale;
        const worldY = (mouseY - currentOffset.y) / currentScale;
        const newOffsetX = mouseX - worldX * newScale;
        const newOffsetY = mouseY - worldY * newScale;
        setScale(newScale);
        setOffset({ x: newOffsetX, y: newOffsetY });
      } else { // Pan
        setOffset({ x: stateRef.current.offset.x - e.deltaX, y: stateRef.current.offset.y - e.deltaY });
      }
    };
    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, [setScale, setOffset]); // State setters are stable

  useEffect(() => {
    const target = overlayRef.current;
    if (!target) return;

    const pointInRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) => {
      const tolerance = 3 / stateRef.current.scale;
      return px >= r.x - tolerance && px <= r.x + r.w + tolerance && py >= r.y - tolerance && py <= r.y + r.h + tolerance;
    };

    const onPointerDown = (e: PointerEvent) => {
      target.setPointerCapture(e.pointerId);
      const { wx, wy } = toWorld(e.clientX, e.clientY);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      downScreenRef.current = { x: e.clientX, y: e.clientY };

      if (keysRef.current.space || e.button === 1) {
        modeRef.current = "pan";
        stateRef.current.isPanning = true;
        return;
      }

      let hitId: string | null = null;
      for (let i = drawableNodes.length - 1; i >= 0; i--) {
        const n = drawableNodes[i];
        if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
          hitId = n.id;
          break;
        }
      }

      if (hitId) {
        modeRef.current = "click";
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
      if (!lastPointer.current) return;

      if (modeRef.current === "click") {
        const dxs = e.clientX - downScreenRef.current!.x;
        const dys = e.clientY - downScreenRef.current!.y;
        if (Math.hypot(dxs, dys) >= CLICK_DRAG_SLOP) {
          modeRef.current = "drag";
        }
      }
      
      lastPointer.current = { x: e.clientX, y: e.clientY };

      // FIX: Pan logic now only mutates the ref for performance.
      if (modeRef.current === "pan") {
        stateRef.current.offset.x += e.movementX;
        stateRef.current.offset.y += e.movementY;
        requestRedraw();
        return;
      }
      
      if (modeRef.current === "marquee") {
        requestRedraw();
        return;
      }
      
      if (modeRef.current === "drag" && dragStartWorld.current) {
        const { wx, wy } = toWorld(e.clientX, e.clientY);
        let dx = wx - dragStartWorld.current.wx;
        let dy = wy - dragStartWorld.current.wy;
        
        const guides = { verticalLines: [] as any[], horizontalLines: [] as any[] };
        let finalDx = dx;
        let finalDy = dy;

        const primaryNodeId = originalPositions.current.keys().next().value;
        if (primaryNodeId) {
            const node = nodeMap.get(primaryNodeId)!;
            const originalPos = originalPositions.current.get(primaryNodeId)!;
            const parentId = childToParentMap.get(primaryNodeId);
            const parent = parentId ? nodeMap.get(parentId) : null;

            if (parent) {
                const nodeCenterX = originalPos.x + dx + node.width / 2;
                const nodeCenterY = originalPos.y + dy + node.height / 2;
                const parentCenterX = parent.x + parent.width / 2;
                const parentCenterY = parent.y + parent.height / 2;

                if (Math.abs(nodeCenterX - parentCenterX) < ALIGNMENT_THRESHOLD) {
                    finalDx = parentCenterX - node.width / 2 - originalPos.x;
                    guides.verticalLines.push({ x: parentCenterX, parentId: parent.id });
                }
                if (Math.abs(nodeCenterY - parentCenterY) < ALIGNMENT_THRESHOLD) {
                    finalDy = parentCenterY - node.height / 2 - originalPos.y;
                    guides.horizontalLines.push({ y: parentCenterY, parentId: parent.id });
                }
            }
        }
        
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
    };

    const onPointerUp = (e: PointerEvent) => {
      try { target.releasePointerCapture(e.pointerId); } catch(err) {/* ignore */}
      
      // FIX: Commit final state for panning after the interaction ends.
      if (modeRef.current === 'pan') {
          setOffset(stateRef.current.offset);
      }
      
      if (modeRef.current === "drag") {
        const offsets = new Map(dragOffsetsRef.current);
        if (offsets.size > 0 && rawRoots) {
            // FIX: Use performant update function instead of structuredClone
            const next = updateNodePositions(rawRoots, offsets);
            if (next !== rawRoots) setRawRoots(next);
        }
      } else if (modeRef.current === 'marquee' && marqueeStart.current) {
        const { wx: endX, wy: endY } = toWorld(e.clientX, e.clientY);
        const sel = {
            x: Math.min(marqueeStart.current.wx, endX), y: Math.min(marqueeStart.current.wy, endY),
            w: Math.abs(endX - marqueeStart.current.wx), h: Math.abs(endY - marqueeStart.current.wy)
        };
        const nextIds = new Set<string>();
        for (const n of drawableNodes) {
            if (rectsIntersect(sel, { x: n.x, y: n.y, w: n.width, h: n.height })) {
                nextIds.add(n.id);
            }
        }
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
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    
    return () => {
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [toWorld, nodeMap, childToParentMap, drawableNodes, rawRoots, selectedIds, setRawRoots, setSelectedIds, setOffset, requestRedraw]);

  // Redraw whenever key state changes that aren't driven by interaction handlers
  useEffect(() => {
    requestRedraw()
  }, [drawableNodes, selectedIds, offset, scale, requestRedraw])

  return (
    <div className={styles.root} style={{ cursor: stateRef.current.isPanning ? "grabbing" : keysRef.current.space ? "grab" : "default" }}>
      <canvas ref={canvasRef} className={styles.canvasBase} />
      <canvas ref={overlayRef} className={styles.canvasOverlay} />
    </div>
  )
}

function useImageMap(map: ImageMap) {
  const [state, setState] = useState<Record<string, HTMLImageElement>>({});

  const mapKey = useMemo(() =>
    Object.entries(map).map(([k, v]) => `${k}:${typeof v === "string" ? v : (v as HTMLImageElement)?.src ?? ""}`).join("|"),
  [map]);

  useEffect(() => {
    let alive = true;
    const next: Record<string, HTMLImageElement> = {};
    const promises: Promise<void>[] = [];

    const entries = Object.entries(map);
    entries.forEach(([key, val]) => {
      if (typeof val !== "string") {
        const img = val as HTMLImageElement;
        if (img?.complete) next[key] = img;
        return;
      }

      const src = val as string;
      const existing = Object.values(state).find(i => i.src === src);
      if (existing?.complete) {
        next[key] = existing;
        return;
      }

      const promise = new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { next[key] = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = src;
      });
      promises.push(promise);
    });

    if (promises.length > 0) {
        Promise.all(promises).then(() => {
            if (alive) setState(prev => ({ ...prev, ...next }));
        });
    } else if (Object.keys(next).length > 0 && Object.keys(next).some(k => !state[k] || state[k].src !== next[k].src)) {
        setState(prev => ({ ...prev, ...next }));
    }

    return () => { alive = false; };
  }, [mapKey, state]);

  return state;
}
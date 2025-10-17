/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import styles from "./css/CanvasStage.module.css"
import type { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types"
import { drawGrid, drawNodes, drawReferenceFrameOverlay } from "../lib/ccanvas-draw-bridge"
import AuthRedirect from "./AuthRedirect"
// Type Definitions
type ImageLike = HTMLImageElement | string
type ImageMap = Record<string, ImageLike>
// Constants
const ALIGNMENT_THRESHOLD = 12 // Increased snap distance for easier alignment
const CLICK_DRAG_SLOP = 3
const STORAGE_VERSION = 1
const MAX_STORAGE_AGE = 24 * 60 * 60 * 1000 // 24 hours
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
  })
  // Control flags
  const framePendingRef = useRef(false)
  const hasLoadedFromStorage = useRef(false)
  const hasUserChanges = useRef(false)
  const isInitialized = useRef(false)
  const hasReceivedData = useRef(false)
  // Sync selection, drawable nodes, and rawRoots on prop changes
  useEffect(() => {
    stateRef.current.selectedIds = selectedIds
    stateRef.current.drawableNodes = drawableNodes
    stateRef.current.rawRoots = rawRoots
  }, [selectedIds, drawableNodes, rawRoots])
  const keysRef = useRef({ ctrl: false, meta: false, shift: false, space: false })
  type Mode = "idle" | "pan" | "marquee" | "drag" | "click"
  const modeRef = useRef<Mode>("idle")
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const downScreenRef = useRef<{ x: number; y: number } | null>(null)
  const dragStartScreen = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ wx: number; wy: number } | null>(null)
  const dragStartWorld = useRef<{ wx: number; wy: number } | null>(null)
  const originalPositions = useRef<Map<string, { x: number, y: number }>>(new Map())
  const dragOffsetsRef = useRef<Map<string, { dx: number, dy: number }>>(new Map())
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
    })
  }, [viewportSize, selectedFrame])
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
  // Auth event listeners
  useEffect(() => {
    const handleAuthWarning = (e: CustomEvent) => console.warn('Auth warning:', e.detail.message);
    const handleAuthConfirmed = () => hasUserChanges.current = true;
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
  
  // ✅ PERFORMANCE OPTIMIZATION: High-performance wheel handler
  // This updates the canvas view directly without triggering React re-renders on every scroll event.
  // The final state is synced back to React after the gesture ends.
  const wheelEndTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    const target = overlayRef.current;
    if (!target) return;
    
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
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

      if (e.ctrlKey || e.metaKey) { // Zooming
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
      } else { // Panning
        // Multiply by devicePixelRatio to make panning consistent across DPRs
        const dpr = window.devicePixelRatio || 1;
        const newOffset = {
          x: currentOffset.x - dX * dpr,
          y: currentOffset.y - dY * dpr
        };
        stateRef.current.offset = newOffset;
        setOffset(newOffset);
      }
      requestRedraw();
      hasUserChanges.current = true;
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
    let panState = { x: 0, y: 0 };
    let motionFrameId: number | null = null;
    let lastScreenPos = { x: 0, y: 0 }; // Track last screen position for delta calculation
    
    const pointInRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) => {
      const tolerance = 3 / stateRef.current.scale;
      return px >= r.x - tolerance && px <= r.x + r.w + tolerance && py >= r.y - tolerance && py <= r.y + r.h + tolerance;
    };
    const onPointerDown = (e: PointerEvent) => {
      target.setPointerCapture(e.pointerId);
      const { wx, wy } = toWorld(e.clientX, e.clientY);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      lastScreenPos = { x: e.clientX, y: e.clientY }; // Initialize screen position tracker
      downScreenRef.current = { x: e.clientX, y: e.clientY };
      if (keysRef.current.space || e.button === 1) {
        modeRef.current = "pan";
        stateRef.current.isPanning = true;
        panState = { ...stateRef.current.offset };
        return;
      }
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
      if (!lastPointer.current) return;
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
      motionFrameId = requestAnimationFrame(() => {
        if (modeRef.current === "click") {
          const dxs = e.clientX - downScreenRef.current!.x;
          const dys = e.clientY - downScreenRef.current!.y;
          if (Math.hypot(dxs, dys) >= CLICK_DRAG_SLOP) {
            modeRef.current = "drag";
            hasUserChanges.current = true;
          }
        }
        
        // Calculate delta from last position for more reliable movement
        const deltaX = e.clientX - lastScreenPos.x;
        const deltaY = e.clientY - lastScreenPos.y;
        lastScreenPos = { x: e.clientX, y: e.clientY };
        lastPointer.current = { x: e.clientX, y: e.clientY };
        
        if (modeRef.current === "pan") {
          // Use client deltas rather than movementX/movementY to avoid inconsistencies
          const last = lastPointer.current || { x: e.clientX, y: e.clientY };
          const dx = e.clientX - last.x;
          const dy = e.clientY - last.y;
          panState.x += dx;
          panState.y += dy;
          stateRef.current.offset = { x: panState.x, y: panState.y };
          lastPointer.current = { x: e.clientX, y: e.clientY };
          requestRedraw();
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
        
        motionFrameId = null;
      });
    };
    const onPointerUp = (e: PointerEvent) => {
      try { target.releasePointerCapture(e.pointerId); } catch(err) {/* ignore */}
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
      
      if (modeRef.current === 'pan') {
          setOffset(panState); // Commit final pan position to React state
          hasUserChanges.current = true;
      }
      
      if (modeRef.current === "drag") {
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
            .filter(n => rectsIntersect(sel, { x: n.x, y: n.y, w: n.width, h: n.height }))
            .map(n => n.id)
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
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    
    return () => {
      target.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (motionFrameId) cancelAnimationFrame(motionFrameId);
    };
  }, [toWorld, drawableNodes, setRawRoots, setSelectedIds, setOffset, requestRedraw, nodeMap, childToParentMap, rawRoots, selectedIds]);
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
          cursor: stateRef.current.isPanning ? "grabbing" : 
                  keysRef.current.space ? "grab" : "default" 
        }}
      >
        <canvas ref={canvasRef} className={styles.canvasBase} />
        <canvas ref={overlayRef} className={styles.canvasOverlay} />
      </div>
    </>
  )
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

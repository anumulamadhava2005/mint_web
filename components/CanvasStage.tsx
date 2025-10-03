/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types"
import { drawGrid, drawNodes, drawReferenceFrameOverlay } from "../lib/ccanvas-draw-bridge"

type ImageLike = HTMLImageElement | string
type ImageMap = Record<string, ImageLike> // keyed by node.id or node.name

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
  images?: ImageMap // NEW: map node id/name -> URL or HTMLImageElement
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
  }: any = props

  // overlay and base canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 })

  // interaction state
  const keysRef = useRef({ ctrl: false, meta: false, shift: false, space: false })
  type Mode = "idle" | "pan" | "marquee" | "drag" | "click"
  const modeRef = useRef<Mode>("idle")
  const [isPanning, setIsPanning] = useState(false)
  const [isMarquee, setIsMarquee] = useState(false)
  const lastPointer = useRef<{ x: number; y: number } | null>(null)
  const marqueeStart = useRef<{ wx: number; wy: number } | null>(null)
  const downScreenRef = useRef<{ x: number; y: number } | null>(null)

  const dragStartWorld = useRef<{ wx: number; wy: number } | null>(null)
  const originalPositions = useRef<Map<string, { x: number; y: number }>>(new Map())
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map())
  const [tick, setTick] = useState(0)
  const rerender = () => setTick((t) => (t + 1) & 0xffff)

  const GRID_MAJOR = 100
  const GRID_MINOR = 20
  const SNAP = 10
  const CLICK_DRAG_SLOP = 4

  // layout
  useEffect(() => {
    const update = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update, { passive: true })
    return () => window.removeEventListener("resize", update)
  }, [])

  // key handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = true
      if (e.key === "Meta") keysRef.current.meta = true
      if (e.key === "Shift") keysRef.current.shift = true
      if (e.key === " ") {
        keysRef.current.space = true
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = false
      if (e.key === "Meta") keysRef.current.meta = false
      if (e.key === "Shift") keysRef.current.shift = false
      if (e.key === " ") {
        keysRef.current.space = false
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  // wheel zoom with Ctrl/Meta
  useEffect(() => {
    const target = overlayRef.current || canvasRef.current
    if (!target) return

    const onWheel = (e: WheelEvent) => {
      // Always allow zoom with wheel (trackpad or mouse), block browser zoom
      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // Clamp deltaY to avoid huge jumps (trackpad/mouse differences)
      let delta = Math.max(-100, Math.min(100, e.deltaY));
      // Use a stable zoom factor
      const zoomFactor = Math.exp(-delta * 0.002);
      let next = scale * zoomFactor;
      next = Math.max(0.05, Math.min(10, next));
      const wx = (cx - offset.x) / scale;
      const wy = (cy - offset.y) / scale;
      const nx = cx - wx * next;
      const ny = cy - wy * next;
      setScale(next);
      setOffset({ x: nx, y: ny });
    }

    target.addEventListener("wheel", onWheel, { passive: false })
    return () => target.removeEventListener("wheel", onWheel)
  }, [scale, offset, setScale, setOffset])

  // Preload any string URLs in images into HTMLImageElement instances
  const loadedImages = useImageMap(images)

  // pointer interactions (unchanged) ...
  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return
    canvas.style.touchAction = "none"
    overlay.style.touchAction = "none"

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      const wx = (sx - offset.x) / scale
      const wy = (sy - offset.y) / scale
      return { wx, wy, sx, sy }
    }

    const pointInRect = (px: number, py: number, r: { x: number; y: number; w: number; h: number }) =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h

    const rectsIntersect = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
    ) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)

    const rectContains = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
    ) => a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h

    const onPointerDown = (e: PointerEvent) => {
      const { wx, wy } = toWorld(e.clientX, e.clientY)
      lastPointer.current = { x: e.clientX, y: e.clientY }
      downScreenRef.current = { x: e.clientX, y: e.clientY }
      const isCtrl = e.ctrlKey || e.metaKey
      const isSpace = keysRef.current.space

      // If space is held, always pan (Figma-like)
      if (isSpace) {
        modeRef.current = "pan"
        setIsPanning(true)
        overlay.setPointerCapture(e.pointerId)
        return
      }

      let hitId: string | null = null
      for (let i = drawableNodes.length - 1; i >= 0; i--) {
        const n = drawableNodes[i]
        if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
          hitId = n.id
          break
        }
      }

      if (hitId) {
        modeRef.current = "click"
        if (!isCtrl) {
          dragStartWorld.current = { wx, wy }
          const map = new Map<string, { x: number; y: number }>()
          const set = new Set(selectedIds)
          set.add(hitId)
          drawableNodes.forEach((n: any) => {
            if (set.has(n.id)) map.set(n.id, { x: n.x, y: n.y })
          })
          originalPositions.current = map
          dragOffsetsRef.current.clear()
        }
        overlay.setPointerCapture(e.pointerId)

        setSelectedIds((prev: any) => {
          const next = new Set(prev)
          if (isCtrl) {
            if (next.has(hitId!)) next.delete(hitId!)
            else next.add(hitId!)
          } else {
            if (!next.has(hitId!) || next.size > 1) {
              next.clear()
              next.add(hitId!)
            }
          }
          return next
        })
        return
      }

      // Fallback to pan if no node was hit
      modeRef.current = "pan"
      setIsPanning(true)
      overlay.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (modeRef.current === "click" && dragStartWorld.current && downScreenRef.current) {
        const dxs = e.clientX - downScreenRef.current.x
        const dys = e.clientY - downScreenRef.current.y
        if (Math.hypot(dxs, dys) >= CLICK_DRAG_SLOP) {
          modeRef.current = "drag"
        }
      }
      lastPointer.current = { x: e.clientX, y: e.clientY }

      if (modeRef.current === "pan") {
        setOffset((o: any) => ({ x: o.x + e.movementX, y: o.y + e.movementY }))
        return
      }

      if (modeRef.current === "drag" && dragStartWorld.current) {
        const { wx, wy } = toWorld(e.clientX, e.clientY)
        let dx = wx - dragStartWorld.current.wx
        let dy = wy - dragStartWorld.current.wy
        dx = Math.round(dx / SNAP) * SNAP
        dy = Math.round(dy / SNAP) * SNAP

        const offsets = dragOffsetsRef.current
        offsets.clear()
        originalPositions.current.forEach((_pos, id) => {
          offsets.set(id, { dx, dy })
        })
        setTick((t) => (t + 1) & 0xffff)
        return
      }
    }

    const onPointerUp = (_e: PointerEvent) => {
      if (modeRef.current === "pan") {
        setIsPanning(false)
      } else if (modeRef.current === "drag" && dragStartWorld.current) {
        const offsets = dragOffsetsRef.current
        if (offsets.size > 0 && rawRoots) {
          const moved = new Set(offsets.keys())
          const apply = (node: NodeInput) => {
            if (moved.has(node.id)) {
              const off = offsets.get(node.id)!
              if (node.absoluteBoundingBox) {
                node.absoluteBoundingBox.x = (node.absoluteBoundingBox.x ?? 0) + off.dx
                node.absoluteBoundingBox.y = (node.absoluteBoundingBox.y ?? 0) + off.dy
              } else {
                if (typeof (node as any).x === "number") (node as any).x = ((node as any).x ?? 0) + off.dx
                if (typeof (node as any).y === "number") (node as any).y = ((node as any).y ?? 0) + off.dy
              }
            }
            node.children?.forEach(apply)
          }
          const next = structuredClone(rawRoots) as NodeInput[]
          next.forEach(apply)
          setRawRoots(next)
        }
        dragStartWorld.current = null
        dragOffsetsRef.current.clear()
      } else if (modeRef.current === "marquee" && marqueeStart.current) {
        const rect = canvas.getBoundingClientRect()
        const s2x = lastPointer.current!.x - rect.left
        const s2y = lastPointer.current!.y - rect.top
        const endX = (s2x - offset.x) / scale
        const endY = (s2y - offset.y) / scale
        const sel = {
          x: Math.min(marqueeStart.current.wx, endX),
          y: Math.min(marqueeStart.current.wy, endY),
          w: Math.abs(endX - marqueeStart.current.wx),
          h: Math.abs(endY - marqueeStart.current.wy),
        }
        setSelectedIds(() => {
          const next = new Set<string>()
          for (const n of drawableNodes) {
            const nodeRect = { x: n.x, y: n.y, w: n.width, h: n.height }
            const include = rectContains(sel, nodeRect) || rectsIntersect(sel, nodeRect)
            if (include) next.add(n.id)
          }
          return next
        })
        setIsMarquee(false)
        marqueeStart.current = null
      }
      modeRef.current = "idle"
    }

    overlay.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)

    return () => {
      overlay.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [drawableNodes, offset, scale, rawRoots, setOffset, setRawRoots, setSelectedIds])

  // render pass
  useEffect(() => {
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!canvas || !overlay) return

    const dpr = window.devicePixelRatio || 1
    ;[canvas, overlay].forEach((c) => {
      c.style.width = `${viewportSize.width}px`
      c.style.height = `${viewportSize.height}px`
      c.width = Math.floor(viewportSize.width * dpr)
      c.height = Math.floor(viewportSize.height * dpr)
    })

    const ctx = canvas.getContext("2d")!
    const octx = overlay.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, viewportSize.width, viewportSize.height)
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, viewportSize.width, viewportSize.height)

    // Show grid only if there are no drawable nodes (before fetch)
    if (!drawableNodes || drawableNodes.length === 0) {
      drawGrid(ctx, viewportSize.width, viewportSize.height, offset, scale, 100, 20)
    }
    drawNodes(ctx, drawableNodes, offset, scale, selectedIds, dragOffsetsRef.current, rawRoots || null)

    // draw images OVER shapes when available
    const FIT_MODE = "cover" as "cover" | "contain" | "stretch"

    for (const n of drawableNodes) {
      const key = images[n.id] ? n.id : n.name // prefer id
      const asset = loadedImages[key]
      const img = asset as HTMLImageElement | undefined

      if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) continue

      const x = offset.x + n.x * scale
      const y = offset.y + n.y * scale
      const w = Math.max(0.5, n.width * scale)
      const h = Math.max(0.5, n.height * scale)

      // Compute draw rect based on fit mode
      let dx = x,
        dy = y,
        dw = w,
        dh = h
      if (FIT_MODE !== "stretch") {
        const ir = img.naturalWidth / img.naturalHeight
        const br = w / h
        if (FIT_MODE === "cover") {
          // fill box entirely, possibly cropping
          if (ir > br) {
            // image wider -> match height
            dh = h
            dw = h * ir
            dx = x + (w - dw) / 2
            dy = y
          } else {
            // image taller -> match width
            dw = w
            dh = w / ir
            dx = x
            dy = y + (h - dh) / 2
          }
        } else if (FIT_MODE === "contain") {
          // letterbox inside box
          if (ir > br) {
            dw = w
            dh = w / ir
            dx = x
            dy = y + (h - dh) / 2
          } else {
            dh = h
            dw = h * ir
            dx = x + (w - dw) / 2
            dy = y
          }
        }
      }

      // Optional: clip to rounded corners if node has radius
      const radius =
        (rawRoots &&
          (rawRoots.find((r: any) => r.id === n.id)?.corners?.uniform ??
            rawRoots?.find((r: any) => r.id === n.id)?.corners?.topLeft ??
            rawRoots?.find((r: any) => r.id === n.id)?.corners?.topRight ??
            rawRoots?.find((r: any) => r.id === n.id)?.corners?.bottomRight ??
            rawRoots?.find((r: any) => r.id === n.id)?.corners?.bottomLeft)) ||
        0

      try {
        if (radius && radius > 0) {
          const r = Math.min(radius * scale, Math.min(w, h) / 2)
          ctx.save()
          ctx.beginPath()
          if ((ctx as any).roundRect) {
            ;(ctx as any).roundRect(x, y, w, h, r)
          } else {
            // simple rounded rect path
            ctx.moveTo(x + r, y)
            ctx.arcTo(x + w, y, x + w, y + h, r)
            ctx.arcTo(x + w, y + h, x, y + h, r)
            ctx.arcTo(x, y + h, x, y, r)
            ctx.arcTo(x, y, x + w, y, r)
            ctx.closePath()
          }
          ctx.clip()
          ctx.drawImage(img, dx, dy, dw, dh)
          ctx.restore()
        } else {
          ctx.drawImage(img, dx, dy, dw, dh)
        }
      } catch {
        // If CORS taints canvas or other draw errors, skip drawing this image
        // Ensure images are loaded with img.crossOrigin="anonymous" and proper ACAO headers. [2]
        continue
      }
    }

    // overlay pass
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    octx.clearRect(0, 0, viewportSize.width, viewportSize.height)

    if (isMarquee && marqueeStart.current && lastPointer.current) {
      const s1x = offset.x + marqueeStart.current.wx * scale
      const s1y = offset.y + marqueeStart.current.wy * scale
      const rect = overlay.getBoundingClientRect()
      const s2x = lastPointer.current.x - rect.left
      const s2y = lastPointer.current.y - rect.top
      const mx = Math.min(s1x, s2x)
      const my = Math.min(s1y, s2y)
      const mw = Math.abs(s2x - s1x)
      const mh = Math.abs(s2y - s1y)
      octx.fillStyle = "rgba(16, 185, 129, 0.12)"
      octx.strokeStyle = "#10b981"
      octx.lineWidth = 1.5
      octx.fillRect(mx, my, mw, mh)
      octx.strokeRect(mx, my, mw, mh)
    }

    if (selectedFrame) drawReferenceFrameOverlay(octx, selectedFrame, offset, scale)
  }, [drawableNodes, viewportSize, offset, scale, selectedIds, isMarquee, tick, rawRoots, selectedFrame, loadedImages])

  return (
    <div
      className="relative flex-1 bg-background"
      style={{ width: "100%", height: "100%", overflow: "hidden", cursor: isPanning ? "grabbing" : "default" }}
    >
      <canvas ref={canvasRef} className="block absolute inset-0" />
      <canvas ref={overlayRef} className="block absolute inset-0" />
    </div>
  )
}

/* Preload helper: convert string URLs to HTMLImageElement and memoize readiness */
function useImageMap(map: ImageMap) {
  const [state, setState] = useState<Record<string, HTMLImageElement>>({})
  const entries = useMemo(() => Object.entries(map), [map])

  useEffect(() => {
    let alive = true
    const next: Record<string, HTMLImageElement> = {}
    let pending = 0

    const finish = () => {
      if (alive) setState({ ...next })
    }

    entries.forEach(([key, val]) => {
      if (typeof val !== "string") {
        const img = val as HTMLImageElement
        if (img && img.complete) next[key] = img
        else if (img) {
          pending++
          const onLoad = () => {
            next[key] = img
            if (--pending === 0) finish()
          }
          const onError = () => {
            if (--pending === 0) finish()
          }
          img.addEventListener("load", onLoad, { once: true })
          img.addEventListener("error", onError, { once: true })
        }
        return
      }
      const src = val as string
      const img = new Image()
      pending++
      // CORS must be set BEFORE src to avoid tainting and to allow drawing at all
      img.crossOrigin = "anonymous" // server must send ACAO, or use same-origin/proxy [2]
      img.onload = () => {
        next[key] = img
        if (--pending === 0) finish()
      }
      img.onerror = () => {
        console.warn("Image failed to load:", src)
        if (--pending === 0) finish()
      }
      img.src = src // set last [1]
    })

    if (pending === 0) finish()
    return () => {
      alive = false
    }
  }, [entries])

;  return state
}

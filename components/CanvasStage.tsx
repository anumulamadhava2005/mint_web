/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import styles from "./css/CanvasStage.module.css"
import type { DrawableNode, NodeInput, ReferenceFrame } from "../lib/figma-types"
import { drawGrid, drawNodes, drawReferenceFrameOverlay } from "../lib/ccanvas-draw-bridge"

type ImageLike = HTMLImageElement | string
type ImageMap = Record<string, ImageLike>

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
  }: any = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 })
<<<<<<< HEAD
=======
  
  // Refs to track current scale and offset for smooth zoom
  const scaleRef = useRef(scale)
  const offsetRef = useRef(offset)
  
  // Update refs when state changes
  useEffect(() => {
    scaleRef.current = scale
    offsetRef.current = offset
  }, [scale, offset])
>>>>>>> origin/adhish1

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
<<<<<<< HEAD
=======
  const [hoveredId, setHoveredId] = useState<string | null>(null)
>>>>>>> origin/adhish1
  const [tick, setTick] = useState(0)

  const SNAP = 10
  const CLICK_DRAG_SLOP = 4

  useEffect(() => {
    const update = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener("resize", update, { passive: true })
    return () => window.removeEventListener("resize", update)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = true
      if (e.key === "Meta") keysRef.current.meta = true
      if (e.key === "Shift") keysRef.current.shift = true
      if (e.key === " ") {
        keysRef.current.space = true
<<<<<<< HEAD
        // Only prevent default if not typing in an input/textarea
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return // Allow normal space behavior in text inputs
=======
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return
>>>>>>> origin/adhish1
        }
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = false
      if (e.key === "Meta") keysRef.current.meta = false
      if (e.key === "Shift") keysRef.current.shift = false
      if (e.key === " ") {
        keysRef.current.space = false
<<<<<<< HEAD
        // Only prevent default if not typing in an input/textarea
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return // Allow normal space behavior in text inputs
=======
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return
>>>>>>> origin/adhish1
        }
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

  useEffect(() => {
    const target = overlayRef.current || canvasRef.current
    if (!target) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
<<<<<<< HEAD
      const rect = target.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      let delta = Math.max(-100, Math.min(100, e.deltaY))
      const zoomFactor = Math.exp(-delta * 0.002)
      let next = scale * zoomFactor
      next = Math.max(0.05, Math.min(10, next))
      const wx = (cx - offset.x) / scale
      const wy = (cy - offset.y) / scale
      const nx = cx - wx * next
      const ny = cy - wy * next
      setScale(next)
      setOffset({ x: nx, y: ny })
    }

    target.addEventListener("wheel", onWheel, { passive: false })
    return () => target.removeEventListener("wheel", onWheel)
  }, [scale, offset, setScale, setOffset])
=======
      
      const rect = target.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const currentScale = scaleRef.current
      const currentOffset = offsetRef.current

      // Detect gesture type
      const isCtrlZoom = e.ctrlKey || e.metaKey
      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      
      // Pinch zoom: both X and Y are significant (trackpad pinch gesture)
      // Only trigger if BOTH axes have meaningful movement
      const isTrackpadPinch = absX > 15 && absY > 15 && e.deltaMode === 0 && absX > absY * 0.5 && absY > absX * 0.5
      
      if (isCtrlZoom) {
        // Ctrl+scroll zoom
        const delta = -e.deltaY
        const zoomFactor = Math.exp(delta * 0.008)
        const newScale = Math.max(0.05, Math.min(20, currentScale * zoomFactor))
        
        const worldX = (mouseX - currentOffset.x) / currentScale
        const worldY = (mouseY - currentOffset.y) / currentScale
        
        const newOffsetX = mouseX - worldX * newScale
        const newOffsetY = mouseY - worldY * newScale
        
        setScale(newScale)
        setOffset({ x: newOffsetX, y: newOffsetY })
      } else if (isTrackpadPinch) {
        // Trackpad pinch zoom using deltaX
        const delta = e.deltaX
        const zoomFactor = Math.exp(delta * 0.008)
        const newScale = Math.max(0.05, Math.min(20, currentScale * zoomFactor))
        
        const worldX = (mouseX - currentOffset.x) / currentScale
        const worldY = (mouseY - currentOffset.y) / currentScale
        
        const newOffsetX = mouseX - worldX * newScale
        const newOffsetY = mouseY - worldY * newScale
        
        setScale(newScale)
        setOffset({ x: newOffsetX, y: newOffsetY })
      } else {
        // Pan - smooth two-finger scroll in any direction
        setOffset((prev: any) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    target.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      target.removeEventListener("wheel", onWheel)
    }
  }, [])
>>>>>>> origin/adhish1

  const mergedImages = useMemo(() => {
    const out: ImageMap = { ...(images || {}) }
    if (rawRoots && Array.isArray(rawRoots)) {
      const walk = (node: any) => {
        if (node?.fill?.type === "IMAGE" && typeof node.fill.imageRef === "string") {
          let imageUrl = node.fill.imageRef
<<<<<<< HEAD
          // Proxy external URLs to avoid CORS
=======
>>>>>>> origin/adhish1
          if (imageUrl.startsWith('http') && !imageUrl.includes(window.location.hostname)) {
            imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
          }
          out[node.id] = imageUrl
          if (node.name) out[node.name] = imageUrl
        }
        node.children?.forEach((c: any) => walk(c))
      }
      rawRoots.forEach((r: any) => walk(r))
    }
    return out
  }, [images, rawRoots, tick])

  const loadedImages = useImageMap(mergedImages)

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
          const idsToMove = new Set<string>([hitId!])
          drawableNodes.forEach((n: any) => {
            if (idsToMove.has(n.id)) map.set(n.id, { x: n.x, y: n.y })
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

      if (!isCtrl && !isSpace) {
        setSelectedIds(() => new Set())
      }
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

<<<<<<< HEAD
=======
      if (modeRef.current === "idle") {
        const { wx, wy } = toWorld(e.clientX, e.clientY)
        let hitId: string | null = null
        for (let i = drawableNodes.length - 1; i >= 0; i--) {
          const n = drawableNodes[i]
          if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
            hitId = n.id
            break
          }
        }
        setHoveredId(hitId)
      }

>>>>>>> origin/adhish1
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
<<<<<<< HEAD
    ctx.fillStyle = "#ffffff"
=======
    ctx.fillStyle = "rgba(236, 231, 231, 1)"
>>>>>>> origin/adhish1
    ctx.fillRect(0, 0, viewportSize.width, viewportSize.height)

    if (!drawableNodes || drawableNodes.length === 0) {
      drawGrid(ctx, viewportSize.width, viewportSize.height, offset, scale, 100, 20)
    }
    
<<<<<<< HEAD
    drawNodes(ctx, drawableNodes, offset, scale, selectedIds, dragOffsetsRef.current, rawRoots || null)
=======
    drawNodes(ctx, drawableNodes, offset, scale, selectedIds, dragOffsetsRef.current, rawRoots || null, hoveredId)
>>>>>>> origin/adhish1

    for (const n of drawableNodes) {
      let nodeData: any = null
      let fillProps: any = null
      
      if (rawRoots) {
        const findNode = (node: any): any => {
          if (node.id === n.id) return node
          if (node.children) {
            for (const child of node.children) {
              const found = findNode(child)
              if (found) return found
            }
          }
          return null
        }
        
        for (const root of rawRoots) {
          const found = findNode(root)
          if (found) {
            nodeData = found
            fillProps = found.fill
            break
          }
        }
      }

      if (!fillProps || fillProps.type !== "IMAGE") continue

      const img = loadedImages[n.id] || loadedImages[n.name]
      if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) continue

      const fitMode = fillProps?.fit || "cover"
      const opacity = fillProps?.opacity !== undefined ? fillProps.opacity : 1

      const x = offset.x + n.x * scale
      const y = offset.y + n.y * scale
      const w = Math.max(0.5, n.width * scale)
      const h = Math.max(0.5, n.height * scale)

      let dx = x, dy = y, dw = w, dh = h

      if (fitMode === "cover") {
        const ir = img.naturalWidth / img.naturalHeight
        const br = w / h
        if (ir > br) {
          dh = h
          dw = h * ir
          dx = x + (w - dw) / 2
          dy = y
        } else {
          dw = w
          dh = w / ir
          dx = x
          dy = y + (h - dh) / 2
        }
      } else if (fitMode === "contain") {
        const ir = img.naturalWidth / img.naturalHeight
        const br = w / h
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

      const radius = nodeData?.corners?.uniform || 0

      try {
        ctx.save()
        ctx.globalAlpha = opacity

        if (radius && radius > 0) {
          const r = Math.min(radius * scale, Math.min(w, h) / 2)
          ctx.beginPath()
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(x, y, w, h, r)
          } else {
            ctx.moveTo(x + r, y)
            ctx.arcTo(x + w, y, x + w, y + h, r)
            ctx.arcTo(x + w, y + h, x, y + h, r)
            ctx.arcTo(x, y + h, x, y, r)
            ctx.arcTo(x, y, x + w, y, r)
            ctx.closePath()
          }
          ctx.clip()
        }

        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh)
        ctx.restore()
      } catch (err) {
        ctx.restore()
        continue
      }
    }

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
<<<<<<< HEAD
  }, [drawableNodes, viewportSize, offset, scale, selectedIds, isMarquee, tick, rawRoots, selectedFrame, loadedImages])
=======
  }, [drawableNodes, viewportSize, offset, scale, selectedIds, isMarquee, tick, rawRoots, selectedFrame, loadedImages, hoveredId])
>>>>>>> origin/adhish1

  return (
    <div className={styles.root} style={{ cursor: isPanning ? "grabbing" : "default" }}>
      <canvas ref={canvasRef} className={styles.canvasBase} />
      <canvas ref={overlayRef} className={styles.canvasOverlay} />
    </div>
  )
}

function useImageMap(map: ImageMap) {
  const [state, setState] = useState<Record<string, HTMLImageElement>>({})

<<<<<<< HEAD
  // Build a lightweight key that changes when any src changes (handles HTMLImageElement or string)
=======
>>>>>>> origin/adhish1
  const mapKey = useMemo(() =>
    Object.entries(map)
      .map(([k, v]) => `${k}:${typeof v === "string" ? v : (v && (v as HTMLImageElement).src) ?? ""}`)
      .join("|"),
  [map])

  useEffect(() => {
    let alive = true
    const next: Record<string, HTMLImageElement> = {}
    let pending = 0

    const finish = () => {
      if (alive) setState({ ...next })
    }

    const entries = Object.entries(map)
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
<<<<<<< HEAD
      // Reuse an existing loaded image with same src if present to avoid unnecessary reloads
=======
>>>>>>> origin/adhish1
      const existing = Object.values(state).find((i) => i.src === src)
      if (existing && existing.complete) {
        next[key] = existing
        return
      }

      const img = new Image()
      pending++
<<<<<<< HEAD
      // try to avoid tainting canvas when possible
=======
>>>>>>> origin/adhish1
      try {
        img.crossOrigin = "anonymous"
      } catch {}
      img.onload = () => {
        next[key] = img
        if (--pending === 0) finish()
      }
      img.onerror = () => {
        if (--pending === 0) finish()
      }
      img.src = src
    })

    if (pending === 0) finish()
    return () => {
      alive = false
    }
  }, [mapKey])

  return state
}
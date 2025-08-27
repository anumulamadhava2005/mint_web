/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";

// ---------- Types ----------
type NodeInput = {
  id: string;
  name: string;
  type: string;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  children?: NodeInput[];
  characters?: string;
  textContent?: string | null;
};

type DrawableNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textContent?: string | null;
};

type User = { id: string; handle: string; img_url: string; email?: string };

type ApiResponse =
  | { fileName?: string | null; frames?: NodeInput[]; error?: string }
  | { fileName?: string | null; document?: { children?: NodeInput[] }; error?: string };

// ---------- Helpers ----------
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function rectsIntersect(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
function pointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
function rectContains(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x <= b.x && a.y <= b.y && a.x + a.w >= b.x + b.w && a.y + a.h >= b.y + b.h;
}
function toWorld(clientX: number, clientY: number, rect: DOMRect, offset: { x: number; y: number }, scale: number) {
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const wx = (sx - offset.x) / scale;
  const wy = (sy - offset.y) / scale;
  return { wx, wy, sx, sy };
}

// ---------- Component ----------
export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [fileInput, setFileInput] = useState("");
  const [rawRoots, setRawRoots] = useState<NodeInput[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Viewport (pan/zoom)
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null); // interactions + marquee
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 800 });

  // Interaction keys and mode
  const keysRef = useRef({ ctrl: false, meta: false, shift: false, space: false });
  type Mode = "idle" | "pan" | "marquee" | "drag" | "click";
  const modeRef = useRef<Mode>("idle");

  // Interaction states
  const [isPanning, setIsPanning] = useState(false);
  const [isMarquee, setIsMarquee] = useState(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const marqueeStart = useRef<{ wx: number; wy: number } | null>(null);
  const downScreenRef = useRef<{ x: number; y: number } | null>(null); // for slop

  // Selection and dragging
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dragStartWorld = useRef<{ wx: number; wy: number } | null>(null);
  const originalPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map());
  const [tick, setTick] = useState(0);
  const rerender = () => setTick((t) => (t + 1) & 0xffff);

  // Grid
  const GRID_MAJOR = 100;
  const GRID_MINOR = 20;
  const SNAP = 10; // world units

  const MARQUEE_RULE = "contain" as "touch" | "contain"; // contain => fully inside to select 
  const CLICK_DRAG_SLOP = 4; // pixels to distinguish click vs drag

  const [convertOpen, setConvertOpen] = useState(false); // modal open/close
  const [convertChoice, setConvertChoice] = useState<string | null>(null); // chosen framework 

  const FRAMEWORKS = [
    { id: "react", label: "React" },
    { id: "react-native", label: "React Native" },
    { id: "nextjs", label: "Next.js" },
    { id: "vue", label: "Vue" },
    { id: "svelte", label: "Svelte" },
    { id: "flutter", label: "Flutter" },
  ];

  async function convertFile(target: string) {
    // TODO: implement real conversion request, e.g. POST to /api/convert with file and target
    // await fetch("/api/convert", { method: "POST", body: JSON.stringify({ target, file: rawRoots, fileName }) })
    // For now, just log
    console.log("Converting to:", target, "file:", fileName);
    // Close modal on success
    setConvertOpen(false);
  }

  // Fullscreen sizing
  useEffect(() => {
    const update = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);

  // User
  useEffect(() => {
    fetch("/api/figma/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setUser(data);
      })
      .catch(() => { });
  }, []);

  function onConnect() {
    window.location.href = "/api/auth/login";
  }

  // Keys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = true;
      if (e.key === "Meta") keysRef.current.meta = true;
      if (e.key === "Shift") keysRef.current.shift = true;
      if (e.key === " ") {
        keysRef.current.space = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") keysRef.current.ctrl = false;
      if (e.key === "Meta") keysRef.current.meta = false;
      if (e.key === "Shift") keysRef.current.shift = false;
      if (e.key === " ") {
        keysRef.current.space = false;
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Zoom: Ctrl/Meta + wheel
  useEffect(() => {
    const target = overlayRef.current || canvasRef.current;
    if (!target) return;

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // Ctrl/Meta required 
      e.preventDefault(); // stop browser zoom
      const rect = target.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const intensity = 0.0015;
      const dir = -e.deltaY;
      const next = clamp(scale * (1 + dir * intensity), 0.05, 10);
      const wx = (cx - offset.x) / scale;
      const wy = (cy - offset.y) / scale;
      const nx = cx - wx * next;
      const ny = cy - wy * next;
      setScale(next);
      setOffset({ x: nx, y: ny });
    };

    target.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      target.removeEventListener("wheel", onWheel);
    };
  }, [scale, offset]);

  // Fetch
  async function onFetch() {
    setError(null);
    const key = fileInput.trim();
    if (!key) {
      setError("Please paste a valid Figma file URL or file key.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(key)}`);
      const data: ApiResponse = await res.json();
      if (!res.ok) {
        setError((data as any)?.error ?? "Failed to load frames");
        setRawRoots(null);
        setFileName(null);
      } else {
        let roots: NodeInput[] | null = null;
        if ("frames" in data && Array.isArray(data.frames)) roots = data.frames;
        else if ("document" in data && data.document && Array.isArray(data.document.children)) roots = data.document.children;

        if (!roots || roots.length === 0) {
          setError("No nodes found. Check that your API returns frames or document.children.");
          setRawRoots(null);
        } else {
          setRawRoots(roots);
          setSelectedIds(new Set());
          dragOffsetsRef.current.clear();
        }
        setFileName(data.fileName ?? null);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  // Build drawable (absolute world)
  const drawableNodes = useMemo<DrawableNode[]>(() => {
    if (!rawRoots) return [];
    const out: DrawableNode[] = [];
    const walk = (node: NodeInput, px: number, py: number) => {
      let ax: number | undefined, ay: number | undefined, aw: number | undefined, ah: number | undefined;
      if (node.absoluteBoundingBox) {
        ax = node.absoluteBoundingBox.x;
        ay = node.absoluteBoundingBox.y;
        aw = node.absoluteBoundingBox.width;
        ah = node.absoluteBoundingBox.height;
      } else if (node.x != null && node.y != null && node.width != null && node.height != null) {
        ax = (node.x ?? 0) + px;
        ay = (node.y ?? 0) + py;
        aw = node.width ?? 0;
        ah = node.height ?? 0;
      }
      const text = typeof node.textContent === "string" ? node.textContent : typeof node.characters === "string" ? node.characters : undefined;
      if (ax != null && ay != null && aw != null && ah != null && aw > 0 && ah > 0) {
        out.push({ id: node.id, name: node.name ?? node.id, type: node.type ?? "NODE", x: ax, y: ay, width: aw, height: ah, textContent: text ?? null });
        const nx = node.absoluteBoundingBox ? 0 : (node.x ?? 0) + px;
        const ny = node.absoluteBoundingBox ? 0 : (node.y ?? 0) + py;
        node.children?.forEach((c) => walk(c, nx, ny));
      } else {
        node.children?.forEach((c) => walk(c, px, py));
      }
    };
    rawRoots.forEach((r) => walk(r, 0, 0));
    return out;
  }, [rawRoots]);

  // Fit view
  const fitToScreen = useCallback(() => {
    if (drawableNodes.length === 0) return;
    const pad = 48;
    const minX = Math.min(...drawableNodes.map((n) => n.x));
    const minY = Math.min(...drawableNodes.map((n) => n.y));
    const maxX = Math.max(...drawableNodes.map((n) => n.x + n.width));
    const maxY = Math.max(...drawableNodes.map((n) => n.y + n.height));
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const sx = (viewportSize.width - pad * 2) / worldW;
    const sy = (viewportSize.height - pad * 2) / worldH;
    const s = Math.max(0.05, Math.min(sx, sy));
    setScale(s);
    setOffset({ x: pad - minX * s, y: pad - minY * s });
  }, [drawableNodes, viewportSize]);

  useEffect(() => {
    if (drawableNodes.length > 0) fitToScreen();
  }, [drawableNodes, fitToScreen]);

  // Pointer interactions with mode locking
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    canvas.style.touchAction = "none";
    overlay.style.touchAction = "none";

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { wx, wy } = toWorld(e.clientX, e.clientY, rect, offset, scale);
      lastPointer.current = { x: e.clientX, y: e.clientY };
      downScreenRef.current = { x: e.clientX, y: e.clientY }; // track for click/drag slop

      const isCtrl = e.ctrlKey || e.metaKey;
      const isSpace = keysRef.current.space;

      // Hit test top-down
      let hitId: string | null = null;
      for (let i = drawableNodes.length - 1; i >= 0; i--) {
        const n = drawableNodes[i];
        if (pointInRect(wx, wy, { x: n.x, y: n.y, w: n.width, h: n.height })) {
          hitId = n.id;
          break;
        }
      }

      if (isSpace) {
        modeRef.current = "pan";
        setIsPanning(true);
        overlay.setPointerCapture(e.pointerId);
        return;
      }

      if (isCtrl && !hitId) {
        modeRef.current = "marquee";
        setIsMarquee(true);
        marqueeStart.current = { wx, wy };
        overlay.setPointerCapture(e.pointerId);
        return;
      }

      if (hitId) {
        const toggle = isCtrl; // Ctrl/Meta toggles, no Shift
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (toggle) {
            if (next.has(hitId!)) next.delete(hitId!);
            else next.add(hitId!);
          } else {
            if (!next.has(hitId!) || next.size > 1) {
              next.clear();
              next.add(hitId!);
            }
          }
          return next;
        });

        if (!isCtrl) {
          // candidate click -> escalate to drag only after slop exceeded
          modeRef.current = "click";
          dragStartWorld.current = { wx, wy };
          const map = new Map<string, { x: number; y: number }>();
          const set = new Set(selectedIds);
          set.add(hitId); // ensure hit is included
          drawableNodes.forEach((n) => {
            if (set.has(n.id)) map.set(n.id, { x: n.x, y: n.y });
          });
          originalPositions.current = map;
          dragOffsetsRef.current.clear();
          overlay.setPointerCapture(e.pointerId);
        } else {
          modeRef.current = "click";
        }
        return;
      }

      // empty click without ctrl
      modeRef.current = "click";
      setSelectedIds(new Set());
    };

    const onPointerMove = (e: PointerEvent) => {
      if (modeRef.current === "click" && dragStartWorld.current && downScreenRef.current) {
        const dxs = e.clientX - downScreenRef.current.x;
        const dys = e.clientY - downScreenRef.current.y;
        if (Math.hypot(dxs, dys) >= CLICK_DRAG_SLOP) {
          modeRef.current = "drag"; // begin actual drag
        }
      }
      lastPointer.current = { x: e.clientX, y: e.clientY };

      if (modeRef.current === "pan") {
        const dx = e.movementX;
        const dy = e.movementY;
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
        return;
      }

      if (modeRef.current === "drag" && dragStartWorld.current) {
        const rect = canvas.getBoundingClientRect();
        const { wx, wy } = toWorld(e.clientX, e.clientY, rect, offset, scale);
        let dx = wx - dragStartWorld.current.wx;
        let dy = wy - dragStartWorld.current.wy;
        // Snap
        const sx = Math.round(dx / SNAP) * SNAP;
        const sy = Math.round(dy / SNAP) * SNAP;
        dx = sx;
        dy = sy;

        const offsets = dragOffsetsRef.current;
        offsets.clear();
        originalPositions.current.forEach((_pos, id) => {
          offsets.set(id, { dx, dy });
        });
        rerender();
        return;
      }

      // Marquee: render handled in draw pass using marqueeStart + lastPointer
    };

    const onPointerUp = (e: PointerEvent) => {
      if (modeRef.current === "pan") {
        setIsPanning(false);
      } else if (modeRef.current === "drag" && dragStartWorld.current) {
        // Commit final offsets once
        const offsets = dragOffsetsRef.current;
        if (offsets.size > 0 && rawRoots) {
          const moved = new Set(offsets.keys());
          const apply = (node: NodeInput) => {
            if (moved.has(node.id)) {
              const off = offsets.get(node.id)!;
              if (node.absoluteBoundingBox) {
                node.absoluteBoundingBox.x = (node.absoluteBoundingBox.x ?? 0) + off.dx;
                node.absoluteBoundingBox.y = (node.absoluteBoundingBox.y ?? 0) + off.dy;
              } else {
                if (typeof node.x === "number") node.x = node.x + off.dx;
                if (typeof node.y === "number") node.y = node.y + off.dy;
              }
            }
            node.children?.forEach(apply);
          };
          const next = structuredClone(rawRoots) as NodeInput[];
          next.forEach(apply);
          setRawRoots(next);
        }
        dragStartWorld.current = null;
        dragOffsetsRef.current.clear();
      } else if (modeRef.current === "marquee" && marqueeStart.current) {
        const rect = canvas.getBoundingClientRect();
        const start = marqueeStart.current;
        const { wx: endX, wy: endY } = toWorld(e.clientX, e.clientY, rect, offset, scale);
        const sel = {
          x: Math.min(start.wx, endX),
          y: Math.min(start.wy, endY),
          w: Math.abs(endX - start.wx),
          h: Math.abs(endY - start.wy),
        };
        setSelectedIds(() => {
          const next = new Set<string>();
          for (const n of drawableNodes) {
            const nodeRect = { x: n.x, y: n.y, w: n.width, h: n.height };
            const include = (MARQUEE_RULE === "touch")
              ? rectsIntersect(sel, nodeRect)
              : rectContains(sel, nodeRect);
            if (include) next.add(n.id);


          }
          return next;
        });
        setIsMarquee(false);
        marqueeStart.current = null;
      }

      modeRef.current = "idle";
    };

    overlay.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      overlay.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [drawableNodes, offset, scale, rawRoots]);

  // Fit view once data loads
  const fitView = useCallback(() => {
    fitToScreen();
  }, [fitToScreen]);

  useEffect(() => {
    if (drawableNodes.length > 0) fitView();
  }, [drawableNodes, fitView]);

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    const dpr = window.devicePixelRatio || 1;
    [canvas, overlay].forEach((c) => {
      c.style.width = `${viewportSize.width}px`;
      c.style.height = `${viewportSize.height}px`;
      c.width = Math.floor(viewportSize.width * dpr);
      c.height = Math.floor(viewportSize.height * dpr);
    });

    const ctx = canvas.getContext("2d");
    const octx = overlay.getContext("2d");
    if (!ctx || !octx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

    // Grid
    drawGrid(ctx, viewportSize.width, viewportSize.height, offset, scale, GRID_MAJOR, GRID_MINOR);

    // Draw nodes (apply transient drag offsets if present)
    drawableNodes.forEach((n) => {
      let wx = n.x;
      let wy = n.y;
      const off = dragOffsetsRef.current.get(n.id);
      if (off) {
        wx += off.dx;
        wy += off.dy;
      }

      const x = offset.x + wx * scale;
      const y = offset.y + wy * scale;
      const w = Math.max(0.5, n.width * scale);
      const h = Math.max(0.5, n.height * scale);

      const isText = n.type?.toUpperCase() === "TEXT";
      const stroke = isText ? "#FF5733" : "#3b82f6";
      const fill = isText ? "rgba(255,87,51,0.08)" : "rgba(59,130,246,0.08)";

      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

      if (selectedIds.has(n.id)) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#10b981";
        ctx.setLineDash([3, 10]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "#111";
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(n.name ?? n.id, x + 6, y + 6);
      if (n.textContent) {
        ctx.fillStyle = "#333";
        ctx.font = "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
        const content = n.textContent.replace(/\s+/g, " ").trim();
        const maxChars = Math.max(6, Math.floor((w - 12) / 6));
        const shown = content.length > maxChars ? content.slice(0, maxChars) + "…" : content;
        ctx.fillText(shown, x + 6, y + 22);
      }
    });

    // Overlay: marquee rectangle
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, viewportSize.width, viewportSize.height);
    if (isMarquee && marqueeStart.current && lastPointer.current) {
      const s1x = offset.x + marqueeStart.current.wx * scale;
      const s1y = offset.y + marqueeStart.current.wy * scale;
      const rect = overlay.getBoundingClientRect();
      const s2x = lastPointer.current.x - rect.left;
      const s2y = lastPointer.current.y - rect.top;
      const mx = Math.min(s1x, s2x);
      const my = Math.min(s1y, s2y);
      const mw = Math.abs(s2x - s1x);
      const mh = Math.abs(s2y - s1y);
      octx.fillStyle = "rgba(16, 185, 129, 0.12)";
      octx.strokeStyle = "#10b981";
      octx.lineWidth = 1.5;
      octx.fillRect(mx, my, mw, mh);
      octx.strokeRect(mx, my, mw, mh);
    }
  }, [drawableNodes, viewportSize, offset, scale, selectedIds, isMarquee, tick]);

  // Apply final movement to rawRoots on drag end (committed in pointerup)

  // Grid drawing
  function drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    offset: { x: number; y: number },
    scale: number,
    major: number,
    minor: number
  ) {
    const worldMinX = (-offset.x) / scale;
    const worldMinY = (-offset.y) / scale;
    const worldMaxX = (width - offset.x) / scale;
    const worldMaxY = (height - offset.y) / scale;

    // Minor
    ctx.strokeStyle = "rgba(0,0,0,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startMinorX = Math.floor(worldMinX / minor) * minor;
    const startMinorY = Math.floor(worldMinY / minor) * minor;
    for (let x = startMinorX; x <= worldMaxX; x += minor) {
      const sx = offset.x + x * scale;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let y = startMinorY; y <= worldMaxY; y += minor) {
      const sy = offset.y + y * scale;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();

    // Major
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    const startMajorX = Math.floor(worldMinX / major) * major;
    const startMajorY = Math.floor(worldMinY / major) * major;
    for (let x = startMajorX; x <= worldMaxX; x += major) {
      const sx = offset.x + x * scale;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let y = startMajorY; y <= worldMaxY; y += major) {
      const sy = offset.y + y * scale;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();
  }

  const hasDrawable = drawableNodes.length > 0;

  function ConvertModal({
    open,
    onClose,
    onConfirm,
    choices,
    selected,
    setSelected,
  }: {
    open: boolean;
    onClose: () => void;
    onConfirm: (val: string) => void;
    choices: { id: string; label: string }[];
    selected: string | null;
    setSelected: (v: string) => void;
  }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!open) return;
      // focus on container when opened
      ref.current?.focus();

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50" aria-labelledby="convert-modal-title" role="dialog" aria-modal="true" >
        {/* backdrop /}
<div className="absolute inset-0 bg-black/40" onClick={onClose} />
{/ dialog */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div ref={ref} tabIndex={-1} className="w-full max-w-md rounded-xl bg-white shadow-lg border outline-none" >
            <div className="px-4 py-3 border-b">
              <h2 id="convert-modal-title" className="text-lg font-semibold">
                Choose target framework
              </h2>
            </div>

            <div className="p-4">
              <div className="grid gap-2">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 hover:bg-gray-50 ${selected === c.id ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
                      }`}
                    aria-pressed={selected === c.id}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm border hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selected && onConfirm(selected)}
                className="rounded-lg px-3 py-2 text-sm border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={!selected}
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <main className="min-h-screen w-screen h-screen flex flex-col">
      <div className="p-3 flex items-center gap-3 border-b">
        <h1 className="text-xl font-semibold">Figma Node Visualizer</h1>
        <div className="flex-1" />
        {!user ? (
          <button onClick={onConnect} className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md">
            Connect Figma
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <Image src={user.img_url} alt={user.handle} width={32} height={32} className="w-8 h-8 rounded-full border" />
            <div className="text-sm">
              <div className="font-medium">@{user.handle}</div>
              {user.email && <div className="text-gray-600">{user.email}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center gap-2 border-b">
        <input
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Paste Figma file URL or key"
          value={fileInput}
          onChange={(e) => setFileInput(e.target.value)}
        />
        <button onClick={onFetch} className="rounded-2xl px-4 py-2 shadow border text-sm hover:shadow-md" disabled={loading}>
          {loading ? "Fetching…" : "Fetch"}
        </button>
        <button onClick={fitToScreen} className="rounded-2xl px-3 py-2 shadow border text-sm hover:shadow-md">
          Fit
        </button>
        <button
          onClick={() => { setConvertChoice(null); setConvertOpen(true); }}
          className="rounded-2xl px-3 py-2 shadow border text-sm hover:shadow-md"
          disabled={!rawRoots || rawRoots.length === 0}
        >
          Convert
        </button>
        <div className="text-sm text-gray-700 px-2">Zoom: {(scale * 100).toFixed(0)}%</div>
      </div>

      {error && <div className="text-red-700 bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
      {fileName && <div className="px-3 py-2 text-sm border-b">File: {fileName}</div>}

      <div className={`relative flex-1 bg-white ${convertOpen ? "pointer-events-none" : ""}`} style={{ width: "100vw", height: "100%", overflow: "hidden", cursor: modeRef.current === "pan" ? (isPanning ? "grabbing" : "grab") : modeRef.current === "marquee" ? "crosshair" : "default" }} >
        <canvas ref={canvasRef} className="block absolute inset-0" />
        <canvas ref={overlayRef} className="block absolute inset-0" />
        {!hasDrawable && !loading && !error && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600 text-sm bg-white/80 px-3 py-2 rounded border">
            No drawable nodes. Ensure nodes include absoluteBoundingBox or x, y, width, height.
          </div>
        )}
      </div>
      <ConvertModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={(val) => convertFile(val)}
        choices={FRAMEWORKS}
        selected={convertChoice}
        setSelected={(v) => setConvertChoice(v)}
      />
    </main >
  );
}
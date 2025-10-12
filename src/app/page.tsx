/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import Toolbar from "../../components/ToolBar";
import CanvasStage from "../../components/CanvasStage";
import PropertiesPanel from "../../components/PropertiesPanel";
import ConvertModal from "../../components/ConvertModal";
import { findNodeById } from "../../lib/tree";
import { useDrawable } from "../../hooks/useDrawable";
import { NodeInput, ReferenceFrame } from "../../lib/figma-types";
import Sidebar from "../../components/Sidebar";
import { Home } from "../../components/home";
import { ProjectsPage } from "../../components/ProjectsPage";
import Spinner from "../../components/Spinner";
import styles from "./page.module.css";

/** Immutable, safe updater that preserves children and only changes the target node */
function updateNodeByIdSafe(roots: NodeInput[], id: string, mut: (n: NodeInput) => void): NodeInput[] {
  const rec = (node: NodeInput): NodeInput => {
    if (node.id === id) {
      const cloned: NodeInput = { ...node, children: node.children ? [...node.children] : node.children };
      mut(cloned);
      if (node.children && !cloned.children) cloned.children = [...node.children];
      return cloned;
    }
    if (node.children && node.children.length) {
      let changed = false;
      const nextChildren = node.children.map((c) => {
        const nc = rec(c);
        if (nc !== c) changed = true;
        return nc;
      });
      return changed ? ({ ...node, children: nextChildren } as NodeInput) : node;
    }
    return node;
  };
  return roots.map(rec);
}

type ViewState = { scale: number; offset: { x: number; y: number }; rawRoots: NodeInput[] | null };

function HomePage() {
  async function convertFile(target: string) {
    const nodesToSend = rawRoots ?? [];
    try {
      await requestConversion(
        target.toLowerCase().replace(/\s+/g, "-"),
        nodesToSend as any[],
        fileName || "FigmaFile",
        selectedFrame
      );
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setConvertOpen(false);
    }
  }
  
  const [showConverter, setShowConverter] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRoots, setRawRoots] = useState<NodeInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFrameId, setSelectedFrameId] = useState<string>("");
  const [images, setImages] = useState<Record<string, string | HTMLImageElement>>({});

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [convertOpen, setConvertOpen] = useState(false);

  // State persistence helpers
  const saveStateToStorage = useCallback((state: Partial<{
    fileName: string | null;
    rawRoots: NodeInput[] | null;
    selectedIds: string[];
    selectedFrameId: string;
    images: Record<string, string>;
    scale: number;
    offset: { x: number; y: number };
    lastFileKey: string | null;
  }>) => {
    try {
      const existing = JSON.parse(localStorage.getItem('mint-editor-state') || '{}');
      const merged = { ...existing, ...state, timestamp: Date.now() };
      localStorage.setItem('mint-editor-state', JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, []);

  const loadStateFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('mint-editor-state');
      if (!stored) return null;
      const state = JSON.parse(stored);
      // Only restore if saved within last 24 hours
      if (state.timestamp && (Date.now() - state.timestamp) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('mint-editor-state');
        return null;
      }
      return state;
    } catch (e) {
      console.warn('Failed to load state:', e);
      return null;
    }
  }, []);

  // --- History for undo/redo (track rawRoots + viewport) ---
  const [history, setHistory] = useState<ViewState[]>([]);
  const [redoStack, setRedoStack] = useState<ViewState[]>([]);
  const suppressHistoryRef = useRef(false);

  // Record state changes into history when not performing undo/redo
  useEffect(() => {
    if (suppressHistoryRef.current) {
      // Skip capturing this change and clear the flag for next changes
      suppressHistoryRef.current = false;
      return;
    }
    setHistory((prev) => {
      const nextState: ViewState = { scale, offset, rawRoots };
      const last = prev[prev.length - 1];
      if (
        last &&
        last.scale === nextState.scale &&
        last.offset.x === nextState.offset.x &&
        last.offset.y === nextState.offset.y &&
        last.rawRoots === nextState.rawRoots
      ) {
        return prev; // no-op change
      }
      return [...prev, nextState];
    });
    // Any new branch invalidates redo stack
    setRedoStack([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offset, rawRoots]);

  const handleZoomIn = () => setScale((s) => Math.min(10, s * 1.1));
  const handleZoomOut = () => setScale((s) => Math.max(0.05, s / 1.1));
  const handleZoomReset = () => setScale(1);

  const handleUndo = () => {
    setHistory((curr) => {
      if (curr.length <= 1) return curr;
      const prev = curr[curr.length - 2];
      const present = curr[curr.length - 1];
      // Prevent this state restoration from being re-captured
      suppressHistoryRef.current = true;
      setScale(prev.scale);
      setOffset(prev.offset);
      setRawRoots(prev.rawRoots);
      // Push present onto redo stack
      setRedoStack((r) => [present, ...r]);
      return curr.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setRedoStack((curr) => {
      if (curr.length === 0) return curr;
      const next = curr[0];
      // Prevent this state restoration from being re-captured
      suppressHistoryRef.current = true;
      setScale(next.scale);
      setOffset(next.offset);
      setRawRoots(next.rawRoots);
      // Move next into history and drop from redo
      setHistory((h) => [...h, next]);
      return curr.slice(1);
    });
  };

  const { drawableNodes, frameOptions } = useDrawable(rawRoots);
  const [fitPending, setFitPending] = useState(false);

  const selectedFrame: ReferenceFrame | null = useMemo(
    () => (selectedFrameId ? frameOptions.find((f) => f.id === selectedFrameId) ?? null : null),
    [selectedFrameId, frameOptions]
  );

  const selectedNode = useMemo(() => {
    if (!rawRoots || selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return findNodeById(rawRoots, id);
  }, [rawRoots, selectedIds]);

  function updateSelected(mut: (n: NodeInput) => void) {
    if (!rawRoots || selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    setRawRoots((prev) => (prev ? updateNodeByIdSafe(prev, id, mut) : prev));
  }

  const fitToScreen = useCallback(() => {
    if (!drawableNodes.length) return;
    const pad = 48;
    const minX = Math.min(...drawableNodes.map((n) => n.x));
    const minY = Math.min(...drawableNodes.map((n) => n.y));
    const maxX = Math.max(...drawableNodes.map((n) => n.x + n.width));
    const maxY = Math.max(...drawableNodes.map((n) => n.y + n.height));
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const sx = (window.innerWidth - pad * 2) / worldW;
    const sy = (window.innerHeight - pad * 2) / worldH;
    const s = Math.max(0.05, Math.min(sx, sy));
    setScale(s);
    setOffset({ x: pad - minX * s, y: pad - minY * s });
  }, [drawableNodes]);

  async function fetchUser() {
    try {
      const res = await fetch("/api/figma/me");
      const data = await res.json();
      if (!data.error) {
        setUser(data);
        setLoading(false);
        return data;
      }
    } catch {}
    setLoading(false);
    return null;
  }

  // Check URL hash on mount to determine which page to show
  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      
      if (hash === '#projects') {
        setShowProjects(true);
        setShowConverter(false);
      } else if (hash.startsWith('#project=')) {
        // Coming from projects page with a specific project
        const projectId = hash.replace('#project=', '');
        loadProjectById(projectId);
        setShowProjects(false);
        setShowConverter(false);
      } else {
        setShowProjects(false);
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  // Load project from storage when opening from projects page
  function loadProjectById(projectId: string) {
    try {
      const stored = sessionStorage.getItem('currentProject');
      if (stored) {
        const project = JSON.parse(stored);
        if (project.id === projectId) {
          setFileName(project.name);
          setRawRoots(project.rawRoots);
          setLastFileKey(project.fileKey);
          setFitPending(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from sessionStorage:', e);
    }
    
    // Fallback to window object
    const project = (window as any).__currentProject;
    if (project && project.id === projectId) {
      setFileName(project.name);
      setRawRoots(project.rawRoots);
      setLastFileKey(project.fileKey);
      setFitPending(true);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('logged_in');
    fetchUser().then((userData) => {
      if (justLoggedIn && userData) {
        // Redirect to projects page after login
        window.location.href = '/#projects';
      }
    });
  }, []);

  useEffect(() => {
    if (user && !rawRoots && !showConverter && !showProjects) {
      setShowConverter(true);
    }
  }, [user, rawRoots, showConverter, showProjects]);

  // Restore state on mount
  useEffect(() => {
    const savedState = loadStateFromStorage();
    if (savedState) {
      if (savedState.fileName) setFileName(savedState.fileName);
      if (savedState.rawRoots) setRawRoots(savedState.rawRoots);
      if (savedState.selectedIds && Array.isArray(savedState.selectedIds)) {
        setSelectedIds(new Set(savedState.selectedIds));
      }
      if (savedState.selectedFrameId) setSelectedFrameId(savedState.selectedFrameId);
      if (savedState.images) {
        // Only restore string URLs, not HTMLImageElement instances
        const stringImages: Record<string, string> = {};
        Object.entries(savedState.images).forEach(([key, value]) => {
          if (typeof value === 'string') stringImages[key] = value;
        });
        setImages(stringImages);
      }
      if (typeof savedState.scale === 'number') setScale(savedState.scale);
      if (savedState.offset && typeof savedState.offset.x === 'number' && typeof savedState.offset.y === 'number') {
        setOffset(savedState.offset);
      }
    }
  }, [loadStateFromStorage]);

  // Save state on changes
  useEffect(() => {
    if (rawRoots || fileName || Object.keys(images).length > 0) {
      // Convert images to serializable format (only strings)
      const serializableImages: Record<string, string> = {};
      Object.entries(images).forEach(([key, value]) => {
        if (typeof value === 'string') serializableImages[key] = value;
      });
      
      saveStateToStorage({
        fileName,
        rawRoots,
        selectedIds: Array.from(selectedIds),
        selectedFrameId,
        images: serializableImages,
        scale,
        offset
      });
    }
  }, [rawRoots, fileName, selectedIds, selectedFrameId, images, scale, offset, saveStateToStorage]);

  async function onFetch(fileUrlOrKey: string) {
    setError(null);
    const key = fileUrlOrKey.trim();
    if (!key) {
      setError("Please paste a valid Figma file URL or key.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(key)}`);
      if (!res.ok) {
        let errorMessage = "Failed to load frames";
        try {
          const errorData = await res.json();
          errorMessage = errorData?.error || errorData?.err || errorMessage;
        } catch {
          try {
            const errorText = await res.text();
            errorMessage = errorText || errorMessage;
          } catch {
            errorMessage = res.statusText || errorMessage;
          }
        }
        setError(errorMessage);
        setRawRoots(null);
        setFileName(null);
        setLastFileKey(null);
        return;
      }
      const data = await res.json();
      let roots: NodeInput[] | null = null;
      let fName: string | null = null;
      let fileKey: string | null = null;

      if ("extracted" in data && Array.isArray(data.extracted)) {
        roots = data.extracted as NodeInput[];
        if ((data as any).raw?.name) fName = (data as any).raw.name;
        else if ((data as any).raw?.document?.name) fName = (data as any).raw.document.name;
        if ((data as any).raw?.key) fileKey = (data as any).raw.key;
      } else if ("frames" in data && Array.isArray(data.frames)) {
        roots = data.frames as NodeInput[];
        fName = (data as any).fileName ?? null;
        fileKey = (data as any).fileKey ?? null;
      } else if ("document" in data && (data as any).document && Array.isArray((data as any).document.children)) {
        roots = (data as any).document.children as NodeInput[];
        fName = (data as any).fileName ?? null;
        fileKey = (data as any).fileKey ?? null;
      }

      if (!roots || roots.length === 0) {
        setError("No nodes found. Check that your API returns frames, document.children, or extracted nodes.");
        setRawRoots(null);
        setLastFileKey(null);
      } else {
        setRawRoots(roots);
        setSelectedIds(new Set());
        setFitPending(true);
        setLastFileKey(fileKey ?? key);
      }
      setFileName(fName);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setLastFileKey(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-fit after new nodes are loaded
  useEffect(() => {
    if (fitPending && drawableNodes.length) {
      fitToScreen();
      setFitPending(false);
    }
  }, [fitPending, drawableNodes, fitToScreen]);

  async function requestConversion(target: string, nodes: any[], name: string | null, referenceFrame: ReferenceFrame | null) {
    const res = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, fileName: name || "figma-project", nodes, referenceFrame }),
    });
    if (!res.ok) throw new Error((await res.text()) || "Conversion failed");
    const blob = await res.blob();
    const safeName = `${(name || "figma-project").replace(/\s+/g, "-")}-${target}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImageChange(key: string, url: string) {
    setImages((prev) => {
      const next = { ...prev };
      if (!url) delete next[key];
      else next[key] = url;
      return next;
    });
  }

  // Logout handler: clear cookies and user state
  function handleLogout() {
    const cookiesToClear = [
      "session", ".session", "token", "auth", "user", "sid", "figma_access", "figma_refresh"
    ];
    cookiesToClear.forEach((name) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
    setUser(null);
    setShowConverter(false);
    setShowProjects(false);
    setFileName(null);
    setRawRoots(null);
    setError(null);
    setSelectedIds(new Set());
    setSelectedFrameId("");
  }

  // Track the last loaded file key for use in commitLive
  const [lastFileKey, setLastFileKey] = useState<string | null>(null);

  // NEW: success modal state for commitLive
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string | null>(null);

  // helpers: flatten tree, rect ops, synthetic root and spatial nesting
  function flattenNodes(nodes: any[], out: any[] = []) {
    (nodes || []).forEach((n) => {
      out.push(n);
      if (Array.isArray(n.children) && n.children.length) flattenNodes(n.children, out);
    });
    return out;
  }

  function rectOverlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    const ax1 = a.x, ay1 = a.y, ax2 = a.x + (a.w || 0);
    const ay2 = a.y + (a.h || 0);
    const bx1 = b.x, by1 = b.y, bx2 = b.x + (b.w || 0);
    const by2 = b.y + (b.h || 0);
    return !(bx1 >= ax2 || bx2 <= ax1 || by1 >= ay2 || by2 <= ay1);
  }

  function rectContains(outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) {
    return (inner.x >= outer.x && inner.y >= outer.y && (inner.x + (inner.w || 0)) <= (outer.x + (outer.w || 0)) && (inner.y + (inner.h || 0)) <= (outer.y + (outer.h || 0)));
  }

  function makeSyntheticRootFromRef(ref: ReferenceFrame): any {
    return {
      id: `__ref__${ref.id}`,
      name: ref.id ?? "ref",
      type: "FRAME",
      ax: ref.x ?? 0,
      ay: ref.y ?? 0,
      x: 0,
      y: 0,
      w: Math.round(ref.width ?? 0),
      h: Math.round(ref.height ?? 0),
      textRaw: "",
      fill: null,
      stroke: null,
      corners: { uniform: null, topLeft: null, topRight: null, bottomRight: null, bottomLeft: null },
      effects: [],
      text: null,
      children: [] as any[],
    };
  }

  function rebuildSubtree(node: any, insideSet: Set<string>, ref: ReferenceFrame): any {
    const clone = JSON.parse(JSON.stringify(node));
    clone.x = Math.round((node.ax ?? node.x ?? 0) - (ref.x ?? 0));
    clone.y = Math.round((node.ay ?? node.y ?? 0) - (ref.y ?? 0));
    clone.w = Math.round(node.w ?? node.width ?? 0);
    clone.h = Math.round(node.h ?? node.height ?? 0);
    clone.width = clone.width ?? clone.w;
    clone.height = clone.height ?? clone.h;
    if (Array.isArray(node.children) && node.children.length) {
      clone.children = node.children
        .filter((c: any) => insideSet.has(String(c.id)))
        .map((c: any) => rebuildSubtree(c, insideSet, ref));
    } else {
      clone.children = [];
    }
    return clone;
  }

  async function commitLive() {
    try {
      if (!lastFileKey) {
        alert("Open a Figma file first so the fileKey is known.");
        return;
      }

      const normalizedKey = extractFileKey(lastFileKey) ?? lastFileKey;

      const refW = selectedFrame?.width ??
        Math.max(1, ...drawableNodes.map(n => n.x + n.width)) - Math.min(0, ...drawableNodes.map(n => n.x));
      const refH = selectedFrame?.height ??
        Math.max(1, ...drawableNodes.map(n => n.y + n.height)) - Math.min(0, ...drawableNodes.map(n => n.y));

      const sourceNodes = rawRoots ?? [];

      let computedRoots: any[] = [];
      if (selectedFrame) {
        const ref = selectedFrame;
        const refNode = sourceNodes && findNodeById(sourceNodes, ref.id);
        if (refNode && Array.isArray(refNode.children) && refNode.children.length > 0) {
          computedRoots = [refNode];
        } else {
          const syntheticRoot = makeSyntheticRootFromRef(ref);
          const all = flattenNodes(sourceNodes);
          const allById = new Map<string, any>();
          all.forEach((n) => { if (n && n.id) allById.set(String(n.id), n); });

          const inside = all.filter((n) => {
            const nodeRect = { x: Number(n.ax ?? n.x ?? 0), y: Number(n.ay ?? n.y ?? 0), w: Number(n.w ?? n.width ?? 0), h: Number(n.h ?? n.height ?? 0) };
            const refRect = { x: Number(ref.x ?? 0), y: Number(ref.y ?? 0), w: Number(ref.width ?? 0), h: Number(ref.height ?? 0) };
            return rectOverlaps(refRect, nodeRect);
          });

          const insideSet = new Set(inside.map((n) => String(n.id)));

          const topLevel = inside.filter((n) => {
            return !inside.some((p) => p !== n && rectContains({ x: p.ax ?? p.x ?? 0, y: p.ay ?? p.y ?? 0, w: p.w ?? p.width ?? 0, h: p.h ?? p.height ?? 0 },
                                                                 { x: n.ax ?? n.x ?? 0, y: n.ay ?? n.y ?? 0, w: n.w ?? n.width ?? 0, h: n.h ?? n.height ?? 0 }));
          });

          syntheticRoot.children = topLevel.map((t) => rebuildSubtree(t, insideSet, ref));
          computedRoots = [syntheticRoot];
        }
      } else {
        computedRoots = sourceNodes;
      }

      const payloadRoots = computedRoots;

      const payload = {
        fileKey: normalizedKey,
        roots: payloadRoots,
        refW: Math.round(refW),
        refH: Math.round(refH),
        fileName: fileName ?? undefined,
        images,
        referenceFrame: selectedFrame ?? null,
        forcePublish: true,
        cacheBuster: Date.now(),
      };

      const res = await fetch("/api/live/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Publish failed");
      }

      let msg = "Published successfully";
      try {
        const text = await res.text();
        if (text) {
          try {
            const j = JSON.parse(text);
            if (j?.message) msg = j.message;
            else if (typeof text === "string" && text.trim()) msg = text;
          } catch {
            msg = text;
          }
        }
      } catch {
        /* ignore parsing errors */
      }

      setCommitMessage(msg);
      setCommitSuccess(true);
    } catch (e: any) {
      alert(e?.message || String(e));
    }
  }

  useEffect(() => {
    if (!commitSuccess) return;
    const t = setTimeout(() => setCommitSuccess(false), 3000);
    return () => clearTimeout(t);
  }, [commitSuccess]);

  // Show projects page if routed there
  if (showProjects) {
    return <ProjectsPage />;
  }

  // Show landing page if not logged in and no data
  if (!showConverter && !rawRoots && !user && !loading) {
    return <Home onGetStarted={() => setShowConverter(true)} />;
  }

  return (
    <div className={styles.root}>
<<<<<<< HEAD
      {loading && <Spinner />}
=======
      {loading && !rawRoots && !user && <Spinner />}
>>>>>>> origin/adhish1
      
      {/* Toolbar - Top bar with dark theme */}
      <div className={styles.toolbarBar}>
        <Toolbar
          user={user}
          onConnect={() => (window.location.href = "/api/auth/login")}
          onMountFetchUser={fetchUser}
          fileName={fileName}
          loading={loading}
          onFetch={onFetch}
          frameOptions={frameOptions}
          selectedFrameId={selectedFrameId}
          setSelectedFrameId={setSelectedFrameId}
          fitToScreen={fitToScreen}
          openConvert={() => setConvertOpen(true)}
          zoomPct={scale * 100}
          onLogout={handleLogout}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={history.length > 1}
          canRedo={redoStack.length > 0}
          onCommit={commitLive}
          onNavigateProjects={() => window.location.href = '/#projects'}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Main Content Area - 3 column layout */}
      <div className={styles.main}>
        {/* Left Sidebar - Layers Panel */}
        <Sidebar
          rawRoots={rawRoots}
          setRawRoots={setRawRoots}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          selectedFrameId={selectedFrameId}
          setSelectedFrameId={setSelectedFrameId}
        />

        {/* Center Canvas */}
        <div className={styles.center}>
          <CanvasStage
            rawRoots={rawRoots}
            setRawRoots={setRawRoots}
            drawableNodes={drawableNodes}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            scale={scale}
            setScale={setScale}
            offset={offset}
            setOffset={setOffset}
            selectedFrame={selectedFrame}
            images={images}
          />
        </div>

        {/* Right Sidebar - Properties Panel */}
        {selectedNode && (
          <PropertiesPanel
            selectedNode={selectedNode}
            onUpdateSelected={updateSelected}
            onImageChange={(id, url) => handleImageChange(id, url)}
            onClose={() => setSelectedIds(new Set())}
          />
        )}
      </div>

      {/* Convert Modal */}
      <ConvertModal 
        open={convertOpen} 
        onClose={() => setConvertOpen(false)} 
        onConfirm={(val) => convertFile(val)} 
      />

      {/* Success Modal */}
      {commitSuccess && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
            zIndex: 2000,
          }}
          onClick={() => setCommitSuccess(false)}
        >
          <div
            style={{
              minWidth: 260,
              maxWidth: "80%",
              padding: 16,
              borderRadius: 8,
              background: "white",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 12, fontWeight: 600 }}>{commitMessage ?? "Success"}</div>
            <div style={{ fontSize: 13, color: "#444", marginBottom: 12 }}>Your changes were published.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setCommitSuccess(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;

function extractFileKey(lastFileKey: string) {
  // Handles both raw file keys and Figma URLs
  const urlMatch = lastFileKey.match(/figma\.com\/file\/([a-zA-Z0-9]{20,})/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9]{20,}$/.test(lastFileKey)) return lastFileKey;
  return null;
}
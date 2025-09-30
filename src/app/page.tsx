/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Toolbar from "../../components/ToolBar";
import CanvasStage from "../../components/CanvasStage";
import PropertiesPanel from "../../components/PropertiesPanel";
import ConvertModal from "../../components/ConvertModal";
import { findNodeById } from "../../lib/tree";
import { useDrawable } from "../../hooks/useDrawable";
import { NodeInput, ReferenceFrame } from "../../lib/figma-types";
import Sidebar from "../../components/Sidebar";
import Home from "./home";

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
      return changed ? { ...node, children: nextChildren } as NodeInput : node;
    }
    return node;
  };
  return roots.map(rec);
}

export default function Page() {
  const [showConverter, setShowConverter] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRoots, setRawRoots] = useState<NodeInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFrameId, setSelectedFrameId] = useState<string>("");
  const [images, setImages] = useState<Record<string, string | HTMLImageElement>>({});

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [convertOpen, setConvertOpen] = useState(false);

  const { drawableNodes, frameOptions } = useDrawable(rawRoots);

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
        return data;
      }
    } catch { }
    return null;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('logged_in');
    
    fetchUser().then((userData) => {
      if (justLoggedIn && userData) {
        setShowConverter(true);
        window.history.replaceState({}, '', '/');
      }
    });
  }, []);

  useEffect(() => {
    if (user && !rawRoots && !showConverter) {
      setShowConverter(true);
    }
  }, [user, rawRoots, showConverter]);

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
        return;
      }
      const data = await res.json();
      let roots: NodeInput[] | null = null;
      let fName: string | null = null;

      if ("extracted" in data && Array.isArray(data.extracted)) {
        roots = data.extracted as NodeInput[];
        if ((data as any).raw?.name) fName = (data as any).raw.name;
        else if ((data as any).raw?.document?.name) fName = (data as any).raw.document.name;
      } else if ("frames" in data && Array.isArray(data.frames)) {
        roots = data.frames as NodeInput[];
        fName = (data as any).fileName ?? null;
      } else if ("document" in data && (data as any).document && Array.isArray((data as any).document.children)) {
        roots = (data as any).document.children as NodeInput[];
        fName = (data as any).fileName ?? null;
      }

      if (!roots || roots.length === 0) {
        setError("No nodes found. Check that your API returns frames, document.children, or extracted nodes.");
        setRawRoots(null);
      } else {
        setRawRoots(roots);
        setSelectedIds(new Set());
      }
      setFileName(fName);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

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

  async function convertFile(target: string) {
    const nodesToSend = rawRoots ?? [];
    try {
      await requestConversion(target.toLowerCase().replace(/\s+/g, "-"), nodesToSend as any[], fileName || "FigmaFile", selectedFrame);
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setConvertOpen(false);
    }
  }

  function handleImageChange(key: string, url: string) {
    setImages((prev) => {
      const next = { ...prev };
      if (!url) delete next[key];
      else next[key] = url;
      return next;
    });
  }

  if (!showConverter && !rawRoots && !user) {
    return <Home onGetStarted={() => setShowConverter(true)} />;
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-white overflow-hidden">
      {/* Toolbar - Top bar with dark theme */}
      <div className="bg-gray-900 border-b border-gray-800 flex-shrink-0">
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
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border-b border-red-800/30 text-red-300 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Main Content Area - 3 column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
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
        <div className="flex-1 bg-gray-900 overflow-hidden relative">
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
            //images={images}
            onImageChange={(id, url) => handleImageChange(id, url)}
          />
        )}
      </div>

      {/* Convert Modal */}
      <ConvertModal 
        open={convertOpen} 
        onClose={() => setConvertOpen(false)} 
        onConfirm={(val) => convertFile(val)} 
      />
    </div>
  );
}
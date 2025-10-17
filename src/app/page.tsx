/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
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
import FrameDock from "../../components/FrameDock";
import dynamic from 'next/dynamic';



// Prevent SSR for ProjectsPage to avoid hydration mismatch
const ProjectsPage = dynamic(
  () => import('../../components/ProjectsPage'),
  { ssr: false, loading: () => null }
);
import styles from "./page.module.css";

// NEW: interaction type for element/frame connections
type Interaction = {
  id: string;
  sourceId: string;
  targetId: string;
  type: "navigation" | "animation";
  trigger: "onClick" | "onTap";
  animation?: {
    name: "none" | "fade" | "slide" | "zoom";
    durationMs?: number;
    easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    direction?: "left" | "right" | "up" | "down";
  };
};

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
  const [mounted, setMounted] = useState(false);

  // On client mount, mark mounted and show projects if URL hash is #projects
  useEffect(() => {
    setMounted(true);
    if (window.location.hash === '#projects') {
      setShowProjects(true);
    }
  }, []);

  const [user, setUser] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRoots, setRawRoots] = useState<NodeInput[] | null>(null);
  const [originalRawRoots, setOriginalRawRoots] = useState<NodeInput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFileKey, setLastFileKey] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFrameId, setSelectedFrameId] = useState<string>("");
  const [images, setImages] = useState<Record<string, string | HTMLImageElement>>({});
  // NEW: interactions state
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  // NEW: UI state for adding a connection
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [connectTargetId, setConnectTargetId] = useState<string>("");
  const [connectType, setConnectType] = useState<Interaction["type"]>("navigation");
  const [connectTrigger, setConnectTrigger] = useState<Interaction["trigger"]>("onClick");
  const [connectAnimationName, setConnectAnimationName] = useState<NonNullable<Interaction["animation"]>["name"]>("none");
  const [connectAnimationDuration, setConnectAnimationDuration] = useState<number>(300);
  const [connectAnimationEasing, setConnectAnimationEasing] = useState<NonNullable<Interaction["animation"]>["easing"]>("ease-in-out");
  const [connectAnimationDirection, setConnectAnimationDirection] = useState<NonNullable<Interaction["animation"]>["direction"]>("right");

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [convertOpen, setConvertOpen] = useState(false);

  // State persistence helpers
  const saveStateToStorage = useCallback((state: Partial<{
    fileName: string | null;
    originalRawRoots: NodeInput[] | null;
    selectedIds: string[];
    selectedFrameId: string;
    images: Record<string, string>;
    scale: number;
    offset: { x: number; y: number };
    lastFileKey: string | null;
    // NEW: persist interactions
    interactions: Interaction[];
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

  // --- Persist rawRoots (frames) to localStorage ---
  useEffect(() => {
    if (rawRoots) {
      try {
        localStorage.setItem('mint-frames', JSON.stringify(rawRoots));
      } catch (e) {
        console.warn('Failed to save frames to localStorage:', e);
      }
    }
  }, [rawRoots]);

  // --- Load persisted frames on mount ---
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mint-frames');
      if (stored && !rawRoots) {
        const frames = JSON.parse(stored);
        if (Array.isArray(frames)) {
          setRawRoots(frames);
        }
      }
    } catch (e) {
      console.warn('Failed to load frames from localStorage:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      console.log('Hash changed:', hash);
      
      if (hash === '#projects') {
        console.log('Setting showProjects = true');
        setShowProjects(true);
        setShowConverter(false);
        return;
      } 
      
      if (hash.startsWith('#project=')) {
        // Coming from projects page with a specific project
        const projectId = hash.replace('#project=', '');
        console.log('Loading project:', projectId);
        loadProjectById(projectId);
        setShowProjects(false);
        setShowConverter(false);
        return;
      }
      
      // If no hash or other hash, don't force any view
      // Let other effects handle showing converter, etc.
    };

    // Initial check on mount
    checkRoute();
    
    // Also listen for hash changes
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);  // Empty dependency array - only run on mount

  // Load project from storage when opening from projects page
  function loadProjectById(projectId: string) {
    console.log('loadProjectById called with:', projectId);
    try {
      // First try sessionStorage (for current session)
      const stored = sessionStorage.getItem('currentProject');
      if (stored) {
        const project = JSON.parse(stored);
        if (project.id === projectId) {
          console.log('Loaded project from sessionStorage');
          setFileName(project.name);
          setRawRoots(project.rawRoots);
          setOriginalRawRoots(project.rawRoots);
          setLastFileKey(project.fileKey);
          // Restore viewport if saved
          if (typeof project.scale === 'number') setScale(project.scale);
          if (project.offset) setOffset(project.offset);
          else setFitPending(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Failed to load from sessionStorage:', e);
    }
    
    // Try localStorage as backup (persists across refreshes)
    try {
      const stored = localStorage.getItem(`project-${projectId}`);
      if (stored) {
        const project = JSON.parse(stored);
        console.log('Loaded project from localStorage');
        setFileName(project.name);
        setRawRoots(project.rawRoots);
        setOriginalRawRoots(project.rawRoots);
        setLastFileKey(project.fileKey);
        // Restore viewport if saved
        if (typeof project.scale === 'number') setScale(project.scale);
        if (project.offset) setOffset(project.offset);
        else setFitPending(true);
        return;
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
    
    // Fallback to window object
    const project = (window as any).__currentProject;
    if (project && project.id === projectId) {
      console.log('Loaded project from window object');
      setFileName(project.name);
      setRawRoots(project.rawRoots);
      setOriginalRawRoots(project.rawRoots);
      setLastFileKey(project.fileKey);
      if (typeof project.scale === 'number') setScale(project.scale);
      if (project.offset) setOffset(project.offset);
      else setFitPending(true);
      return;
    }

    // If not found in storage, fetch from API
    console.log('Fetching project from API:', projectId);
    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.project) {
          const project = data.project;
          console.log('Loaded project from API');
          setFileName(project.name);
          setRawRoots(project.rawRoots || []);
          setOriginalRawRoots(project.rawRoots || []);
          setLastFileKey(project.fileKey);
          setFitPending(true);
          // Store in sessionStorage and localStorage for next reload
          sessionStorage.setItem('currentProject', JSON.stringify(project));
          localStorage.setItem(`project-${projectId}`, JSON.stringify(project));
          (window as any).__currentProject = project;
        }
      })
      .catch(err => console.error('Failed to fetch project from API:', err));
  }


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justLoggedIn = params.get('logged_in');
    
    // Check if user is already authenticated
    fetchUser().then((userData) => {
      if (justLoggedIn && userData) {
        // Redirect to projects page after login
        window.location.href = '/#projects';
      }
      
      // If not logged in after checking, show home
      if (!userData) {
        console.log('User not authenticated, keeping home view');
        // Don't show converter or projects - user must log in
      } else {
        console.log('User authenticated:', userData);
      }
    });
  }, []);

  useEffect(() => {
    if (user && !rawRoots && !showConverter && !showProjects) {
      setShowConverter(true);
    }
  }, [user, rawRoots, showConverter, showProjects]);

  // Restore state on mount (but skip if we're loading a specific project)
  useEffect(() => {
    const hash = window.location.hash;
    const isLoadingProject = hash.startsWith('#project=');
    
    // Always try to restore canvas view state (scale, offset, selections, etc.)
    // This applies both to fresh projects and when viewing existing projects
    const savedState = loadStateFromStorage();
    if (savedState) {
      // Always restore view state (zoom, pan, selections)
      if (savedState.selectedIds && Array.isArray(savedState.selectedIds)) {
        setSelectedIds(new Set(savedState.selectedIds));
      }
      if (savedState.selectedFrameId) setSelectedFrameId(savedState.selectedFrameId);
      if (typeof savedState.scale === 'number') setScale(savedState.scale);
      if (savedState.offset && typeof savedState.offset.x === 'number' && typeof savedState.offset.y === 'number') {
        setOffset(savedState.offset);
      }
      
      // Restore interactions
      if (Array.isArray(savedState.interactions)) setInteractions(savedState.interactions);
    }
    
    // Only restore full document state if NOT loading a specific project
    // (project data comes from the project itself, not localStorage)
    if (!isLoadingProject) {
      console.log('Restoring full document state from localStorage');
      if (savedState) {
        if (savedState.fileName) setFileName(savedState.fileName);
        if (savedState.originalRawRoots) {
          setRawRoots(savedState.originalRawRoots);
          setOriginalRawRoots(savedState.originalRawRoots);
        }
        if (savedState.images) {
          // Only restore string URLs, not HTMLImageElement instances
          const stringImages: Record<string, string> = {};
          Object.entries(savedState.images).forEach(([key, value]) => {
            if (typeof value === 'string') stringImages[key] = value;
          });
          setImages(stringImages);
        }
      }
    }
  }, [loadStateFromStorage]);

  // Save state on changes
  useEffect(() => {
    const hash = window.location.hash;
    const isViewingProject = hash.startsWith('#project=');
    const projectId = isViewingProject ? hash.replace('#project=', '') : null;
    
    // Always save canvas view state (zoom, pan, selections)
    // But only save full document state if NOT viewing a specific project
    // (because project state is managed separately)
    if (isViewingProject && projectId && fileName && rawRoots) {
      // For projects: save both view state AND the updated project data
      const serializableImages: Record<string, string> = {};
      Object.entries(images).forEach(([key, value]) => {
        if (typeof value === 'string') serializableImages[key] = value;
      });
      
      // Save view state
      saveStateToStorage({
        selectedIds: Array.from(selectedIds),
        selectedFrameId,
        images: serializableImages,
        scale,
        offset,
        interactions,
      });
      
      // Also save project data for persistence across refreshes
      try {
        const projectData = {
          id: projectId,
          name: fileName,
          rawRoots: rawRoots,
          fileKey: lastFileKey,
          scale, // Save scale with project
          offset, // Save offset with project
        };
        localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));
        sessionStorage.setItem('currentProject', JSON.stringify(projectData));
      } catch (e) {
        console.warn('Failed to save project data:', e);
      }
    } else if (!isViewingProject) {
      // Save full state for non-project work
      if (rawRoots || fileName || Object.keys(images).length > 0 || interactions.length > 0) {
        const serializableImages: Record<string, string> = {};
        Object.entries(images).forEach(([key, value]) => {
          if (typeof value === 'string') serializableImages[key] = value;
        });
        
        saveStateToStorage({
          fileName,
          originalRawRoots,
          selectedIds: Array.from(selectedIds),
          selectedFrameId,
          images: serializableImages,
          scale,
          offset,
          interactions,
        });
      }
    }
  }, [rawRoots, fileName, selectedIds, selectedFrameId, images, scale, offset, saveStateToStorage, interactions, lastFileKey]);
  async function onFetch(fileUrlOrKey: string) {
    setError(null);
    const key = fileUrlOrKey.trim();
    if (!key) {
      setError("Please paste a valid Figma file URL or key.");
      return;
    }
    setLoading(true);
    try {
      console.log('Fetching Figma file:', key);
      const res = await fetch(`/api/figma/frames?fileUrl=${encodeURIComponent(key)}`);
      console.log('Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        let errorMessage = "Failed to load frames";
        try {
          const errorData = await res.json();
          console.error('Error data:', errorData);
          errorMessage = errorData?.error || errorData?.err || errorMessage;
        } catch {
          try {
            const errorText = await res.text();
            console.error('Error text:', errorText);
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
      console.log('Figma data received:', {
        hasExtracted: 'extracted' in data,
        hasFrames: 'frames' in data,
        hasDocument: 'document' in data,
        extractedCount: Array.isArray(data.extracted) ? data.extracted.length : 0,
      });
      
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

      console.log('Extracted roots:', { count: roots?.length || 0, fileName: fName });

      if (!roots || roots.length === 0) {
        setError("No nodes found. Check that your API returns frames, document.children, or extracted nodes.");
        setRawRoots(null);
        setLastFileKey(null);
      } else {
        setRawRoots(roots);
        setOriginalRawRoots(roots);
        setSelectedIds(new Set());
        setFitPending(true);
        setLastFileKey(fileKey ?? key);
      }
      setFileName(fName);
    } catch (e: any) {
      console.error('Error fetching Figma file:', e);
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
      body: JSON.stringify({
        target,
        fileName: name || "figma-project",
        nodes,
        referenceFrame,
        // NEW: include interactions for conversion
        interactions,
      }),
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
  // Reset canvas to original state: nodes, selection, zoom, pan
  const [resetKey, setResetKey] = useState(0);
  const handleResetCanvas = () => {
    if (!originalRawRoots) return;
    setRawRoots(originalRawRoots);
    setSelectedIds(new Set());
    setSelectedFrameId('');
    // Reset zoom and pan to fit the original nodes
    fitToScreen();
    // Trigger CanvasStage to sync zoom/pan
    setResetKey((k) => k + 1);
  };

  function handleImageChange(key: string, url: string) {
    setImages((prev) => {
      const next = { ...prev };
      if (!url) delete next[key];
      else {
        // Store the image with BOTH the nodeId key AND the URL as key
        // This ensures we can find it by either reference
        next[key] = url;
        // Also store by URL so it can be found when rendering
        if (typeof url === 'string' && url.length > 0) {
          next[url] = url;
        }
      }
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

  // Track the last loaded file key for use in commitLive (defined earlier in the file)

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

  // NEW: parent index builder for grouping/ungrouping
  const buildParentIndex = useCallback((roots: NodeInput[]) => {
    const parentById = new Map<string, { parentId: string | null; index: number }>();
    const walk = (arr: NodeInput[] | undefined | null, parentId: string | null) => {
      (arr || []).forEach((n, i) => {
        parentById.set(n.id, { parentId, index: i });
        if (n.children && n.children.length) walk(n.children as NodeInput[], n.id);
      });
    };
    walk(roots, null);
    return parentById;
  }, []);

  // NEW: delete selected nodes
  const deleteSelected = useCallback(() => {
    if (!rawRoots || selectedIds.size === 0) return;
    const ids = new Set(selectedIds);
    const rec = (node: any): any | null => {
      if (ids.has(node.id)) return null;
      if (Array.isArray(node.children) && node.children.length) {
        let changed = false;
        const nextChildren: any[] = [];
        for (const c of node.children) {
          const r = rec(c);
          if (r === null) {
            changed = true;
            continue;
          }
          if (r !== c) changed = true;
          nextChildren.push(r);
        }
        if (changed) return { ...node, children: nextChildren };
      }
      return node;
    };
    const nextRoots = (rawRoots.map((r) => rec(r)).filter(Boolean) as unknown) as NodeInput[];
    setRawRoots(nextRoots);
    if (selectedFrameId && ids.has(selectedFrameId)) setSelectedFrameId("");
    setSelectedIds(new Set());
    // prune interactions where source or target was deleted
    setInteractions((prev) => prev.filter((it) => !ids.has(it.sourceId) && !ids.has(it.targetId)));
  }, [rawRoots, selectedIds, selectedFrameId]);

  // NEW: group selected nodes (requires same parent)
  const groupSelected = useCallback(() => {
    if (!rawRoots || selectedIds.size < 2) return;
    const idsArr = Array.from(selectedIds);
    const parentIndex = buildParentIndex(rawRoots);
    const parents = new Set<string | null>(idsArr.map((id) => parentIndex.get(id)?.parentId ?? null));
    if (parents.size !== 1) {
      alert("Select nodes with the same parent to group.");
      return;
    }
    const parentId = parents.values().next().value as string | null;
    const parentNode = parentId ? (findNodeById(rawRoots, parentId) as any) : null;
    const collection: any[] = parentNode ? (parentNode.children || []) : (rawRoots as any[]);

    const selectedChildren = collection.filter((c) => selectedIds.has(c.id));
    if (selectedChildren.length !== idsArr.length) {
      alert("Select nodes with the same parent to group.");
      return;
    }

    const minX = Math.min(...selectedChildren.map((n) => Number(n.x || 0)));
    const minY = Math.min(...selectedChildren.map((n) => Number(n.y || 0)));
    const maxX = Math.max(...selectedChildren.map((n) => Number(n.x || 0) + Number(n.width || n.w || 0)));
    const maxY = Math.max(...selectedChildren.map((n) => Number(n.y || 0) + Number(n.height || n.h || 0)));
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    const groupId = "group_" + Date.now().toString(36);
    const groupNode: any = {
      id: groupId,
      type: "GROUP",
      name: "Group",
      x: minX,
      y: minY,
      width,
      height,
      w: width,
      h: height,
      children: selectedChildren.map((c) => ({
        ...c,
        x: Number(c.x || 0) - minX,
        y: Number(c.y || 0) - minY,
      })),
    };

    const selectedSet = new Set(selectedChildren.map((c) => c.id));
    const firstIndex = Math.min(...selectedChildren.map((c) => collection.indexOf(c)));
    const left = collection.slice(0, firstIndex).filter((c) => !selectedSet.has(c.id));
    const right = collection.slice(firstIndex).filter((c) => !selectedSet.has(c.id));
    const newCollection = [...left, groupNode, ...right];

    if (parentId) {
      setRawRoots((prev) => (prev ? updateNodeByIdSafe(prev, parentId, (p) => ((p as any).children = newCollection)) : prev));
    } else {
      setRawRoots(newCollection as NodeInput[]);
    }
    setSelectedIds(new Set([groupId]));
  }, [rawRoots, selectedIds, buildParentIndex]);

  // NEW: ungroup currently selected group (single selection)
  const ungroupSelected = useCallback(() => {
    if (!rawRoots || selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const node = findNodeById(rawRoots, id) as any;
    if (!node || node.type !== "GROUP") return;

    const parentIndex = buildParentIndex(rawRoots);
    const meta = parentIndex.get(id);
    const parentId = meta?.parentId ?? null;

    const childrenAdjusted = (node.children || []).map((c: any) => ({
      ...c,
      x: Number(c.x || 0) + Number(node.x || 0),
      y: Number(c.y || 0) + Number(node.y || 0),
    }));

    if (parentId) {
      setRawRoots((prev) =>
        prev
          ? updateNodeByIdSafe(prev, parentId, (p) => {
              const arr = ((p as any).children || []) as any[];
              const idx = arr.findIndex((c) => c.id === id);
              if (idx === -1) return;
              const newChildren = [...arr.slice(0, idx), ...childrenAdjusted, ...arr.slice(idx + 1)];
              (p as any).children = newChildren;
            })
          : prev
      );
    } else {
      // top-level
      setRawRoots((prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((c) => (c as any).id === id);
        if (idx === -1) return prev;
        return [...prev.slice(0, idx), ...childrenAdjusted, ...prev.slice(idx + 1)];
      });
    }
    setSelectedIds(new Set(childrenAdjusted.map((c: any) => c.id)));
  }, [rawRoots, selectedIds, buildParentIndex]);

  // NEW: create new frame with a name (prompt)
  const handleCreateFrame = useCallback(() => {
    const name = (window.prompt("New frame name?") || "").trim();
    if (!name) return;
    const id = "frame_" + Date.now().toString(36);
    const frame: any = {
      id,
      type: "FRAME",
      name,
      x: Math.round((0 - offset.x) / scale + 100),
      y: Math.round((0 - offset.y) / scale + 100),
      width: 600,
      height: 400,
      w: 600,
      h: 400,
      children: [],
    };
    setRawRoots((prev) => ([...(prev || []), frame]));
    setSelectedIds(new Set([id]));
    setSelectedFrameId(id);
  }, [offset, scale, setRawRoots, setSelectedIds, setSelectedFrameId]);

  // NEW: rename selected frame
  const handleRenameFrame = useCallback((newName: string) => {
    if (!selectedFrame) return;
    const id = selectedFrame.id;
    setRawRoots((prev) => (prev ? updateNodeByIdSafe(prev, id, (n) => ((n as any).name = newName)) : prev));
  }, [selectedFrame]);

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
        } // end inner else
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
        // NEW: include interactions for live publish (optional but helpful)
        interactions,
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

  // NEW: open Add Connection modal for current selection
  const handleOpenAddConnection = useCallback(() => {
    if (selectedIds.size !== 1) {
      alert("Select a single element or frame to create a connection.");
      return;
    }
    const sid = Array.from(selectedIds)[0];
    setConnectSourceId(sid);
    setConnectTargetId("");
    setConnectType("navigation");
    setConnectTrigger("onClick");
    setConnectAnimationName("none");
    setConnectAnimationDuration(300);
    setConnectAnimationEasing("ease-in-out");
    setConnectAnimationDirection("right");
    setConnectOpen(true);
  }, [selectedIds]);

  const confirmAddConnection = useCallback(() => {
    if (!connectSourceId || !connectTargetId) {
      alert("Please select a target element or frame.");
      return;
    }
    if (connectSourceId === connectTargetId) {
      alert("Source and target must be different.");
      return;
    }
    const newIt: Interaction = {
      id: "it_" + Date.now().toString(36),
      sourceId: connectSourceId,
      targetId: connectTargetId,
      type: connectType,
      trigger: connectTrigger,
      animation:
        connectType === "animation"
          ? {
              name: connectAnimationName,
              durationMs: Number.isFinite(connectAnimationDuration) ? connectAnimationDuration : 300,
              easing: connectAnimationEasing,
              direction: connectAnimationDirection,
            }
          : { name: "none" },
    };
    setInteractions((prev) => [...prev, newIt]);
    setConnectOpen(false);
  }, [
    connectSourceId,
    connectTargetId,
    connectType,
    connectTrigger,
    connectAnimationName,
    connectAnimationDuration,
    connectAnimationEasing,
    connectAnimationDirection,
  ]);

  const removeInteraction = useCallback((id: string) => {
    setInteractions((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const nodeLabelById = useCallback(
    (id: string) => {
      if (!rawRoots) return id;
      const n = findNodeById(rawRoots, id) as any;
      return n ? `${n.name || n.type || "Node"} (${id})` : id;
    },
    [rawRoots]
  );

  // Build a list of possible targets
  const targetOptions = useMemo(() => {
    if (!rawRoots) return [];
    const all: any[] = [];
    const walk = (arr: any[]) => {
      (arr || []).forEach((n) => {
        all.push(n);
        if (n.children && n.children.length) walk(n.children);
      });
    };
    walk(rawRoots as any[]);
    return all;
  }, [rawRoots]);

  // NEW: keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Undo
      if (cmdOrCtrl && key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if ((cmdOrCtrl && key === "y") || (cmdOrCtrl && key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Delete selection
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!cmdOrCtrl && !e.altKey) {
          e.preventDefault();
          deleteSelected();
        }
        return;
      }
      // Group
      if (cmdOrCtrl && key === "g" && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
        return;
      }
      // Ungroup
      if (cmdOrCtrl && key === "g" && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo, deleteSelected, groupSelected, ungroupSelected]);

  // Show projects page on client if routed there
  if (mounted && showProjects) {
    return <ProjectsPage />;
  }

  // Show landing page if not logged in
  if (!user && !loading) {
    return <Home onGetStarted={() => window.location.href = '/api/auth/login'} />;
  }

  return (
    <div className={styles.root}>
      
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
          lastFileKey={lastFileKey}
          onReset={handleResetCanvas}
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
            resetKey={resetKey}
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

      {/* NEW: quick actions (create frame / rename frame / add connection) */}
      <FrameDock
        selectedFrame={selectedFrame}
        onNewFrame={handleCreateFrame}
        onRenameFrame={handleRenameFrame}
        onAddConnection={handleOpenAddConnection}
      />

      {/* NEW: simple list of interactions for selected source */}
      {selectedIds.size === 1 && interactions.some((it) => it.sourceId === Array.from(selectedIds)[0]) && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 64,
            zIndex: 1200,
            padding: 8,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            maxWidth: 360,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Connections</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {interactions
              .filter((it) => it.sourceId === Array.from(selectedIds)[0])
              .map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#333" }}>
                    {it.type === "navigation" ? "Navigate" : "Animate"} to {nodeLabelById(it.targetId)}
                    {it.type === "animation" && it.animation
                      ? ` (${it.animation.name}${it.animation.durationMs ? `, ${it.animation.durationMs}ms` : ""})`
                      : ""}
                  </div>
                  <button
                    onClick={() => removeInteraction(it.id)}
                    style={{ fontSize: 12, padding: "2px 6px", borderRadius: 4, border: "1px solid #eee", background: "#fafafa", cursor: "pointer" }}
                    title="Remove connection"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Connection Modal */}
{/* Connection Modal */}
{connectOpen && (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="connection-modal-title"
    onClick={() => setConnectOpen(false)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.7)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      zIndex: 2500,
      padding: "20px 16px",
      animation: "fadeIn 0.2s ease-out",
      overflowY: "auto",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(480px, 96vw)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        animation: "slideUp 0.3s ease-out",
        margin: "20px auto",
        maxHeight: "85vh",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "4px" }}>
        <h2
          id="connection-modal-title"
          style={{
            fontWeight: 700,
            fontSize: "20px",
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Create Connection
        </h2>
        <p style={{
          fontSize: "14px",
          color: "#9ca3af",
          margin: "4px 0 0 0",
          lineHeight: 1.4,
        }}>
          Define how nodes interact with each other
        </p>
      </div>

      {/* Form Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr",
        gap: "12px",
        alignItems: "center",
      }}>
        {/* Source */}
        <label style={{
          fontSize: "14px",
          color: "#d1d5db",
          fontWeight: 500,
          textAlign: "right",
        }}>
          From
        </label>
        <div style={{
          fontSize: "14px",
          color: "#f3f4f6",
          padding: "12px 14px",
          background: "rgba(255, 255, 255, 0.05)",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          minHeight: "44px",
          display: "flex",
          alignItems: "center",
          fontWeight: 500,
        }}>
          {connectSourceId ? (
            <span style={{ color: "#60a5fa" }}>{nodeLabelById(connectSourceId)}</span>
          ) : (
            <span style={{ color: "#6b7280", fontStyle: "italic" }}>(none selected)</span>
          )}
        </div>

        {/* Target */}
        <label style={{
          fontSize: "14px",
          color: "#d1d5db",
          fontWeight: 500,
          textAlign: "right",
        }}>
          To
        </label>
        <select
          value={connectTargetId}
          onChange={(e) => setConnectTargetId(e.target.value)}
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#f3f4f6",
            fontSize: "14px",
            outline: "none",
            transition: "all 0.2s ease",
            cursor: "pointer",
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            backgroundSize: "16px",
            paddingRight: "32px",
          }}
          onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
        >
          <option value="" style={{ color: "#6b7280", background: "#1a1a1a" }}>
            Select target node…
          </option>
          {targetOptions
            .filter((n) => n?.id && n.id !== connectSourceId)
            .map((n) => (
              <option
                key={n.id}
                value={n.id}
                style={{ color: "#f3f4f6", background: "#1a1a1a" }}
              >
                {`${n.name || n.type || "Node"} (${n.type})`}
              </option>
            ))}
        </select>

        {/* Connection Type */}
        <label style={{
          fontSize: "14px",
          color: "#d1d5db",
          fontWeight: 500,
          textAlign: "right",
        }}>
          Type
        </label>
        <select
          value={connectType}
          onChange={(e) => setConnectType(e.target.value as Interaction["type"])}
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#f3f4f6",
            fontSize: "14px",
            outline: "none",
            transition: "all 0.2s ease",
            cursor: "pointer",
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            backgroundSize: "16px",
            paddingRight: "32px",
          }}
          onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
        >
          <option value="navigation" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>
            Navigation
          </option>
          <option value="animation" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>
            Animation
          </option>
        </select>

        {/* Trigger */}
        <label style={{
          fontSize: "14px",
          color: "#d1d5db",
          fontWeight: 500,
          textAlign: "right",
        }}>
          Trigger
        </label>
        <select
          value={connectTrigger}
          onChange={(e) => setConnectTrigger(e.target.value as Interaction["trigger"])}
          style={{
            padding: "12px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#f3f4f6",
            fontSize: "14px",
            outline: "none",
            transition: "all 0.2s ease",
            cursor: "pointer",
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            backgroundSize: "16px",
            paddingRight: "32px",
          }}
          onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
        >
          <option value="onClick" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>
            On Click
          </option>
          <option value="onTap" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>
            On Tap
          </option>
        </select>

        {/* Animation Options */}
        {connectType === "animation" && (
          <>
            <div style={{
              gridColumn: "1 / -1",
              height: "1px",
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
              margin: "8px 0",
            }} />
            <label style={{
              fontSize: "14px",
              color: "#d1d5db",
              fontWeight: 500,
              textAlign: "right",
            }}>
              Animation
            </label>
            <select
              value={connectAnimationName}
              onChange={(e) => setConnectAnimationName(e.target.value as any)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#f3f4f6",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
                cursor: "pointer",
                width: "100%",
                maxHeight: "200px",
                overflowY: "auto",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
                paddingRight: "32px",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
            >
              <option value="none" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>None</option>
              <option value="fade" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Fade</option>
              <option value="slide" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Slide</option>
              <option value="zoom" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Zoom</option>
            </select>
            <label style={{
              fontSize: "14px",
              color: "#d1d5db",
              fontWeight: 500,
              textAlign: "right",
            }}>
              Duration
            </label>
            <input
              type="number"
              value={connectAnimationDuration}
              onChange={(e) => setConnectAnimationDuration(parseInt(e.target.value || "300", 10))}
              min={0}
              step={50}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#f3f4f6",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
                width: "100%",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
              placeholder="300"
            />
            <label style={{
              fontSize: "14px",
              color: "#d1d5db",
              fontWeight: 500,
              textAlign: "right",
            }}>
              Easing
            </label>
            <select
              value={connectAnimationEasing}
              onChange={(e) => setConnectAnimationEasing(e.target.value as any)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#f3f4f6",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
                cursor: "pointer",
                width: "100%",
                maxHeight: "200px",
                overflowY: "auto",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
                paddingRight: "32px",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
            >
              <option value="linear" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Linear</option>
              <option value="ease-in" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Ease-in</option>
              <option value="ease-out" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Ease-out</option>
              <option value="ease-in-out" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Ease-in-out</option>
            </select>
            <label style={{
              fontSize: "14px",
              color: "#d1d5db",
              fontWeight: 500,
              textAlign: "right",
            }}>
              Direction
            </label>
            <select
              value={connectAnimationDirection}
              onChange={(e) => setConnectAnimationDirection(e.target.value as any)}
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#f3f4f6",
                fontSize: "14px",
                outline: "none",
                transition: "all 0.2s ease",
                cursor: "pointer",
                width: "100%",
                maxHeight: "200px",
                overflowY: "auto",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                backgroundImage: "url('data:image/svg+xml;utf8,<svg fill=\"white\" height=\"24\" viewBox=\"0 0 24 24\" width=\"24\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                backgroundSize: "16px",
                paddingRight: "32px",
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255, 255, 255, 0.2)"}
            >
              <option value="right" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Right</option>
              <option value="left" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Left</option>
              <option value="up" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Up</option>
              <option value="down" style={{ color: "#f3f4f6", background: "#1a1a1a" }}>Down</option>
            </select>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
        marginTop: "8px",
        paddingTop: "16px",
        borderTop: "1px solid rgba(255, 255, 255, 0.1)",
      }}>
        <button
          onClick={() => setConnectOpen(false)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            background: "transparent",
            color: "#9ca3af",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.background = "rgba(255, 255, 255, 0.05)";
            target.style.color = "#d1d5db";
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.background = "transparent";
            target.style.color = "#9ca3af";
          }}
        >
          Cancel
        </button>
        <button
          onClick={confirmAddConnection}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            transition: "all 0.2s ease",
            boxShadow: "0 2px 10px rgba(59, 130, 246, 0.3)",
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.transform = "translateY(-1px)";
            target.style.boxShadow = "0 4px 15px rgba(59, 130, 246, 0.4)";
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLButtonElement;
            target.style.transform = "translateY(0)";
            target.style.boxShadow = "0 2px 10px rgba(59, 130, 246, 0.3)";
          }}
        >
          Add Connection
        </button>
      </div>
    </div>
  </div>
)}

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
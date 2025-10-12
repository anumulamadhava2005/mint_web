import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize,
  Wand2,
  LogOut,
  Settings,
  ChevronDown,
  Zap,
  FileCode,
  Search,
  X,
} from "lucide-react";

import { Link } from "lucide-react";
import { ReferenceFrame } from "../lib/figma-types";

// A helper component for consistent and animated tooltips.
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-slate-950 border border-slate-700 rounded-md text-xs font-medium text-slate-200 whitespace-nowrap z-50 shadow-lg"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ToolbarProps {
  user: any;
  onConnect: () => void;
  onMountFetchUser: () => Promise<any>;
  fileName: string | null;
  loading: boolean;
  onFetch: (fileUrlOrKey: string) => void;
  frameOptions: ReferenceFrame[];
  selectedFrameId: string;
  setSelectedFrameId: (id: string) => void;
  fitToScreen: () => void;
  openConvert: () => void;
  zoomPct: number;
  onLogout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCommit: () => void;
  onNavigateProjects: () => void;
}

export default function ModernToolbar(props: ToolbarProps) {
  const [fileInputVal, setFileInputVal] = useState("");
  const [profileHovered, setProfileHovered] = useState(false);
  const [showFrameDropdown, setShowFrameDropdown] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [cursorInTopZone, setCursorInTopZone] = useState(false);
  const frameDropdownRef = useRef<HTMLDivElement | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Effect to fetch user on mount, runs only once.
  useEffect(() => {
    props.onMountFetchUser?.();
  }, [props.onMountFetchUser]);

  // Effect to handle auto-hide and show on hover
  useEffect(() => {
    let showTimeout: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!toolbarRef.current) return;

      const inTopZone = e.clientY < 150;
      const isOverToolbar = toolbarRef.current.contains(e.target as Node);

      if (inTopZone || isOverToolbar) {
        if (!isVisible && showTimeout === null) {
          // Start show timer
          showTimeout = window.setTimeout(() => {
            setIsVisible(true);
            showTimeout = null;
          }, 800);
        }
      } else {
        // Clear show timer if cursor leaves
        if (showTimeout !== null) {
          clearTimeout(showTimeout);
          showTimeout = null;
        }
      }

      // If visible, reset hide timer
      if (isVisible) {
        if (hideTimeoutRef.current !== null) {
          clearTimeout(hideTimeoutRef.current);
        }

        // Hide after 2 seconds of inactivity, but not if cursor is over toolbar
        if (!isOverToolbar) {
          hideTimeoutRef.current = window.setTimeout(() => {
            if (!profileHovered && !showFrameDropdown && !showFetchModal) {
              setIsVisible(false);
            }
          }, 2000);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (showTimeout !== null) {
        clearTimeout(showTimeout);
      }
    };
  }, [isVisible, profileHovered, showFrameDropdown, showFetchModal]);

  // Effect to handle clicks outside of dropdowns to close them.
  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (frameDropdownRef.current && !frameDropdownRef.current.contains(event.target as Node)) {
        setShowFrameDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileHovered(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  function handleFetch() {
    props.onFetch?.(fileInputVal);
    setShowFetchModal(false);
    setFileInputVal("");
  }

  function handleLogout() {
    if (props.onLogout) {
      props.onLogout();
    } else {
      // Fallback logout logic
      const cookiesToClear = ["session", ".session", "token", "auth", "user", "sid"];
      cookiesToClear.forEach((name) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      window.location.href = "/home";
    }
  }
  
  // Base classes for consistent icon button styling
  const iconButtonClasses = "flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/20 text-black hover:text-black transition-all duration-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed";

  return (
    <>
      <div ref={toolbarRef} className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-fit z-50">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{
            opacity: isVisible ? 1 : 0,
            y: isVisible ? 0 : -30,
            pointerEvents: isVisible ? "auto" : "none",
          }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-3xl backdrop-blur-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.02) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
            WebkitBackdropFilter: "blur(40px)",
            backdropFilter: "blur(40px)",
          }}
        >
          {/* Left Section: Logo & View Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={props.onNavigateProjects}>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                <Zap className="w-4 h-4 text-white" />
              </div>
        
            </div>
            
            <div className="w-px h-6 bg-black/20" />

            <div className="flex items-center gap-1">
              <Tooltip text="Undo (Ctrl+Z)">
                <button onClick={props.onUndo} disabled={!props.canUndo} className={iconButtonClasses}>
                  <RotateCcw className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip text="Redo (Ctrl+Y)">
                <button onClick={props.onRedo} disabled={!props.canRedo} className={iconButtonClasses}>
                  <RotateCw className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            
            <div className="w-px h-6 bg-black/20" />

            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "rgba(0, 0, 0, 0.05)", border: "1px solid rgba(0, 0, 0, 0.1)" }}>
              <Tooltip text="Zoom Out">
                <button onClick={props.onZoomOut} className={iconButtonClasses}>
                  <ZoomOut className="w-4 h-4" />
                </button>
              </Tooltip>
              <div 
                className="w-12 text-center text-xs text-black font-semibold cursor-pointer hover:bg-white/20 rounded-md py-1"
                onClick={props.onZoomReset}
              >
                {props.zoomPct?.toFixed(0) || 100}%
              </div>
              <Tooltip text="Zoom In">
                <button onClick={props.onZoomIn} className={iconButtonClasses}>
                  <ZoomIn className="w-4 h-4" />
                </button>
              </Tooltip>
              <div className="w-px h-5 bg-black/20 mx-1" />
              <Tooltip text="Fit to Screen">
                <button onClick={props.fitToScreen} className={iconButtonClasses}>
                  <Maximize className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Center Section: Fetch & Frame Selector */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setShowFetchModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black hover:bg-white/20 transition-all"
              style={{ background: "rgba(0, 0, 0, 0.05)", border: "1px solid rgba(0, 0, 0, 0.1)" }}
            >
              <Search className="w-4 h-4" />
              Fetch
            </motion.button>
            
            {/* Frame Selector */}
            {props.frameOptions?.length > 0 && (
              <div className="relative" ref={frameDropdownRef}>
                <button
                  onClick={() => setShowFrameDropdown(!showFrameDropdown)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-black hover:bg-white/20 transition-all"
                  style={{ background: "rgba(0, 0, 0, 0.05)", border: "1px solid rgba(0, 0, 0, 0.1)" }}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${props.selectedFrameId ? 'bg-emerald-600' : 'bg-black/40'}`} />
                  <span className="hidden sm:inline truncate max-w-[120px]">
                    {props.selectedFrameId === "" ? "World Origin" : props.frameOptions.find(f => f.id === props.selectedFrameId)?.name || "Select Frame"}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFrameDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showFrameDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-full mt-2 w-56 rounded-lg shadow-xl z-50 overflow-hidden backdrop-blur-3xl"
                      style={{ 
                        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.02) 100%)", 
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                      }}
                    >
                      <div className="max-h-60 overflow-y-auto text-sm p-1">
                        <button
                          onClick={() => { props.setSelectedFrameId?.(""); setShowFrameDropdown(false); }}
                          className="w-full text-left px-3 py-2 text-black/80 hover:bg-white/20 rounded-md"
                        >
                          World Origin
                        </button>
                        {props.frameOptions.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => { props.setSelectedFrameId?.(f.id); setShowFrameDropdown(false); }}
                            className={`w-full text-left px-3 py-2 mt-1 rounded-md transition-all ${
                              props.selectedFrameId === f.id
                                ? "bg-blue-600/40 text-blue-900"
                                : "text-black/80 hover:bg-white/20"
                            }`}
                          >
                            <div className="font-semibold">{f.name || f.id}</div>
                            <div className="text-xs text-black/50">{Math.round(f.width)}×{Math.round(f.height)}</div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right Section: Actions & Profile */}
          <div className="flex items-center gap-2">
            <button onClick={props.openConvert} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-black hover:bg-white/20 transition-all"
              style={{ background: "rgba(0, 0, 0, 0.05)", border: "1px solid rgba(0, 0, 0, 0.1)" }}>
              <Wand2 className="w-4 h-4 text-purple-600" />
              Convert
            </button>
            <button
              onClick={() => props.onCommit?.()}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-md hover:shadow-emerald-500/30"
            >
              Commit
            </button>
          
            <div className="w-px h-6 bg-black/20" />

            <div
              ref={profileDropdownRef}
              onMouseEnter={() => setProfileHovered(true)}
              onMouseLeave={() => setProfileHovered(false)}
              className="relative"
            >
              {!props.user ? (
                <button
                  onClick={props.onConnect}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
                >
                  Connect
                </button>
              ) : (
                <>
                  <button className="w-9 h-9 rounded-full border-2 border-black/20 hover:border-blue-600 transition-colors duration-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 ring-offset-2 ring-offset-white/80">
                    <img
                      src={props.user.img_url || "/placeholder.svg"}
                      alt={props.user.handle || "User"}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <AnimatePresence>
                    {profileHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute right-0 top-full mt-2 rounded-lg shadow-xl z-50 w-52 overflow-hidden backdrop-blur-3xl"
                        style={{ 
                          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.02) 100%)", 
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.2)"
                        }}
                      >
                        <div className="p-3" style={{ borderBottom: "1px solid rgba(0, 0, 0, 0.1)" }}>
                          <div className="text-sm font-bold text-black">{props.user.handle}</div>
                          <div className="text-xs text-black/60 truncate">{props.user.email}</div>
                        </div>
                        <div className="p-2 space-y-1">
                          <button
                            onClick={() => { props.onNavigateProjects?.(); setProfileHovered(false); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-black/80 hover:bg-white/20 rounded-md"
                          >
                            My Projects
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm text-black/80 hover:bg-white/20 rounded-md"
                          >
                            <Settings className="w-4 h-4" /> Settings
                          </button>
                          <button
                            onClick={handleLogout}
                            className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-500/20 hover:text-red-700 rounded-md flex items-center gap-2"
                          >
                            <LogOut className="w-4 h-4" /> Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Fetch Modal */}
      <AnimatePresence>
        {showFetchModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFetchModal(false)}
            className="fixed inset-0 backdrop-blur-sm z-40"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
            >
              <div
                className="rounded-3xl p-6 backdrop-blur-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.02) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-black">Fetch Figma Design</h2>
                  <button
                    onClick={() => setShowFetchModal(false)}
                    className="text-black/60 hover:text-black transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="relative mb-4">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                  <input
                    placeholder="Paste Figma URL or key..."
                    value={fileInputVal}
                    onChange={(e) => setFileInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                    autoFocus
                    className="w-full pl-9 pr-3 py-3 rounded-xl text-sm text-black placeholder-black/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
                    style={{ background: "rgba(0, 0, 0, 0.05)", border: "1px solid rgba(0, 0, 0, 0.1)" }}
                  />
                </div>

                <button
                  onClick={handleFetch}
                  disabled={!fileInputVal}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-blue-500/30"
                >
                  {props.loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
                      Fetching...
                    </span>
                  ) : (
                    "Fetch Design"
                  )}
                </button>

                <p className="text-xs text-black/60 mt-4 text-center">
                  Paste your Figma file URL or key to load the design
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import Image from "next/image"
import type { ReferenceFrame } from "../lib/figma-types"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type FrameOption = ReferenceFrame

export default function Toolbar(props: {
  onNavigateProjects?: () => void;
  user: any
  onConnect: () => void
  onMountFetchUser: () => void
  fileName: string | null
  loading: boolean
  onFetch: (fileUrlOrKey: string) => void
  frameOptions: FrameOption[]
  selectedFrameId: string
  setSelectedFrameId: (v: string) => void
  fitToScreen: () => void
  openConvert: () => void
  zoomPct: number
  onLogout?: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onCommit: () => void
}) {
  const {
    user,
    onConnect,
    onMountFetchUser,
    fileName,
    loading,
    onFetch,
    frameOptions,
    selectedFrameId,
    setSelectedFrameId,
    fitToScreen,
    openConvert,
    zoomPct,
    onCommit
  } = props

  const [fileInputVal, setFileInputVal] = useState("")

  // fetch user on mount (kept here to keep page.tsx lean)
  if (typeof window !== "undefined") {
    // run once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ; (window as any).__userFetched__ ||= (onMountFetchUser(), true)
  }

  function handleFetch() {
    onFetch(fileInputVal)
  }

  // Hover state for logout button
  const [profileHovered, setProfileHovered] = useState(false)

  function handleLogout() {
    if (props.onLogout) {
      props.onLogout()
    } else {
      // Remove common session cookies
      const cookiesToClear = ["session", ".session", "token", "auth", "user", "sid"]
      cookiesToClear.forEach((name) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
      window.location.href = "/home"
    }
  }

  function onNavigateProjects(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void {
    if (props.onNavigateProjects) {
      props.onNavigateProjects();
    }
  }
  return (
    <div style={{
      background: 'rgba(24,24,27,0.8)',
      /* borderBottom removed to avoid extra strip */
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      width: '100%',
    }}>
      {/* Controls Row */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
        }}
      >
        {/* Site image placeholder + Zoom/Undo/Redo Controls */}
        <div
          aria-label="Site image placeholder"
          title="Site image placeholder"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#23272f',
            border: '1px solid #444',
            marginRight: 12,
          }}
        >
          
</div>
          
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <button onClick={props.onZoomOut} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>-</button>
          <div style={{ fontSize: 12, color: '#9ca3af', padding: '0 6px', minWidth: 56, textAlign: 'center' }}>{zoomPct.toFixed(0)}%</div>
          <button onClick={props.onZoomIn} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>+</button>
        </div>
        <button onClick={props.onUndo} disabled={!props.canUndo} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 2, marginLeft: 16, cursor: props.canUndo ? 'pointer' : 'not-allowed', opacity: props.canUndo ? 1 : 0.5 }}>Undo</button>
        <button onClick={props.onRedo} disabled={!props.canRedo} style={{ borderRadius: 6, padding: '4px 10px', background: '#23272f', border: '1px solid #444', color: '#fff', fontSize: 14, fontWeight: 500, marginRight: 8, cursor: props.canRedo ? 'pointer' : 'not-allowed', opacity: props.canRedo ? 1 : 0.5 }}>Redo</button>
        {/* File Input */}
        <input
          style={{
            flex: 1,
            background: '#23272f',
            border: '1px solid #444',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 14,
            color: '#fff',
            marginRight: 8,
          }}
          placeholder="Paste Figma file URL or key"
          value={fileInputVal}
          onChange={(e) => setFileInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleFetch()
          }}
        />
        <button
          onClick={handleFetch}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: loading ? '#3b82f6' : '#2563eb',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            marginRight: 8,
            transition: 'background 0.2s',
          }}
          disabled={loading}
          onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8' }}
          onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
        >
          {loading ? "Fetching…" : "Fetch"}
        </button>


        {/* Divider */}
        <div style={{ height: 24, width: 1, background: '#333', margin: '0 8px' }} />

        {/* Frame Selector */}
        {frameOptions.length > 0 && (
          <>
            <label style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>Reference frame</label>
            <select
              style={{
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 14,
                backgroundColor: '#18181b',
                color: '#fff',
                border: '1px solid #333',
                marginRight: 8,
              }}
              value={selectedFrameId}
              onChange={(e) => setSelectedFrameId(e.target.value)}
              title="Choose a frame to anchor coordinates and preview overlay"
            >
              <option value="">World origin</option>
              {frameOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name || f.id} ({Math.round(f.width)}×{Math.round(f.height)})
                </option>
              ))}
            </select>
            <div style={{ height: 24, width: 1, background: '#333', margin: '0 8px' }} />
          </>
        )}

        {/* Action Buttons */}
        <button
          onClick={fitToScreen}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: '#23272f',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: '1px solid #444',
            marginRight: 8,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#18181b')}
          onMouseOut={e => (e.currentTarget.style.background = '#23272f')}
        >
          Fit
        </button>
        <button
          onClick={openConvert}
          style={{
            borderRadius: 8,
            padding: '6px 16px',
            background: '#23272f',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            border: '1px solid #444',
            marginRight: 8,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#18181b')}
          onMouseOut={e => (e.currentTarget.style.background = '#23272f')}
        >
          Convert
        </button>


        <button
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
          onClick={() => onCommit?.()}
          title="Publish snapshot for live preview"
        >
          Commit
        </button>

        {/* Profile next to Convert */}
        <div
          style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
          onMouseEnter={() => setProfileHovered(true)}
          onMouseLeave={() => setProfileHovered(false)}
        >
          {!user ? (
            <button
              onClick={onConnect}
              style={{
                borderRadius: 8,
                padding: '6px 16px',
                background: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseOut={e => (e.currentTarget.style.background = '#2563eb')}
            >
              Connect
            </button>
          ) : (
            <>
              <Image
                src={user.img_url || "/placeholder.svg"}
                alt={user.handle}
                width={28}
                height={28}
                style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #444' }}
              />
              <AnimatePresence>
                {profileHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 36,
                      zIndex: 10,
                      padding: 8,
                      borderRadius: 8,
                      background: '#23272f',
                      border: '1px solid #444',
                      boxShadow: '0 8px 18px rgba(0,0,0,0.18)',
                      minWidth: 180,
                      color: '#e5e7eb',
                    }}
                  >
                    {user.email && (
                      <div style={{ fontSize: 12, marginBottom: 8, color: '#9ca3af', wordBreak: 'break-all' }}>
                        {user.email}
                      </div>
                    )}
                    <button
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        borderRadius: 8,
                        padding: '8px 10px',
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        border: '1px solid #b91c1c',
                        cursor: 'pointer',
                      }}
                    >
                      Log out
                    </button>
                    {user && (
                          <button
                          onClick={onNavigateProjects}
                          className="px-3 py-2 text-sm hover:bg-gray-700 rounded-md transition-colors"
                          title="My Projects"
                        >
                          Projects
                        </button>
                      )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Zoom Display */}

      </motion.div>

      {/* File Name Row */}
      <AnimatePresence>
        {fileName && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              padding: '8px 16px',
              background: '#18181b',
              borderTop: '1px solid #333',
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            <span style={{ color: '#6b7280' }}>File:</span>{' '}
            <span style={{ color: '#fff' }}>{fileName}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

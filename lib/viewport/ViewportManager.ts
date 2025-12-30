/**
 * ViewportManager - Centralized zoom/pan logic for canvas rendering
 * 
 * Responsibilities:
 * - Zoom centered on cursor
 * - Pan (trackpad/mouse drag)
 * - Screen <-> World coordinate transforms
 * - DevicePixelRatio handling
 * - Canvas and DOM preview sync
 * 
 * Single source of truth for all viewport math.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewportState {
  /** Current zoom level (1.0 = 100%) */
  scale: number;
  /** Canvas offset in screen pixels */
  offset: { x: number; y: number };
}

export interface ViewportConfig {
  /** Minimum allowed scale */
  minScale: number;
  /** Maximum allowed scale */
  maxScale: number;
  /** Zoom sensitivity (higher = faster zoom) */
  zoomSensitivity: number;
  /** Whether to apply devicePixelRatio to canvas rendering */
  useDevicePixelRatio: boolean;
}

export interface ScreenPoint {
  sx: number;
  sy: number;
}

export interface WorldPoint {
  wx: number;
  wy: number;
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ViewportConfig = {
  minScale: 0.05,
  maxScale: 20,
  zoomSensitivity: 0.0012,
  useDevicePixelRatio: true,
};

// Delta mode constants (WheelEvent.deltaMode)
const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

// ─────────────────────────────────────────────────────────────────────────────
// ViewportManager Class
// ─────────────────────────────────────────────────────────────────────────────

export class ViewportManager {
  private config: ViewportConfig;
  private state: ViewportState;
  private canvasRect: DOMRect | null = null;
  
  // Listeners for state changes
  private listeners: Set<(state: ViewportState) => void> = new Set();
  
  constructor(
    initialState: Partial<ViewportState> = {},
    config: Partial<ViewportConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      scale: initialState.scale ?? 1,
      offset: initialState.offset ?? { x: 0, y: 0 },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────────────────────────────────
  
  setConfig(config: Partial<ViewportConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): ViewportConfig {
    return { ...this.config };
  }
  
  /**
   * Set the canvas bounding rect (call on mount and resize)
   */
  setCanvasRect(rect: DOMRect): void {
    this.canvasRect = rect;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // State Access
  // ─────────────────────────────────────────────────────────────────────────
  
  getState(): ViewportState {
    return { ...this.state, offset: { ...this.state.offset } };
  }
  
  getScale(): number {
    return this.state.scale;
  }
  
  getOffset(): { x: number; y: number } {
    return { ...this.state.offset };
  }
  
  /**
   * Get devicePixelRatio (memoized for consistency within a frame)
   */
  getDpr(): number {
    if (!this.config.useDevicePixelRatio) return 1;
    return typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // State Updates
  // ─────────────────────────────────────────────────────────────────────────
  
  setState(state: Partial<ViewportState>): void {
    if (state.scale !== undefined) {
      this.state.scale = this.clampScale(state.scale);
    }
    if (state.offset !== undefined) {
      this.state.offset = { ...state.offset };
    }
    this.notifyListeners();
  }
  
  setScale(scale: number): void {
    this.state.scale = this.clampScale(scale);
    this.notifyListeners();
  }
  
  setOffset(offset: { x: number; y: number }): void {
    this.state.offset = { ...offset };
    this.notifyListeners();
  }
  
  private clampScale(scale: number): number {
    return Math.max(this.config.minScale, Math.min(this.config.maxScale, scale));
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Coordinate Transforms
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(sx: number, sy: number): WorldPoint {
    const { scale, offset } = this.state;
    return {
      wx: (sx - offset.x) / scale,
      wy: (sy - offset.y) / scale,
    };
  }
  
  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(wx: number, wy: number): ScreenPoint {
    const { scale, offset } = this.state;
    return {
      sx: wx * scale + offset.x,
      sy: wy * scale + offset.y,
    };
  }
  
  /**
   * Convert client (page) coordinates to screen (canvas-relative) coordinates
   */
  clientToScreen(clientX: number, clientY: number): ScreenPoint {
    if (!this.canvasRect) {
      return { sx: clientX, sy: clientY };
    }
    return {
      sx: clientX - this.canvasRect.left,
      sy: clientY - this.canvasRect.top,
    };
  }
  
  /**
   * Convert client coordinates directly to world coordinates
   */
  clientToWorld(clientX: number, clientY: number): WorldPoint {
    const screen = this.clientToScreen(clientX, clientY);
    return this.screenToWorld(screen.sx, screen.sy);
  }
  
  /**
   * Get the visible world rect (what's currently in the viewport)
   */
  getVisibleWorldRect(viewportWidth: number, viewportHeight: number): ViewportRect {
    const { scale, offset } = this.state;
    return {
      x: -offset.x / scale,
      y: -offset.y / scale,
      width: viewportWidth / scale,
      height: viewportHeight / scale,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Zoom Operations
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Zoom centered on a screen point
   * This is the core zoom algorithm - zoom factor is applied while keeping
   * the point under the cursor at the same world position.
   */
  zoomAtPoint(screenX: number, screenY: number, zoomFactor: number): ViewportState {
    const { scale: currentScale, offset: currentOffset } = this.state;
    
    // Calculate new scale
    const newScale = this.clampScale(currentScale * zoomFactor);
    
    // If scale didn't change (hit bounds), return current state
    if (newScale === currentScale) {
      return this.getState();
    }
    
    // Convert screen point to world coordinates using CURRENT scale
    const worldX = (screenX - currentOffset.x) / currentScale;
    const worldY = (screenY - currentOffset.y) / currentScale;
    
    // Calculate new offset to keep that world point at the same screen position
    // Formula: screenX = worldX * newScale + newOffset.x
    // Therefore: newOffset.x = screenX - worldX * newScale
    const newOffset = {
      x: screenX - worldX * newScale,
      y: screenY - worldY * newScale,
    };
    
    this.state.scale = newScale;
    this.state.offset = newOffset;
    this.notifyListeners();
    
    return this.getState();
  }
  
  /**
   * Zoom centered on the viewport center
   */
  zoomAtCenter(viewportWidth: number, viewportHeight: number, zoomFactor: number): ViewportState {
    return this.zoomAtPoint(viewportWidth / 2, viewportHeight / 2, zoomFactor);
  }
  
  /**
   * Set zoom to a specific level, centered on viewport
   */
  setZoomLevel(scale: number, viewportWidth: number, viewportHeight: number): ViewportState {
    const zoomFactor = scale / this.state.scale;
    return this.zoomAtCenter(viewportWidth, viewportHeight, zoomFactor);
  }
  
  /**
   * Zoom to fit content within viewport
   */
  zoomToFit(
    contentRect: ViewportRect,
    viewportWidth: number,
    viewportHeight: number,
    padding: number = 50
  ): ViewportState {
    if (contentRect.width === 0 || contentRect.height === 0) {
      return this.getState();
    }
    
    const availableWidth = viewportWidth - padding * 2;
    const availableHeight = viewportHeight - padding * 2;
    
    const scaleX = availableWidth / contentRect.width;
    const scaleY = availableHeight / contentRect.height;
    const newScale = this.clampScale(Math.min(scaleX, scaleY));
    
    // Center the content
    const contentCenterX = contentRect.x + contentRect.width / 2;
    const contentCenterY = contentRect.y + contentRect.height / 2;
    
    const newOffset = {
      x: viewportWidth / 2 - contentCenterX * newScale,
      y: viewportHeight / 2 - contentCenterY * newScale,
    };
    
    this.state.scale = newScale;
    this.state.offset = newOffset;
    this.notifyListeners();
    
    return this.getState();
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Pan Operations
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Pan by a delta in screen pixels
   */
  pan(deltaX: number, deltaY: number): ViewportState {
    this.state.offset = {
      x: this.state.offset.x - deltaX,
      y: this.state.offset.y - deltaY,
    };
    this.notifyListeners();
    return this.getState();
  }
  
  /**
   * Pan to center a world point in the viewport
   */
  panToWorld(
    worldX: number,
    worldY: number,
    viewportWidth: number,
    viewportHeight: number
  ): ViewportState {
    const { scale } = this.state;
    this.state.offset = {
      x: viewportWidth / 2 - worldX * scale,
      y: viewportHeight / 2 - worldY * scale,
    };
    this.notifyListeners();
    return this.getState();
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Wheel Event Handling
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Normalize wheel delta across different browsers and input devices
   */
  normalizeWheelDelta(e: WheelEvent): { deltaX: number; deltaY: number } {
    let factor: number;
    
    switch (e.deltaMode) {
      case DOM_DELTA_LINE:
        factor = 16; // Typical line height
        break;
      case DOM_DELTA_PAGE:
        factor = typeof window !== 'undefined' ? window.innerHeight : 800;
        break;
      case DOM_DELTA_PIXEL:
      default:
        factor = 1;
        break;
    }
    
    return {
      deltaX: e.deltaX * factor,
      deltaY: e.deltaY * factor,
    };
  }
  
  /**
   * Handle wheel event - determines zoom vs pan based on modifier keys
   * Returns the new viewport state
   */
  handleWheel(e: WheelEvent, canvasRect: DOMRect): ViewportState {
    const { deltaX, deltaY } = this.normalizeWheelDelta(e);
    
    // Zoom when Ctrl/Meta is pressed
    if (e.ctrlKey || e.metaKey) {
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;
      
      // Calculate zoom factor from vertical delta
      const zoomFactor = Math.exp(-deltaY * this.config.zoomSensitivity);
      
      return this.zoomAtPoint(mouseX, mouseY, zoomFactor);
    } else {
      // Pan otherwise
      return this.pan(deltaX, deltaY);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Canvas Setup
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Setup canvas for high-DPI rendering
   * Call this on mount and resize
   */
  setupCanvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): void {
    const dpr = this.getDpr();
    
    // Set display size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    // Set actual size in memory (scaled for DPI)
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  
  /**
   * Prepare canvas context for drawing
   * Call this at the start of each render frame
   */
  prepareContext(ctx: CanvasRenderingContext2D): void {
    const dpr = this.getDpr();
    
    // Reset transform and scale for DPI
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  
  /**
   * Apply viewport transform to context
   * Call after prepareContext, before drawing world-space content
   */
  applyViewportTransform(ctx: CanvasRenderingContext2D): void {
    const dpr = this.getDpr();
    const { scale, offset } = this.state;
    
    // Apply DPI scaling, then viewport transform
    ctx.setTransform(
      dpr * scale, 0,
      0, dpr * scale,
      offset.x * dpr, offset.y * dpr
    );
  }
  
  /**
   * Get CSS transform string for DOM elements that should follow canvas zoom/pan
   */
  getCSSTransform(): string {
    const { scale, offset } = this.state;
    return `translate(${offset.x}px, ${offset.y}px) scale(${scale})`;
  }
  
  /**
   * Get CSS transform-origin for DOM elements
   */
  getCSSTransformOrigin(): string {
    return '0 0';
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Listeners
  // ─────────────────────────────────────────────────────────────────────────
  
  subscribe(listener: (state: ViewportState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface UseViewportOptions extends Partial<ViewportConfig> {
  initialScale?: number;
  initialOffset?: { x: number; y: number };
}

export interface UseViewportResult {
  /** Current scale */
  scale: number;
  /** Current offset */
  offset: { x: number; y: number };
  /** Set scale */
  setScale: (scale: number) => void;
  /** Set offset */
  setOffset: (offset: { x: number; y: number }) => void;
  /** Convert screen coords to world */
  screenToWorld: (sx: number, sy: number) => WorldPoint;
  /** Convert world coords to screen */
  worldToScreen: (wx: number, wy: number) => ScreenPoint;
  /** Convert client (page) coords to world */
  clientToWorld: (clientX: number, clientY: number) => WorldPoint;
  /** Zoom at a point */
  zoomAtPoint: (screenX: number, screenY: number, factor: number) => void;
  /** Zoom to fit content */
  zoomToFit: (contentRect: ViewportRect, padding?: number) => void;
  /** Pan by delta */
  pan: (deltaX: number, deltaY: number) => void;
  /** Handle wheel event */
  handleWheel: (e: WheelEvent) => void;
  /** Setup canvas for HiDPI */
  setupCanvas: (canvas: HTMLCanvasElement) => void;
  /** Prepare context for drawing */
  prepareContext: (ctx: CanvasRenderingContext2D) => void;
  /** Get visible world rect */
  getVisibleWorldRect: () => ViewportRect;
  /** Get CSS transform for DOM sync */
  getCSSTransform: () => string;
  /** Device pixel ratio */
  dpr: number;
  /** The underlying manager instance */
  manager: ViewportManager;
}

export function useViewport(options: UseViewportOptions = {}): UseViewportResult {
  const { initialScale = 1, initialOffset = { x: 0, y: 0 }, ...config } = options;
  
  const managerRef = useRef<ViewportManager | null>(null);
  
  if (!managerRef.current) {
    managerRef.current = new ViewportManager(
      { scale: initialScale, offset: initialOffset },
      config
    );
  }
  
  const manager = managerRef.current;
  
  const [scale, setScaleState] = useState(initialScale);
  const [offset, setOffsetState] = useState(initialOffset);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  
  // Subscribe to manager changes
  useEffect(() => {
    const unsubscribe = manager.subscribe((state) => {
      setScaleState(state.scale);
      setOffsetState(state.offset);
    });
    return unsubscribe;
  }, [manager]);
  
  // Track viewport size
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const setScale = useCallback((s: number) => manager.setScale(s), [manager]);
  const setOffset = useCallback((o: { x: number; y: number }) => manager.setOffset(o), [manager]);
  
  const screenToWorld = useCallback(
    (sx: number, sy: number) => manager.screenToWorld(sx, sy),
    [manager]
  );
  
  const worldToScreen = useCallback(
    (wx: number, wy: number) => manager.worldToScreen(wx, wy),
    [manager]
  );
  
  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => manager.clientToWorld(clientX, clientY),
    [manager]
  );
  
  const zoomAtPoint = useCallback(
    (screenX: number, screenY: number, factor: number) => {
      manager.zoomAtPoint(screenX, screenY, factor);
    },
    [manager]
  );
  
  const zoomToFit = useCallback(
    (contentRect: ViewportRect, padding = 50) => {
      manager.zoomToFit(contentRect, viewportSize.width, viewportSize.height, padding);
    },
    [manager, viewportSize]
  );
  
  const pan = useCallback(
    (deltaX: number, deltaY: number) => {
      manager.pan(deltaX, deltaY);
    },
    [manager]
  );
  
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const canvas = (e.target as HTMLElement).closest('canvas');
      if (!canvas) return;
      manager.setCanvasRect(canvas.getBoundingClientRect());
      manager.handleWheel(e, canvas.getBoundingClientRect());
    },
    [manager]
  );
  
  const setupCanvas = useCallback(
    (canvas: HTMLCanvasElement) => {
      manager.setupCanvas(canvas, viewportSize.width, viewportSize.height);
    },
    [manager, viewportSize]
  );
  
  const prepareContext = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      manager.prepareContext(ctx);
    },
    [manager]
  );
  
  const getVisibleWorldRect = useCallback(
    () => manager.getVisibleWorldRect(viewportSize.width, viewportSize.height),
    [manager, viewportSize]
  );
  
  const getCSSTransform = useCallback(() => manager.getCSSTransform(), [manager]);
  
  return useMemo(() => ({
    scale,
    offset,
    setScale,
    setOffset,
    screenToWorld,
    worldToScreen,
    clientToWorld,
    zoomAtPoint,
    zoomToFit,
    pan,
    handleWheel,
    setupCanvas,
    prepareContext,
    getVisibleWorldRect,
    getCSSTransform,
    dpr: manager.getDpr(),
    manager,
  }), [
    scale, offset, setScale, setOffset, screenToWorld, worldToScreen,
    clientToWorld, zoomAtPoint, zoomToFit, pan, handleWheel, setupCanvas,
    prepareContext, getVisibleWorldRect, getCSSTransform, manager,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let globalViewportManager: ViewportManager | null = null;

export function getViewportManager(): ViewportManager | null {
  return globalViewportManager;
}

export function createViewportManager(
  initialState?: Partial<ViewportState>,
  config?: Partial<ViewportConfig>
): ViewportManager {
  globalViewportManager = new ViewportManager(initialState, config);
  return globalViewportManager;
}

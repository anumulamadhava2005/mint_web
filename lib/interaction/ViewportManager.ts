/**
 * ViewportManager - Manages canvas viewport with Figma-like behavior
 * 
 * Features:
 * - Zoom at cursor position
 * - Smooth pan and zoom
 * - Zoom limits (0.01x to 256x)
 * - Fit to selection
 * - Fit to canvas
 * - Center on load
 * - DPR-aware rendering
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ViewportState {
  /** Horizontal offset (world units from origin) */
  panX: number;
  /** Vertical offset (world units from origin) */
  panY: number;
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** Canvas width in screen pixels */
  canvasWidth: number;
  /** Canvas height in screen pixels */
  canvasHeight: number;
  /** Device pixel ratio */
  dpr: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ViewportChangeListener = (state: ViewportState) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Minimum zoom level (1%) */
export const MIN_ZOOM = 0.01;

/** Maximum zoom level (25600%) */
export const MAX_ZOOM = 256;

/** Zoom step multiplier for wheel zoom */
export const ZOOM_STEP = 0.1;

/** Preset zoom levels for quick access */
export const ZOOM_PRESETS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8, 16];

/** Padding around content when fitting to view */
export const FIT_PADDING = 50;

// ═══════════════════════════════════════════════════════════════════════════════
// VIEWPORT MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class ViewportManager {
  private state: ViewportState = {
    panX: 0,
    panY: 0,
    zoom: 1,
    canvasWidth: 0,
    canvasHeight: 0,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  };
  
  private listeners: Set<ViewportChangeListener> = new Set();
  private animationFrame: number | null = null;
  
  // ─── State Access ───
  
  getState(): Readonly<ViewportState> {
    return this.state;
  }
  
  getZoom(): number {
    return this.state.zoom;
  }
  
  getPan(): { x: number; y: number } {
    return { x: this.state.panX, y: this.state.panY };
  }
  
  getDPR(): number {
    return this.state.dpr;
  }
  
  // ─── Canvas Setup ───
  
  /**
   * Set canvas dimensions (call on resize)
   */
  setCanvasSize(width: number, height: number): void {
    this.state.canvasWidth = width;
    this.state.canvasHeight = height;
    this.notifyListeners();
  }
  
  /**
   * Update DPR (call if window moves between displays)
   */
  updateDPR(): void {
    this.state.dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    this.notifyListeners();
  }
  
  // ─── Coordinate Transforms ───
  
  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): WorldPoint {
    return {
      x: (screenX / this.state.zoom) + this.state.panX,
      y: (screenY / this.state.zoom) + this.state.panY,
    };
  }
  
  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): ScreenPoint {
    return {
      x: (worldX - this.state.panX) * this.state.zoom,
      y: (worldY - this.state.panY) * this.state.zoom,
    };
  }
  
  /**
   * Get the visible world bounds
   */
  getVisibleBounds(): Bounds {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(this.state.canvasWidth, this.state.canvasHeight);
    
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }
  
  // ─── Zoom Operations ───
  
  /**
   * Zoom at a specific screen point (for mouse wheel zoom)
   */
  zoomAtPoint(screenX: number, screenY: number, delta: number): void {
    // Get world position before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);
    
    // Calculate new zoom
    const zoomFactor = 1 + (delta > 0 ? -ZOOM_STEP : ZOOM_STEP);
    const newZoom = this.clampZoom(this.state.zoom * zoomFactor);
    
    if (newZoom === this.state.zoom) return;
    
    this.state.zoom = newZoom;
    
    // Get world position after zoom
    const worldAfter = this.screenToWorld(screenX, screenY);
    
    // Adjust pan to keep point under cursor
    this.state.panX += worldBefore.x - worldAfter.x;
    this.state.panY += worldBefore.y - worldAfter.y;
    
    this.notifyListeners();
  }
  
  /**
   * Set zoom level, keeping center in view
   */
  setZoom(zoom: number): void {
    const centerX = this.state.canvasWidth / 2;
    const centerY = this.state.canvasHeight / 2;
    
    // Get world position of center
    const worldCenter = this.screenToWorld(centerX, centerY);
    
    this.state.zoom = this.clampZoom(zoom);
    
    // Adjust pan to keep center
    const newWorldCenter = this.screenToWorld(centerX, centerY);
    this.state.panX += worldCenter.x - newWorldCenter.x;
    this.state.panY += worldCenter.y - newWorldCenter.y;
    
    this.notifyListeners();
  }
  
  /**
   * Zoom to next preset level
   */
  zoomIn(): void {
    const current = this.state.zoom;
    for (const preset of ZOOM_PRESETS) {
      if (preset > current * 1.01) {
        this.setZoom(preset);
        return;
      }
    }
    this.setZoom(current * 1.5);
  }
  
  /**
   * Zoom to previous preset level
   */
  zoomOut(): void {
    const current = this.state.zoom;
    for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
      if (ZOOM_PRESETS[i] < current * 0.99) {
        this.setZoom(ZOOM_PRESETS[i]);
        return;
      }
    }
    this.setZoom(current / 1.5);
  }
  
  /**
   * Reset zoom to 100%
   */
  resetZoom(): void {
    this.setZoom(1);
  }
  
  // ─── Pan Operations ───
  
  /**
   * Pan by screen pixels
   */
  panBy(deltaX: number, deltaY: number): void {
    this.state.panX -= deltaX / this.state.zoom;
    this.state.panY -= deltaY / this.state.zoom;
    this.notifyListeners();
  }
  
  /**
   * Pan to center a world point
   */
  panTo(worldX: number, worldY: number): void {
    const centerX = this.state.canvasWidth / 2;
    const centerY = this.state.canvasHeight / 2;
    
    this.state.panX = worldX - centerX / this.state.zoom;
    this.state.panY = worldY - centerY / this.state.zoom;
    
    this.notifyListeners();
  }
  
  // ─── Fit Operations ───
  
  /**
   * Fit bounds in view with padding
   */
  fitBounds(bounds: Bounds, padding: number = FIT_PADDING): void {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    
    // Calculate zoom to fit
    const scaleX = (this.state.canvasWidth - padding * 2) / bounds.width;
    const scaleY = (this.state.canvasHeight - padding * 2) / bounds.height;
    const zoom = this.clampZoom(Math.min(scaleX, scaleY));
    
    this.state.zoom = zoom;
    
    // Center the bounds
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    this.state.panX = centerX - (this.state.canvasWidth / 2) / zoom;
    this.state.panY = centerY - (this.state.canvasHeight / 2) / zoom;
    
    this.notifyListeners();
  }
  
  /**
   * Fit content in view
   */
  fitContent(contentBounds: Bounds): void {
    this.fitBounds(contentBounds, FIT_PADDING);
  }
  
  /**
   * Fit selection in view
   */
  fitSelection(selectionBounds: Bounds): void {
    // Use smaller padding for selection
    this.fitBounds(selectionBounds, FIT_PADDING * 2);
  }
  
  /**
   * Center on bounds without changing zoom
   */
  centerOn(bounds: Bounds): void {
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    this.panTo(centerX, centerY);
  }
  
  // ─── Animation ───
  
  /**
   * Animate to a new viewport state
   */
  animateTo(
    targetPanX: number,
    targetPanY: number,
    targetZoom: number,
    duration: number = 300
  ): Promise<void> {
    return new Promise(resolve => {
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
      }
      
      const startPanX = this.state.panX;
      const startPanY = this.state.panY;
      const startZoom = this.state.zoom;
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        
        this.state.panX = startPanX + (targetPanX - startPanX) * eased;
        this.state.panY = startPanY + (targetPanY - startPanY) * eased;
        this.state.zoom = startZoom + (targetZoom - startZoom) * eased;
        
        this.notifyListeners();
        
        if (progress < 1) {
          this.animationFrame = requestAnimationFrame(animate);
        } else {
          this.animationFrame = null;
          resolve();
        }
      };
      
      this.animationFrame = requestAnimationFrame(animate);
    });
  }
  
  /**
   * Animate to fit bounds
   */
  async animateToFitBounds(bounds: Bounds, duration: number = 300): Promise<void> {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    
    const scaleX = (this.state.canvasWidth - FIT_PADDING * 2) / bounds.width;
    const scaleY = (this.state.canvasHeight - FIT_PADDING * 2) / bounds.height;
    const targetZoom = this.clampZoom(Math.min(scaleX, scaleY));
    
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    const targetPanX = centerX - (this.state.canvasWidth / 2) / targetZoom;
    const targetPanY = centerY - (this.state.canvasHeight / 2) / targetZoom;
    
    await this.animateTo(targetPanX, targetPanY, targetZoom, duration);
  }
  
  // ─── Transform Matrix ───
  
  /**
   * Get the canvas transform matrix for rendering
   */
  getTransformMatrix(): DOMMatrix {
    const matrix = new DOMMatrix();
    matrix.scaleSelf(this.state.zoom, this.state.zoom);
    matrix.translateSelf(-this.state.panX, -this.state.panY);
    return matrix;
  }
  
  /**
   * Apply transform to canvas context
   */
  applyToContext(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(
      this.state.zoom * this.state.dpr,
      0,
      0,
      this.state.zoom * this.state.dpr,
      -this.state.panX * this.state.zoom * this.state.dpr,
      -this.state.panY * this.state.zoom * this.state.dpr
    );
  }
  
  // ─── Helpers ───
  
  private clampZoom(zoom: number): number {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
  }
  
  // ─── Listeners ───
  
  subscribe(listener: ViewportChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
  
  // ─── Serialization ───
  
  /**
   * Export viewport state for saving
   */
  exportState(): { panX: number; panY: number; zoom: number } {
    return {
      panX: this.state.panX,
      panY: this.state.panY,
      zoom: this.state.zoom,
    };
  }
  
  /**
   * Import viewport state
   */
  importState(state: { panX: number; panY: number; zoom: number }): void {
    this.state.panX = state.panX;
    this.state.panY = state.panY;
    this.state.zoom = this.clampZoom(state.zoom);
    this.notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const viewportManager = new ViewportManager();

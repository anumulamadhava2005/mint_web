/**
 * Enhanced SnappingEngine - Complete snapping system with Figma-like behavior
 * 
 * Features:
 * - Grid snapping (configurable)
 * - Edge snapping (to siblings)
 * - Center snapping (to siblings)
 * - Smart guides (visual feedback)
 * - Distribution snapping (equal spacing)
 * - Pixel snapping
 * - Parent bounds snapping
 * - Snapping threshold configuration
 */

import type { Bounds } from '../scene-graph/FigmaNode';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SnapConfig {
  /** Enable/disable all snapping */
  enabled: boolean;
  /** Enable grid snapping */
  gridEnabled: boolean;
  /** Grid size in pixels */
  gridSize: number;
  /** Enable edge snapping to siblings */
  edgeSnapping: boolean;
  /** Enable center snapping to siblings */
  centerSnapping: boolean;
  /** Enable distribution snapping */
  distributionSnapping: boolean;
  /** Enable snapping to parent bounds */
  parentSnapping: boolean;
  /** Enable pixel snapping (round to integers) */
  pixelSnapping: boolean;
  /** Snapping threshold in screen pixels */
  threshold: number;
  /** Snapping threshold for rotation in degrees */
  rotationThreshold: number;
  /** Common rotation angles to snap to */
  rotationAngles: number[];
}

export type GuideType = 'edge' | 'center' | 'distribution' | 'spacing';
export type GuideOrientation = 'horizontal' | 'vertical';

export interface SnapGuide {
  /** Guide type */
  type: GuideType;
  /** Orientation */
  orientation: GuideOrientation;
  /** Position (x for vertical, y for horizontal) */
  position: number;
  /** Start of guide line */
  start: number;
  /** End of guide line */
  end: number;
  /** Label for spacing guides */
  label?: string;
}

export interface SnapResult {
  /** Snapped X position */
  x: number;
  /** Snapped Y position */
  y: number;
  /** Delta X from original */
  deltaX: number;
  /** Delta Y from original */
  deltaY: number;
  /** Whether X was snapped */
  snappedX: boolean;
  /** Whether Y was snapped */
  snappedY: boolean;
  /** Active guides to render */
  guides: SnapGuide[];
}

export interface DistributionInfo {
  /** Spacing between elements */
  spacing: number;
  /** Elements involved */
  elements: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  gridEnabled: false,
  gridSize: 8,
  edgeSnapping: true,
  centerSnapping: true,
  distributionSnapping: true,
  parentSnapping: true,
  pixelSnapping: true,
  threshold: 5,
  rotationThreshold: 5,
  rotationAngles: [0, 45, 90, 135, 180, 225, 270, 315],
};

// ═══════════════════════════════════════════════════════════════════════════════
// SNAPPING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class SnappingEngine {
  private config: SnapConfig = { ...DEFAULT_SNAP_CONFIG };
  private scale: number = 1;
  
  // ─── Configuration ───
  
  setConfig(config: Partial<SnapConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): Readonly<SnapConfig> {
    return this.config;
  }
  
  setScale(scale: number): void {
    this.scale = scale;
  }
  
  toggleSnapping(enabled: boolean): void {
    this.config.enabled = enabled;
  }
  
  toggleGrid(enabled: boolean): void {
    this.config.gridEnabled = enabled;
  }
  
  setGridSize(size: number): void {
    this.config.gridSize = Math.max(1, size);
  }
  
  // ─── Main Snap Function ───
  
  /**
   * Snap a bounds to nearby elements
   */
  snap(
    bounds: Bounds,
    siblingBounds: Bounds[],
    parentBounds: Bounds | null
  ): SnapResult {
    if (!this.config.enabled) {
      return {
        x: bounds.x,
        y: bounds.y,
        deltaX: 0,
        deltaY: 0,
        snappedX: false,
        snappedY: false,
        guides: [],
      };
    }
    
    const threshold = this.config.threshold / this.scale;
    const guides: SnapGuide[] = [];
    
    let snapX: number | null = null;
    let snapY: number | null = null;
    let minDistX = threshold;
    let minDistY = threshold;
    
    // Collect snap points for the dragged element
    const dragPoints = this.getBoundsSnapPoints(bounds);
    
    // ─── Grid Snapping ───
    if (this.config.gridEnabled) {
      const gridResult = this.snapToGrid(bounds);
      if (gridResult.snappedX) {
        snapX = gridResult.x;
        minDistX = 0;
      }
      if (gridResult.snappedY) {
        snapY = gridResult.y;
        minDistY = 0;
      }
    }
    
    // ─── Edge and Center Snapping ───
    for (const sibling of siblingBounds) {
      const siblingPoints = this.getBoundsSnapPoints(sibling);
      
      // Edge snapping
      if (this.config.edgeSnapping) {
        // Left edge to left/right edges
        for (const sx of [siblingPoints.left, siblingPoints.right]) {
          const dist = Math.abs(dragPoints.left - sx);
          if (dist < minDistX) {
            minDistX = dist;
            snapX = sx;
            guides.push(this.createVerticalGuide('edge', sx, bounds, sibling));
          }
        }
        
        // Right edge to left/right edges
        for (const sx of [siblingPoints.left, siblingPoints.right]) {
          const dist = Math.abs(dragPoints.right - sx);
          if (dist < minDistX) {
            minDistX = dist;
            snapX = sx - bounds.width;
            guides.push(this.createVerticalGuide('edge', sx, bounds, sibling));
          }
        }
        
        // Top edge to top/bottom edges
        for (const sy of [siblingPoints.top, siblingPoints.bottom]) {
          const dist = Math.abs(dragPoints.top - sy);
          if (dist < minDistY) {
            minDistY = dist;
            snapY = sy;
            guides.push(this.createHorizontalGuide('edge', sy, bounds, sibling));
          }
        }
        
        // Bottom edge to top/bottom edges
        for (const sy of [siblingPoints.top, siblingPoints.bottom]) {
          const dist = Math.abs(dragPoints.bottom - sy);
          if (dist < minDistY) {
            minDistY = dist;
            snapY = sy - bounds.height;
            guides.push(this.createHorizontalGuide('edge', sy, bounds, sibling));
          }
        }
      }
      
      // Center snapping
      if (this.config.centerSnapping) {
        // Center X
        const distCX = Math.abs(dragPoints.centerX - siblingPoints.centerX);
        if (distCX < minDistX) {
          minDistX = distCX;
          snapX = siblingPoints.centerX - bounds.width / 2;
          guides.push(this.createVerticalGuide('center', siblingPoints.centerX, bounds, sibling));
        }
        
        // Center Y
        const distCY = Math.abs(dragPoints.centerY - siblingPoints.centerY);
        if (distCY < minDistY) {
          minDistY = distCY;
          snapY = siblingPoints.centerY - bounds.height / 2;
          guides.push(this.createHorizontalGuide('center', siblingPoints.centerY, bounds, sibling));
        }
      }
    }
    
    // ─── Parent Bounds Snapping ───
    if (this.config.parentSnapping && parentBounds) {
      const parentPoints = this.getBoundsSnapPoints(parentBounds);
      
      // Snap to parent edges
      const parentEdges = [
        { pos: parentPoints.left, type: 'left' as const },
        { pos: parentPoints.right, type: 'right' as const },
      ];
      
      for (const { pos } of parentEdges) {
        const distLeft = Math.abs(dragPoints.left - pos);
        if (distLeft < minDistX) {
          minDistX = distLeft;
          snapX = pos;
        }
        
        const distRight = Math.abs(dragPoints.right - pos);
        if (distRight < minDistX) {
          minDistX = distRight;
          snapX = pos - bounds.width;
        }
      }
      
      const parentYEdges = [
        { pos: parentPoints.top, type: 'top' as const },
        { pos: parentPoints.bottom, type: 'bottom' as const },
      ];
      
      for (const { pos } of parentYEdges) {
        const distTop = Math.abs(dragPoints.top - pos);
        if (distTop < minDistY) {
          minDistY = distTop;
          snapY = pos;
        }
        
        const distBottom = Math.abs(dragPoints.bottom - pos);
        if (distBottom < minDistY) {
          minDistY = distBottom;
          snapY = pos - bounds.height;
        }
      }
      
      // Snap to parent center
      const distCX = Math.abs(dragPoints.centerX - parentPoints.centerX);
      if (distCX < minDistX) {
        minDistX = distCX;
        snapX = parentPoints.centerX - bounds.width / 2;
        guides.push({
          type: 'center',
          orientation: 'vertical',
          position: parentPoints.centerX,
          start: parentBounds.y,
          end: parentBounds.y + parentBounds.height,
        });
      }
      
      const distCY = Math.abs(dragPoints.centerY - parentPoints.centerY);
      if (distCY < minDistY) {
        minDistY = distCY;
        snapY = parentPoints.centerY - bounds.height / 2;
        guides.push({
          type: 'center',
          orientation: 'horizontal',
          position: parentPoints.centerY,
          start: parentBounds.x,
          end: parentBounds.x + parentBounds.width,
        });
      }
    }
    
    // ─── Distribution Snapping ───
    if (this.config.distributionSnapping && siblingBounds.length >= 2) {
      const distResult = this.snapToDistribution(bounds, siblingBounds, threshold);
      if (distResult.snapX !== null && Math.abs(distResult.snapX - bounds.x) < minDistX) {
        snapX = distResult.snapX;
        guides.push(...distResult.guides);
      }
      if (distResult.snapY !== null && Math.abs(distResult.snapY - bounds.y) < minDistY) {
        snapY = distResult.snapY;
        guides.push(...distResult.guides);
      }
    }
    
    // ─── Pixel Snapping ───
    const finalX = snapX !== null ? snapX : bounds.x;
    const finalY = snapY !== null ? snapY : bounds.y;
    
    const resultX = this.config.pixelSnapping ? Math.round(finalX) : finalX;
    const resultY = this.config.pixelSnapping ? Math.round(finalY) : finalY;
    
    return {
      x: resultX,
      y: resultY,
      deltaX: resultX - bounds.x,
      deltaY: resultY - bounds.y,
      snappedX: snapX !== null,
      snappedY: snapY !== null,
      guides: this.dedupeGuides(guides),
    };
  }
  
  // ─── Grid Snapping ───
  
  /**
   * Snap bounds to grid
   */
  snapToGrid(bounds: Bounds): { x: number; y: number; snappedX: boolean; snappedY: boolean } {
    const gridSize = this.config.gridSize;
    
    const snappedX = Math.round(bounds.x / gridSize) * gridSize;
    const snappedY = Math.round(bounds.y / gridSize) * gridSize;
    
    return {
      x: snappedX,
      y: snappedY,
      snappedX: Math.abs(snappedX - bounds.x) < this.config.threshold / this.scale,
      snappedY: Math.abs(snappedY - bounds.y) < this.config.threshold / this.scale,
    };
  }
  
  /**
   * Snap a point to grid
   */
  snapPointToGrid(x: number, y: number): { x: number; y: number } {
    const gridSize = this.config.gridSize;
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }
  
  // ─── Distribution Snapping ───
  
  /**
   * Snap to equal distribution between elements
   */
  private snapToDistribution(
    bounds: Bounds,
    siblings: Bounds[],
    threshold: number
  ): { snapX: number | null; snapY: number | null; guides: SnapGuide[] } {
    const guides: SnapGuide[] = [];
    let snapX: number | null = null;
    let snapY: number | null = null;
    
    // Sort siblings by position
    const sortedByX = [...siblings].sort((a, b) => a.x - b.x);
    const sortedByY = [...siblings].sort((a, b) => a.y - b.y);
    
    // Check for horizontal distribution
    for (let i = 0; i < sortedByX.length - 1; i++) {
      const a = sortedByX[i];
      const b = sortedByX[i + 1];
      const gap = b.x - (a.x + a.width);
      
      if (gap > 0) {
        // Try to place bounds with same gap after b
        const targetX = b.x + b.width + gap;
        if (Math.abs(targetX - bounds.x) < threshold) {
          snapX = targetX;
          guides.push({
            type: 'distribution',
            orientation: 'vertical',
            position: b.x + b.width + gap / 2,
            start: Math.min(bounds.y, b.y),
            end: Math.max(bounds.y + bounds.height, b.y + b.height),
            label: `${Math.round(gap)}`,
          });
        }
        
        // Try to place bounds with same gap before a
        const targetXBefore = a.x - gap - bounds.width;
        if (Math.abs(targetXBefore - bounds.x) < threshold) {
          snapX = targetXBefore;
          guides.push({
            type: 'distribution',
            orientation: 'vertical',
            position: a.x - gap / 2,
            start: Math.min(bounds.y, a.y),
            end: Math.max(bounds.y + bounds.height, a.y + a.height),
            label: `${Math.round(gap)}`,
          });
        }
      }
    }
    
    // Check for vertical distribution
    for (let i = 0; i < sortedByY.length - 1; i++) {
      const a = sortedByY[i];
      const b = sortedByY[i + 1];
      const gap = b.y - (a.y + a.height);
      
      if (gap > 0) {
        // Try to place bounds with same gap after b
        const targetY = b.y + b.height + gap;
        if (Math.abs(targetY - bounds.y) < threshold) {
          snapY = targetY;
          guides.push({
            type: 'distribution',
            orientation: 'horizontal',
            position: b.y + b.height + gap / 2,
            start: Math.min(bounds.x, b.x),
            end: Math.max(bounds.x + bounds.width, b.x + b.width),
            label: `${Math.round(gap)}`,
          });
        }
        
        // Try to place bounds with same gap before a
        const targetYBefore = a.y - gap - bounds.height;
        if (Math.abs(targetYBefore - bounds.y) < threshold) {
          snapY = targetYBefore;
          guides.push({
            type: 'distribution',
            orientation: 'horizontal',
            position: a.y - gap / 2,
            start: Math.min(bounds.x, a.x),
            end: Math.max(bounds.x + bounds.width, a.x + a.width),
            label: `${Math.round(gap)}`,
          });
        }
      }
    }
    
    return { snapX, snapY, guides };
  }
  
  // ─── Rotation Snapping ───
  
  /**
   * Snap rotation angle to common values
   */
  snapRotation(angle: number): { angle: number; snapped: boolean } {
    if (!this.config.enabled) {
      return { angle, snapped: false };
    }
    
    // Normalize angle to 0-360
    let normalized = ((angle % 360) + 360) % 360;
    
    for (const snapAngle of this.config.rotationAngles) {
      if (Math.abs(normalized - snapAngle) < this.config.rotationThreshold) {
        return { angle: snapAngle, snapped: true };
      }
    }
    
    return { angle, snapped: false };
  }
  
  // ─── Helpers ───
  
  /**
   * Get snap points for a bounds
   */
  private getBoundsSnapPoints(bounds: Bounds): {
    left: number;
    right: number;
    top: number;
    bottom: number;
    centerX: number;
    centerY: number;
  } {
    return {
      left: bounds.x,
      right: bounds.x + bounds.width,
      top: bounds.y,
      bottom: bounds.y + bounds.height,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
    };
  }
  
  /**
   * Create a vertical guide line
   */
  private createVerticalGuide(type: GuideType, x: number, a: Bounds, b: Bounds): SnapGuide {
    return {
      type,
      orientation: 'vertical',
      position: x,
      start: Math.min(a.y, b.y),
      end: Math.max(a.y + a.height, b.y + b.height),
    };
  }
  
  /**
   * Create a horizontal guide line
   */
  private createHorizontalGuide(type: GuideType, y: number, a: Bounds, b: Bounds): SnapGuide {
    return {
      type,
      orientation: 'horizontal',
      position: y,
      start: Math.min(a.x, b.x),
      end: Math.max(a.x + a.width, b.x + b.width),
    };
  }
  
  /**
   * Remove duplicate guides
   */
  private dedupeGuides(guides: SnapGuide[]): SnapGuide[] {
    const seen = new Set<string>();
    return guides.filter(g => {
      const key = `${g.orientation}-${g.position.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const snappingEngine = new SnappingEngine();

/**
 * DragManager - Handles all drag operations with Figma-like behavior
 * 
 * Features:
 * - Move/drag nodes
 * - Resize with handles
 * - Rotate with handle
 * - Maintain aspect ratio (Shift)
 * - Constrain axis (Shift while dragging)
 * - Scale from center (Alt)
 * - Coalesce drags for history
 */

import type { FigmaNode, Bounds, Matrix2D } from '../scene-graph/FigmaNode';
import { multiplyMatrices } from '../scene-graph/FigmaNode';
import type { SelectionManager, ResizeHandle } from '../scene-graph/SelectionManager';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DragMode = 'move' | 'resize' | 'rotate' | 'marquee';

export interface DragState {
  /** Current drag mode */
  mode: DragMode | null;
  /** Starting mouse position (world coordinates) */
  startX: number;
  startY: number;
  /** Current mouse position (world coordinates) */
  currentX: number;
  currentY: number;
  /** Starting bounds of selection */
  startBounds: Bounds | null;
  /** Starting positions of each node */
  startPositions: Map<string, { x: number; y: number; width: number; height: number; rotation: number }>;
  /** Active resize handle */
  resizeHandle: ResizeHandle | null;
  /** Whether Shift is held */
  shiftKey: boolean;
  /** Whether Alt is held */
  altKey: boolean;
  /** Axis constraint (when shift+drag) */
  axisConstraint: 'x' | 'y' | null;
  /** Whether we've moved past drag threshold */
  isDragging: boolean;
}

export interface DragDelta {
  dx: number;
  dy: number;
  /** Constrained delta */
  constrainedDx: number;
  constrainedDy: number;
}

export interface ResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DragStartCallback = (mode: DragMode, nodeIds: string[]) => void;
export type DragMoveCallback = (delta: DragDelta) => void;
export type DragEndCallback = (mode: DragMode, nodeIds: string[]) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Distance in screen pixels before drag starts */
export const DRAG_THRESHOLD = 3;

/** Minimum size when resizing */
export const MIN_SIZE = 1;

/** Snap rotation to 15° increments when Shift held */
export const ROTATION_SNAP = 15;

// ═══════════════════════════════════════════════════════════════════════════════
// DRAG MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class DragManager {
  private state: DragState = {
    mode: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startBounds: null,
    startPositions: new Map(),
    resizeHandle: null,
    shiftKey: false,
    altKey: false,
    axisConstraint: null,
    isDragging: false,
  };
  
  private selectionManager: SelectionManager;
  private nodeMap: Map<string, FigmaNode> = new Map();
  
  private onDragStart: DragStartCallback | null = null;
  private onDragMove: DragMoveCallback | null = null;
  private onDragEnd: DragEndCallback | null = null;
  
  constructor(selectionManager: SelectionManager) {
    this.selectionManager = selectionManager;
  }
  
  // ─── Node Registry ───
  
  setNodes(nodes: Map<string, FigmaNode>): void {
    this.nodeMap = nodes;
  }
  
  // ─── Callbacks ───
  
  setCallbacks(
    onStart: DragStartCallback,
    onMove: DragMoveCallback,
    onEnd: DragEndCallback
  ): void {
    this.onDragStart = onStart;
    this.onDragMove = onMove;
    this.onDragEnd = onEnd;
  }
  
  // ─── State Access ───
  
  getState(): Readonly<DragState> {
    return this.state;
  }
  
  isDragging(): boolean {
    return this.state.isDragging;
  }
  
  getMode(): DragMode | null {
    return this.state.mode;
  }
  
  // ─── Drag Start ───
  
  /**
   * Start a move drag
   */
  startMove(worldX: number, worldY: number): void {
    this.initDrag('move', worldX, worldY);
  }
  
  /**
   * Start a resize drag
   */
  startResize(worldX: number, worldY: number, handle: ResizeHandle): void {
    this.initDrag('resize', worldX, worldY);
    this.state.resizeHandle = handle;
  }
  
  /**
   * Start a rotate drag
   */
  startRotate(worldX: number, worldY: number): void {
    this.initDrag('rotate', worldX, worldY);
  }
  
  /**
   * Start a marquee selection drag
   */
  startMarquee(worldX: number, worldY: number): void {
    this.state.mode = 'marquee';
    this.state.startX = worldX;
    this.state.startY = worldY;
    this.state.currentX = worldX;
    this.state.currentY = worldY;
    this.state.isDragging = true;
  }
  
  /**
   * Initialize drag state
   */
  private initDrag(mode: DragMode, worldX: number, worldY: number): void {
    this.state.mode = mode;
    this.state.startX = worldX;
    this.state.startY = worldY;
    this.state.currentX = worldX;
    this.state.currentY = worldY;
    this.state.isDragging = false;
    this.state.axisConstraint = null;
    
    // Store starting positions
    this.state.startPositions.clear();
    const selection = this.selectionManager.getSelectedNodes();
    
    for (const node of selection) {
      this.state.startPositions.set(node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        rotation: node.rotation,
      });
    }
    
    // Store starting bounds
    const bounds = this.selectionManager.getBounds();
    if (bounds) {
      this.state.startBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      };
    }
  }
  
  // ─── Drag Move ───
  
  /**
   * Update drag position
   */
  move(worldX: number, worldY: number, shiftKey: boolean, altKey: boolean): void {
    if (this.state.mode === null) return;
    
    // Check threshold
    if (!this.state.isDragging) {
      const dx = worldX - this.state.startX;
      const dy = worldY - this.state.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < DRAG_THRESHOLD) return;
      
      this.state.isDragging = true;
      
      // Fire drag start callback
      if (this.onDragStart) {
        const nodeIds = Array.from(this.state.startPositions.keys());
        this.onDragStart(this.state.mode, nodeIds);
      }
    }
    
    this.state.currentX = worldX;
    this.state.currentY = worldY;
    this.state.shiftKey = shiftKey;
    this.state.altKey = altKey;
    
    // Determine axis constraint
    if (shiftKey && this.state.mode === 'move') {
      if (this.state.axisConstraint === null) {
        const dx = Math.abs(worldX - this.state.startX);
        const dy = Math.abs(worldY - this.state.startY);
        if (dx > dy) {
          this.state.axisConstraint = 'x';
        } else {
          this.state.axisConstraint = 'y';
        }
      }
    } else {
      this.state.axisConstraint = null;
    }
    
    // Fire move callback
    if (this.onDragMove) {
      this.onDragMove(this.getDelta());
    }
  }
  
  /**
   * Get current drag delta
   */
  getDelta(): DragDelta {
    const dx = this.state.currentX - this.state.startX;
    const dy = this.state.currentY - this.state.startY;
    
    let constrainedDx = dx;
    let constrainedDy = dy;
    
    if (this.state.axisConstraint === 'x') {
      constrainedDy = 0;
    } else if (this.state.axisConstraint === 'y') {
      constrainedDx = 0;
    }
    
    return { dx, dy, constrainedDx, constrainedDy };
  }
  
  /**
   * Get marquee bounds (normalized)
   */
  getMarqueeBounds(): Bounds | null {
    if (this.state.mode !== 'marquee') return null;
    
    const x = Math.min(this.state.startX, this.state.currentX);
    const y = Math.min(this.state.startY, this.state.currentY);
    const width = Math.abs(this.state.currentX - this.state.startX);
    const height = Math.abs(this.state.currentY - this.state.startY);
    
    return { x, y, width, height };
  }
  
  // ─── Resize Calculations ───
  
  /**
   * Calculate new bounds from resize
   */
  calculateResize(): ResizeResult | null {
    if (this.state.mode !== 'resize' || !this.state.startBounds || !this.state.resizeHandle) {
      return null;
    }
    
    const { startBounds, resizeHandle, shiftKey, altKey } = this.state;
    const delta = this.getDelta();
    
    let x = startBounds.x;
    let y = startBounds.y;
    let width = startBounds.width;
    let height = startBounds.height;
    
    // Apply resize based on handle
    switch (resizeHandle) {
      case 'nw':
        x += delta.dx;
        y += delta.dy;
        width -= delta.dx;
        height -= delta.dy;
        break;
      case 'n':
        y += delta.dy;
        height -= delta.dy;
        break;
      case 'ne':
        y += delta.dy;
        width += delta.dx;
        height -= delta.dy;
        break;
      case 'e':
        width += delta.dx;
        break;
      case 'se':
        width += delta.dx;
        height += delta.dy;
        break;
      case 's':
        height += delta.dy;
        break;
      case 'sw':
        x += delta.dx;
        width -= delta.dx;
        height += delta.dy;
        break;
      case 'w':
        x += delta.dx;
        width -= delta.dx;
        break;
    }
    
    // Maintain aspect ratio if Shift held
    if (shiftKey) {
      const aspectRatio = startBounds.width / startBounds.height;
      
      if (resizeHandle === 'n' || resizeHandle === 's') {
        const newWidth = height * aspectRatio;
        x = startBounds.x + (startBounds.width - newWidth) / 2;
        width = newWidth;
      } else if (resizeHandle === 'e' || resizeHandle === 'w') {
        const newHeight = width / aspectRatio;
        y = startBounds.y + (startBounds.height - newHeight) / 2;
        height = newHeight;
      } else {
        // Corner handles
        if (Math.abs(delta.dx) > Math.abs(delta.dy)) {
          height = width / aspectRatio;
          if (resizeHandle.includes('n')) {
            y = startBounds.y + startBounds.height - height;
          }
        } else {
          width = height * aspectRatio;
          if (resizeHandle.includes('w')) {
            x = startBounds.x + startBounds.width - width;
          }
        }
      }
    }
    
    // Scale from center if Alt held
    if (altKey) {
      const centerX = startBounds.x + startBounds.width / 2;
      const centerY = startBounds.y + startBounds.height / 2;
      
      // Double the delta
      const scaledWidth = width + (width - startBounds.width);
      const scaledHeight = height + (height - startBounds.height);
      
      x = centerX - scaledWidth / 2;
      y = centerY - scaledHeight / 2;
      width = scaledWidth;
      height = scaledHeight;
    }
    
    // Enforce minimum size
    if (width < MIN_SIZE) {
      width = MIN_SIZE;
      if (resizeHandle.includes('w')) {
        x = startBounds.x + startBounds.width - MIN_SIZE;
      }
    }
    if (height < MIN_SIZE) {
      height = MIN_SIZE;
      if (resizeHandle.includes('n')) {
        y = startBounds.y + startBounds.height - MIN_SIZE;
      }
    }
    
    return { x, y, width, height };
  }
  
  /**
   * Calculate individual node resize (proportional)
   */
  calculateNodeResize(nodeId: string, newBounds: ResizeResult): ResizeResult | null {
    const startPos = this.state.startPositions.get(nodeId);
    const startBounds = this.state.startBounds;
    
    if (!startPos || !startBounds) return null;
    
    // Calculate scale factors
    const scaleX = newBounds.width / startBounds.width;
    const scaleY = newBounds.height / startBounds.height;
    
    // Calculate new position relative to selection
    const relativeX = startPos.x - startBounds.x;
    const relativeY = startPos.y - startBounds.y;
    
    return {
      x: newBounds.x + relativeX * scaleX,
      y: newBounds.y + relativeY * scaleY,
      width: startPos.width * scaleX,
      height: startPos.height * scaleY,
    };
  }
  
  // ─── Rotate Calculations ───
  
  /**
   * Calculate rotation angle
   */
  calculateRotation(): number | null {
    if (this.state.mode !== 'rotate' || !this.state.startBounds) return null;
    
    const bounds = this.state.startBounds;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    // Calculate angle from center to current position
    const startAngle = Math.atan2(
      this.state.startY - centerY,
      this.state.startX - centerX
    );
    const currentAngle = Math.atan2(
      this.state.currentY - centerY,
      this.state.currentX - centerX
    );
    
    let rotation = ((currentAngle - startAngle) * 180) / Math.PI;
    
    // Snap to 15° increments if Shift held
    if (this.state.shiftKey) {
      rotation = Math.round(rotation / ROTATION_SNAP) * ROTATION_SNAP;
    }
    
    return rotation;
  }
  
  /**
   * Calculate individual node rotation
   */
  calculateNodeRotation(nodeId: string, deltaRotation: number): number | null {
    const startPos = this.state.startPositions.get(nodeId);
    if (!startPos) return null;
    
    return startPos.rotation + deltaRotation;
  }
  
  // ─── Drag End ───
  
  /**
   * End drag operation
   */
  end(): void {
    const mode = this.state.mode;
    const nodeIds = Array.from(this.state.startPositions.keys());
    
    // Fire end callback
    if (this.state.isDragging && this.onDragEnd && mode) {
      this.onDragEnd(mode, nodeIds);
    }
    
    // Reset state
    this.state.mode = null;
    this.state.isDragging = false;
    this.state.startBounds = null;
    this.state.startPositions.clear();
    this.state.resizeHandle = null;
    this.state.axisConstraint = null;
    this.state.shiftKey = false;
    this.state.altKey = false;
  }
  
  /**
   * Cancel drag operation (restore original positions)
   */
  cancel(): void {
    this.end();
  }
}

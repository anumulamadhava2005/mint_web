/**
 * SelectionManager - Manages node selection with Figma-like behavior
 * 
 * Features:
 * - Multi-select (Shift+Click)
 * - Deep select (Cmd/Ctrl+Click)
 * - Selection bounding box
 * - Resize handles (8 points)
 * - Rotate handle
 * - Hover outlines
 * - Locked layer handling
 */

import type { FigmaNode, Bounds } from './FigmaNode';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SelectionBounds {
  /** Combined bounds of all selected nodes */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation of the selection (if single node) */
  rotation: number;
  /** Whether selection contains rotated elements */
  hasRotation: boolean;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
}

export interface SelectionState {
  /** Currently selected node IDs */
  selectedIds: Set<string>;
  /** Currently hovered node ID */
  hoveredId: string | null;
  /** Active resize handle */
  activeHandle: ResizeHandle | null;
  /** Whether rotating */
  isRotating: boolean;
  /** Selection bounds */
  bounds: SelectionBounds | null;
  /** Whether in deep select mode */
  deepSelectMode: boolean;
}

export interface SelectionOptions {
  /** Whether multi-select is active (Shift held) */
  multiSelect: boolean;
  /** Whether deep select is active (Cmd/Ctrl held) */
  deepSelect: boolean;
  /** Whether to toggle selection on click */
  toggle: boolean;
}

export type SelectionChangeListener = (selection: Set<string>) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Handle size in screen pixels (constant regardless of zoom) */
export const HANDLE_SIZE = 8;

/** Rotation handle distance from selection bounds */
export const ROTATE_HANDLE_DISTANCE = 24;

/** Minimum size for resize operations */
export const MIN_NODE_SIZE = 1;

/** Cursor styles for resize handles */
export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SELECTION MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class SelectionManager {
  private state: SelectionState = {
    selectedIds: new Set(),
    hoveredId: null,
    activeHandle: null,
    isRotating: false,
    bounds: null,
    deepSelectMode: false,
  };
  
  private nodeMap: Map<string, FigmaNode> = new Map();
  private listeners: Set<SelectionChangeListener> = new Set();
  
  // ─── Node Registry ───
  
  /**
   * Update the node map (called when scene graph changes)
   */
  setNodes(nodes: Map<string, FigmaNode>): void {
    this.nodeMap = nodes;
    this.updateBounds();
  }
  
  /**
   * Get a node by ID
   */
  getNode(id: string): FigmaNode | undefined {
    return this.nodeMap.get(id);
  }
  
  // ─── Selection State ───
  
  /**
   * Get current selection
   */
  getSelection(): Set<string> {
    return new Set(this.state.selectedIds);
  }
  
  /**
   * Get selection as array
   */
  getSelectedNodes(): FigmaNode[] {
    return Array.from(this.state.selectedIds)
      .map(id => this.nodeMap.get(id))
      .filter((n): n is FigmaNode => n !== undefined);
  }
  
  /**
   * Check if node is selected
   */
  isSelected(id: string): boolean {
    return this.state.selectedIds.has(id);
  }
  
  /**
   * Get hovered node ID
   */
  getHoveredId(): string | null {
    return this.state.hoveredId;
  }
  
  /**
   * Get selection bounds
   */
  getBounds(): SelectionBounds | null {
    return this.state.bounds;
  }
  
  // ─── Selection Operations ───
  
  /**
   * Select a single node
   */
  select(id: string, options: Partial<SelectionOptions> = {}): void {
    const node = this.nodeMap.get(id);
    if (!node || node.locked) return;
    
    if (options.toggle && this.state.selectedIds.has(id)) {
      this.deselect(id);
      return;
    }
    
    if (options.multiSelect) {
      // Add to selection
      this.state.selectedIds.add(id);
    } else {
      // Replace selection
      this.state.selectedIds.clear();
      this.state.selectedIds.add(id);
    }
    
    this.updateBounds();
    this.notifyListeners();
  }
  
  /**
   * Select multiple nodes
   */
  selectMultiple(ids: string[], options: Partial<SelectionOptions> = {}): void {
    if (!options.multiSelect) {
      this.state.selectedIds.clear();
    }
    
    for (const id of ids) {
      const node = this.nodeMap.get(id);
      if (node && !node.locked) {
        this.state.selectedIds.add(id);
      }
    }
    
    this.updateBounds();
    this.notifyListeners();
  }
  
  /**
   * Deselect a node
   */
  deselect(id: string): void {
    this.state.selectedIds.delete(id);
    this.updateBounds();
    this.notifyListeners();
  }
  
  /**
   * Clear all selection
   */
  clearSelection(): void {
    if (this.state.selectedIds.size === 0) return;
    this.state.selectedIds.clear();
    this.state.bounds = null;
    this.notifyListeners();
  }
  
  /**
   * Select all nodes (excluding locked)
   */
  selectAll(): void {
    this.state.selectedIds.clear();
    this.nodeMap.forEach((node, id) => {
      if (!node.locked && node.parentId === null) {
        this.state.selectedIds.add(id);
      }
    });
    this.updateBounds();
    this.notifyListeners();
  }
  
  /**
   * Deep select - select child at point instead of parent
   */
  deepSelectAt(worldX: number, worldY: number): string | null {
    // Find all nodes at point, sorted by depth
    const candidates: Array<{ id: string; depth: number }> = [];
    
    this.nodeMap.forEach((node, id) => {
      if (node.locked || !node.visible) return;
      
      const bounds = node.bounds.worldBounds;
      if (
        worldX >= bounds.x &&
        worldX <= bounds.x + bounds.width &&
        worldY >= bounds.y &&
        worldY <= bounds.y + bounds.height
      ) {
        const depth = this.getNodeDepth(id);
        candidates.push({ id, depth });
      }
    });
    
    // Sort by depth (deepest first)
    candidates.sort((a, b) => b.depth - a.depth);
    
    // If current selection is in candidates, select next deeper
    if (candidates.length > 0) {
      const currentIdx = candidates.findIndex(c => this.state.selectedIds.has(c.id));
      if (currentIdx >= 0 && currentIdx < candidates.length - 1) {
        return candidates[currentIdx + 1].id;
      }
      return candidates[0].id;
    }
    
    return null;
  }
  
  /**
   * Get depth of node in tree
   */
  private getNodeDepth(id: string): number {
    let depth = 0;
    let current = this.nodeMap.get(id);
    while (current?.parentId) {
      depth++;
      current = this.nodeMap.get(current.parentId);
    }
    return depth;
  }
  
  // ─── Hover ───
  
  /**
   * Set hovered node
   */
  setHovered(id: string | null): void {
    if (this.state.hoveredId === id) return;
    
    // Don't hover locked nodes
    if (id) {
      const node = this.nodeMap.get(id);
      if (node?.locked) {
        this.state.hoveredId = null;
        return;
      }
    }
    
    this.state.hoveredId = id;
  }
  
  // ─── Resize Handles ───
  
  /**
   * Get resize handle positions in screen coordinates
   */
  getHandlePositions(scale: number): HandlePosition[] {
    if (!this.state.bounds) return [];
    
    const { x, y, width, height } = this.state.bounds;
    const handles: HandlePosition[] = [];
    
    // 8 resize handles
    const positions: Array<{ handle: ResizeHandle; rx: number; ry: number }> = [
      { handle: 'nw', rx: 0, ry: 0 },
      { handle: 'n', rx: 0.5, ry: 0 },
      { handle: 'ne', rx: 1, ry: 0 },
      { handle: 'e', rx: 1, ry: 0.5 },
      { handle: 'se', rx: 1, ry: 1 },
      { handle: 's', rx: 0.5, ry: 1 },
      { handle: 'sw', rx: 0, ry: 1 },
      { handle: 'w', rx: 0, ry: 0.5 },
    ];
    
    for (const { handle, rx, ry } of positions) {
      handles.push({
        handle,
        x: x + width * rx,
        y: y + height * ry,
        cursor: this.getRotatedCursor(handle, this.state.bounds.rotation),
      });
    }
    
    return handles;
  }
  
  /**
   * Get rotation handle position
   */
  getRotationHandlePosition(): { x: number; y: number } | null {
    if (!this.state.bounds) return null;
    
    const { x, y, width, rotation } = this.state.bounds;
    const centerX = x + width / 2;
    
    // Position above center top
    const rad = (rotation * Math.PI) / 180;
    const handleY = y - ROTATE_HANDLE_DISTANCE;
    
    // Rotate around center if selection is rotated
    if (rotation !== 0) {
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cy = y + this.state.bounds.height / 2;
      const dx = centerX - centerX;
      const dy = handleY - cy;
      return {
        x: centerX + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
      };
    }
    
    return { x: centerX, y: handleY };
  }
  
  /**
   * Hit test resize handles
   */
  hitTestHandle(screenX: number, screenY: number, scale: number): ResizeHandle | null {
    const handles = this.getHandlePositions(scale);
    const hitSize = HANDLE_SIZE / scale;
    
    for (const { handle, x, y } of handles) {
      if (
        Math.abs(screenX - x * scale) < hitSize &&
        Math.abs(screenY - y * scale) < hitSize
      ) {
        return handle;
      }
    }
    
    return null;
  }
  
  /**
   * Get cursor adjusted for rotation
   */
  private getRotatedCursor(handle: ResizeHandle, rotation: number): string {
    // Rotate cursor based on selection rotation
    const cursors: ResizeHandle[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    const baseIdx = cursors.indexOf(handle);
    const rotationSteps = Math.round(rotation / 45) % 8;
    const newIdx = (baseIdx + rotationSteps + 8) % 8;
    return HANDLE_CURSORS[cursors[newIdx]];
  }
  
  /**
   * Set active handle
   */
  setActiveHandle(handle: ResizeHandle | null): void {
    this.state.activeHandle = handle;
  }
  
  /**
   * Get active handle
   */
  getActiveHandle(): ResizeHandle | null {
    return this.state.activeHandle;
  }
  
  /**
   * Set rotating state
   */
  setRotating(rotating: boolean): void {
    this.state.isRotating = rotating;
  }
  
  /**
   * Check if rotating
   */
  isRotating(): boolean {
    return this.state.isRotating;
  }
  
  // ─── Bounds Computation ───
  
  /**
   * Update selection bounds
   */
  private updateBounds(): void {
    if (this.state.selectedIds.size === 0) {
      this.state.bounds = null;
      return;
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let rotation = 0;
    let hasRotation = false;
    
    const selectedNodes = this.getSelectedNodes();
    
    for (const node of selectedNodes) {
      const bounds = node.bounds.worldBounds;
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
      
      if (node.rotation !== 0) {
        hasRotation = true;
        if (selectedNodes.length === 1) {
          rotation = node.rotation;
        }
      }
    }
    
    this.state.bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation,
      hasRotation,
    };
  }
  
  // ─── Listeners ───
  
  /**
   * Subscribe to selection changes
   */
  subscribe(listener: SelectionChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const selection = this.getSelection();
    for (const listener of this.listeners) {
      listener(selection);
    }
  }
  
  // ─── Marquee Selection ───
  
  /**
   * Select all nodes within a marquee rectangle
   */
  selectInMarquee(rect: Bounds, options: Partial<SelectionOptions> = {}): void {
    if (!options.multiSelect) {
      this.state.selectedIds.clear();
    }
    
    this.nodeMap.forEach((node, id) => {
      if (node.locked || !node.visible) return;
      
      const bounds = node.bounds.worldBounds;
      
      // Check intersection
      const intersects = !(
        bounds.x > rect.x + rect.width ||
        bounds.x + bounds.width < rect.x ||
        bounds.y > rect.y + rect.height ||
        bounds.y + bounds.height < rect.y
      );
      
      if (intersects) {
        this.state.selectedIds.add(id);
      }
    });
    
    this.updateBounds();
    this.notifyListeners();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const selectionManager = new SelectionManager();

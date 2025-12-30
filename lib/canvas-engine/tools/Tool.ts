/**
 * Tool Interface - Standardized tool behavior for canvas interactions
 * 
 * Each tool defines how it responds to pointer and keyboard events.
 * Tools are stateless handlers; state lives in the ToolContext.
 */

import type { NodeInput } from '../../figma-types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolPointerEvent {
  /** Client X coordinate */
  clientX: number;
  /** Client Y coordinate */
  clientY: number;
  /** World X coordinate */
  worldX: number;
  /** World Y coordinate */
  worldY: number;
  /** Screen X (relative to canvas) */
  screenX: number;
  /** Screen Y (relative to canvas) */
  screenY: number;
  /** Mouse button (0=left, 1=middle, 2=right) */
  button: number;
  /** Ctrl key held */
  ctrlKey: boolean;
  /** Meta key held (Cmd on Mac) */
  metaKey: boolean;
  /** Shift key held */
  shiftKey: boolean;
  /** Alt key held */
  altKey: boolean;
}

export interface ToolKeyEvent {
  /** Key value */
  key: string;
  /** Key code */
  code: string;
  /** Ctrl key held */
  ctrlKey: boolean;
  /** Meta key held */
  metaKey: boolean;
  /** Shift key held */
  shiftKey: boolean;
  /** Alt key held */
  altKey: boolean;
  /** Prevent default behavior */
  preventDefault: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Context - shared state and callbacks
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ToolContext {
  // ─── State Accessors ───
  
  /** Get current scale */
  getScale: () => number;
  
  /** Get current offset */
  getOffset: () => { x: number; y: number };
  
  /** Get selected node IDs */
  getSelection: () => Set<string>;
  
  /** Get all drawable nodes */
  getDrawableNodes: () => Array<{ id: string; x: number; y: number; width: number; height: number; type: string }>;
  
  /** Get node bounds by ID */
  getNodeBounds: (id: string) => NodeBounds | null;
  
  /** Get parent ID of a node */
  getParentId: (id: string) => string | null;
  
  /** Get raw roots */
  getRawRoots: () => NodeInput[] | null;
  
  /** Hit test node at world position */
  hitTestNode: (wx: number, wy: number) => string | null;
  
  /** Hit test resize handle at screen position */
  hitTestResizeHandle: (sx: number, sy: number, selectedId: string) => ResizeHandle | null;
  
  // ─── State Mutators ───
  
  /** Set selection */
  setSelection: (ids: Set<string>) => void;
  
  /** Set offset */
  setOffset: (offset: { x: number; y: number }) => void;
  
  /** Set scale */
  setScale: (scale: number) => void;
  
  /** Update raw roots */
  setRawRoots: (roots: NodeInput[] | null) => void;
  
  /** Set cursor style */
  setCursor: (cursor: string) => void;
  
  /** Request canvas redraw */
  requestRedraw: () => void;
  
  /** Mark user changes (for persistence) */
  markChanged: () => void;
  
  // ─── Node Operations ───
  
  /** Create a new node */
  createNode: (node: Partial<NodeInput>, parentId: string | null) => string;
  
  /** Update node bounds */
  updateNodeBounds: (id: string, bounds: Partial<NodeBounds>) => void;
  
  /** Update node positions by offsets */
  updateNodePositions: (offsets: Map<string, { dx: number; dy: number }>) => void;
  
  /** Delete nodes */
  deleteNodes: (ids: Set<string>) => void;
  
  // ─── Alignment ───
  
  /** Calculate alignment snap */
  calculateAlignmentSnap: (
    nodeId: string,
    dx: number,
    dy: number
  ) => {
    finalDx: number;
    finalDy: number;
    guides: AlignmentGuides;
  };
  
  /** Set alignment guides for rendering */
  setAlignmentGuides: (guides: AlignmentGuides) => void;
  
  /** Clear alignment guides */
  clearAlignmentGuides: () => void;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface AlignmentGuides {
  verticalLines: Array<{ x: number; parentX: number; parentY: number; parentW: number; parentH: number }>;
  horizontalLines: Array<{ y: number; parentX: number; parentY: number; parentW: number; parentH: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool State - per-tool transient state
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolState {
  /** Is the tool currently active (pointer down) */
  isActive: boolean;
  /** Any tool-specific data */
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface Tool {
  /** Unique tool identifier */
  readonly id: ToolId;
  
  /** Display name */
  readonly name: string;
  
  /** Default cursor when tool is active */
  readonly cursor: string;
  
  /** Called when tool becomes active */
  onActivate?: (ctx: ToolContext, state: ToolState) => void;
  
  /** Called when tool becomes inactive */
  onDeactivate?: (ctx: ToolContext, state: ToolState) => void;
  
  /** Handle pointer down */
  onPointerDown: (event: ToolPointerEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Handle pointer move */
  onPointerMove: (event: ToolPointerEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Handle pointer up */
  onPointerUp: (event: ToolPointerEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Handle key down */
  onKeyDown?: (event: ToolKeyEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Handle key up */
  onKeyUp?: (event: ToolKeyEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Handle wheel event */
  onWheel?: (event: WheelEvent, ctx: ToolContext, state: ToolState) => void;
  
  /** Render tool-specific overlay (e.g., marquee, creation preview) */
  renderOverlay?: (ctx: CanvasRenderingContext2D, toolCtx: ToolContext, state: ToolState) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool IDs
// ─────────────────────────────────────────────────────────────────────────────

export type ToolId = 
  | 'select'
  | 'hand'
  | 'rect'
  | 'ellipse'
  | 'text'
  | 'pen'
  | 'grid';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createToolState(): ToolState {
  return {
    isActive: false,
    data: {},
  };
}

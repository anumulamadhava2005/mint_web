/**
 * useToolManager - React hook for integrating ToolManager with canvas components
 */

import { useRef, useCallback, useMemo, useEffect } from 'react';
import type { NodeInput } from '../../figma-types';
import type { 
  ToolId, 
  ToolContext, 
  ToolPointerEvent, 
  NodeBounds,
  AlignmentGuides,
  ResizeHandle,
} from './Tool';
import { ToolManager } from './ToolManager';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UseToolManagerConfig {
  /** Initial tool to activate */
  initialTool?: ToolId;
}

export interface UseToolManagerDeps {
  /** Current scale */
  scale: number;
  /** Current offset */
  offset: { x: number; y: number };
  /** Current selection */
  selection: Set<string>;
  /** Drawable nodes */
  drawableNodes: Array<{ id: string; x: number; y: number; width: number; height: number; type: string }>;
  /** Raw roots for data manipulation */
  rawRoots: NodeInput[] | null;
}

export interface UseToolManagerCallbacks {
  /** Set selection */
  setSelection: (ids: Set<string>) => void;
  /** Set offset */
  setOffset: (offset: { x: number; y: number }) => void;
  /** Set scale */
  setScale: (scale: number) => void;
  /** Set raw roots */
  setRawRoots: (roots: NodeInput[] | null) => void;
  /** Set cursor */
  setCursor: (cursor: string) => void;
  /** Request canvas redraw */
  requestRedraw: () => void;
  /** Mark changes for persistence */
  markChanged: () => void;
  /** Create a node */
  createNode: (node: Partial<NodeInput>, parentId: string | null) => string;
  /** Update node bounds */
  updateNodeBounds: (id: string, bounds: Partial<NodeBounds>) => void;
  /** Delete nodes */
  deleteNodes: (ids: Set<string>) => void;
  /** Hit test node at world position */
  hitTestNode: (wx: number, wy: number) => string | null;
  /** Hit test resize handle */
  hitTestResizeHandle: (sx: number, sy: number, selectedId: string) => ResizeHandle | null;
  /** Get node bounds */
  getNodeBounds: (id: string) => NodeBounds | null;
  /** Get parent ID */
  getParentId: (id: string) => string | null;
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
  /** Set alignment guides */
  setAlignmentGuides: (guides: AlignmentGuides) => void;
  /** Clear alignment guides */
  clearAlignmentGuides: () => void;
}

export interface UseToolManagerResult {
  /** Current active tool ID */
  activeToolId: ToolId;
  /** Set the active tool */
  setActiveTool: (toolId: ToolId) => void;
  /** Handle pointer down event */
  handlePointerDown: (e: React.PointerEvent, worldX: number, worldY: number) => void;
  /** Handle pointer move event */
  handlePointerMove: (e: React.PointerEvent, worldX: number, worldY: number) => void;
  /** Handle pointer up event */
  handlePointerUp: (e: React.PointerEvent, worldX: number, worldY: number) => void;
  /** Handle key down event */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  /** Handle key up event */
  handleKeyUp: (e: React.KeyboardEvent) => void;
  /** Handle wheel event */
  handleWheel: (e: WheelEvent) => void;
  /** Render tool overlay */
  renderOverlay: (ctx: CanvasRenderingContext2D) => void;
  /** Check if tool is in active operation */
  isToolActive: () => boolean;
  /** The tool manager instance */
  manager: ToolManager;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useToolManager(
  config: UseToolManagerConfig,
  deps: UseToolManagerDeps,
  callbacks: UseToolManagerCallbacks
): UseToolManagerResult {
  // Store deps and callbacks in refs for stable context
  const depsRef = useRef(deps);
  const callbacksRef = useRef(callbacks);
  
  // Update refs when values change
  useEffect(() => {
    depsRef.current = deps;
  }, [deps]);
  
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);
  
  // Create stable tool context
  const toolContext = useMemo<ToolContext>(() => ({
    // State accessors
    getScale: () => depsRef.current.scale,
    getOffset: () => depsRef.current.offset,
    getSelection: () => depsRef.current.selection,
    getDrawableNodes: () => depsRef.current.drawableNodes,
    getRawRoots: () => depsRef.current.rawRoots,
    getNodeBounds: (id) => callbacksRef.current.getNodeBounds(id),
    getParentId: (id) => callbacksRef.current.getParentId(id),
    hitTestNode: (wx, wy) => callbacksRef.current.hitTestNode(wx, wy),
    hitTestResizeHandle: (sx, sy, selectedId) => callbacksRef.current.hitTestResizeHandle(sx, sy, selectedId),
    
    // State mutators
    setSelection: (ids) => callbacksRef.current.setSelection(ids),
    setOffset: (offset) => callbacksRef.current.setOffset(offset),
    setScale: (scale) => callbacksRef.current.setScale(scale),
    setRawRoots: (roots) => callbacksRef.current.setRawRoots(roots),
    setCursor: (cursor) => callbacksRef.current.setCursor(cursor),
    requestRedraw: () => callbacksRef.current.requestRedraw(),
    markChanged: () => callbacksRef.current.markChanged(),
    
    // Node operations
    createNode: (node, parentId) => callbacksRef.current.createNode(node, parentId),
    updateNodeBounds: (id, bounds) => callbacksRef.current.updateNodeBounds(id, bounds),
    updateNodePositions: (offsets) => {
      // Update node positions by applying offsets
      const roots = depsRef.current.rawRoots;
      if (!roots) return;
      
      const updateNode = (nodes: NodeInput[]): NodeInput[] => {
        return nodes.map(node => {
          const offset = offsets.get(node.id);
          if (offset) {
            return {
              ...node,
              x: (node.x ?? 0) + offset.dx,
              y: (node.y ?? 0) + offset.dy,
              children: node.children ? updateNode(node.children) : [],
            };
          }
          return {
            ...node,
            children: node.children ? updateNode(node.children) : [],
          };
        });
      };
      
      callbacksRef.current.setRawRoots(updateNode(roots));
    },
    deleteNodes: (ids) => callbacksRef.current.deleteNodes(ids),
    
    // Alignment
    calculateAlignmentSnap: (nodeId, dx, dy) => callbacksRef.current.calculateAlignmentSnap(nodeId, dx, dy),
    setAlignmentGuides: (guides) => callbacksRef.current.setAlignmentGuides(guides),
    clearAlignmentGuides: () => callbacksRef.current.clearAlignmentGuides(),
  }), []); // Empty deps - refs are stable
  
  // Create tool manager ref
  const managerRef = useRef<ToolManager | null>(null);
  
  if (!managerRef.current) {
    managerRef.current = new ToolManager(toolContext, config.initialTool ?? 'select');
  }
  
  // Update context when deps/callbacks change
  useEffect(() => {
    managerRef.current?.updateContext(toolContext);
  }, [toolContext]);
  
  // Convert React pointer event to ToolPointerEvent
  const createPointerEvent = useCallback((
    e: React.PointerEvent,
    worldX: number,
    worldY: number
  ): ToolPointerEvent => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      clientX: e.clientX,
      clientY: e.clientY,
      worldX,
      worldY,
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
      button: e.button,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };
  }, []);
  
  // Event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent, worldX: number, worldY: number) => {
    const event = createPointerEvent(e, worldX, worldY);
    managerRef.current?.handlePointerDown(event);
  }, [createPointerEvent]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent, worldX: number, worldY: number) => {
    const event = createPointerEvent(e, worldX, worldY);
    managerRef.current?.handlePointerMove(event);
  }, [createPointerEvent]);
  
  const handlePointerUp = useCallback((e: React.PointerEvent, worldX: number, worldY: number) => {
    const event = createPointerEvent(e, worldX, worldY);
    managerRef.current?.handlePointerUp(event);
  }, [createPointerEvent]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    managerRef.current?.handleKeyDown({
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      preventDefault: () => e.preventDefault(),
    });
  }, []);
  
  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    managerRef.current?.handleKeyUp({
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      preventDefault: () => e.preventDefault(),
    });
  }, []);
  
  const handleWheel = useCallback((e: WheelEvent) => {
    managerRef.current?.handleWheel(e);
  }, []);
  
  const renderOverlay = useCallback((ctx: CanvasRenderingContext2D) => {
    managerRef.current?.renderOverlay(ctx);
  }, []);
  
  const setActiveTool = useCallback((toolId: ToolId) => {
    managerRef.current?.setActiveTool(toolId);
  }, []);
  
  const isToolActive = useCallback(() => {
    return managerRef.current?.isActive() ?? false;
  }, []);
  
  return {
    activeToolId: managerRef.current.getActiveToolId(),
    setActiveTool,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleKeyDown,
    handleKeyUp,
    handleWheel,
    renderOverlay,
    isToolActive,
    manager: managerRef.current,
  };
}

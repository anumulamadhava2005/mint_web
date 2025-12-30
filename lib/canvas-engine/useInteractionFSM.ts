"use client";

import { useRef, useCallback, useMemo } from "react";
import {
  CanvasInteractionFSM,
  createCanvasInteractionFSM,
  FSMDependencies,
  FSMConfig,
  FSMAction,
  InteractionEvent,
  InteractionState,
  ResizeHandle,
} from "./InteractionFSM";
import type { DrawableNode, NodeInput } from "../figma-types";

// ─────────────────────────────────────────────────────────────────────────────
// Hook Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface UseInteractionFSMConfig {
  /** Pixels before click becomes drag */
  dragThreshold?: number;
  /** Pixels for alignment snapping */
  alignmentThreshold?: number;
  /** Mouse button for panning (default: 1 = middle) */
  panButton?: number;
}

export interface UseInteractionFSMDeps {
  /** Current canvas scale */
  scale: number;
  /** Current canvas offset */
  offset: { x: number; y: number };
  /** Currently selected node IDs */
  selectedIds: Set<string>;
  /** All drawable nodes */
  drawableNodes: DrawableNode[];
  /** Raw roots for node lookup */
  rawRoots: NodeInput[] | null;
  /** Current tool */
  tool: "select" | "rect" | "ellipse" | "text" | "grid" | "pen";
  /** Canvas element ref for coordinate conversion */
  canvasRef: React.RefObject<HTMLCanvasElement>;
  /** Whether space key is held */
  isSpaceHeld: boolean;
  /** Node map for quick lookup */
  nodeMap: Map<string, DrawableNode & { raw: NodeInput }>;
  /** Child to parent map */
  childToParentMap: Map<string, string>;
}

export interface UseInteractionFSMCallbacks {
  setSelectedIds: (ids: Set<string>) => void;
  setOffset: (offset: { x: number; y: number }) => void;
  setScale: (scale: number) => void;
  setRawRoots: (roots: NodeInput[] | null) => void;
  requestRedraw: () => void;
  onSelectInteraction?: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useInteractionFSM(
  deps: UseInteractionFSMDeps,
  callbacks: UseInteractionFSMCallbacks,
  config?: UseInteractionFSMConfig
) {
  // Store latest deps/callbacks in refs for FSM access
  const depsRef = useRef(deps);
  const callbacksRef = useRef(callbacks);
  depsRef.current = deps;
  callbacksRef.current = callbacks;
  
  // Alignment guides state
  const alignmentGuidesRef = useRef<{
    verticalLines: Array<{ x: number; parentX: number; parentY: number; parentW: number; parentH: number }>;
    horizontalLines: Array<{ y: number; parentX: number; parentY: number; parentW: number; parentH: number }>;
  }>({ verticalLines: [], horizontalLines: [] });
  
  // Cursor state
  const cursorRef = useRef<string>("default");
  
  // Hover state
  const hoveredIdRef = useRef<string | null>(null);
  
  // Drag offsets for visual feedback
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(new Map());
  
  // Create FSM dependencies
  const fsmDeps = useMemo<FSMDependencies>(() => ({
    toWorld: (clientX: number, clientY: number) => {
      const canvas = depsRef.current.canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return { wx: 0, wy: 0, sx: 0, sy: 0 };
      
      const { scale, offset } = depsRef.current;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = (sx - offset.x) / scale;
      const wy = (sy - offset.y) / scale;
      return { wx, wy, sx, sy };
    },
    
    hitTestNode: (wx: number, wy: number) => {
      const { drawableNodes, scale } = depsRef.current;
      const tolerance = 3 / scale;
      
      // Iterate backwards for top-to-bottom hit testing
      for (let i = drawableNodes.length - 1; i >= 0; i--) {
        const n = drawableNodes[i];
        if (
          wx >= n.x - tolerance &&
          wx <= n.x + n.width + tolerance &&
          wy >= n.y - tolerance &&
          wy <= n.y + n.height + tolerance
        ) {
          return n.id;
        }
      }
      return null;
    },
    
    hitTestResizeHandle: (sx: number, sy: number, selectedId: string) => {
      const { drawableNodes, scale, offset } = depsRef.current;
      const node = drawableNodes.find(n => n.id === selectedId);
      if (!node) return null;
      
      const screenX = offset.x + node.x * scale;
      const screenY = offset.y + node.y * scale;
      const screenW = node.width * scale;
      const screenH = node.height * scale;
      const handleSize = 8;
      const half = handleSize / 2;
      
      const handles: Array<{ key: ResizeHandle; x: number; y: number }> = [
        { key: "nw", x: screenX, y: screenY },
        { key: "n", x: screenX + screenW / 2, y: screenY },
        { key: "ne", x: screenX + screenW, y: screenY },
        { key: "e", x: screenX + screenW, y: screenY + screenH / 2 },
        { key: "se", x: screenX + screenW, y: screenY + screenH },
        { key: "s", x: screenX + screenW / 2, y: screenY + screenH },
        { key: "sw", x: screenX, y: screenY + screenH },
        { key: "w", x: screenX, y: screenY + screenH / 2 },
      ];
      
      const hit = handles.find(h => 
        Math.abs(sx - h.x) <= half + 2 && Math.abs(sy - h.y) <= half + 2
      );
      
      return hit?.key ?? null;
    },
    
    hitTestInteraction: (sx: number, sy: number) => {
      // Would integrate with interaction geometries - return null for now
      return null;
    },
    
    getSelection: () => depsRef.current.selectedIds,
    getOffset: () => depsRef.current.offset,
    getScale: () => depsRef.current.scale,
    
    getNodeBounds: (id: string) => {
      const { drawableNodes } = depsRef.current;
      const node = drawableNodes.find(n => n.id === id);
      if (!node) return null;
      return { x: node.x, y: node.y, width: node.width, height: node.height };
    },
    
    getParentId: (id: string) => {
      return depsRef.current.childToParentMap.get(id) ?? null;
    },
    
    getTool: () => depsRef.current.tool,
    isSpaceHeld: () => depsRef.current.isSpaceHeld,
    
    calculateAlignmentSnap: (nodeId: string, dx: number, dy: number) => {
      const { nodeMap, childToParentMap } = depsRef.current;
      const THRESHOLD = config?.alignmentThreshold ?? 12;
      
      const guides = {
        verticalLines: [] as Array<{ x: number; parentX: number; parentY: number; parentW: number; parentH: number }>,
        horizontalLines: [] as Array<{ y: number; parentX: number; parentY: number; parentW: number; parentH: number }>,
      };
      
      let finalDx = dx;
      let finalDy = dy;
      
      const node = nodeMap.get(nodeId);
      if (!node) return { finalDx, finalDy, guides };
      
      const parentId = childToParentMap.get(nodeId);
      const parent = parentId ? nodeMap.get(parentId) : null;
      
      if (parent) {
        // Calculate centers
        const nodeCenterX = node.x + dx + node.width / 2;
        const nodeCenterY = node.y + dy + node.height / 2;
        const parentCenterX = parent.x + parent.width / 2;
        const parentCenterY = parent.y + parent.height / 2;
        
        // Horizontal snap
        if (Math.abs(nodeCenterX - parentCenterX) < THRESHOLD) {
          finalDx = parentCenterX - node.width / 2 - node.x;
          guides.verticalLines.push({
            x: parentCenterX,
            parentX: parent.x,
            parentY: parent.y,
            parentW: parent.width,
            parentH: parent.height,
          });
        }
        
        // Vertical snap
        if (Math.abs(nodeCenterY - parentCenterY) < THRESHOLD) {
          finalDy = parentCenterY - node.height / 2 - node.y;
          guides.horizontalLines.push({
            y: parentCenterY,
            parentX: parent.x,
            parentY: parent.y,
            parentW: parent.width,
            parentH: parent.height,
          });
        }
      }
      
      return { finalDx, finalDy, guides };
    },
  }), [config?.alignmentThreshold]);
  
  // Create FSM instance
  const fsmRef = useRef<CanvasInteractionFSM | null>(null);
  if (!fsmRef.current) {
    fsmRef.current = createCanvasInteractionFSM(fsmDeps, {
      dragThreshold: config?.dragThreshold,
      alignmentThreshold: config?.alignmentThreshold,
      panButton: config?.panButton,
    });
  }
  
  // Action handler
  const handleActions = useCallback((actions: FSMAction[]) => {
    const { setSelectedIds, setOffset, setScale, setRawRoots, requestRedraw, onSelectInteraction } = callbacksRef.current;
    
    for (const action of actions) {
      switch (action.type) {
        case 'SET_SELECTION':
          setSelectedIds(action.ids);
          break;
          
        case 'CLEAR_SELECTION':
          setSelectedIds(new Set());
          break;
          
        case 'UPDATE_NODE_POSITIONS':
          dragOffsetsRef.current = new Map(action.offsets);
          break;
          
        case 'FINALIZE_DRAG':
          // Apply final positions to raw roots
          const { rawRoots } = depsRef.current;
          if (rawRoots && action.offsets.size > 0) {
            // Would call updateNodePositions here
          }
          dragOffsetsRef.current.clear();
          break;
          
        case 'UPDATE_OFFSET':
          setOffset(action.offset);
          break;
          
        case 'UPDATE_SCALE':
          setScale(action.scale);
          setOffset(action.offset);
          break;
          
        case 'SET_CURSOR':
          cursorRef.current = action.cursor;
          break;
          
        case 'SET_HOVER':
          hoveredIdRef.current = action.id;
          break;
          
        case 'SET_ALIGNMENT_GUIDES':
          alignmentGuidesRef.current = action.guides;
          break;
          
        case 'CLEAR_ALIGNMENT_GUIDES':
          alignmentGuidesRef.current = { verticalLines: [], horizontalLines: [] };
          break;
          
        case 'SELECT_INTERACTION':
          onSelectInteraction?.(action.id);
          break;
          
        case 'REQUEST_REDRAW':
          requestRedraw();
          break;
      }
    }
  }, []);
  
  // Event dispatcher
  const send = useCallback((event: InteractionEvent) => {
    if (!fsmRef.current) return;
    const actions = fsmRef.current.send(event);
    handleActions(actions);
  }, [handleActions]);
  
  // Get current state
  const getState = useCallback((): InteractionState => {
    return fsmRef.current?.getState() ?? 'idle';
  }, []);
  
  return {
    send,
    getState,
    fsm: fsmRef.current,
    // Expose state refs for rendering
    alignmentGuides: alignmentGuidesRef,
    cursor: cursorRef,
    hoveredId: hoveredIdRef,
    dragOffsets: dragOffsetsRef,
  };
}

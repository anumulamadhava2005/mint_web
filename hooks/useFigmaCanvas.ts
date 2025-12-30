/**
 * useFigmaCanvas - React hook for complete Figma-like canvas functionality
 * 
 * Integrates all systems:
 * - Selection
 * - Drag/Transform
 * - Snapping
 * - History (undo/redo)
 * - Viewport
 * - Keyboard shortcuts
 * - Rendering
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { FigmaNode, Bounds } from '../lib/scene-graph/FigmaNode';
import { createFigmaNode } from '../lib/scene-graph/FigmaNode';
import { SelectionManager } from '../lib/scene-graph/SelectionManager';
import { DragManager, type DragMode } from '../lib/interaction/DragManager';
import { SnappingEngine, type SnapGuide } from '../lib/interaction/SnappingEngine';
import { HistoryManager, createMoveCommand, createResizeCommand, createRotateCommand, createDeleteCommand, createAddCommand } from '../lib/interaction/HistoryManager';
import { ViewportManager } from '../lib/interaction/ViewportManager';
import { KeyboardManager, registerDefaultShortcuts, type ShortcutCallbacks } from '../lib/interaction/KeyboardManager';
import { AutoLayoutEngine } from '../lib/layout/AutoLayoutEngine';
import { RenderEngine } from '../lib/rendering/RenderEngine';
import { ComponentSystem } from '../lib/components/ComponentSystem';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseFigmaCanvasOptions {
  /** Initial nodes */
  initialNodes?: FigmaNode[];
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Enable snapping */
  snapping?: boolean;
  /** Enable grid */
  grid?: boolean;
  /** Grid size */
  gridSize?: number;
  /** History limit */
  historyLimit?: number;
}

export interface CanvasState {
  /** All nodes by ID */
  nodes: Map<string, FigmaNode>;
  /** Root node IDs */
  rootIds: string[];
  /** Selected node IDs */
  selectedIds: Set<string>;
  /** Hovered node ID */
  hoveredId: string | null;
  /** Active snap guides */
  guides: SnapGuide[];
  /** Viewport state */
  viewport: {
    zoom: number;
    panX: number;
    panY: number;
  };
  /** History state */
  history: {
    canUndo: boolean;
    canRedo: boolean;
  };
  /** Current cursor style */
  cursor: string;
  /** Is dragging */
  isDragging: boolean;
  /** Is panning (space+drag) */
  isPanning: boolean;
}

export interface CanvasActions {
  // Selection
  select: (id: string, multiSelect?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  
  // Nodes
  addNode: (node: Partial<FigmaNode>, parentId?: string) => FigmaNode;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  
  // Transform
  moveSelected: (dx: number, dy: number) => void;
  resizeSelected: (width: number, height: number) => void;
  rotateSelected: (angle: number) => void;
  
  // Z-order
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  
  // Grouping
  groupSelected: () => void;
  ungroupSelected: () => void;
  
  // History
  undo: () => void;
  redo: () => void;
  
  // Viewport
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number) => void;
  fitToContent: () => void;
  fitToSelection: () => void;
  panTo: (x: number, y: number) => void;
  
  // Clipboard
  copy: () => void;
  cut: () => void;
  paste: () => void;
  
  // Components
  createComponent: (nodeId: string, name: string) => void;
  createInstance: (componentId: string, x: number, y: number) => void;
}

export interface CanvasHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onKeyUp: (e: React.KeyboardEvent) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useFigmaCanvas(options: UseFigmaCanvasOptions): {
  state: CanvasState;
  actions: CanvasActions;
  handlers: CanvasHandlers;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  render: () => void;
} {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Create managers
  const selectionManager = useMemo(() => new SelectionManager(), []);
  const dragManager = useMemo(() => new DragManager(selectionManager), [selectionManager]);
  const snappingEngine = useMemo(() => new SnappingEngine(), []);
  const historyManager = useMemo(() => new HistoryManager(), []);
  const viewportManager = useMemo(() => new ViewportManager(), []);
  const keyboardManager = useMemo(() => new KeyboardManager(), []);
  const autoLayoutEngine = useMemo(() => new AutoLayoutEngine(), []);
  const renderEngine = useMemo(() => new RenderEngine(), []);
  const componentSystem = useMemo(() => new ComponentSystem(), []);
  
  // Node storage
  const nodesRef = useRef<Map<string, FigmaNode>>(new Map());
  const rootIdsRef = useRef<string[]>([]);
  
  // Clipboard
  const clipboardRef = useRef<FigmaNode[]>([]);
  
  // State for React updates
  const [state, setState] = useState<CanvasState>({
    nodes: new Map(),
    rootIds: [],
    selectedIds: new Set(),
    hoveredId: null,
    guides: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    history: { canUndo: false, canRedo: false },
    cursor: 'default',
    isDragging: false,
    isPanning: false,
  });
  
  // Update state helper
  const updateState = useCallback((updates: Partial<CanvasState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // ─── Initialize ───
  
  useEffect(() => {
    // Initialize nodes
    if (options.initialNodes) {
      for (const node of options.initialNodes) {
        nodesRef.current.set(node.id, node);
        if (!node.parentId) {
          rootIdsRef.current.push(node.id);
        }
      }
    }
    
    // Configure systems
    selectionManager.setNodes(nodesRef.current);
    dragManager.setNodes(nodesRef.current);
    
    snappingEngine.setConfig({
      enabled: options.snapping ?? true,
      gridEnabled: options.grid ?? false,
      gridSize: options.gridSize ?? 8,
    });
    
    historyManager.setLimit(options.historyLimit ?? 100);
    viewportManager.setCanvasSize(options.width, options.height);
    
    // Subscribe to changes
    const unsubSelection = selectionManager.subscribe(selection => {
      updateState({ selectedIds: selection });
    });
    
    const unsubHistory = historyManager.subscribe((canUndo, canRedo) => {
      updateState({ history: { canUndo, canRedo } });
    });
    
    const unsubViewport = viewportManager.subscribe(vp => {
      updateState({
        viewport: { zoom: vp.zoom, panX: vp.panX, panY: vp.panY },
      });
    });
    
    // Setup keyboard shortcuts
    keyboardManager.attach(window);
    
    return () => {
      unsubSelection();
      unsubHistory();
      unsubViewport();
      keyboardManager.detach();
    };
  }, []);
  
  // Register shortcuts
  useEffect(() => {
    const callbacks: ShortcutCallbacks = {
      onUndo: () => historyManager.undo(),
      onRedo: () => historyManager.redo(),
      onDelete: () => actions.deleteSelected(),
      onDuplicate: () => actions.duplicateSelected(),
      onGroup: () => actions.groupSelected(),
      onUngroup: () => actions.ungroupSelected(),
      onSelectAll: () => selectionManager.selectAll(),
      onDeselect: () => selectionManager.clearSelection(),
      onNudge: (dx, dy) => actions.moveSelected(dx, dy),
      onBringForward: () => actions.bringForward(),
      onSendBackward: () => actions.sendBackward(),
      onBringToFront: () => actions.bringToFront(),
      onSendToBack: () => actions.sendToBack(),
      onZoomIn: () => viewportManager.zoomIn(),
      onZoomOut: () => viewportManager.zoomOut(),
      onZoom100: () => viewportManager.resetZoom(),
      onFitToScreen: () => actions.fitToContent(),
      onCopy: () => actions.copy(),
      onCut: () => actions.cut(),
      onPaste: () => actions.paste(),
    };
    
    registerDefaultShortcuts(keyboardManager, callbacks);
  }, []);
  
  // ─── Actions ───
  
  const actions: CanvasActions = useMemo(() => ({
    // Selection
    select: (id, multiSelect = false) => {
      selectionManager.select(id, { multiSelect });
    },
    
    selectMultiple: (ids) => {
      selectionManager.selectMultiple(ids);
    },
    
    clearSelection: () => {
      selectionManager.clearSelection();
    },
    
    selectAll: () => {
      selectionManager.selectAll();
    },
    
    // Nodes
    addNode: (partial, parentId) => {
      const node = createFigmaNode(partial);
      nodesRef.current.set(node.id, node);
      
      if (parentId) {
        const parent = nodesRef.current.get(parentId);
        if (parent) {
          node.parentId = parentId;
          parent.children = parent.children || [];
          parent.children.push(node.id);
        }
      } else {
        rootIdsRef.current.push(node.id);
      }
      
      // Add to history
      const addCmd = createAddCommand(
        [node],
        new Map([[node.id, parentId || null]]),
        (nodes: FigmaNode[], parentIds: Map<string, string | null>) => {
          for (const n of nodes) {
            nodesRef.current.set(n.id, n);
            const pId = parentIds.get(n.id);
            if (pId) {
              const p = nodesRef.current.get(pId);
              if (p) p.children?.push(n.id);
            } else {
              rootIdsRef.current.push(n.id);
            }
          }
        },
        (ids: string[]) => {
          for (const id of ids) {
            const n = nodesRef.current.get(id);
            if (n?.parentId) {
              const p = nodesRef.current.get(n.parentId);
              if (p?.children) {
                p.children = p.children.filter(c => c !== id);
              }
            } else {
              rootIdsRef.current = rootIdsRef.current.filter(rid => rid !== id);
            }
            nodesRef.current.delete(id);
          }
        }
      );
      
      historyManager.execute(addCmd);
      selectionManager.setNodes(nodesRef.current);
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
      
      return node;
    },
    
    deleteSelected: () => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length === 0) return;
      
      const parentIds = new Map<string, string | null>();
      for (const node of selected) {
        parentIds.set(node.id, node.parentId || null);
      }
      
      const deleteCmd = createDeleteCommand(
        selected,
        parentIds,
        (ids: string[]) => {
          for (const id of ids) {
            const n = nodesRef.current.get(id);
            if (n?.parentId) {
              const p = nodesRef.current.get(n.parentId);
              if (p?.children) {
                p.children = p.children.filter(c => c !== id);
              }
            } else {
              rootIdsRef.current = rootIdsRef.current.filter(rid => rid !== id);
            }
            nodesRef.current.delete(id);
          }
        },
        (nodes: FigmaNode[], pIds: Map<string, string | null>) => {
          for (const n of nodes) {
            nodesRef.current.set(n.id, n);
            const pId = pIds.get(n.id);
            if (pId) {
              const p = nodesRef.current.get(pId);
              if (p) p.children?.push(n.id);
            } else {
              rootIdsRef.current.push(n.id);
            }
          }
        }
      );
      
      historyManager.execute(deleteCmd);
      selectionManager.clearSelection();
      selectionManager.setNodes(nodesRef.current);
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
    },
    
    duplicateSelected: () => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length === 0) return;
      
      const newNodes: FigmaNode[] = [];
      const offset = 20;
      
      for (const node of selected) {
        const duplicate = createFigmaNode({
          ...node,
          x: node.x + offset,
          y: node.y + offset,
        });
        newNodes.push(duplicate);
        nodesRef.current.set(duplicate.id, duplicate);
        
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            duplicate.parentId = node.parentId;
            parent.children.push(duplicate.id);
          }
        } else {
          rootIdsRef.current.push(duplicate.id);
        }
      }
      
      selectionManager.setNodes(nodesRef.current);
      selectionManager.selectMultiple(newNodes.map((n: FigmaNode) => n.id));
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
    },
    
    // Transform
    moveSelected: (dx: number, dy: number) => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length === 0) return;
      
      const oldPositions = new Map<string, { x: number; y: number }>();
      const newPositions = new Map<string, { x: number; y: number }>();
      
      for (const node of selected) {
        oldPositions.set(node.id, { x: node.x, y: node.y });
        newPositions.set(node.id, { x: node.x + dx, y: node.y + dy });
      }
      
      const moveCmd = createMoveCommand(
        selected.map((n: FigmaNode) => n.id),
        oldPositions,
        newPositions,
        (positions: Map<string, { x: number; y: number }>) => {
          positions.forEach((pos: { x: number; y: number }, id: string) => {
            const node = nodesRef.current.get(id);
            if (node) {
              node.x = pos.x;
              node.y = pos.y;
            }
          });
        }
      );
      
      historyManager.execute(moveCmd);
      updateState({ nodes: new Map(nodesRef.current) });
    },
    
    resizeSelected: (width: number, height: number) => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length === 0) return;
      
      for (const node of selected) {
        node.width = width;
        node.height = height;
      }
      
      updateState({ nodes: new Map(nodesRef.current) });
    },
    
    rotateSelected: (angle: number) => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length === 0) return;
      
      for (const node of selected) {
        node.rotation = angle;
      }
      
      updateState({ nodes: new Map(nodesRef.current) });
    },
    
    // Z-order
    bringForward: () => {
      const selected = selectionManager.getSelectedNodes();
      for (const node of selected) {
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            const idx = parent.children.findIndex((c: string) => c === node.id);
            if (idx < parent.children.length - 1) {
              [parent.children[idx], parent.children[idx + 1]] = 
              [parent.children[idx + 1], parent.children[idx]];
            }
          }
        } else {
          const idx = rootIdsRef.current.indexOf(node.id);
          if (idx < rootIdsRef.current.length - 1) {
            [rootIdsRef.current[idx], rootIdsRef.current[idx + 1]] =
            [rootIdsRef.current[idx + 1], rootIdsRef.current[idx]];
          }
        }
      }
      updateState({ rootIds: [...rootIdsRef.current] });
    },
    
    sendBackward: () => {
      const selected = selectionManager.getSelectedNodes();
      for (const node of selected) {
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            const idx = parent.children.findIndex((c: string) => c === node.id);
            if (idx > 0) {
              [parent.children[idx], parent.children[idx - 1]] =
              [parent.children[idx - 1], parent.children[idx]];
            }
          }
        } else {
          const idx = rootIdsRef.current.indexOf(node.id);
          if (idx > 0) {
            [rootIdsRef.current[idx], rootIdsRef.current[idx - 1]] =
            [rootIdsRef.current[idx - 1], rootIdsRef.current[idx]];
          }
        }
      }
      updateState({ rootIds: [...rootIdsRef.current] });
    },
    
    bringToFront: () => {
      const selected = selectionManager.getSelectedNodes();
      for (const node of selected) {
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            parent.children = parent.children.filter((c: string) => c !== node.id);
            parent.children.push(node.id);
          }
        } else {
          rootIdsRef.current = rootIdsRef.current.filter((id: string) => id !== node.id);
          rootIdsRef.current.push(node.id);
        }
      }
      updateState({ rootIds: [...rootIdsRef.current] });
    },
    
    sendToBack: () => {
      const selected = selectionManager.getSelectedNodes();
      for (const node of selected) {
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            parent.children = parent.children.filter((c: string) => c !== node.id);
            parent.children.unshift(node.id);
          }
        } else {
          rootIdsRef.current = rootIdsRef.current.filter((id: string) => id !== node.id);
          rootIdsRef.current.unshift(node.id);
        }
      }
      updateState({ rootIds: [...rootIdsRef.current] });
    },
    
    // Grouping
    groupSelected: () => {
      const selected = selectionManager.getSelectedNodes();
      if (selected.length < 2) return;
      
      // Calculate group bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of selected) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }
      
      // Create group
      const group = createFigmaNode({
        type: 'GROUP',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        children: [],
      });
      
      // Reparent children
      for (const node of selected) {
        // Remove from current parent
        if (node.parentId) {
          const parent = nodesRef.current.get(node.parentId);
          if (parent?.children) {
            parent.children = parent.children.filter((c: string) => c !== node.id);
          }
        } else {
          rootIdsRef.current = rootIdsRef.current.filter((id: string) => id !== node.id);
        }
        
        // Add to group (adjust position relative to group)
        node.x -= minX;
        node.y -= minY;
        node.parentId = group.id;
        group.children!.push(node.id);
      }
      
      // Add group to root
      nodesRef.current.set(group.id, group);
      rootIdsRef.current.push(group.id);
      
      selectionManager.setNodes(nodesRef.current);
      selectionManager.select(group.id);
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
    },
    
    ungroupSelected: () => {
      const selected = selectionManager.getSelectedNodes();
      const groups = selected.filter((n: FigmaNode) => n.type === 'GROUP' || n.type === 'FRAME');
      
      for (const group of groups) {
        if (!group.children) continue;
        
        // Move children out of group
        for (const childId of group.children) {
          const child = nodesRef.current.get(childId);
          if (!child) continue;
          
          // Adjust position to world coordinates
          child.x += group.x;
          child.y += group.y;
          child.parentId = group.parentId;
          
          // Add to parent
          if (group.parentId) {
            const parent = nodesRef.current.get(group.parentId);
            if (parent?.children) {
              parent.children.push(childId);
            }
          } else {
            rootIdsRef.current.push(childId);
          }
        }
        
        // Remove group
        if (group.parentId) {
          const parent = nodesRef.current.get(group.parentId);
          if (parent?.children) {
            parent.children = parent.children.filter((c: string) => c !== group.id);
          }
        } else {
          rootIdsRef.current = rootIdsRef.current.filter((id: string) => id !== group.id);
        }
        
        nodesRef.current.delete(group.id);
      }
      
      selectionManager.setNodes(nodesRef.current);
      selectionManager.clearSelection();
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
    },
    
    // History
    undo: () => historyManager.undo(),
    redo: () => historyManager.redo(),
    
    // Viewport
    zoomIn: () => viewportManager.zoomIn(),
    zoomOut: () => viewportManager.zoomOut(),
    zoomTo: (zoom) => viewportManager.setZoom(zoom),
    fitToContent: () => {
      const bounds = calculateAllBounds();
      if (bounds) viewportManager.fitContent(bounds);
    },
    fitToSelection: () => {
      const bounds = selectionManager.getBounds();
      if (bounds) viewportManager.fitSelection(bounds);
    },
    panTo: (x, y) => viewportManager.panTo(x, y),
    
    // Clipboard
    copy: () => {
      clipboardRef.current = selectionManager.getSelectedNodes();
    },
    cut: () => {
      clipboardRef.current = selectionManager.getSelectedNodes();
      actions.deleteSelected();
    },
    paste: () => {
      if (clipboardRef.current.length === 0) return;
      
      const newNodes: FigmaNode[] = [];
      for (const node of clipboardRef.current) {
        const duplicate = createFigmaNode({
          ...node,
          x: node.x + 20,
          y: node.y + 20,
        });
        newNodes.push(duplicate);
        nodesRef.current.set(duplicate.id, duplicate);
        rootIdsRef.current.push(duplicate.id);
      }
      
      selectionManager.setNodes(nodesRef.current);
      selectionManager.selectMultiple(newNodes.map(n => n.id));
      updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
    },
    
    // Components
    createComponent: (nodeId, name) => {
      const node = nodesRef.current.get(nodeId);
      if (node) {
        componentSystem.createComponent(node, name);
      }
    },
    createInstance: (componentId, x, y) => {
      const instance = componentSystem.createInstance(componentId, x, y);
      if (instance) {
        nodesRef.current.set(instance.node.id, instance.node);
        rootIdsRef.current.push(instance.node.id);
        updateState({ nodes: new Map(nodesRef.current), rootIds: [...rootIdsRef.current] });
      }
    },
  }), [selectionManager, historyManager, viewportManager]);
  
  // Helper to calculate all node bounds
  const calculateAllBounds = useCallback((): Bounds | null => {
    if (nodesRef.current.size === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodesRef.current.forEach(node => {
      if (!node.parentId) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
      }
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, []);
  
  // ─── Event Handlers ───
  
  const handlers: CanvasHandlers = useMemo(() => ({
    onMouseDown: (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = viewportManager.screenToWorld(screenX, screenY);
      
      // Check for space+drag (pan)
      if (keyboardManager.isSpaceHeld()) {
        updateState({ isPanning: true });
        return;
      }
      
      // Check for handle hit
      const handle = selectionManager.hitTestHandle(screenX, screenY, viewportManager.getZoom());
      if (handle) {
        dragManager.startResize(world.x, world.y, handle);
        return;
      }
      
      // Hit test nodes
      let hitId: string | null = null;
      nodesRef.current.forEach((node, id) => {
        if (
          world.x >= node.x &&
          world.x <= node.x + node.width &&
          world.y >= node.y &&
          world.y <= node.y + node.height &&
          node.visible &&
          !node.locked
        ) {
          hitId = id;
        }
      });
      
      if (hitId) {
        // Deep select with Cmd/Ctrl
        if (keyboardManager.isCmdHeld()) {
          const deepId = selectionManager.deepSelectAt(world.x, world.y);
          if (deepId) {
            selectionManager.select(deepId, { multiSelect: e.shiftKey });
          }
        } else {
          selectionManager.select(hitId, { multiSelect: e.shiftKey });
        }
        
        dragManager.startMove(world.x, world.y);
      } else {
        // Start marquee
        if (!e.shiftKey) {
          selectionManager.clearSelection();
        }
        dragManager.startMarquee(world.x, world.y);
      }
    },
    
    onMouseMove: (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = viewportManager.screenToWorld(screenX, screenY);
      
      // Pan mode
      if (state.isPanning) {
        viewportManager.panBy(e.movementX, e.movementY);
        return;
      }
      
      // Dragging
      if (dragManager.getMode()) {
        dragManager.move(world.x, world.y, e.shiftKey, e.altKey);
        
        const mode = dragManager.getMode();
        if (mode === 'move') {
          // Apply snapping
          const selected = selectionManager.getSelectedNodes();
          if (selected.length > 0) {
            const delta = dragManager.getDelta();
            const bounds: Bounds = {
              x: selected[0].x + delta.constrainedDx,
              y: selected[0].y + delta.constrainedDy,
              width: selected[0].width,
              height: selected[0].height,
            };
            
            const siblingBounds: Bounds[] = [];
            nodesRef.current.forEach((node, id) => {
              if (!state.selectedIds.has(id)) {
                siblingBounds.push({
                  x: node.x,
                  y: node.y,
                  width: node.width,
                  height: node.height,
                });
              }
            });
            
            const snapResult = snappingEngine.snap(bounds, siblingBounds, null);
            updateState({ guides: snapResult.guides });
          }
        }
        
        updateState({ isDragging: true });
        return;
      }
      
      // Hover detection
      let hovered: string | null = null;
      nodesRef.current.forEach((node, id) => {
        if (
          world.x >= node.x &&
          world.x <= node.x + node.width &&
          world.y >= node.y &&
          world.y <= node.y + node.height &&
          node.visible &&
          !node.locked
        ) {
          hovered = id;
        }
      });
      
      selectionManager.setHovered(hovered);
      updateState({ hoveredId: hovered });
      
      // Update cursor
      const handle = selectionManager.hitTestHandle(screenX, screenY, viewportManager.getZoom());
      if (handle) {
        const handlePositions = selectionManager.getHandlePositions(viewportManager.getZoom());
        const pos = handlePositions.find(h => h.handle === handle);
        updateState({ cursor: pos?.cursor || 'default' });
      } else if (hovered) {
        updateState({ cursor: 'move' });
      } else if (keyboardManager.isSpaceHeld()) {
        updateState({ cursor: 'grab' });
      } else {
        updateState({ cursor: 'default' });
      }
    },
    
    onMouseUp: (e) => {
      if (state.isPanning) {
        updateState({ isPanning: false });
        return;
      }
      
      const mode = dragManager.getMode();
      
      if (mode === 'marquee') {
        const marquee = dragManager.getMarqueeBounds();
        if (marquee) {
          selectionManager.selectInMarquee(marquee, { multiSelect: e.shiftKey });
        }
      } else if (mode === 'move' && dragManager.isDragging()) {
        // Commit move
        const delta = dragManager.getDelta();
        const selected = selectionManager.getSelectedNodes();
        
        for (const node of selected) {
          node.x += delta.constrainedDx;
          node.y += delta.constrainedDy;
        }
        
        updateState({ nodes: new Map(nodesRef.current) });
      } else if (mode === 'resize' && dragManager.isDragging()) {
        const newBounds = dragManager.calculateResize();
        if (newBounds) {
          const selected = selectionManager.getSelectedNodes();
          for (const node of selected) {
            const nodeBounds = dragManager.calculateNodeResize(node.id, newBounds);
            if (nodeBounds) {
              node.x = nodeBounds.x;
              node.y = nodeBounds.y;
              node.width = nodeBounds.width;
              node.height = nodeBounds.height;
            }
          }
          updateState({ nodes: new Map(nodesRef.current) });
        }
      }
      
      dragManager.end();
      updateState({ isDragging: false, guides: [] });
    },
    
    onWheel: (e) => {
      e.preventDefault();
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom at cursor
        viewportManager.zoomAtPoint(screenX, screenY, e.deltaY);
      } else {
        // Pan
        viewportManager.panBy(-e.deltaX, -e.deltaY);
      }
    },
    
    onKeyDown: (e) => {
      // Handled by KeyboardManager
    },
    
    onKeyUp: (e) => {
      // Handled by KeyboardManager
    },
  }), [state.isPanning, viewportManager, keyboardManager, selectionManager, dragManager, snappingEngine]);
  
  // ─── Render ───
  
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const { zoom, panX, panY } = state.viewport;
    
    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply viewport transform
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, -panX * zoom * dpr, -panY * zoom * dpr);
    
    // Render nodes
    rootIdsRef.current.forEach(id => {
      const node = nodesRef.current.get(id);
      if (node) {
        renderEngine.renderNode(ctx, node, { dpr, debug: false, renderGuides: true, renderSelection: true });
      }
    });
    
    // Render hover
    if (state.hoveredId && !state.selectedIds.has(state.hoveredId)) {
      const node = nodesRef.current.get(state.hoveredId);
      if (node) {
        renderEngine.renderHover(ctx, { x: node.x, y: node.y, width: node.width, height: node.height }, zoom);
      }
    }
    
    // Render selection
    const selectionBounds = selectionManager.getBounds();
    if (selectionBounds) {
      const handlePositions = selectionManager.getHandlePositions(zoom);
      renderEngine.renderSelection(
        ctx,
        selectionBounds,
        handlePositions.map(h => ({ x: h.x, y: h.y })),
        zoom
      );
    }
    
    // Render guides
    if (state.guides.length > 0) {
      renderEngine.renderGuides(ctx, state.guides, zoom);
    }
    
    // Render marquee
    if (dragManager.getMode() === 'marquee') {
      const marquee = dragManager.getMarqueeBounds();
      if (marquee) {
        renderEngine.renderMarquee(ctx, marquee, zoom);
      }
    }
  }, [state, selectionManager, renderEngine, dragManager]);
  
  // Auto-render on state changes
  useEffect(() => {
    render();
  }, [state, render]);
  
  return {
    state,
    actions,
    handlers,
    canvasRef,
    render,
  };
}

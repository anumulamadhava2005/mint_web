/**
 * CanvasInteractionFSM - Finite State Machine for canvas interactions
 * 
 * Manages all pointer/keyboard-driven interaction states in CanvasStage.
 * Single source of truth for interaction mode transitions.
 */

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export type InteractionState =
  | 'idle'
  | 'selecting'      // Click without drag yet (deciding between select/drag)
  | 'dragging'       // Moving selected nodes
  | 'resizing'       // Resizing a single selected node
  | 'panning'        // Moving the viewport
  | 'textEditing'    // Editing text content inline
  | 'creating';      // Drawing a new shape/text

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type InteractionEventType =
  | 'POINTER_DOWN'
  | 'POINTER_MOVE'
  | 'POINTER_UP'
  | 'KEY_DOWN'
  | 'KEY_UP'
  | 'WHEEL'
  | 'DOUBLE_CLICK'
  | 'ESCAPE';

export interface PointerEventData {
  clientX: number;
  clientY: number;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface KeyEventData {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface WheelEventData {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  clientX: number;
  clientY: number;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type InteractionEvent =
  | { type: 'POINTER_DOWN'; data: PointerEventData }
  | { type: 'POINTER_MOVE'; data: PointerEventData }
  | { type: 'POINTER_UP'; data: PointerEventData }
  | { type: 'KEY_DOWN'; data: KeyEventData }
  | { type: 'KEY_UP'; data: KeyEventData }
  | { type: 'WHEEL'; data: WheelEventData }
  | { type: 'DOUBLE_CLICK'; data: PointerEventData }
  | { type: 'ESCAPE'; data: null };

// ─────────────────────────────────────────────────────────────────────────────
// Context Types - data passed between states
// ─────────────────────────────────────────────────────────────────────────────

export interface WorldCoords {
  wx: number;
  wy: number;
}

export interface ScreenCoords {
  sx: number;
  sy: number;
}

export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface SelectingContext {
  hitNodeId: string | null;
  startScreen: ScreenCoords;
  startWorld: WorldCoords;
  originalSelection: Set<string>;
}

export interface DraggingContext {
  startScreen: ScreenCoords;
  startWorld: WorldCoords;
  originalPositions: Map<string, { x: number; y: number }>;
  currentOffsets: Map<string, { dx: number; dy: number }>;
}

export interface ResizingContext {
  nodeId: string;
  handle: ResizeHandle;
  startWorld: WorldCoords;
  originalBounds: NodeBounds;
}

export interface PanningContext {
  startScreen: ScreenCoords;
  startOffset: { x: number; y: number };
}

export interface CreatingContext {
  tool: 'rect' | 'ellipse' | 'text';
  startWorld: WorldCoords;
  currentWorld: WorldCoords;
  previewId: string;
  parentId: string | null;
  parentOffset: { x: number; y: number };
}

export interface TextEditingContext {
  nodeId: string;
  originalText: string;
}

export interface MarqueeContext {
  startWorld: WorldCoords;
  currentWorld: WorldCoords;
}

// ─────────────────────────────────────────────────────────────────────────────
// FSM State with Context
// ─────────────────────────────────────────────────────────────────────────────

export type FSMStateData =
  | { state: 'idle' }
  | { state: 'selecting'; context: SelectingContext; isMarquee: boolean }
  | { state: 'dragging'; context: DraggingContext }
  | { state: 'resizing'; context: ResizingContext }
  | { state: 'panning'; context: PanningContext }
  | { state: 'textEditing'; context: TextEditingContext }
  | { state: 'creating'; context: CreatingContext };

// ─────────────────────────────────────────────────────────────────────────────
// Actions emitted by the FSM
// ─────────────────────────────────────────────────────────────────────────────

export type FSMAction =
  | { type: 'SET_SELECTION'; ids: Set<string> }
  | { type: 'ADD_TO_SELECTION'; id: string }
  | { type: 'REMOVE_FROM_SELECTION'; id: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'UPDATE_NODE_POSITIONS'; offsets: Map<string, { dx: number; dy: number }> }
  | { type: 'FINALIZE_DRAG'; offsets: Map<string, { dx: number; dy: number }> }
  | { type: 'UPDATE_NODE_BOUNDS'; nodeId: string; bounds: NodeBounds }
  | { type: 'UPDATE_OFFSET'; offset: { x: number; y: number } }
  | { type: 'UPDATE_SCALE'; scale: number; offset: { x: number; y: number } }
  | { type: 'CREATE_NODE'; node: any; parentId: string | null }
  | { type: 'UPDATE_CREATING_NODE'; id: string; bounds: { x: number; y: number; width: number; height: number } }
  | { type: 'FINALIZE_CREATION'; id: string }
  | { type: 'UPDATE_TEXT'; nodeId: string; text: string }
  | { type: 'SET_CURSOR'; cursor: string }
  | { type: 'SET_HOVER'; id: string | null }
  | { type: 'REQUEST_REDRAW' }
  | { type: 'SET_ALIGNMENT_GUIDES'; guides: { verticalLines: any[]; horizontalLines: any[] } }
  | { type: 'CLEAR_ALIGNMENT_GUIDES' }
  | { type: 'SELECT_INTERACTION'; id: string };

// ─────────────────────────────────────────────────────────────────────────────
// Hit Test Results
// ─────────────────────────────────────────────────────────────────────────────

export interface HitTestResult {
  nodeId: string | null;
  resizeHandle: ResizeHandle | null;
  interactionId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FSM Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface FSMConfig {
  dragThreshold: number;         // Pixels before click becomes drag
  alignmentThreshold: number;    // Pixels for snap alignment
  panButton: number;             // Mouse button for panning (1 = middle)
}

export const DEFAULT_FSM_CONFIG: FSMConfig = {
  dragThreshold: 3,
  alignmentThreshold: 12,
  panButton: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// External Dependencies Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface FSMDependencies {
  /** Convert client coords to world coords */
  toWorld: (clientX: number, clientY: number) => WorldCoords & ScreenCoords;
  
  /** Hit test: find node at world position */
  hitTestNode: (wx: number, wy: number) => string | null;
  
  /** Hit test: find resize handle at screen position */
  hitTestResizeHandle: (sx: number, sy: number, selectedId: string) => ResizeHandle | null;
  
  /** Hit test: find interaction arrow at screen position */
  hitTestInteraction: (sx: number, sy: number) => string | null;
  
  /** Get current selection */
  getSelection: () => Set<string>;
  
  /** Get current offset */
  getOffset: () => { x: number; y: number };
  
  /** Get current scale */
  getScale: () => number;
  
  /** Get node bounds by id */
  getNodeBounds: (id: string) => NodeBounds | null;
  
  /** Get parent of node */
  getParentId: (id: string) => string | null;
  
  /** Current tool */
  getTool: () => 'select' | 'rect' | 'ellipse' | 'text' | 'grid' | 'pen';
  
  /** Check if space key is held */
  isSpaceHeld: () => boolean;
  
  /** Calculate alignment snapping */
  calculateAlignmentSnap: (
    nodeId: string,
    dx: number,
    dy: number
  ) => { finalDx: number; finalDy: number; guides: { verticalLines: any[]; horizontalLines: any[] } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Finite State Machine
// ─────────────────────────────────────────────────────────────────────────────

export class CanvasInteractionFSM {
  private state: FSMStateData = { state: 'idle' };
  private config: FSMConfig;
  private deps: FSMDependencies;
  private actionQueue: FSMAction[] = [];
  
  constructor(deps: FSMDependencies, config: FSMConfig = DEFAULT_FSM_CONFIG) {
    this.deps = deps;
    this.config = config;
  }
  
  /** Get current state */
  getState(): InteractionState {
    return this.state.state;
  }
  
  /** Get full state data */
  getStateData(): FSMStateData {
    return this.state;
  }
  
  /** Process an event and return actions */
  send(event: InteractionEvent): FSMAction[] {
    this.actionQueue = [];
    
    switch (this.state.state) {
      case 'idle':
        this.handleIdleState(event);
        break;
      case 'selecting':
        this.handleSelectingState(event);
        break;
      case 'dragging':
        this.handleDraggingState(event);
        break;
      case 'resizing':
        this.handleResizingState(event);
        break;
      case 'panning':
        this.handlePanningState(event);
        break;
      case 'textEditing':
        this.handleTextEditingState(event);
        break;
      case 'creating':
        this.handleCreatingState(event);
        break;
    }
    
    return this.actionQueue;
  }
  
  /** Force transition to a state (for external control) */
  forceState(state: FSMStateData): void {
    this.state = state;
  }
  
  /** Emit an action */
  private emit(action: FSMAction): void {
    this.actionQueue.push(action);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // State Handlers
  // ─────────────────────────────────────────────────────────────────────────
  
  private handleIdleState(event: InteractionEvent): void {
    if (event.type === 'POINTER_DOWN') {
      const { data } = event;
      const { wx, wy, sx, sy } = this.deps.toWorld(data.clientX, data.clientY);
      
      // Check for pan trigger (middle button or space held)
      if (data.button === this.config.panButton || this.deps.isSpaceHeld()) {
        this.transitionToPanning(sx, sy);
        return;
      }
      
      // Check for creation tool
      const tool = this.deps.getTool();
      if (tool === 'rect' || tool === 'ellipse' || tool === 'text') {
        this.transitionToCreating(tool, wx, wy);
        return;
      }
      
      // Check for interaction hit
      const interactionId = this.deps.hitTestInteraction(sx, sy);
      if (interactionId) {
        this.emit({ type: 'SELECT_INTERACTION', id: interactionId });
        this.emit({ type: 'SET_CURSOR', cursor: 'pointer' });
        this.emit({ type: 'REQUEST_REDRAW' });
        return;
      }
      
      // Check for resize handle hit (single selection only)
      const selection = this.deps.getSelection();
      if (selection.size === 1) {
        const selectedId = Array.from(selection)[0];
        const handle = this.deps.hitTestResizeHandle(sx, sy, selectedId);
        if (handle) {
          this.transitionToResizing(selectedId, handle, wx, wy);
          return;
        }
      }
      
      // Check for node hit
      const hitNodeId = this.deps.hitTestNode(wx, wy);
      if (hitNodeId) {
        this.transitionToSelecting(hitNodeId, sx, sy, wx, wy, data.ctrlKey || data.metaKey);
      } else {
        // Start marquee selection
        this.transitionToMarquee(wx, wy);
      }
    }
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const { wx, wy, sx, sy } = this.deps.toWorld(data.clientX, data.clientY);
      
      // Update hover state
      const hitNodeId = this.deps.hitTestNode(wx, wy);
      this.emit({ type: 'SET_HOVER', id: hitNodeId });
      
      // Update cursor based on what's under pointer
      const interactionId = this.deps.hitTestInteraction(sx, sy);
      if (interactionId) {
        this.emit({ type: 'SET_CURSOR', cursor: 'pointer' });
      } else if (this.deps.isSpaceHeld()) {
        this.emit({ type: 'SET_CURSOR', cursor: 'grab' });
      } else {
        this.emit({ type: 'SET_CURSOR', cursor: 'default' });
      }
    }
    
    if (event.type === 'KEY_DOWN') {
      const { data } = event;
      if (data.code === 'Space') {
        this.emit({ type: 'SET_CURSOR', cursor: 'grab' });
      }
    }
    
    if (event.type === 'KEY_UP') {
      const { data } = event;
      if (data.code === 'Space') {
        this.emit({ type: 'SET_CURSOR', cursor: 'default' });
      }
    }
    
    if (event.type === 'DOUBLE_CLICK') {
      const { data } = event;
      const { wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
      const hitNodeId = this.deps.hitTestNode(wx, wy);
      
      if (hitNodeId) {
        const bounds = this.deps.getNodeBounds(hitNodeId);
        // Check if it's a text node (would need type info from deps)
        // For now, transition to text editing
        this.transitionToTextEditing(hitNodeId);
      }
    }
    
    if (event.type === 'WHEEL') {
      this.handleWheel(event.data);
    }
  }
  
  private handleSelectingState(event: InteractionEvent): void {
    if (this.state.state !== 'selecting') return;
    const ctx = this.state.context;
    const isMarquee = this.state.isMarquee;
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const { sx, sy, wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
      
      if (isMarquee) {
        // Update marquee selection
        this.emit({ type: 'REQUEST_REDRAW' });
        return;
      }
      
      // Check if we've moved past drag threshold
      const dx = sx - ctx.startScreen.sx;
      const dy = sy - ctx.startScreen.sy;
      
      if (Math.hypot(dx, dy) >= this.config.dragThreshold) {
        // Transition to dragging
        this.transitionToDragging(ctx);
      }
    }
    
    if (event.type === 'POINTER_UP') {
      const { data } = event;
      
      if (isMarquee) {
        // Finalize marquee selection
        const { wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
        // Marquee selection would be computed by CanvasStage
        this.emit({ type: 'REQUEST_REDRAW' });
      } else {
        // Click without drag - selection already handled in transition
      }
      
      this.emit({ type: 'CLEAR_ALIGNMENT_GUIDES' });
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'ESCAPE') {
      this.emit({ type: 'SET_SELECTION', ids: ctx.originalSelection });
      this.emit({ type: 'CLEAR_ALIGNMENT_GUIDES' });
      this.state = { state: 'idle' };
    }
  }
  
  private handleDraggingState(event: InteractionEvent): void {
    if (this.state.state !== 'dragging') return;
    const ctx = this.state.context;
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const { sx, sy } = this.deps.toWorld(data.clientX, data.clientY);
      
      // Calculate delta from start
      const scale = this.deps.getScale();
      const dx = (sx - ctx.startScreen.sx) / scale;
      const dy = (sy - ctx.startScreen.sy) / scale;
      
      // Get first selected node for alignment snapping
      const firstId = ctx.originalPositions.keys().next().value;
      if (firstId) {
        const { finalDx, finalDy, guides } = this.deps.calculateAlignmentSnap(firstId, dx, dy);
        
        // Update offsets for all selected nodes
        const newOffsets = new Map<string, { dx: number; dy: number }>();
        ctx.originalPositions.forEach((_, id) => {
          newOffsets.set(id, { dx: finalDx, dy: finalDy });
        });
        ctx.currentOffsets = newOffsets;
        
        this.emit({ type: 'UPDATE_NODE_POSITIONS', offsets: newOffsets });
        this.emit({ type: 'SET_ALIGNMENT_GUIDES', guides });
      }
      
      this.emit({ type: 'REQUEST_REDRAW' });
    }
    
    if (event.type === 'POINTER_UP') {
      // Finalize drag
      if (ctx.currentOffsets.size > 0) {
        this.emit({ type: 'FINALIZE_DRAG', offsets: ctx.currentOffsets });
      }
      this.emit({ type: 'CLEAR_ALIGNMENT_GUIDES' });
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'ESCAPE') {
      // Cancel drag - restore original positions
      const zeroOffsets = new Map<string, { dx: number; dy: number }>();
      ctx.originalPositions.forEach((_, id) => {
        zeroOffsets.set(id, { dx: 0, dy: 0 });
      });
      this.emit({ type: 'UPDATE_NODE_POSITIONS', offsets: zeroOffsets });
      this.emit({ type: 'CLEAR_ALIGNMENT_GUIDES' });
      this.state = { state: 'idle' };
    }
  }
  
  private handleResizingState(event: InteractionEvent): void {
    if (this.state.state !== 'resizing') return;
    const ctx = this.state.context;
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const { wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
      
      const dx = wx - ctx.startWorld.wx;
      const dy = wy - ctx.startWorld.wy;
      
      // Calculate new bounds based on handle
      let { x, y, width: w, height: h } = ctx.originalBounds;
      const keepAspect = data.shiftKey;
      const fromCenter = data.altKey || data.ctrlKey;
      
      // Apply resize based on handle
      const handle = ctx.handle;
      if (handle.includes('w')) { x += dx; w -= dx; }
      if (handle.includes('e')) { w += dx; }
      if (handle.includes('n')) { y += dy; h -= dy; }
      if (handle.includes('s')) { h += dy; }
      
      // Enforce minimum size
      const minSize = 1;
      w = Math.max(minSize, w);
      h = Math.max(minSize, h);
      
      // Keep aspect ratio if shift held
      if (keepAspect) {
        const aspect = ctx.originalBounds.width / Math.max(1e-6, ctx.originalBounds.height);
        if (w / h > aspect) {
          w = h * aspect;
        } else {
          h = w / aspect;
        }
      }
      
      // Resize from center if alt held
      if (fromCenter) {
        x = ctx.originalBounds.x + (ctx.originalBounds.width - w) / 2;
        y = ctx.originalBounds.y + (ctx.originalBounds.height - h) / 2;
      }
      
      this.emit({ type: 'UPDATE_NODE_BOUNDS', nodeId: ctx.nodeId, bounds: { x, y, width: w, height: h } });
      this.emit({ type: 'REQUEST_REDRAW' });
    }
    
    if (event.type === 'POINTER_UP') {
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'ESCAPE') {
      // Restore original bounds
      this.emit({ type: 'UPDATE_NODE_BOUNDS', nodeId: ctx.nodeId, bounds: ctx.originalBounds });
      this.state = { state: 'idle' };
    }
  }
  
  private handlePanningState(event: InteractionEvent): void {
    if (this.state.state !== 'panning') return;
    const ctx = this.state.context;
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const dx = data.clientX - ctx.startScreen.sx;
      const dy = data.clientY - ctx.startScreen.sy;
      
      const newOffset = {
        x: ctx.startOffset.x + dx,
        y: ctx.startOffset.y + dy,
      };
      
      this.emit({ type: 'UPDATE_OFFSET', offset: newOffset });
      this.emit({ type: 'REQUEST_REDRAW' });
    }
    
    if (event.type === 'POINTER_UP') {
      this.emit({ type: 'SET_CURSOR', cursor: this.deps.isSpaceHeld() ? 'grab' : 'default' });
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'KEY_UP') {
      const { data } = event;
      if (data.code === 'Space') {
        // End panning when space released
        this.emit({ type: 'SET_CURSOR', cursor: 'default' });
        this.state = { state: 'idle' };
      }
    }
  }
  
  private handleTextEditingState(event: InteractionEvent): void {
    if (this.state.state !== 'textEditing') return;
    const ctx = this.state.context;
    
    if (event.type === 'ESCAPE') {
      // Cancel text editing
      this.emit({ type: 'UPDATE_TEXT', nodeId: ctx.nodeId, text: ctx.originalText });
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'POINTER_DOWN') {
      const { data } = event;
      const { wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
      const hitNodeId = this.deps.hitTestNode(wx, wy);
      
      // Click outside text node ends editing
      if (hitNodeId !== ctx.nodeId) {
        this.state = { state: 'idle' };
        // Re-process the event in idle state
        this.handleIdleState(event);
      }
    }
  }
  
  private handleCreatingState(event: InteractionEvent): void {
    if (this.state.state !== 'creating') return;
    const ctx = this.state.context;
    
    if (event.type === 'POINTER_MOVE') {
      const { data } = event;
      const { wx, wy } = this.deps.toWorld(data.clientX, data.clientY);
      ctx.currentWorld = { wx, wy };
      
      // Calculate bounds
      const minX = Math.min(ctx.startWorld.wx, wx);
      const minY = Math.min(ctx.startWorld.wy, wy);
      let w = Math.abs(wx - ctx.startWorld.wx);
      let h = Math.abs(wy - ctx.startWorld.wy);
      
      // Minimum size
      w = Math.max(10, w);
      h = Math.max(10, h);
      
      // Square constraint for shift key
      if (data.shiftKey && (ctx.tool === 'rect' || ctx.tool === 'ellipse')) {
        const s = Math.max(w, h);
        w = s;
        h = s;
      }
      
      // Calculate relative position
      const relX = ctx.parentId ? minX - ctx.parentOffset.x : minX;
      const relY = ctx.parentId ? minY - ctx.parentOffset.y : minY;
      
      this.emit({ type: 'UPDATE_CREATING_NODE', id: ctx.previewId, bounds: { x: relX, y: relY, width: w, height: h } });
      this.emit({ type: 'REQUEST_REDRAW' });
    }
    
    if (event.type === 'POINTER_UP') {
      this.emit({ type: 'FINALIZE_CREATION', id: ctx.previewId });
      this.emit({ type: 'SET_SELECTION', ids: new Set([ctx.previewId]) });
      this.state = { state: 'idle' };
    }
    
    if (event.type === 'ESCAPE') {
      // Cancel creation - would need to remove the preview node
      this.state = { state: 'idle' };
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Transition Helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  private transitionToSelecting(
    hitNodeId: string,
    sx: number,
    sy: number,
    wx: number,
    wy: number,
    isMultiSelect: boolean
  ): void {
    const currentSelection = this.deps.getSelection();
    
    // Calculate new selection
    let newSelection: Set<string>;
    if (isMultiSelect) {
      newSelection = new Set(currentSelection);
      if (newSelection.has(hitNodeId)) {
        newSelection.delete(hitNodeId);
      } else {
        newSelection.add(hitNodeId);
      }
    } else if (currentSelection.has(hitNodeId)) {
      newSelection = currentSelection;
    } else {
      newSelection = new Set([hitNodeId]);
    }
    
    this.emit({ type: 'SET_SELECTION', ids: newSelection });
    
    // Store original positions for potential drag
    const originalPositions = new Map<string, { x: number; y: number }>();
    newSelection.forEach(id => {
      const bounds = this.deps.getNodeBounds(id);
      if (bounds) {
        originalPositions.set(id, { x: bounds.x, y: bounds.y });
      }
    });
    
    this.state = {
      state: 'selecting',
      context: {
        hitNodeId,
        startScreen: { sx, sy },
        startWorld: { wx, wy },
        originalSelection: currentSelection,
      },
      isMarquee: false,
    };
  }
  
  private transitionToMarquee(wx: number, wy: number): void {
    this.emit({ type: 'CLEAR_SELECTION' });
    
    this.state = {
      state: 'selecting',
      context: {
        hitNodeId: null,
        startScreen: { sx: 0, sy: 0 },
        startWorld: { wx, wy },
        originalSelection: new Set(),
      },
      isMarquee: true,
    };
  }
  
  private transitionToDragging(selectingCtx: SelectingContext): void {
    const selection = this.deps.getSelection();
    const originalPositions = new Map<string, { x: number; y: number }>();
    
    selection.forEach(id => {
      const bounds = this.deps.getNodeBounds(id);
      if (bounds) {
        originalPositions.set(id, { x: bounds.x, y: bounds.y });
      }
    });
    
    this.state = {
      state: 'dragging',
      context: {
        startScreen: selectingCtx.startScreen,
        startWorld: selectingCtx.startWorld,
        originalPositions,
        currentOffsets: new Map(),
      },
    };
  }
  
  private transitionToResizing(
    nodeId: string,
    handle: ResizeHandle,
    wx: number,
    wy: number
  ): void {
    const bounds = this.deps.getNodeBounds(nodeId);
    if (!bounds) return;
    
    this.state = {
      state: 'resizing',
      context: {
        nodeId,
        handle,
        startWorld: { wx, wy },
        originalBounds: bounds,
      },
    };
  }
  
  private transitionToPanning(sx: number, sy: number): void {
    const offset = this.deps.getOffset();
    
    this.emit({ type: 'SET_CURSOR', cursor: 'grabbing' });
    
    this.state = {
      state: 'panning',
      context: {
        startScreen: { sx, sy },
        startOffset: { ...offset },
      },
    };
  }
  
  private transitionToCreating(
    tool: 'rect' | 'ellipse' | 'text',
    wx: number,
    wy: number
  ): void {
    const id = `${tool}_${Date.now().toString(36)}`;
    
    // Determine parent (would be done via hit testing frames)
    const parentId = null; // Simplified - CanvasStage handles parent detection
    const parentOffset = { x: 0, y: 0 };
    
    this.state = {
      state: 'creating',
      context: {
        tool,
        startWorld: { wx, wy },
        currentWorld: { wx, wy },
        previewId: id,
        parentId,
        parentOffset,
      },
    };
    
    // Emit create node action
    const nodeType = tool === 'text' ? 'TEXT' : tool === 'ellipse' ? 'ELLIPSE' : 'FRAME';
    const node = {
      id,
      type: nodeType,
      name: tool === 'text' ? 'Text' : tool === 'ellipse' ? 'Ellipse' : 'Rectangle',
      x: wx,
      y: wy,
      width: tool === 'text' ? 200 : 10,
      height: tool === 'text' ? 40 : 10,
      fill: tool === 'text' ? null : { type: 'SOLID', color: '#ffffff' },
      stroke: tool === 'text' ? null : { color: '#111827', weight: 1 },
      children: [],
      text: tool === 'text' ? { characters: 'Text', fontSize: 20, color: '#111' } : undefined,
    };
    
    this.emit({ type: 'CREATE_NODE', node, parentId });
    this.emit({ type: 'REQUEST_REDRAW' });
  }
  
  private transitionToTextEditing(nodeId: string): void {
    // Would get original text from node
    this.state = {
      state: 'textEditing',
      context: {
        nodeId,
        originalText: '', // Would be populated from node
      },
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Wheel Handler (always available)
  // ─────────────────────────────────────────────────────────────────────────
  
  private handleWheel(data: WheelEventData): void {
    const offset = this.deps.getOffset();
    const scale = this.deps.getScale();
    const { sx, sy } = this.deps.toWorld(data.clientX, data.clientY);
    
    if (data.ctrlKey || data.metaKey) {
      // Zoom
      const deltaFactor = data.deltaMode === 0 ? 1 : data.deltaMode === 1 ? 16 : window.innerHeight;
      const dY = data.deltaY * deltaFactor;
      const zoomFactor = Math.exp(-dY * 0.0012);
      const newScale = Math.max(0.05, Math.min(20, scale * zoomFactor));
      
      const worldX = (sx - offset.x) / scale;
      const worldY = (sy - offset.y) / scale;
      const newOffset = {
        x: sx - worldX * newScale,
        y: sy - worldY * newScale,
      };
      
      this.emit({ type: 'UPDATE_SCALE', scale: newScale, offset: newOffset });
    } else {
      // Pan
      const newOffset = {
        x: offset.x - data.deltaX,
        y: offset.y - data.deltaY,
      };
      this.emit({ type: 'UPDATE_OFFSET', offset: newOffset });
    }
    
    this.emit({ type: 'REQUEST_REDRAW' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export factory
// ─────────────────────────────────────────────────────────────────────────────

export function createCanvasInteractionFSM(
  deps: FSMDependencies,
  config?: Partial<FSMConfig>
): CanvasInteractionFSM {
  return new CanvasInteractionFSM(deps, { ...DEFAULT_FSM_CONFIG, ...config });
}

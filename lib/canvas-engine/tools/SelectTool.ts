/**
 * Select Tool - Default selection and manipulation tool
 * 
 * Handles: selection, dragging, resizing, marquee selection
 */

import type {
  Tool,
  ToolPointerEvent,
  ToolKeyEvent,
  ToolContext,
  ToolState,
  ResizeHandle,
} from './Tool';

// ─────────────────────────────────────────────────────────────────────────────
// Select Tool State
// ─────────────────────────────────────────────────────────────────────────────

interface SelectToolData {
  mode: 'idle' | 'dragging' | 'resizing' | 'marquee';
  startWorldX: number;
  startWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
  resizeHandle: ResizeHandle | null;
  initialBounds: Map<string, { x: number; y: number; width: number; height: number }>;
  dragStartPositions: Map<string, { x: number; y: number }>;
}

function getSelectData(state: ToolState): SelectToolData {
  if (!state.data.select) {
    state.data.select = {
      mode: 'idle',
      startWorldX: 0,
      startWorldY: 0,
      currentWorldX: 0,
      currentWorldY: 0,
      resizeHandle: null,
      initialBounds: new Map(),
      dragStartPositions: new Map(),
    };
  }
  return state.data.select as SelectToolData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Select Tool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const SelectTool: Tool = {
  id: 'select',
  name: 'Select',
  cursor: 'default',
  
  onActivate(ctx, state) {
    ctx.setCursor('default');
    const data = getSelectData(state);
    data.mode = 'idle';
  },
  
  onDeactivate(ctx, state) {
    ctx.clearAlignmentGuides();
    const data = getSelectData(state);
    data.mode = 'idle';
  },
  
  onPointerDown(event, ctx, state) {
    const data = getSelectData(state);
    state.isActive = true;
    
    data.startWorldX = event.worldX;
    data.startWorldY = event.worldY;
    data.currentWorldX = event.worldX;
    data.currentWorldY = event.worldY;
    
    const selection = ctx.getSelection();
    
    // Check if clicking on a resize handle
    if (selection.size === 1) {
      const selectedId = Array.from(selection)[0];
      const handle = ctx.hitTestResizeHandle(event.screenX, event.screenY, selectedId);
      
      if (handle) {
        data.mode = 'resizing';
        data.resizeHandle = handle;
        
        // Store initial bounds
        data.initialBounds.clear();
        const bounds = ctx.getNodeBounds(selectedId);
        if (bounds) {
          data.initialBounds.set(selectedId, { ...bounds });
        }
        
        ctx.setCursor(getResizeCursor(handle));
        return;
      }
    }
    
    // Hit test for node selection
    const hitId = ctx.hitTestNode(event.worldX, event.worldY);
    
    if (hitId) {
      // Clicking on a node
      if (event.shiftKey) {
        // Toggle selection
        const newSelection = new Set(selection);
        if (newSelection.has(hitId)) {
          newSelection.delete(hitId);
        } else {
          newSelection.add(hitId);
        }
        ctx.setSelection(newSelection);
      } else if (!selection.has(hitId)) {
        // Select this node
        ctx.setSelection(new Set([hitId]));
      }
      
      // Start dragging
      data.mode = 'dragging';
      data.dragStartPositions.clear();
      
      // Store start positions for all selected nodes
      const currentSelection = ctx.getSelection();
      currentSelection.forEach(id => {
        const bounds = ctx.getNodeBounds(id);
        if (bounds) {
          data.dragStartPositions.set(id, { x: bounds.x, y: bounds.y });
        }
      });
      
      ctx.setCursor('move');
    } else {
      // Clicking on empty space - start marquee
      if (!event.shiftKey) {
        ctx.setSelection(new Set());
      }
      data.mode = 'marquee';
      ctx.setCursor('crosshair');
    }
  },
  
  onPointerMove(event, ctx, state) {
    const data = getSelectData(state);
    data.currentWorldX = event.worldX;
    data.currentWorldY = event.worldY;
    
    if (!state.isActive) {
      // Hover state - check for resize handles
      const selection = ctx.getSelection();
      if (selection.size === 1) {
        const selectedId = Array.from(selection)[0];
        const handle = ctx.hitTestResizeHandle(event.screenX, event.screenY, selectedId);
        if (handle) {
          ctx.setCursor(getResizeCursor(handle));
          return;
        }
      }
      
      // Check if hovering over a node
      const hitId = ctx.hitTestNode(event.worldX, event.worldY);
      ctx.setCursor(hitId ? 'pointer' : 'default');
      return;
    }
    
    const dx = event.worldX - data.startWorldX;
    const dy = event.worldY - data.startWorldY;
    
    switch (data.mode) {
      case 'dragging': {
        const selection = ctx.getSelection();
        if (selection.size === 0) return;
        
        // Calculate snap for first selected node
        const firstId = Array.from(selection)[0];
        const { finalDx, finalDy, guides } = ctx.calculateAlignmentSnap(firstId, dx, dy);
        ctx.setAlignmentGuides(guides);
        
        // Apply movement with snap
        const offsets = new Map<string, { dx: number; dy: number }>();
        selection.forEach(id => {
          const startPos = data.dragStartPositions.get(id);
          if (startPos) {
            const bounds = ctx.getNodeBounds(id);
            if (bounds) {
              offsets.set(id, {
                dx: startPos.x + finalDx - bounds.x,
                dy: startPos.y + finalDy - bounds.y,
              });
            }
          }
        });
        
        ctx.updateNodePositions(offsets);
        ctx.requestRedraw();
        break;
      }
      
      case 'resizing': {
        const selection = ctx.getSelection();
        if (selection.size !== 1 || !data.resizeHandle) return;
        
        const selectedId = Array.from(selection)[0];
        const initial = data.initialBounds.get(selectedId);
        if (!initial) return;
        
        const newBounds = calculateResizedBounds(
          initial,
          data.resizeHandle,
          dx,
          dy,
          event.shiftKey // Maintain aspect ratio
        );
        
        ctx.updateNodeBounds(selectedId, newBounds);
        ctx.requestRedraw();
        break;
      }
      
      case 'marquee': {
        // Marquee selection - calculate which nodes are in the box
        const minX = Math.min(data.startWorldX, event.worldX);
        const minY = Math.min(data.startWorldY, event.worldY);
        const maxX = Math.max(data.startWorldX, event.worldX);
        const maxY = Math.max(data.startWorldY, event.worldY);
        
        const nodes = ctx.getDrawableNodes();
        const selected = new Set<string>();
        
        nodes.forEach(node => {
          if (
            node.x >= minX && node.x + node.width <= maxX &&
            node.y >= minY && node.y + node.height <= maxY
          ) {
            selected.add(node.id);
          }
        });
        
        ctx.setSelection(selected);
        ctx.requestRedraw();
        break;
      }
    }
  },
  
  onPointerUp(event, ctx, state) {
    const data = getSelectData(state);
    
    if (data.mode === 'dragging' || data.mode === 'resizing') {
      ctx.markChanged();
    }
    
    data.mode = 'idle';
    state.isActive = false;
    ctx.clearAlignmentGuides();
    ctx.setCursor('default');
  },
  
  onKeyDown(event, ctx, state) {
    const selection = ctx.getSelection();
    
    // Delete selected nodes
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selection.size > 0) {
        ctx.deleteNodes(selection);
        ctx.setSelection(new Set());
        ctx.markChanged();
        ctx.requestRedraw();
        event.preventDefault();
      }
    }
    
    // Select all
    if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
      const allNodes = ctx.getDrawableNodes();
      const allIds = new Set(allNodes.map(n => n.id));
      ctx.setSelection(allIds);
      event.preventDefault();
    }
    
    // Arrow key nudge
    const nudge = event.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    
    switch (event.key) {
      case 'ArrowUp': dy = -nudge; break;
      case 'ArrowDown': dy = nudge; break;
      case 'ArrowLeft': dx = -nudge; break;
      case 'ArrowRight': dx = nudge; break;
    }
    
    if ((dx !== 0 || dy !== 0) && selection.size > 0) {
      const offsets = new Map<string, { dx: number; dy: number }>();
      selection.forEach(id => offsets.set(id, { dx, dy }));
      ctx.updateNodePositions(offsets);
      ctx.markChanged();
      ctx.requestRedraw();
      event.preventDefault();
    }
  },
  
  renderOverlay(renderCtx, toolCtx, state) {
    const data = getSelectData(state);
    
    if (data.mode !== 'marquee') return;
    
    const scale = toolCtx.getScale();
    const offset = toolCtx.getOffset();
    
    // Convert world to screen coordinates
    const x1 = data.startWorldX * scale + offset.x;
    const y1 = data.startWorldY * scale + offset.y;
    const x2 = data.currentWorldX * scale + offset.x;
    const y2 = data.currentWorldY * scale + offset.y;
    
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    
    // Draw marquee rectangle
    renderCtx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    renderCtx.fillRect(x, y, w, h);
    
    renderCtx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    renderCtx.lineWidth = 1;
    renderCtx.strokeRect(x, y, w, h);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getResizeCursor(handle: ResizeHandle): string {
  switch (handle) {
    case 'n': case 's': return 'ns-resize';
    case 'e': case 'w': return 'ew-resize';
    case 'ne': case 'sw': return 'nesw-resize';
    case 'nw': case 'se': return 'nwse-resize';
    default: return 'default';
  }
}

function calculateResizedBounds(
  initial: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
  dx: number,
  dy: number,
  maintainAspect: boolean
): { x?: number; y?: number; width?: number; height?: number } {
  let { x, y, width, height } = initial;
  
  const aspectRatio = initial.width / initial.height;
  
  // Apply delta based on handle
  switch (handle) {
    case 'n':
      y += dy;
      height -= dy;
      break;
    case 's':
      height += dy;
      break;
    case 'e':
      width += dx;
      break;
    case 'w':
      x += dx;
      width -= dx;
      break;
    case 'ne':
      y += dy;
      height -= dy;
      width += dx;
      break;
    case 'nw':
      y += dy;
      height -= dy;
      x += dx;
      width -= dx;
      break;
    case 'se':
      height += dy;
      width += dx;
      break;
    case 'sw':
      height += dy;
      x += dx;
      width -= dx;
      break;
  }
  
  // Maintain aspect ratio if shift is held
  if (maintainAspect) {
    if (handle === 'n' || handle === 's') {
      const newWidth = height * aspectRatio;
      x -= (newWidth - width) / 2;
      width = newWidth;
    } else if (handle === 'e' || handle === 'w') {
      const newHeight = width / aspectRatio;
      y -= (newHeight - height) / 2;
      height = newHeight;
    } else {
      // Corner handles
      const newWidth = Math.max(width, height * aspectRatio);
      const newHeight = newWidth / aspectRatio;
      
      if (handle.includes('n')) {
        y = initial.y + initial.height - newHeight;
      }
      if (handle.includes('w')) {
        x = initial.x + initial.width - newWidth;
      }
      
      width = newWidth;
      height = newHeight;
    }
  }
  
  // Ensure minimum size
  const minSize = 1;
  if (width < minSize) {
    if (handle.includes('w')) {
      x = initial.x + initial.width - minSize;
    }
    width = minSize;
  }
  if (height < minSize) {
    if (handle.includes('n')) {
      y = initial.y + initial.height - minSize;
    }
    height = minSize;
  }
  
  return { x, y, width, height };
}

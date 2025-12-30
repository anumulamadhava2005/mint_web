/**
 * Rect Tool - Create rectangle shapes
 */

import type {
  Tool,
  ToolPointerEvent,
  ToolKeyEvent,
  ToolContext,
  ToolState,
} from './Tool';

// ─────────────────────────────────────────────────────────────────────────────
// Rect Tool State
// ─────────────────────────────────────────────────────────────────────────────

interface RectToolData {
  isDrawing: boolean;
  startWorldX: number;
  startWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
  shiftHeld: boolean;
  parentId: string | null;
}

function getRectData(state: ToolState): RectToolData {
  if (!state.data.rect) {
    state.data.rect = {
      isDrawing: false,
      startWorldX: 0,
      startWorldY: 0,
      currentWorldX: 0,
      currentWorldY: 0,
      shiftHeld: false,
      parentId: null,
    };
  }
  return state.data.rect as RectToolData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rect Tool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const RectTool: Tool = {
  id: 'rect',
  name: 'Rectangle',
  cursor: 'crosshair',
  
  onActivate(ctx) {
    ctx.setCursor('crosshair');
    ctx.setSelection(new Set());
  },
  
  onDeactivate(ctx, state) {
    const data = getRectData(state);
    data.isDrawing = false;
    ctx.setCursor('default');
  },
  
  onPointerDown(event, ctx, state) {
    const data = getRectData(state);
    state.isActive = true;
    data.isDrawing = true;
    
    data.startWorldX = event.worldX;
    data.startWorldY = event.worldY;
    data.currentWorldX = event.worldX;
    data.currentWorldY = event.worldY;
    data.shiftHeld = event.shiftKey;
    
    // Find parent frame at this position
    const hitId = ctx.hitTestNode(event.worldX, event.worldY);
    if (hitId) {
      const parentId = ctx.getParentId(hitId);
      data.parentId = parentId ?? hitId;
    } else {
      // Check if clicking inside any root frame
      const nodes = ctx.getDrawableNodes();
      const rootFrame = nodes.find(n => 
        n.type === 'FRAME' &&
        event.worldX >= n.x && event.worldX <= n.x + n.width &&
        event.worldY >= n.y && event.worldY <= n.y + n.height
      );
      data.parentId = rootFrame?.id ?? null;
    }
  },
  
  onPointerMove(event, ctx, state) {
    const data = getRectData(state);
    
    if (!state.isActive || !data.isDrawing) return;
    
    data.currentWorldX = event.worldX;
    data.currentWorldY = event.worldY;
    data.shiftHeld = event.shiftKey;
    
    ctx.requestRedraw();
  },
  
  onPointerUp(event, ctx, state) {
    const data = getRectData(state);
    
    if (!data.isDrawing) {
      state.isActive = false;
      return;
    }
    
    let { startWorldX, startWorldY, currentWorldX, currentWorldY, shiftHeld, parentId } = data;
    
    // Calculate bounds
    let x = Math.min(startWorldX, currentWorldX);
    let y = Math.min(startWorldY, currentWorldY);
    let width = Math.abs(currentWorldX - startWorldX);
    let height = Math.abs(currentWorldY - startWorldY);
    
    // Constrain to square if shift held
    if (shiftHeld) {
      const size = Math.max(width, height);
      width = size;
      height = size;
    }
    
    // Only create if larger than minimum
    if (width >= 1 && height >= 1) {
      // Adjust coordinates if inside a parent
      if (parentId) {
        const parentBounds = ctx.getNodeBounds(parentId);
        if (parentBounds) {
          x -= parentBounds.x;
          y -= parentBounds.y;
        }
      }
      
      const nodeId = ctx.createNode({
        type: 'RECTANGLE',
        name: 'Rectangle',
        x,
        y,
        width,
        height,
        fills: [{ type: 'SOLID', color: '#D9D9D9' }],
        strokes: [],
        corners: { uniform: 0 },
      }, parentId);
      
      ctx.setSelection(new Set([nodeId]));
      ctx.markChanged();
    }
    
    data.isDrawing = false;
    state.isActive = false;
    ctx.requestRedraw();
  },
  
  onKeyDown(event, ctx, state) {
    const data = getRectData(state);
    
    if (event.key === 'Escape' && data.isDrawing) {
      data.isDrawing = false;
      state.isActive = false;
      ctx.requestRedraw();
      event.preventDefault();
    }
    
    if (event.key === 'Shift') {
      data.shiftHeld = true;
      if (data.isDrawing) {
        ctx.requestRedraw();
      }
    }
  },
  
  onKeyUp(event, ctx, state) {
    const data = getRectData(state);
    
    if (event.key === 'Shift') {
      data.shiftHeld = false;
      if (data.isDrawing) {
        ctx.requestRedraw();
      }
    }
  },
  
  renderOverlay(renderCtx, toolCtx, state) {
    const data = getRectData(state);
    
    if (!data.isDrawing) return;
    
    const scale = toolCtx.getScale();
    const offset = toolCtx.getOffset();
    
    let { startWorldX, startWorldY, currentWorldX, currentWorldY, shiftHeld } = data;
    
    // Calculate bounds
    let x = Math.min(startWorldX, currentWorldX);
    let y = Math.min(startWorldY, currentWorldY);
    let width = Math.abs(currentWorldX - startWorldX);
    let height = Math.abs(currentWorldY - startWorldY);
    
    // Constrain to square if shift held
    if (shiftHeld) {
      const size = Math.max(width, height);
      width = size;
      height = size;
    }
    
    // Convert to screen coordinates
    const screenX = x * scale + offset.x;
    const screenY = y * scale + offset.y;
    const screenW = width * scale;
    const screenH = height * scale;
    
    // Draw preview rectangle
    renderCtx.fillStyle = 'rgba(217, 217, 217, 0.5)';
    renderCtx.fillRect(screenX, screenY, screenW, screenH);
    
    renderCtx.strokeStyle = '#0D99FF';
    renderCtx.lineWidth = 1;
    renderCtx.strokeRect(screenX, screenY, screenW, screenH);
    
    // Draw dimensions label
    if (width > 0 && height > 0) {
      renderCtx.fillStyle = '#0D99FF';
      renderCtx.font = '11px Inter, system-ui, sans-serif';
      const label = `${Math.round(width)} × ${Math.round(height)}`;
      renderCtx.fillText(label, screenX, screenY - 4);
    }
  },
};

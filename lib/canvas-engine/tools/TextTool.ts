/**
 * Text Tool - Create text nodes
 */

import type {
  Tool,
  ToolPointerEvent,
  ToolContext,
  ToolState,
} from './Tool';

// ─────────────────────────────────────────────────────────────────────────────
// Text Tool State
// ─────────────────────────────────────────────────────────────────────────────

interface TextToolData {
  pendingCreate: boolean;
  worldX: number;
  worldY: number;
  parentId: string | null;
}

function getTextData(state: ToolState): TextToolData {
  if (!state.data.text) {
    state.data.text = {
      pendingCreate: false,
      worldX: 0,
      worldY: 0,
      parentId: null,
    };
  }
  return state.data.text as TextToolData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text Tool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const TextTool: Tool = {
  id: 'text',
  name: 'Text',
  cursor: 'text',
  
  onActivate(ctx) {
    ctx.setCursor('text');
    ctx.setSelection(new Set());
  },
  
  onDeactivate(ctx, state) {
    const data = getTextData(state);
    data.pendingCreate = false;
    ctx.setCursor('default');
  },
  
  onPointerDown(event, ctx, state) {
    const data = getTextData(state);
    
    data.worldX = event.worldX;
    data.worldY = event.worldY;
    
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
    
    data.pendingCreate = true;
    state.isActive = true;
  },
  
  onPointerMove(event, ctx, state) {
    // Text tool doesn't drag
  },
  
  onPointerUp(event, ctx, state) {
    const data = getTextData(state);
    
    if (!data.pendingCreate) {
      state.isActive = false;
      return;
    }
    
    let { worldX, worldY, parentId } = data;
    
    // Adjust coordinates if inside a parent
    if (parentId) {
      const parentBounds = ctx.getNodeBounds(parentId);
      if (parentBounds) {
        worldX -= parentBounds.x;
        worldY -= parentBounds.y;
      }
    }
    
    // Create text node with default size
    const nodeId = ctx.createNode({
      type: 'TEXT',
      name: 'Text',
      x: worldX,
      y: worldY,
      width: 100,
      height: 24,
      characters: 'Text',
      text: {
        fontSize: 16,
        fontFamily: 'Inter',
        lineHeight: 1.5,
        letterSpacing: 0,
        textAlignHorizontal: 'LEFT',
        color: '#000000',
      },
      fills: [{ type: 'SOLID', color: '#000000' }],
      strokes: [],
    }, parentId);
    
    ctx.setSelection(new Set([nodeId]));
    ctx.markChanged();
    
    data.pendingCreate = false;
    state.isActive = false;
    ctx.requestRedraw();
    
    // TODO: Trigger inline text editing mode
  },
  
  onKeyDown(event, ctx, state) {
    const data = getTextData(state);
    
    if (event.key === 'Escape' && data.pendingCreate) {
      data.pendingCreate = false;
      state.isActive = false;
      ctx.requestRedraw();
      event.preventDefault();
    }
  },
  
  renderOverlay(renderCtx, toolCtx, state) {
    // Text tool shows cursor line at click position during pending create
    const data = getTextData(state);
    
    if (!data.pendingCreate) return;
    
    const scale = toolCtx.getScale();
    const offset = toolCtx.getOffset();
    
    const screenX = data.worldX * scale + offset.x;
    const screenY = data.worldY * scale + offset.y;
    
    // Draw text cursor indicator
    renderCtx.strokeStyle = '#0D99FF';
    renderCtx.lineWidth = 2;
    renderCtx.beginPath();
    renderCtx.moveTo(screenX, screenY);
    renderCtx.lineTo(screenX, screenY + 20 * scale);
    renderCtx.stroke();
  },
};

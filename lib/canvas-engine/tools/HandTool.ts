/**
 * Hand Tool - Panning the canvas
 */

import type {
  Tool,
  ToolPointerEvent,
  ToolContext,
  ToolState,
} from './Tool';

// ─────────────────────────────────────────────────────────────────────────────
// Hand Tool State
// ─────────────────────────────────────────────────────────────────────────────

interface HandToolData {
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
}

function getHandData(state: ToolState): HandToolData {
  if (!state.data.hand) {
    state.data.hand = {
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
    };
  }
  return state.data.hand as HandToolData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hand Tool Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const HandTool: Tool = {
  id: 'hand',
  name: 'Hand',
  cursor: 'grab',
  
  onActivate(ctx) {
    ctx.setCursor('grab');
  },
  
  onDeactivate(ctx) {
    ctx.setCursor('default');
  },
  
  onPointerDown(event, ctx, state) {
    const data = getHandData(state);
    state.isActive = true;
    
    const offset = ctx.getOffset();
    data.startClientX = event.clientX;
    data.startClientY = event.clientY;
    data.startOffsetX = offset.x;
    data.startOffsetY = offset.y;
    
    ctx.setCursor('grabbing');
  },
  
  onPointerMove(event, ctx, state) {
    if (!state.isActive) return;
    
    const data = getHandData(state);
    const dx = event.clientX - data.startClientX;
    const dy = event.clientY - data.startClientY;
    
    ctx.setOffset({
      x: data.startOffsetX + dx,
      y: data.startOffsetY + dy,
    });
    
    ctx.requestRedraw();
  },
  
  onPointerUp(event, ctx, state) {
    state.isActive = false;
    ctx.setCursor('grab');
  },
  
  onWheel(event, ctx, state) {
    // Pan with wheel when hand tool is active
    event.preventDefault();
    
    const offset = ctx.getOffset();
    ctx.setOffset({
      x: offset.x - event.deltaX,
      y: offset.y - event.deltaY,
    });
    
    ctx.requestRedraw();
  },
};

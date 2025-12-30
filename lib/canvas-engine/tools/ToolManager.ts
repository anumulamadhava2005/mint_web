/**
 * Tool Manager - Registry and state management for canvas tools
 */

import type {
  Tool,
  ToolId,
  ToolState,
  ToolContext,
  ToolPointerEvent,
  ToolKeyEvent,
} from './Tool';
import { createToolState } from './Tool';
import { SelectTool } from './SelectTool';
import { HandTool } from './HandTool';
import { RectTool } from './RectTool';
import { EllipseTool } from './EllipseTool';
import { TextTool } from './TextTool';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Registry
// ─────────────────────────────────────────────────────────────────────────────

const toolRegistry: Map<ToolId, Tool> = new Map([
  ['select', SelectTool],
  ['hand', HandTool],
  ['rect', RectTool],
  ['ellipse', EllipseTool],
  ['text', TextTool],
]);

export function getTool(id: ToolId): Tool | undefined {
  return toolRegistry.get(id);
}

export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values());
}

export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.id, tool);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Manager
// ─────────────────────────────────────────────────────────────────────────────

export class ToolManager {
  private activeTool: Tool;
  private toolState: ToolState;
  private context: ToolContext;
  
  constructor(context: ToolContext, initialToolId: ToolId = 'select') {
    this.context = context;
    this.toolState = createToolState();
    
    const tool = getTool(initialToolId);
    if (!tool) {
      throw new Error(`Tool '${initialToolId}' not found`);
    }
    this.activeTool = tool;
    
    // Activate initial tool
    this.activeTool.onActivate?.(this.context, this.toolState);
  }
  
  /** Get the currently active tool */
  getActiveTool(): Tool {
    return this.activeTool;
  }
  
  /** Get the current tool ID */
  getActiveToolId(): ToolId {
    return this.activeTool.id;
  }
  
  /** Switch to a different tool */
  setActiveTool(toolId: ToolId): void {
    if (this.activeTool.id === toolId) return;
    
    const newTool = getTool(toolId);
    if (!newTool) {
      console.warn(`Tool '${toolId}' not found`);
      return;
    }
    
    // Deactivate current tool
    this.activeTool.onDeactivate?.(this.context, this.toolState);
    
    // Reset tool state
    this.toolState = createToolState();
    
    // Activate new tool
    this.activeTool = newTool;
    this.activeTool.onActivate?.(this.context, this.toolState);
  }
  
  /** Update the context (e.g., when callbacks change) */
  updateContext(context: Partial<ToolContext>): void {
    this.context = { ...this.context, ...context };
  }
  
  // ─── Event Handlers ───
  
  handlePointerDown(event: ToolPointerEvent): void {
    this.activeTool.onPointerDown(event, this.context, this.toolState);
  }
  
  handlePointerMove(event: ToolPointerEvent): void {
    this.activeTool.onPointerMove(event, this.context, this.toolState);
  }
  
  handlePointerUp(event: ToolPointerEvent): void {
    this.activeTool.onPointerUp(event, this.context, this.toolState);
  }
  
  handleKeyDown(event: ToolKeyEvent): void {
    this.activeTool.onKeyDown?.(event, this.context, this.toolState);
  }
  
  handleKeyUp(event: ToolKeyEvent): void {
    this.activeTool.onKeyUp?.(event, this.context, this.toolState);
  }
  
  handleWheel(event: WheelEvent): void {
    this.activeTool.onWheel?.(event, this.context, this.toolState);
  }
  
  // ─── Overlay Rendering ───
  
  renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.activeTool.renderOverlay?.(ctx, this.context, this.toolState);
  }
  
  /** Check if the tool is currently in an active operation */
  isActive(): boolean {
    return this.toolState.isActive;
  }
  
  /** Get the tool state (for debugging/inspection) */
  getToolState(): ToolState {
    return this.toolState;
  }
}

/**
 * Tools module - Canvas interaction tools
 */

// Core interface
export type {
  Tool,
  ToolId,
  ToolState,
  ToolContext,
  ToolPointerEvent,
  ToolKeyEvent,
  NodeBounds,
  ResizeHandle,
  AlignmentGuides,
} from './Tool';

export { createToolState } from './Tool';

// Individual tools
export { SelectTool } from './SelectTool';
export { HandTool } from './HandTool';
export { RectTool } from './RectTool';
export { EllipseTool } from './EllipseTool';
export { TextTool } from './TextTool';

// Manager
export { ToolManager, getTool, getAllTools, registerTool } from './ToolManager';

// React hook
export {
  useToolManager,
  type UseToolManagerConfig,
  type UseToolManagerDeps,
  type UseToolManagerCallbacks,
  type UseToolManagerResult,
} from './useToolManager';

/**
 * Command Pattern - Base interface and types
 * 
 * All scene graph mutations go through commands for:
 * - Undo/redo support
 * - Serialization for collaboration
 * - History tracking
 */

import type { SceneNode, NodeStyles, LayoutConfig, Constraints } from '../scene-graph';

// ─────────────────────────────────────────────────────────────────────────────
// Command Types
// ─────────────────────────────────────────────────────────────────────────────

export type CommandType = 
  | 'MOVE'
  | 'RESIZE'
  | 'REPARENT'
  | 'STYLE_CHANGE'
  | 'CREATE'
  | 'DELETE'
  | 'BATCH';

// ─────────────────────────────────────────────────────────────────────────────
// Command Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base command interface - all mutations implement this
 */
export interface Command {
  /** Command type for serialization */
  readonly type: CommandType;
  
  /** Unique command ID */
  readonly id: string;
  
  /** Timestamp when command was created */
  readonly timestamp: number;
  
  /** Human-readable description */
  readonly description: string;
  
  /**
   * Execute the command (apply mutation)
   * @returns true if successful
   */
  execute(): boolean;
  
  /**
   * Undo the command (reverse mutation)
   * @returns true if successful
   */
  undo(): boolean;
  
  /**
   * Serialize command for persistence/collaboration
   */
  serialize(): SerializedCommand;
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialized Command Format
// ─────────────────────────────────────────────────────────────────────────────

export interface SerializedCommand {
  type: CommandType;
  id: string;
  timestamp: number;
  description: string;
  payload: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Payloads
// ─────────────────────────────────────────────────────────────────────────────

export interface MovePayload {
  nodeIds: string[];
  deltaX: number;
  deltaY: number;
  /** Previous positions for undo */
  previousPositions: Map<string, { x: number; y: number }>;
}

export interface ResizePayload {
  nodeId: string;
  /** New bounds */
  newBounds: { x: number; y: number; width: number; height: number };
  /** Previous bounds for undo */
  previousBounds: { x: number; y: number; width: number; height: number };
  /** Which handle was used (for proper anchor) */
  handle?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
}

export interface ReparentPayload {
  nodeId: string;
  /** New parent ID (null for root) */
  newParentId: string | null;
  /** New index in parent's children[] */
  newIndex: number;
  /** Previous parent ID for undo */
  previousParentId: string | null;
  /** Previous index for undo */
  previousIndex: number;
}

export interface StyleChangePayload {
  nodeId: string;
  /** Changed style properties */
  changes: Partial<NodeStyles>;
  /** Previous values for undo */
  previousValues: Partial<NodeStyles>;
}

export interface CreatePayload {
  /** The created node (full SceneNode data) */
  node: SceneNode;
  /** Parent ID to insert into */
  parentId: string | null;
  /** Index in parent's children[] */
  index: number;
}

export interface DeletePayload {
  /** The deleted node (full data for undo) */
  node: SceneNode;
  /** All descendant nodes (for undo) */
  descendants: SceneNode[];
  /** Parent ID it was removed from */
  parentId: string | null;
  /** Index it was at in parent's children[] */
  index: number;
}

export interface BatchPayload {
  /** Sub-commands to execute together */
  commands: SerializedCommand[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Context - Provides access to scene graph
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandContext {
  /** Get the scene graph */
  getSceneGraph(): Map<string, SceneNode>;
  
  /** Update a node in the scene graph */
  updateNode(nodeId: string, updates: Partial<SceneNode>): void;
  
  /** Add a node to the scene graph */
  addNode(node: SceneNode): void;
  
  /** Remove a node from the scene graph */
  removeNode(nodeId: string): SceneNode | null;
  
  /** Get a node by ID */
  getNode(nodeId: string): SceneNode | undefined;
  
  /** Notify that scene graph changed */
  notifyChange(): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: Generate command ID
// ─────────────────────────────────────────────────────────────────────────────

let commandCounter = 0;

export function generateCommandId(): string {
  return `cmd_${Date.now().toString(36)}_${(commandCounter++).toString(36)}`;
}

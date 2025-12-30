/**
 * CommandManager - Manages command history for undo/redo
 * 
 * Features:
 * - Undo/redo stack
 * - Command coalescing (merge consecutive similar commands)
 * - History limit
 * - Serialization support
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  SerializedCommand,
  CommandType,
} from './Command';
import { MoveCommand } from './MoveCommand';
import { ResizeCommand } from './ResizeCommand';
import { ReparentCommand } from './ReparentCommand';
import { StyleChangeCommand } from './StyleChangeCommand';
import { CreateCommand } from './CreateCommand';
import { DeleteCommand } from './DeleteCommand';
import { BatchCommand } from './BatchCommand';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandManagerOptions {
  /** Maximum number of commands in history */
  maxHistory?: number;
  /** Time window for coalescing similar commands (ms) */
  coalesceWindow?: number;
  /** Callback when history changes */
  onHistoryChange?: () => void;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  historyLength: number;
  currentIndex: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CommandManager Class
// ─────────────────────────────────────────────────────────────────────────────

export class CommandManager {
  private ctx: CommandContext;
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private coalesceWindow: number;
  private onHistoryChange?: () => void;
  private lastCommandTime: number = 0;
  private isExecuting: boolean = false;
  
  constructor(ctx: CommandContext, options: CommandManagerOptions = {}) {
    this.ctx = ctx;
    this.maxHistory = options.maxHistory ?? 100;
    this.coalesceWindow = options.coalesceWindow ?? 500; // 500ms default
    this.onHistoryChange = options.onHistoryChange;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Execute Commands
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Execute a command and add to history
   */
  execute(command: Command): boolean {
    if (this.isExecuting) {
      console.warn('CommandManager: Cannot execute during another execution');
      return false;
    }
    
    this.isExecuting = true;
    
    try {
      // Try to coalesce with previous command
      if (this.shouldCoalesce(command)) {
        const coalesced = this.coalesceCommands(this.undoStack[this.undoStack.length - 1], command);
        if (coalesced) {
          // Replace last command with coalesced version
          this.undoStack[this.undoStack.length - 1] = coalesced;
          if (!coalesced.execute()) {
            return false;
          }
          this.lastCommandTime = Date.now();
          this.notifyChange();
          return true;
        }
      }
      
      // Execute the command
      if (!command.execute()) {
        return false;
      }
      
      // Add to undo stack
      this.undoStack.push(command);
      
      // Clear redo stack (new branch)
      this.redoStack = [];
      
      // Trim history if needed
      while (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      
      this.lastCommandTime = Date.now();
      this.notifyChange();
      return true;
      
    } finally {
      this.isExecuting = false;
    }
  }
  
  /**
   * Execute multiple commands as a batch
   */
  executeBatch(commands: Command[], description?: string): boolean {
    if (commands.length === 0) return true;
    if (commands.length === 1) return this.execute(commands[0]);
    
    const batch = new BatchCommand(this.ctx, commands, description);
    return this.execute(batch);
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Undo/Redo
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Undo the last command
   */
  undo(): boolean {
    if (!this.canUndo()) return false;
    if (this.isExecuting) return false;
    
    this.isExecuting = true;
    
    try {
      const command = this.undoStack.pop()!;
      
      if (!command.undo()) {
        // Undo failed, put it back
        this.undoStack.push(command);
        return false;
      }
      
      this.redoStack.push(command);
      this.notifyChange();
      return true;
      
    } finally {
      this.isExecuting = false;
    }
  }
  
  /**
   * Redo the last undone command
   */
  redo(): boolean {
    if (!this.canRedo()) return false;
    if (this.isExecuting) return false;
    
    this.isExecuting = true;
    
    try {
      const command = this.redoStack.pop()!;
      
      if (!command.execute()) {
        // Redo failed, put it back
        this.redoStack.push(command);
        return false;
      }
      
      this.undoStack.push(command);
      this.notifyChange();
      return true;
      
    } finally {
      this.isExecuting = false;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // State Queries
  // ─────────────────────────────────────────────────────────────────────────
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.undoStack.length > 0 
        ? this.undoStack[this.undoStack.length - 1].description 
        : null,
      redoDescription: this.redoStack.length > 0
        ? this.redoStack[this.redoStack.length - 1].description
        : null,
      historyLength: this.undoStack.length,
      currentIndex: this.undoStack.length,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // History Management
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }
  
  /**
   * Get serialized history
   */
  serialize(): SerializedCommand[] {
    return this.undoStack.map(cmd => cmd.serialize());
  }
  
  /**
   * Restore history from serialized data
   */
  deserialize(commands: SerializedCommand[]): void {
    this.undoStack = commands.map(data => this.deserializeCommand(data));
    this.redoStack = [];
    this.notifyChange();
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Command Coalescing
  // ─────────────────────────────────────────────────────────────────────────
  
  private shouldCoalesce(newCommand: Command): boolean {
    if (this.undoStack.length === 0) return false;
    
    const lastCommand = this.undoStack[this.undoStack.length - 1];
    const timeDiff = Date.now() - this.lastCommandTime;
    
    // Only coalesce within time window
    if (timeDiff > this.coalesceWindow) return false;
    
    // Only coalesce same type
    if (lastCommand.type !== newCommand.type) return false;
    
    // Type-specific coalescing rules
    switch (newCommand.type) {
      case 'MOVE':
        // Coalesce moves of the same nodes
        return this.canCoalesceMove(lastCommand as MoveCommand, newCommand as MoveCommand);
      case 'RESIZE':
        // Coalesce resizes of the same node
        return this.canCoalesceResize(lastCommand as ResizeCommand, newCommand as ResizeCommand);
      case 'STYLE_CHANGE':
        // Coalesce style changes on same node
        return this.canCoalesceStyleChange(lastCommand as StyleChangeCommand, newCommand as StyleChangeCommand);
      default:
        return false;
    }
  }
  
  private canCoalesceMove(last: MoveCommand, next: MoveCommand): boolean {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    // Same set of nodes
    if (lastPayload.nodeIds.length !== nextPayload.nodeIds.length) return false;
    return lastPayload.nodeIds.every((id: string) => nextPayload.nodeIds.includes(id));
  }
  
  private canCoalesceResize(last: ResizeCommand, next: ResizeCommand): boolean {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    return lastPayload.nodeId === nextPayload.nodeId;
  }
  
  private canCoalesceStyleChange(last: StyleChangeCommand, next: StyleChangeCommand): boolean {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    return lastPayload.nodeId === nextPayload.nodeId;
  }
  
  private coalesceCommands(last: Command, next: Command): Command | null {
    switch (next.type) {
      case 'MOVE':
        return this.coalesceMoveCommands(last as MoveCommand, next as MoveCommand);
      case 'RESIZE':
        return this.coalesceResizeCommands(last as ResizeCommand, next as ResizeCommand);
      case 'STYLE_CHANGE':
        return this.coalesceStyleChangeCommands(last as StyleChangeCommand, next as StyleChangeCommand);
      default:
        return null;
    }
  }
  
  private coalesceMoveCommands(last: MoveCommand, next: MoveCommand): MoveCommand {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    // Combine deltas, keep original previous positions
    return new MoveCommand(
      this.ctx,
      lastPayload.nodeIds,
      lastPayload.deltaX + nextPayload.deltaX,
      lastPayload.deltaY + nextPayload.deltaY,
      lastPayload.previousPositions
    );
  }
  
  private coalesceResizeCommands(last: ResizeCommand, next: ResizeCommand): ResizeCommand {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    // Use new bounds, keep original previous bounds
    return new ResizeCommand(
      this.ctx,
      lastPayload.nodeId,
      nextPayload.newBounds,
      lastPayload.previousBounds,
      nextPayload.handle
    );
  }
  
  private coalesceStyleChangeCommands(last: StyleChangeCommand, next: StyleChangeCommand): StyleChangeCommand {
    const lastPayload = (last as any).payload;
    const nextPayload = (next as any).payload;
    
    // Merge changes, keep original previous values
    return new StyleChangeCommand(
      this.ctx,
      lastPayload.nodeId,
      { ...lastPayload.changes, ...nextPayload.changes },
      lastPayload.previousValues
    );
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Deserialization
  // ─────────────────────────────────────────────────────────────────────────
  
  private deserializeCommand(data: SerializedCommand): Command {
    switch (data.type) {
      case 'MOVE':
        return MoveCommand.deserialize(this.ctx, data);
      case 'RESIZE':
        return ResizeCommand.deserialize(this.ctx, data);
      case 'REPARENT':
        return ReparentCommand.deserialize(this.ctx, data);
      case 'STYLE_CHANGE':
        return StyleChangeCommand.deserialize(this.ctx, data);
      case 'CREATE':
        return CreateCommand.deserialize(this.ctx, data);
      case 'DELETE':
        return DeleteCommand.deserialize(this.ctx, data);
      case 'BATCH':
        const batchPayload = data.payload as { commands: SerializedCommand[] };
        const subCommands = batchPayload.commands.map(c => this.deserializeCommand(c));
        return new BatchCommand(this.ctx, subCommands, data.description);
      default:
        throw new Error(`Unknown command type: ${data.type}`);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Notifications
  // ─────────────────────────────────────────────────────────────────────────
  
  private notifyChange(): void {
    this.onHistoryChange?.();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton factory
// ─────────────────────────────────────────────────────────────────────────────

let globalCommandManager: CommandManager | null = null;

export function getCommandManager(): CommandManager | null {
  return globalCommandManager;
}

export function createCommandManager(ctx: CommandContext, options?: CommandManagerOptions): CommandManager {
  globalCommandManager = new CommandManager(ctx, options);
  return globalCommandManager;
}

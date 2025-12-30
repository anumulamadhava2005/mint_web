/**
 * HistoryManager - Command pattern with undo/redo and drag coalescing
 * 
 * Features:
 * - Undo/Redo stack with configurable limit
 * - Command coalescing for drags (group into single undo step)
 * - Transaction support (multiple operations as one undo)
 * - History change listeners
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Command {
  /** Unique command type */
  type: string;
  /** Human-readable description */
  description: string;
  /** Execute the command (redo) */
  execute(): void;
  /** Undo the command */
  undo(): void;
  /** Whether this command can be merged with another */
  canMerge?(other: Command): boolean;
  /** Merge with another command */
  merge?(other: Command): void;
  /** Timestamp for coalescing */
  timestamp?: number;
}

export interface Transaction {
  commands: Command[];
  description: string;
}

export type HistoryChangeListener = (canUndo: boolean, canRedo: boolean) => void;

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  historyLength: number;
  currentIndex: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Default history limit */
export const DEFAULT_HISTORY_LIMIT = 100;

/** Time window for coalescing drag operations (ms) */
export const COALESCE_WINDOW = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a move command
 */
export function createMoveCommand(
  nodeIds: string[],
  oldPositions: Map<string, { x: number; y: number }>,
  newPositions: Map<string, { x: number; y: number }>,
  applyPositions: (positions: Map<string, { x: number; y: number }>) => void
): Command {
  return {
    type: 'move',
    description: `Move ${nodeIds.length} element${nodeIds.length > 1 ? 's' : ''}`,
    timestamp: Date.now(),
    execute() {
      applyPositions(newPositions);
    },
    undo() {
      applyPositions(oldPositions);
    },
    canMerge(other: Command) {
      if (other.type !== 'move') return false;
      // Same nodes within time window
      const otherMove = other as ReturnType<typeof createMoveCommand>;
      if (!otherMove.timestamp) return false;
      return Date.now() - otherMove.timestamp < COALESCE_WINDOW;
    },
    merge(other: Command) {
      // Keep old positions from this command, use new positions from other
      const otherPositions = (other as any).newPositions as Map<string, { x: number; y: number }>;
      otherPositions.forEach((pos, id) => {
        newPositions.set(id, pos);
      });
    },
  };
}

/**
 * Create a resize command
 */
export function createResizeCommand(
  nodeIds: string[],
  oldBounds: Map<string, { x: number; y: number; width: number; height: number }>,
  newBounds: Map<string, { x: number; y: number; width: number; height: number }>,
  applyBounds: (bounds: Map<string, { x: number; y: number; width: number; height: number }>) => void
): Command {
  return {
    type: 'resize',
    description: `Resize ${nodeIds.length} element${nodeIds.length > 1 ? 's' : ''}`,
    timestamp: Date.now(),
    execute() {
      applyBounds(newBounds);
    },
    undo() {
      applyBounds(oldBounds);
    },
    canMerge(other: Command) {
      if (other.type !== 'resize') return false;
      const otherResize = other as ReturnType<typeof createResizeCommand>;
      if (!otherResize.timestamp) return false;
      return Date.now() - otherResize.timestamp < COALESCE_WINDOW;
    },
    merge(other: Command) {
      const otherBounds = (other as any).newBounds as Map<string, { x: number; y: number; width: number; height: number }>;
      otherBounds.forEach((b, id) => {
        newBounds.set(id, b);
      });
    },
  };
}

/**
 * Create a rotation command
 */
export function createRotateCommand(
  nodeIds: string[],
  oldRotations: Map<string, number>,
  newRotations: Map<string, number>,
  applyRotations: (rotations: Map<string, number>) => void
): Command {
  return {
    type: 'rotate',
    description: `Rotate ${nodeIds.length} element${nodeIds.length > 1 ? 's' : ''}`,
    timestamp: Date.now(),
    execute() {
      applyRotations(newRotations);
    },
    undo() {
      applyRotations(oldRotations);
    },
    canMerge(other: Command) {
      if (other.type !== 'rotate') return false;
      const otherRotate = other as ReturnType<typeof createRotateCommand>;
      if (!otherRotate.timestamp) return false;
      return Date.now() - otherRotate.timestamp < COALESCE_WINDOW;
    },
    merge(other: Command) {
      const otherRotations = (other as any).newRotations as Map<string, number>;
      otherRotations.forEach((r, id) => {
        newRotations.set(id, r);
      });
    },
  };
}

/**
 * Create a delete command
 */
export function createDeleteCommand(
  nodes: any[],
  parentIds: Map<string, string | null>,
  deleteNodes: (ids: string[]) => void,
  restoreNodes: (nodes: any[], parentIds: Map<string, string | null>) => void
): Command {
  return {
    type: 'delete',
    description: `Delete ${nodes.length} element${nodes.length > 1 ? 's' : ''}`,
    execute() {
      deleteNodes(nodes.map(n => n.id));
    },
    undo() {
      restoreNodes(nodes, parentIds);
    },
  };
}

/**
 * Create an add command
 */
export function createAddCommand(
  nodes: any[],
  parentIds: Map<string, string | null>,
  addNodes: (nodes: any[], parentIds: Map<string, string | null>) => void,
  deleteNodes: (ids: string[]) => void
): Command {
  return {
    type: 'add',
    description: `Add ${nodes.length} element${nodes.length > 1 ? 's' : ''}`,
    execute() {
      addNodes(nodes, parentIds);
    },
    undo() {
      deleteNodes(nodes.map(n => n.id));
    },
  };
}

/**
 * Create a property change command
 */
export function createPropertyCommand(
  nodeId: string,
  property: string,
  oldValue: any,
  newValue: any,
  applyProperty: (id: string, prop: string, value: any) => void
): Command {
  return {
    type: 'property',
    description: `Change ${property}`,
    timestamp: Date.now(),
    execute() {
      applyProperty(nodeId, property, newValue);
    },
    undo() {
      applyProperty(nodeId, property, oldValue);
    },
    canMerge(other: Command) {
      if (other.type !== 'property') return false;
      const otherProp = other as ReturnType<typeof createPropertyCommand>;
      if ((otherProp as any).nodeId !== nodeId) return false;
      if ((otherProp as any).property !== property) return false;
      if (!otherProp.timestamp) return false;
      return Date.now() - otherProp.timestamp < COALESCE_WINDOW;
    },
    merge(other: Command) {
      // Keep our old value, take their new value
      const otherNew = (other as any).newValue;
      (this as any).newValue = otherNew;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTORY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

export class HistoryManager {
  private undoStack: (Command | Transaction)[] = [];
  private redoStack: (Command | Transaction)[] = [];
  private limit: number = DEFAULT_HISTORY_LIMIT;
  private listeners: Set<HistoryChangeListener> = new Set();
  private activeTransaction: Transaction | null = null;
  private isPaused: boolean = false;
  
  // ─── Configuration ───
  
  setLimit(limit: number): void {
    this.limit = Math.max(1, limit);
    this.trimStack();
  }
  
  getLimit(): number {
    return this.limit;
  }
  
  // ─── State ───
  
  getState(): HistoryState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.getUndoDescription(),
      redoDescription: this.getRedoDescription(),
      historyLength: this.undoStack.length,
      currentIndex: this.undoStack.length,
    };
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  
  getUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    const item = this.undoStack[this.undoStack.length - 1];
    // Both Command and Transaction have description
    return item.description || 'Unknown';
  }
  
  getRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    const item = this.redoStack[this.redoStack.length - 1];
    // Both Command and Transaction have description
    return item.description || 'Unknown';
  }
  
  // ─── Operations ───
  
  /**
   * Execute and record a command
   */
  execute(command: Command): void {
    if (this.isPaused) {
      command.execute();
      return;
    }
    
    // If in transaction, add to transaction
    if (this.activeTransaction) {
      command.execute();
      this.activeTransaction.commands.push(command);
      return;
    }
    
    // Try to merge with previous command
    if (this.undoStack.length > 0) {
      const last = this.undoStack[this.undoStack.length - 1];
      if ('type' in last && command.canMerge && command.canMerge(last as Command)) {
        command.execute();
        if (command.merge) {
          (last as Command).merge!(command);
        }
        this.notifyListeners();
        return;
      }
    }
    
    // Execute and push
    command.execute();
    this.undoStack.push(command);
    
    // Clear redo stack
    this.redoStack = [];
    
    // Trim if needed
    this.trimStack();
    
    this.notifyListeners();
  }
  
  /**
   * Undo last command
   */
  undo(): void {
    if (!this.canUndo()) return;
    
    const item = this.undoStack.pop()!;
    
    if ('commands' in item) {
      // Transaction - undo all commands in reverse
      for (let i = item.commands.length - 1; i >= 0; i--) {
        item.commands[i].undo();
      }
    } else {
      item.undo();
    }
    
    this.redoStack.push(item);
    this.notifyListeners();
  }
  
  /**
   * Redo last undone command
   */
  redo(): void {
    if (!this.canRedo()) return;
    
    const item = this.redoStack.pop()!;
    
    if ('commands' in item) {
      // Transaction - execute all commands
      for (const cmd of item.commands) {
        cmd.execute();
      }
    } else {
      item.execute();
    }
    
    this.undoStack.push(item);
    this.notifyListeners();
  }
  
  // ─── Transactions ───
  
  /**
   * Begin a transaction (multiple commands as one undo step)
   */
  beginTransaction(description: string): void {
    if (this.activeTransaction) {
      console.warn('Transaction already active');
      return;
    }
    
    this.activeTransaction = {
      commands: [],
      description,
    };
  }
  
  /**
   * Commit current transaction
   */
  commitTransaction(): void {
    if (!this.activeTransaction) {
      console.warn('No active transaction');
      return;
    }
    
    if (this.activeTransaction.commands.length > 0) {
      this.undoStack.push(this.activeTransaction);
      this.redoStack = [];
      this.trimStack();
    }
    
    this.activeTransaction = null;
    this.notifyListeners();
  }
  
  /**
   * Abort current transaction
   */
  abortTransaction(): void {
    if (!this.activeTransaction) return;
    
    // Undo all commands in reverse
    for (let i = this.activeTransaction.commands.length - 1; i >= 0; i--) {
      this.activeTransaction.commands[i].undo();
    }
    
    this.activeTransaction = null;
    this.notifyListeners();
  }
  
  /**
   * Check if in transaction
   */
  isInTransaction(): boolean {
    return this.activeTransaction !== null;
  }
  
  // ─── Pause/Resume ───
  
  /**
   * Pause history recording
   */
  pause(): void {
    this.isPaused = true;
  }
  
  /**
   * Resume history recording
   */
  resume(): void {
    this.isPaused = false;
  }
  
  /**
   * Check if paused
   */
  isPausedState(): boolean {
    return this.isPaused;
  }
  
  // ─── Listeners ───
  
  /**
   * Subscribe to history changes
   */
  subscribe(listener: HistoryChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();
    for (const listener of this.listeners) {
      listener(canUndo, canRedo);
    }
  }
  
  // ─── Utilities ───
  
  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.activeTransaction = null;
    this.notifyListeners();
  }
  
  /**
   * Trim stack to limit
   */
  private trimStack(): void {
    while (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const historyManager = new HistoryManager();

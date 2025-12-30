/**
 * HistoryManager - Enhanced history management with drag batching and memory caps
 * 
 * Features:
 * - Undo/redo stack (delegates to CommandManager)
 * - Command batching during drag operations
 * - Keyboard shortcuts handler
 * - Memory cap to prevent unbounded growth
 * - Transaction support for multi-step operations
 * - Persistence hooks (for future implementation)
 */

import { CommandManager, CommandManagerOptions, HistoryState } from './CommandManager';
import { Command, CommandContext, SerializedCommand } from './Command';
import { MoveCommand } from './MoveCommand';
import { ResizeCommand } from './ResizeCommand';
import { BatchCommand } from './BatchCommand';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryManagerOptions extends CommandManagerOptions {
  /** Maximum memory usage in bytes (approximate) */
  maxMemoryBytes?: number;
  /** Debounce time for drag operations (ms) */
  dragDebounceMs?: number;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Persistence adapter (optional, for future use) */
  persistenceAdapter?: HistoryPersistenceAdapter;
}

export interface HistoryPersistenceAdapter {
  save(data: SerializedHistory): Promise<void>;
  load(): Promise<SerializedHistory | null>;
  clear(): Promise<void>;
}

export interface SerializedHistory {
  version: number;
  timestamp: number;
  commands: SerializedCommand[];
  metadata?: Record<string, unknown>;
}

export interface DragSession {
  id: string;
  type: 'move' | 'resize';
  nodeIds: string[];
  startTime: number;
  commands: Command[];
  initialState: Map<string, { x: number; y: number; width?: number; height?: number }>;
}

export type TransactionId = string;

// ─────────────────────────────────────────────────────────────────────────────
// HistoryManager Class
// ─────────────────────────────────────────────────────────────────────────────

export class HistoryManager {
  private commandManager: CommandManager;
  private ctx: CommandContext;
  private options: HistoryManagerOptions;
  
  // Drag batching state
  private activeDragSession: DragSession | null = null;
  private dragDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Transaction state
  private activeTransactions: Map<TransactionId, Command[]> = new Map();
  
  // Memory tracking
  private estimatedMemoryUsage: number = 0;
  private maxMemoryBytes: number;
  
  // Keyboard handler reference
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  
  // Change listeners
  private listeners: Set<() => void> = new Set();
  
  constructor(ctx: CommandContext, options: HistoryManagerOptions = {}) {
    this.ctx = ctx;
    this.options = options;
    this.maxMemoryBytes = options.maxMemoryBytes ?? 50 * 1024 * 1024; // 50MB default
    
    // Create underlying CommandManager
    this.commandManager = new CommandManager(ctx, {
      ...options,
      onHistoryChange: () => this.handleHistoryChange(),
    });
    
    // Setup keyboard shortcuts if enabled
    if (options.enableKeyboardShortcuts !== false) {
      this.setupKeyboardShortcuts();
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Basic Operations
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Execute a command and add to history
   */
  execute(command: Command): boolean {
    const result = this.commandManager.execute(command);
    if (result) {
      this.updateMemoryUsage(command, 'add');
      this.trimHistoryForMemory();
    }
    return result;
  }
  
  /**
   * Execute multiple commands as a batch
   */
  executeBatch(commands: Command[], description?: string): boolean {
    return this.commandManager.executeBatch(commands, description);
  }
  
  /**
   * Undo the last command
   */
  undo(): boolean {
    return this.commandManager.undo();
  }
  
  /**
   * Redo the last undone command
   */
  redo(): boolean {
    return this.commandManager.redo();
  }
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.commandManager.canUndo();
  }
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.commandManager.canRedo();
  }
  
  /**
   * Get current history state
   */
  getState(): HistoryState {
    return this.commandManager.getState();
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.commandManager.clear();
    this.estimatedMemoryUsage = 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Drag Batching
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Start a drag session - collects all moves/resizes into a single undo step
   */
  startDragSession(type: 'move' | 'resize', nodeIds: string[]): string {
    // Finalize any existing session
    this.finalizeDragSession();
    
    const sessionId = `drag_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Capture initial state
    const initialState = new Map<string, { x: number; y: number; width?: number; height?: number }>();
    for (const nodeId of nodeIds) {
      const node = this.ctx.getNode(nodeId);
      if (node) {
        // Use localTransform for position (tx=index4, ty=index5) and size for dimensions
        initialState.set(nodeId, {
          x: node.localTransform[4],
          y: node.localTransform[5],
          width: node.size.width,
          height: node.size.height,
        });
      }
    }
    
    this.activeDragSession = {
      id: sessionId,
      type,
      nodeIds,
      startTime: Date.now(),
      commands: [],
      initialState,
    };
    
    return sessionId;
  }
  
  /**
   * Record a drag update (doesn't add to history yet)
   */
  recordDragUpdate(command: Command): void {
    if (!this.activeDragSession) {
      // No active session, execute immediately
      this.execute(command);
      return;
    }
    
    // Execute for live preview but don't add to history
    command.execute();
    this.activeDragSession.commands.push(command);
    
    // Reset debounce timer
    if (this.dragDebounceTimer) {
      clearTimeout(this.dragDebounceTimer);
    }
    
    const debounceMs = this.options.dragDebounceMs ?? 100;
    this.dragDebounceTimer = setTimeout(() => {
      // If no more updates, finalize
      // (This is a safety fallback; normally finalizeDragSession is called explicitly)
    }, debounceMs);
  }
  
  /**
   * Finalize drag session - creates a single undo step for the entire drag
   */
  finalizeDragSession(): Command | null {
    if (this.dragDebounceTimer) {
      clearTimeout(this.dragDebounceTimer);
      this.dragDebounceTimer = null;
    }
    
    if (!this.activeDragSession) {
      return null;
    }
    
    const session = this.activeDragSession;
    this.activeDragSession = null;
    
    if (session.commands.length === 0) {
      return null;
    }
    
    // Calculate total delta from initial to final state
    const finalCommand = this.createFinalDragCommand(session);
    
    if (finalCommand) {
      // Add the coalesced command to history
      // Note: Don't execute - state is already updated from live updates
      this.commandManager['undoStack'].push(finalCommand);
      this.commandManager['redoStack'] = [];
      this.updateMemoryUsage(finalCommand, 'add');
      this.trimHistoryForMemory();
      this.handleHistoryChange();
    }
    
    return finalCommand;
  }
  
  /**
   * Cancel drag session - reverts to initial state
   */
  cancelDragSession(): void {
    if (this.dragDebounceTimer) {
      clearTimeout(this.dragDebounceTimer);
      this.dragDebounceTimer = null;
    }
    
    if (!this.activeDragSession) {
      return;
    }
    
    const session = this.activeDragSession;
    this.activeDragSession = null;
    
    // Revert all commands in reverse order
    for (let i = session.commands.length - 1; i >= 0; i--) {
      session.commands[i].undo();
    }
  }
  
  /**
   * Check if a drag session is active
   */
  isDragging(): boolean {
    return this.activeDragSession !== null;
  }
  
  private createFinalDragCommand(session: DragSession): Command | null {
    if (session.type === 'move') {
      return this.createFinalMoveCommand(session);
    } else if (session.type === 'resize') {
      return this.createFinalResizeCommand(session);
    }
    return null;
  }
  
  private createFinalMoveCommand(session: DragSession): MoveCommand | null {
    // Calculate total delta from initial positions
    const nodeId = session.nodeIds[0];
    if (!nodeId) return null;
    
    const initialPos = session.initialState.get(nodeId);
    const node = this.ctx.getNode(nodeId);
    
    if (!initialPos || !node) return null;
    
    const deltaX = node.localTransform[4] - initialPos.x;
    const deltaY = node.localTransform[5] - initialPos.y;
    
    if (deltaX === 0 && deltaY === 0) return null;
    
    // Create a move command with the initial positions preserved
    const previousPositions = new Map<string, { x: number; y: number }>();
    for (const [id, state] of session.initialState) {
      previousPositions.set(id, { x: state.x, y: state.y });
    }
    
    return new MoveCommand(
      this.ctx,
      session.nodeIds,
      deltaX,
      deltaY,
      previousPositions
    );
  }
  
  private createFinalResizeCommand(session: DragSession): ResizeCommand | null {
    const nodeId = session.nodeIds[0];
    if (!nodeId) return null;
    
    const initialState = session.initialState.get(nodeId);
    const node = this.ctx.getNode(nodeId);
    
    if (!initialState || !node) return null;
    
    return new ResizeCommand(
      this.ctx,
      nodeId,
      { 
        x: node.localTransform[4], 
        y: node.localTransform[5], 
        width: node.size.width, 
        height: node.size.height 
      },
      { 
        x: initialState.x, 
        y: initialState.y, 
        width: initialState.width!, 
        height: initialState.height! 
      }
    );
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Transactions
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Begin a transaction - groups multiple commands into one undo step
   */
  beginTransaction(id?: string): TransactionId {
    const transactionId = id ?? `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.activeTransactions.set(transactionId, []);
    return transactionId;
  }
  
  /**
   * Record a command in a transaction (executed but not added to history yet)
   */
  recordInTransaction(transactionId: TransactionId, command: Command): boolean {
    const commands = this.activeTransactions.get(transactionId);
    if (!commands) {
      console.warn(`HistoryManager: Unknown transaction ${transactionId}`);
      return false;
    }
    
    if (!command.execute()) {
      return false;
    }
    
    commands.push(command);
    return true;
  }
  
  /**
   * Commit a transaction - creates single undo step
   */
  commitTransaction(transactionId: TransactionId, description?: string): boolean {
    const commands = this.activeTransactions.get(transactionId);
    this.activeTransactions.delete(transactionId);
    
    if (!commands || commands.length === 0) {
      return false;
    }
    
    // Create batch command (commands already executed)
    const batch = new BatchCommand(this.ctx, commands, description);
    
    // Add to history directly (already executed)
    this.commandManager['undoStack'].push(batch);
    this.commandManager['redoStack'] = [];
    this.updateMemoryUsage(batch, 'add');
    this.trimHistoryForMemory();
    this.handleHistoryChange();
    
    return true;
  }
  
  /**
   * Rollback a transaction - reverts all commands
   */
  rollbackTransaction(transactionId: TransactionId): void {
    const commands = this.activeTransactions.get(transactionId);
    this.activeTransactions.delete(transactionId);
    
    if (!commands) return;
    
    // Undo all commands in reverse order
    for (let i = commands.length - 1; i >= 0; i--) {
      commands[i].undo();
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Memory Management
  // ─────────────────────────────────────────────────────────────────────────
  
  private updateMemoryUsage(command: Command, action: 'add' | 'remove'): void {
    const size = this.estimateCommandSize(command);
    if (action === 'add') {
      this.estimatedMemoryUsage += size;
    } else {
      this.estimatedMemoryUsage = Math.max(0, this.estimatedMemoryUsage - size);
    }
  }
  
  private estimateCommandSize(command: Command): number {
    // Rough estimation based on serialized size
    try {
      const serialized = command.serialize();
      const json = JSON.stringify(serialized);
      // Account for object overhead (~2x JSON size)
      return json.length * 2;
    } catch {
      // Default estimate if serialization fails
      return 1024;
    }
  }
  
  private trimHistoryForMemory(): void {
    const undoStack = this.commandManager['undoStack'] as Command[];
    
    while (this.estimatedMemoryUsage > this.maxMemoryBytes && undoStack.length > 1) {
      const removed = undoStack.shift();
      if (removed) {
        this.updateMemoryUsage(removed, 'remove');
      }
    }
  }
  
  /**
   * Get estimated memory usage
   */
  getMemoryUsage(): { bytes: number; maxBytes: number; percentage: number } {
    return {
      bytes: this.estimatedMemoryUsage,
      maxBytes: this.maxMemoryBytes,
      percentage: (this.estimatedMemoryUsage / this.maxMemoryBytes) * 100,
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard Shortcuts
  // ─────────────────────────────────────────────────────────────────────────
  
  private setupKeyboardShortcuts(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Don't intercept if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
        return;
      }
      
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y / Cmd+Y
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.redo();
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
        return;
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydownHandler);
    }
  }
  
  /**
   * Enable or disable keyboard shortcuts
   */
  setKeyboardShortcutsEnabled(enabled: boolean): void {
    if (enabled && !this.keydownHandler) {
      this.setupKeyboardShortcuts();
    } else if (!enabled && this.keydownHandler) {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      this.keydownHandler = null;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Persistence (Future)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Save history to persistence adapter
   */
  async save(): Promise<void> {
    if (!this.options.persistenceAdapter) {
      console.warn('HistoryManager: No persistence adapter configured');
      return;
    }
    
    const data: SerializedHistory = {
      version: 1,
      timestamp: Date.now(),
      commands: this.commandManager.serialize(),
    };
    
    await this.options.persistenceAdapter.save(data);
  }
  
  /**
   * Load history from persistence adapter
   */
  async load(): Promise<boolean> {
    if (!this.options.persistenceAdapter) {
      return false;
    }
    
    const data = await this.options.persistenceAdapter.load();
    if (!data) {
      return false;
    }
    
    if (data.version !== 1) {
      console.warn(`HistoryManager: Unknown history version ${data.version}`);
      return false;
    }
    
    this.commandManager.deserialize(data.commands);
    return true;
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Change Listeners
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Subscribe to history changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private handleHistoryChange(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error('HistoryManager: Listener error:', e);
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Dispose of resources
   */
  dispose(): void {
    // Remove keyboard handler
    if (this.keydownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    
    // Clear timers
    if (this.dragDebounceTimer) {
      clearTimeout(this.dragDebounceTimer);
      this.dragDebounceTimer = null;
    }
    
    // Clear state
    this.activeDragSession = null;
    this.activeTransactions.clear();
    this.listeners.clear();
    
    // Clear history
    this.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface UseHistoryResult {
  /** Undo last action */
  undo: () => boolean;
  /** Redo last undone action */
  redo: () => boolean;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Current history state */
  state: HistoryState;
  /** Memory usage info */
  memoryUsage: { bytes: number; maxBytes: number; percentage: number };
  /** Start a drag session */
  startDrag: (type: 'move' | 'resize', nodeIds: string[]) => string;
  /** Record drag update */
  recordDrag: (command: Command) => void;
  /** Finalize drag session */
  finalizeDrag: () => Command | null;
  /** Cancel drag session */
  cancelDrag: () => void;
  /** Check if dragging */
  isDragging: boolean;
  /** Begin a transaction */
  beginTransaction: (id?: string) => TransactionId;
  /** Record in transaction */
  recordInTransaction: (txId: TransactionId, command: Command) => boolean;
  /** Commit transaction */
  commitTransaction: (txId: TransactionId, description?: string) => boolean;
  /** Rollback transaction */
  rollbackTransaction: (txId: TransactionId) => void;
  /** Execute a command */
  execute: (command: Command) => boolean;
  /** Clear all history */
  clear: () => void;
  /** The history manager instance */
  manager: HistoryManager;
}

export function useHistory(
  ctx: CommandContext,
  options: HistoryManagerOptions = {}
): UseHistoryResult {
  const managerRef = useRef<HistoryManager | null>(null);
  
  // Create manager once
  if (!managerRef.current) {
    managerRef.current = new HistoryManager(ctx, {
      ...options,
      enableKeyboardShortcuts: false, // We handle shortcuts separately for React
    });
  }
  
  const manager = managerRef.current;
  
  // State for re-renders
  const [, forceUpdate] = useState({});
  
  // Subscribe to changes
  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      forceUpdate({});
    });
    
    return () => {
      unsubscribe();
    };
  }, [manager]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.dispose();
    };
  }, [manager]);
  
  // Memoized callbacks
  const undo = useCallback(() => manager.undo(), [manager]);
  const redo = useCallback(() => manager.redo(), [manager]);
  const execute = useCallback((cmd: Command) => manager.execute(cmd), [manager]);
  const clear = useCallback(() => manager.clear(), [manager]);
  
  const startDrag = useCallback(
    (type: 'move' | 'resize', nodeIds: string[]) => manager.startDragSession(type, nodeIds),
    [manager]
  );
  const recordDrag = useCallback((cmd: Command) => manager.recordDragUpdate(cmd), [manager]);
  const finalizeDrag = useCallback(() => manager.finalizeDragSession(), [manager]);
  const cancelDrag = useCallback(() => manager.cancelDragSession(), [manager]);
  
  const beginTransaction = useCallback((id?: string) => manager.beginTransaction(id), [manager]);
  const recordInTransaction = useCallback(
    (txId: TransactionId, cmd: Command) => manager.recordInTransaction(txId, cmd),
    [manager]
  );
  const commitTransaction = useCallback(
    (txId: TransactionId, desc?: string) => manager.commitTransaction(txId, desc),
    [manager]
  );
  const rollbackTransaction = useCallback(
    (txId: TransactionId) => manager.rollbackTransaction(txId),
    [manager]
  );
  
  return useMemo(() => ({
    undo,
    redo,
    canUndo: manager.canUndo(),
    canRedo: manager.canRedo(),
    state: manager.getState(),
    memoryUsage: manager.getMemoryUsage(),
    startDrag,
    recordDrag,
    finalizeDrag,
    cancelDrag,
    isDragging: manager.isDragging(),
    beginTransaction,
    recordInTransaction,
    commitTransaction,
    rollbackTransaction,
    execute,
    clear,
    manager,
  }), [
    undo, redo, manager, startDrag, recordDrag, finalizeDrag, cancelDrag,
    beginTransaction, recordInTransaction, commitTransaction, rollbackTransaction,
    execute, clear,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton
// ─────────────────────────────────────────────────────────────────────────────

let globalHistoryManager: HistoryManager | null = null;

export function getHistoryManager(): HistoryManager | null {
  return globalHistoryManager;
}

export function createHistoryManager(
  ctx: CommandContext,
  options?: HistoryManagerOptions
): HistoryManager {
  if (globalHistoryManager) {
    globalHistoryManager.dispose();
  }
  globalHistoryManager = new HistoryManager(ctx, options);
  return globalHistoryManager;
}

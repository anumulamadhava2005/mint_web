/**
 * useCommands - React hook for command dispatching
 */

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import type { SceneNode, NodeStyles } from '../scene-graph';
import {
  Command,
  CommandContext,
} from './Command';
import {
  CommandManager,
  createCommandManager,
  type HistoryState,
} from './CommandManager';
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

export interface UseCommandsOptions {
  maxHistory?: number;
  coalesceWindow?: number;
}

export interface UseCommandsReturn {
  /** Dispatch a move command */
  dispatchMove: (nodeIds: string[], deltaX: number, deltaY: number) => boolean;
  
  /** Dispatch a resize command */
  dispatchResize: (
    nodeId: string,
    newBounds: { x: number; y: number; width: number; height: number },
    handle?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => boolean;
  
  /** Dispatch a reparent command */
  dispatchReparent: (nodeId: string, newParentId: string | null, newIndex: number) => boolean;
  
  /** Dispatch a style change command */
  dispatchStyleChange: (nodeId: string, changes: Partial<NodeStyles>) => boolean;
  
  /** Dispatch a create command */
  dispatchCreate: (node: SceneNode, parentId: string | null, index?: number) => boolean;
  
  /** Dispatch a delete command */
  dispatchDelete: (nodeId: string) => boolean;
  
  /** Dispatch a batch of commands */
  dispatchBatch: (commands: Command[], description?: string) => boolean;
  
  /** Dispatch any command */
  dispatch: (command: Command) => boolean;
  
  /** Undo last command */
  undo: () => boolean;
  
  /** Redo last undone command */
  redo: () => boolean;
  
  /** Check if can undo */
  canUndo: boolean;
  
  /** Check if can redo */
  canRedo: boolean;
  
  /** History state */
  historyState: HistoryState;
  
  /** Clear history */
  clearHistory: () => void;
  
  /** Get command context for creating custom commands */
  getContext: () => CommandContext;
  
  /** Get command manager */
  getManager: () => CommandManager;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useCommands(
  sceneGraph: Map<string, SceneNode>,
  onSceneGraphChange: (graph: Map<string, SceneNode>) => void,
  options: UseCommandsOptions = {}
): UseCommandsReturn {
  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    undoDescription: null,
    redoDescription: null,
    historyLength: 0,
    currentIndex: 0,
  });
  
  // Keep a mutable ref to the scene graph for the command context
  const sceneGraphRef = useRef(sceneGraph);
  sceneGraphRef.current = sceneGraph;
  
  // Create command context
  const commandContext = useMemo<CommandContext>(() => ({
    getSceneGraph: () => sceneGraphRef.current,
    
    updateNode: (nodeId: string, updates: Partial<SceneNode>) => {
      const current = sceneGraphRef.current;
      const node = current.get(nodeId);
      if (!node) return;
      
      const updated = { ...node, ...updates };
      const newGraph = new Map(current);
      newGraph.set(nodeId, updated);
      sceneGraphRef.current = newGraph;
    },
    
    addNode: (node: SceneNode) => {
      const newGraph = new Map(sceneGraphRef.current);
      newGraph.set(node.id, node);
      sceneGraphRef.current = newGraph;
    },
    
    removeNode: (nodeId: string) => {
      const current = sceneGraphRef.current;
      const node = current.get(nodeId);
      if (!node) return null;
      
      const newGraph = new Map(current);
      newGraph.delete(nodeId);
      sceneGraphRef.current = newGraph;
      return node;
    },
    
    getNode: (nodeId: string) => sceneGraphRef.current.get(nodeId),
    
    notifyChange: () => {
      // Trigger React state update
      onSceneGraphChange(sceneGraphRef.current);
    },
  }), [onSceneGraphChange]);
  
  // Create command manager
  const managerRef = useRef<CommandManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = createCommandManager(commandContext, {
      maxHistory: options.maxHistory,
      coalesceWindow: options.coalesceWindow,
      onHistoryChange: () => {
        if (managerRef.current) {
          setHistoryState(managerRef.current.getState());
        }
      },
    });
  }
  
  const manager = managerRef.current;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Command Dispatchers
  // ─────────────────────────────────────────────────────────────────────────
  
  const dispatch = useCallback((command: Command): boolean => {
    return manager.execute(command);
  }, [manager]);
  
  const dispatchMove = useCallback((
    nodeIds: string[],
    deltaX: number,
    deltaY: number
  ): boolean => {
    const cmd = new MoveCommand(commandContext, nodeIds, deltaX, deltaY);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchResize = useCallback((
    nodeId: string,
    newBounds: { x: number; y: number; width: number; height: number },
    handle?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ): boolean => {
    const cmd = new ResizeCommand(commandContext, nodeId, newBounds, undefined, handle);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchReparent = useCallback((
    nodeId: string,
    newParentId: string | null,
    newIndex: number
  ): boolean => {
    const cmd = new ReparentCommand(commandContext, nodeId, newParentId, newIndex);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchStyleChange = useCallback((
    nodeId: string,
    changes: Partial<NodeStyles>
  ): boolean => {
    const cmd = new StyleChangeCommand(commandContext, nodeId, changes);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchCreate = useCallback((
    node: SceneNode,
    parentId: string | null,
    index?: number
  ): boolean => {
    const cmd = new CreateCommand(commandContext, node, parentId, index);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchDelete = useCallback((nodeId: string): boolean => {
    const cmd = new DeleteCommand(commandContext, nodeId);
    return manager.execute(cmd);
  }, [manager, commandContext]);
  
  const dispatchBatch = useCallback((
    commands: Command[],
    description?: string
  ): boolean => {
    return manager.executeBatch(commands, description);
  }, [manager]);
  
  // ─────────────────────────────────────────────────────────────────────────
  // Undo/Redo
  // ─────────────────────────────────────────────────────────────────────────
  
  const undo = useCallback((): boolean => {
    return manager.undo();
  }, [manager]);
  
  const redo = useCallback((): boolean => {
    return manager.redo();
  }, [manager]);
  
  const clearHistory = useCallback(() => {
    manager.clear();
  }, [manager]);
  
  const getContext = useCallback(() => commandContext, [commandContext]);
  const getManager = useCallback(() => manager, [manager]);
  
  return {
    dispatchMove,
    dispatchResize,
    dispatchReparent,
    dispatchStyleChange,
    dispatchCreate,
    dispatchDelete,
    dispatchBatch,
    dispatch,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    historyState,
    clearHistory,
    getContext,
    getManager,
  };
}

/**
 * Commands Module - Command pattern for undo/redo
 * 
 * All scene graph mutations go through commands:
 * - execute() - apply the mutation
 * - undo() - reverse the mutation
 * - serialize() - for persistence/collaboration
 */

// Base types
export {
  type Command,
  type CommandType,
  type CommandContext,
  type SerializedCommand,
  type MovePayload,
  type ResizePayload,
  type ReparentPayload,
  type StyleChangePayload,
  type CreatePayload,
  type DeletePayload,
  type BatchPayload,
  generateCommandId,
} from './Command';

// Command implementations
export { MoveCommand } from './MoveCommand';
export { ResizeCommand } from './ResizeCommand';
export { ReparentCommand } from './ReparentCommand';
export { StyleChangeCommand } from './StyleChangeCommand';
export { CreateCommand } from './CreateCommand';
export { DeleteCommand } from './DeleteCommand';
export { BatchCommand } from './BatchCommand';

// Command manager
export {
  CommandManager,
  type CommandManagerOptions,
  type HistoryState,
  getCommandManager,
  createCommandManager,
} from './CommandManager';

// History manager (enhanced with drag batching, memory caps)
export {
  HistoryManager,
  type HistoryManagerOptions,
  type HistoryPersistenceAdapter,
  type SerializedHistory,
  type DragSession,
  type TransactionId,
  useHistory,
  type UseHistoryResult,
  getHistoryManager,
  createHistoryManager,
} from './HistoryManager';

// React hook
export {
  useCommands,
  type UseCommandsOptions,
  type UseCommandsReturn,
} from './useCommands';

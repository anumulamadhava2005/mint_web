/**
 * BatchCommand - Execute multiple commands as a single undoable unit
 */

import {
  Command,
  CommandContext,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class BatchCommand implements Command {
  readonly type = 'BATCH' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private commands: Command[];
  
  constructor(
    ctx: CommandContext,
    commands: Command[],
    description?: string
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.commands = commands;
    this.description = description ?? `Batch of ${commands.length} commands`;
  }
  
  execute(): boolean {
    // Execute all commands in order
    for (const cmd of this.commands) {
      if (!cmd.execute()) {
        // If any fails, undo all previously executed
        const executedIndex = this.commands.indexOf(cmd);
        for (let i = executedIndex - 1; i >= 0; i--) {
          this.commands[i].undo();
        }
        return false;
      }
    }
    return true;
  }
  
  undo(): boolean {
    // Undo all commands in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      if (!this.commands[i].undo()) {
        // If any fails, re-execute all that were undone
        for (let j = i + 1; j < this.commands.length; j++) {
          this.commands[j].execute();
        }
        return false;
      }
    }
    return true;
  }
  
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      payload: {
        commands: this.commands.map(cmd => cmd.serialize()),
      },
    };
  }
  
  /**
   * Get the sub-commands
   */
  getCommands(): Command[] {
    return this.commands;
  }
}

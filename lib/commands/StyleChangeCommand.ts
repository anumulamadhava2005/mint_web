/**
 * StyleChangeCommand - Change visual styles on a node
 */

import type { SceneNode, NodeStyles } from '../scene-graph';
import {
  Command,
  CommandContext,
  StyleChangePayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class StyleChangeCommand implements Command {
  readonly type = 'STYLE_CHANGE' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: StyleChangePayload;
  
  constructor(
    ctx: CommandContext,
    nodeId: string,
    changes: Partial<NodeStyles>,
    previousValues?: Partial<NodeStyles>
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    
    // Capture previous values if not provided
    let prevValues = previousValues;
    if (!prevValues) {
      const node = ctx.getNode(nodeId);
      if (node) {
        prevValues = {} as Partial<NodeStyles>;
        // Only capture values for keys that are being changed
        for (const key of Object.keys(changes) as (keyof NodeStyles)[]) {
          (prevValues as any)[key] = this.deepClone((node.styles as any)[key]);
        }
      } else {
        prevValues = {};
      }
    }
    
    // Generate description
    const changedProps = Object.keys(changes).join(', ');
    this.description = `Change styles: ${changedProps}`;
    
    this.payload = {
      nodeId,
      changes,
      previousValues: prevValues,
    };
  }
  
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item)) as unknown as T;
    const cloned = {} as T;
    for (const key in obj) {
      cloned[key] = this.deepClone(obj[key]);
    }
    return cloned;
  }
  
  execute(): boolean {
    const { nodeId, changes } = this.payload;
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Merge changes into existing styles
    const newStyles = {
      ...node.styles,
      ...changes,
    };
    
    // Deep merge for nested objects like fills, strokes
    if (changes.fills) {
      newStyles.fills = this.deepClone(changes.fills);
    }
    if (changes.strokes) {
      newStyles.strokes = this.deepClone(changes.strokes);
    }
    if (changes.effects) {
      newStyles.effects = this.deepClone(changes.effects);
    }
    if (changes.corners) {
      newStyles.corners = { ...node.styles.corners, ...changes.corners };
    }
    if (changes.text) {
      newStyles.text = { ...node.styles.text, ...changes.text };
    }
    
    this.ctx.updateNode(nodeId, { styles: newStyles });
    this.ctx.notifyChange();
    return true;
  }
  
  undo(): boolean {
    const { nodeId, previousValues } = this.payload;
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Restore previous values
    const newStyles = {
      ...node.styles,
      ...previousValues,
    };
    
    // Deep merge for nested objects
    if (previousValues.fills) {
      newStyles.fills = this.deepClone(previousValues.fills);
    }
    if (previousValues.strokes) {
      newStyles.strokes = this.deepClone(previousValues.strokes);
    }
    if (previousValues.effects) {
      newStyles.effects = this.deepClone(previousValues.effects);
    }
    if (previousValues.corners) {
      newStyles.corners = { ...node.styles.corners, ...previousValues.corners };
    }
    if (previousValues.text) {
      newStyles.text = { ...node.styles.text, ...previousValues.text };
    }
    
    this.ctx.updateNode(nodeId, { styles: newStyles });
    this.ctx.notifyChange();
    return true;
  }
  
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      payload: {
        nodeId: this.payload.nodeId,
        changes: this.payload.changes,
        previousValues: this.payload.previousValues,
      },
    };
  }
  
  static deserialize(ctx: CommandContext, data: SerializedCommand): StyleChangeCommand {
    const payload = data.payload as StyleChangePayload;
    
    const cmd = new StyleChangeCommand(
      ctx,
      payload.nodeId,
      payload.changes,
      payload.previousValues
    );
    
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    
    return cmd;
  }
}

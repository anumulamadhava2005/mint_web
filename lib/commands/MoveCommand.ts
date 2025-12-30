/**
 * MoveCommand - Move one or more nodes by a delta
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  MovePayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class MoveCommand implements Command {
  readonly type = 'MOVE' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: MovePayload;
  
  constructor(
    ctx: CommandContext,
    nodeIds: string[],
    deltaX: number,
    deltaY: number,
    previousPositions?: Map<string, { x: number; y: number }>
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.description = `Move ${nodeIds.length} node(s) by (${deltaX}, ${deltaY})`;
    
    // Capture previous positions if not provided
    const prevPositions = previousPositions ?? new Map<string, { x: number; y: number }>();
    if (!previousPositions) {
      for (const nodeId of nodeIds) {
        const node = ctx.getNode(nodeId);
        if (node) {
          prevPositions.set(nodeId, {
            x: node.worldTransform[4],
            y: node.worldTransform[5],
          });
        }
      }
    }
    
    this.payload = {
      nodeIds,
      deltaX,
      deltaY,
      previousPositions: prevPositions,
    };
  }
  
  execute(): boolean {
    const { nodeIds, deltaX, deltaY } = this.payload;
    
    for (const nodeId of nodeIds) {
      const node = this.ctx.getNode(nodeId);
      if (!node) continue;
      
      // Update local transform
      const newLocalTransform = [...node.localTransform] as SceneNode['localTransform'];
      newLocalTransform[4] += deltaX;
      newLocalTransform[5] += deltaY;
      
      // Update world transform
      const newWorldTransform = [...node.worldTransform] as SceneNode['worldTransform'];
      newWorldTransform[4] += deltaX;
      newWorldTransform[5] += deltaY;
      
      this.ctx.updateNode(nodeId, {
        localTransform: newLocalTransform,
        worldTransform: newWorldTransform,
      });
    }
    
    this.ctx.notifyChange();
    return true;
  }
  
  undo(): boolean {
    const { nodeIds, deltaX, deltaY, previousPositions } = this.payload;
    
    for (const nodeId of nodeIds) {
      const node = this.ctx.getNode(nodeId);
      if (!node) continue;
      
      const prevPos = previousPositions.get(nodeId);
      if (prevPos) {
        // Restore to exact previous position
        const newLocalTransform = [...node.localTransform] as SceneNode['localTransform'];
        const newWorldTransform = [...node.worldTransform] as SceneNode['worldTransform'];
        
        // Calculate current position delta from previous
        newLocalTransform[4] -= deltaX;
        newLocalTransform[5] -= deltaY;
        newWorldTransform[4] = prevPos.x;
        newWorldTransform[5] = prevPos.y;
        
        this.ctx.updateNode(nodeId, {
          localTransform: newLocalTransform,
          worldTransform: newWorldTransform,
        });
      }
    }
    
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
        nodeIds: this.payload.nodeIds,
        deltaX: this.payload.deltaX,
        deltaY: this.payload.deltaY,
        previousPositions: Object.fromEntries(this.payload.previousPositions),
      },
    };
  }
  
  /**
   * Create from serialized data
   */
  static deserialize(ctx: CommandContext, data: SerializedCommand): MoveCommand {
    const payload = data.payload as {
      nodeIds: string[];
      deltaX: number;
      deltaY: number;
      previousPositions: Record<string, { x: number; y: number }>;
    };
    
    const cmd = new MoveCommand(
      ctx,
      payload.nodeIds,
      payload.deltaX,
      payload.deltaY,
      new Map(Object.entries(payload.previousPositions))
    );
    
    // Restore original ID and timestamp
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    
    return cmd;
  }
}

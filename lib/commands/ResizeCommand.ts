/**
 * ResizeCommand - Resize a node
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  ResizePayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class ResizeCommand implements Command {
  readonly type = 'RESIZE' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: ResizePayload;
  
  constructor(
    ctx: CommandContext,
    nodeId: string,
    newBounds: { x: number; y: number; width: number; height: number },
    previousBounds?: { x: number; y: number; width: number; height: number },
    handle?: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    
    // Capture previous bounds if not provided
    let prevBounds = previousBounds;
    if (!prevBounds) {
      const node = ctx.getNode(nodeId);
      if (node) {
        prevBounds = {
          x: node.worldTransform[4],
          y: node.worldTransform[5],
          width: node.size.width,
          height: node.size.height,
        };
      } else {
        prevBounds = { x: 0, y: 0, width: 0, height: 0 };
      }
    }
    
    this.description = `Resize node to ${newBounds.width}x${newBounds.height}`;
    
    this.payload = {
      nodeId,
      newBounds,
      previousBounds: prevBounds,
      handle,
    };
  }
  
  execute(): boolean {
    const { nodeId, newBounds } = this.payload;
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Update transforms
    const newLocalTransform = [...node.localTransform] as SceneNode['localTransform'];
    const newWorldTransform = [...node.worldTransform] as SceneNode['worldTransform'];
    
    // Calculate delta from current position
    const deltaX = newBounds.x - node.worldTransform[4];
    const deltaY = newBounds.y - node.worldTransform[5];
    
    newLocalTransform[4] += deltaX;
    newLocalTransform[5] += deltaY;
    newWorldTransform[4] = newBounds.x;
    newWorldTransform[5] = newBounds.y;
    
    this.ctx.updateNode(nodeId, {
      localTransform: newLocalTransform,
      worldTransform: newWorldTransform,
      size: {
        width: newBounds.width,
        height: newBounds.height,
      },
    });
    
    this.ctx.notifyChange();
    return true;
  }
  
  undo(): boolean {
    const { nodeId, previousBounds } = this.payload;
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Restore to previous bounds
    const newLocalTransform = [...node.localTransform] as SceneNode['localTransform'];
    const newWorldTransform = [...node.worldTransform] as SceneNode['worldTransform'];
    
    const deltaX = previousBounds.x - node.worldTransform[4];
    const deltaY = previousBounds.y - node.worldTransform[5];
    
    newLocalTransform[4] += deltaX;
    newLocalTransform[5] += deltaY;
    newWorldTransform[4] = previousBounds.x;
    newWorldTransform[5] = previousBounds.y;
    
    this.ctx.updateNode(nodeId, {
      localTransform: newLocalTransform,
      worldTransform: newWorldTransform,
      size: {
        width: previousBounds.width,
        height: previousBounds.height,
      },
    });
    
    this.ctx.notifyChange();
    return true;
  }
  
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      payload: this.payload,
    };
  }
  
  static deserialize(ctx: CommandContext, data: SerializedCommand): ResizeCommand {
    const payload = data.payload as ResizePayload;
    
    const cmd = new ResizeCommand(
      ctx,
      payload.nodeId,
      payload.newBounds,
      payload.previousBounds,
      payload.handle
    );
    
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    
    return cmd;
  }
}

/**
 * ReparentCommand - Move a node to a new parent (changes z-order/hierarchy)
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  ReparentPayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class ReparentCommand implements Command {
  readonly type = 'REPARENT' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: ReparentPayload;
  
  constructor(
    ctx: CommandContext,
    nodeId: string,
    newParentId: string | null,
    newIndex: number,
    previousParentId?: string | null,
    previousIndex?: number
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    
    // Capture previous parent/index if not provided
    let prevParentId = previousParentId;
    let prevIndex = previousIndex;
    
    if (prevParentId === undefined || prevIndex === undefined) {
      const node = ctx.getNode(nodeId);
      if (node) {
        prevParentId = node.parentId;
        // Find index in parent's children
        if (prevParentId) {
          const parent = ctx.getNode(prevParentId);
          prevIndex = parent?.children.indexOf(nodeId) ?? 0;
        } else {
          // Root level - find index among roots
          let idx = 0;
          ctx.getSceneGraph().forEach((n, id) => {
            if (n.parentId === null) {
              if (id === nodeId) prevIndex = idx;
              idx++;
            }
          });
        }
      }
    }
    
    const newParentName = newParentId ? ctx.getNode(newParentId)?.name ?? 'unknown' : 'root';
    this.description = `Reparent node to ${newParentName} at index ${newIndex}`;
    
    this.payload = {
      nodeId,
      newParentId,
      newIndex,
      previousParentId: prevParentId ?? null,
      previousIndex: prevIndex ?? 0,
    };
  }
  
  execute(): boolean {
    const { nodeId, newParentId, newIndex, previousParentId } = this.payload;
    
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Remove from previous parent's children
    if (previousParentId) {
      const prevParent = this.ctx.getNode(previousParentId);
      if (prevParent) {
        const newChildren = prevParent.children.filter(id => id !== nodeId);
        this.ctx.updateNode(previousParentId, { children: newChildren });
      }
    }
    
    // Add to new parent's children
    if (newParentId) {
      const newParent = this.ctx.getNode(newParentId);
      if (newParent) {
        const newChildren = [...newParent.children];
        newChildren.splice(newIndex, 0, nodeId);
        this.ctx.updateNode(newParentId, { children: newChildren });
      }
    }
    
    // Update node's parentId
    this.ctx.updateNode(nodeId, { parentId: newParentId });
    
    // Recalculate world transform based on new parent
    this.recalculateWorldTransform(nodeId);
    
    this.ctx.notifyChange();
    return true;
  }
  
  undo(): boolean {
    const { nodeId, newParentId, previousParentId, previousIndex } = this.payload;
    
    const node = this.ctx.getNode(nodeId);
    if (!node) return false;
    
    // Remove from new parent's children
    if (newParentId) {
      const newParent = this.ctx.getNode(newParentId);
      if (newParent) {
        const newChildren = newParent.children.filter(id => id !== nodeId);
        this.ctx.updateNode(newParentId, { children: newChildren });
      }
    }
    
    // Add back to previous parent's children
    if (previousParentId) {
      const prevParent = this.ctx.getNode(previousParentId);
      if (prevParent) {
        const newChildren = [...prevParent.children];
        newChildren.splice(previousIndex, 0, nodeId);
        this.ctx.updateNode(previousParentId, { children: newChildren });
      }
    }
    
    // Update node's parentId
    this.ctx.updateNode(nodeId, { parentId: previousParentId });
    
    // Recalculate world transform
    this.recalculateWorldTransform(nodeId);
    
    this.ctx.notifyChange();
    return true;
  }
  
  private recalculateWorldTransform(nodeId: string): void {
    const node = this.ctx.getNode(nodeId);
    if (!node) return;
    
    let worldTransform = [...node.localTransform] as SceneNode['worldTransform'];
    
    if (node.parentId) {
      const parent = this.ctx.getNode(node.parentId);
      if (parent) {
        // Combine with parent's world transform
        const p = parent.worldTransform;
        const l = node.localTransform;
        worldTransform = [
          p[0] * l[0] + p[2] * l[1],
          p[1] * l[0] + p[3] * l[1],
          p[0] * l[2] + p[2] * l[3],
          p[1] * l[2] + p[3] * l[3],
          p[0] * l[4] + p[2] * l[5] + p[4],
          p[1] * l[4] + p[3] * l[5] + p[5],
        ];
      }
    }
    
    this.ctx.updateNode(nodeId, { worldTransform });
    
    // Recursively update children
    for (const childId of node.children) {
      this.recalculateWorldTransform(childId);
    }
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
  
  static deserialize(ctx: CommandContext, data: SerializedCommand): ReparentCommand {
    const payload = data.payload as ReparentPayload;
    
    const cmd = new ReparentCommand(
      ctx,
      payload.nodeId,
      payload.newParentId,
      payload.newIndex,
      payload.previousParentId,
      payload.previousIndex
    );
    
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    
    return cmd;
  }
}

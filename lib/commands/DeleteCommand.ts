/**
 * DeleteCommand - Delete a node (and its descendants)
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  DeletePayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class DeleteCommand implements Command {
  readonly type = 'DELETE' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: DeletePayload;
  
  constructor(
    ctx: CommandContext,
    nodeId: string
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    
    const node = ctx.getNode(nodeId);
    if (!node) {
      this.description = `Delete unknown node`;
      this.payload = {
        node: null as any,
        descendants: [],
        parentId: null,
        index: 0,
      };
      return;
    }
    
    this.description = `Delete ${node.type} "${node.name}"`;
    
    // Capture the node and all descendants for undo
    const descendants = this.collectDescendants(nodeId);
    
    // Find index in parent's children
    let index = 0;
    if (node.parentId) {
      const parent = ctx.getNode(node.parentId);
      index = parent?.children.indexOf(nodeId) ?? 0;
    } else {
      // Find index among roots
      let idx = 0;
      ctx.getSceneGraph().forEach((n, id) => {
        if (n.parentId === null) {
          if (id === nodeId) index = idx;
          idx++;
        }
      });
    }
    
    this.payload = {
      node: this.deepClone(node),
      descendants: descendants.map(d => this.deepClone(d)),
      parentId: node.parentId,
      index,
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
  
  private collectDescendants(nodeId: string): SceneNode[] {
    const result: SceneNode[] = [];
    const node = this.ctx.getNode(nodeId);
    if (!node) return result;
    
    for (const childId of node.children) {
      const child = this.ctx.getNode(childId);
      if (child) {
        result.push(child);
        result.push(...this.collectDescendants(childId));
      }
    }
    
    return result;
  }
  
  execute(): boolean {
    const { node, parentId } = this.payload;
    if (!node) return false;
    
    // Remove from parent's children[]
    if (parentId) {
      const parent = this.ctx.getNode(parentId);
      if (parent) {
        const newChildren = parent.children.filter(id => id !== node.id);
        this.ctx.updateNode(parentId, { children: newChildren });
      }
    }
    
    // Remove the node and all descendants
    this.removeWithDescendants(node.id);
    
    this.ctx.notifyChange();
    return true;
  }
  
  private removeWithDescendants(nodeId: string): void {
    const node = this.ctx.getNode(nodeId);
    if (!node) return;
    
    // First remove all descendants
    for (const childId of node.children) {
      this.removeWithDescendants(childId);
    }
    
    // Then remove this node
    this.ctx.removeNode(nodeId);
  }
  
  undo(): boolean {
    const { node, descendants, parentId, index } = this.payload;
    if (!node) return false;
    
    // Re-add the node
    this.ctx.addNode(this.deepClone(node));
    
    // Re-add all descendants
    for (const descendant of descendants) {
      this.ctx.addNode(this.deepClone(descendant));
    }
    
    // Add back to parent's children[] at original index
    if (parentId) {
      const parent = this.ctx.getNode(parentId);
      if (parent) {
        const newChildren = [...parent.children];
        newChildren.splice(index, 0, node.id);
        this.ctx.updateNode(parentId, { children: newChildren });
      }
    }
    
    this.ctx.notifyChange();
    return true;
  }
  
  /**
   * Get the deleted node ID
   */
  getDeletedNodeId(): string {
    return this.payload.node?.id ?? '';
  }
  
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      payload: {
        node: this.payload.node,
        descendants: this.payload.descendants,
        parentId: this.payload.parentId,
        index: this.payload.index,
      },
    };
  }
  
  static deserialize(ctx: CommandContext, data: SerializedCommand): DeleteCommand {
    const payload = data.payload as DeletePayload;
    
    // Create a shell command and restore payload
    const cmd = new DeleteCommand(ctx, '');
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    (cmd as any).description = data.description;
    (cmd as any).payload = payload;
    
    return cmd;
  }
}

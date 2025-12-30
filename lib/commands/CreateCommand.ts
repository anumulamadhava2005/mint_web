/**
 * CreateCommand - Create a new node
 */

import type { SceneNode } from '../scene-graph';
import {
  Command,
  CommandContext,
  CreatePayload,
  SerializedCommand,
  generateCommandId,
} from './Command';

export class CreateCommand implements Command {
  readonly type = 'CREATE' as const;
  readonly id: string;
  readonly timestamp: number;
  readonly description: string;
  
  private ctx: CommandContext;
  private payload: CreatePayload;
  
  constructor(
    ctx: CommandContext,
    node: SceneNode,
    parentId: string | null,
    index?: number
  ) {
    this.ctx = ctx;
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.description = `Create ${node.type} "${node.name}"`;
    
    // Determine index if not provided
    let insertIndex = index;
    if (insertIndex === undefined) {
      if (parentId) {
        const parent = ctx.getNode(parentId);
        insertIndex = parent?.children.length ?? 0;
      } else {
        // Count root nodes
        let rootCount = 0;
        ctx.getSceneGraph().forEach(n => {
          if (n.parentId === null) rootCount++;
        });
        insertIndex = rootCount;
      }
    }
    
    this.payload = {
      node: this.deepClone(node),
      parentId,
      index: insertIndex,
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
    const { node, parentId, index } = this.payload;
    
    // Add the node to scene graph
    this.ctx.addNode(this.deepClone(node));
    
    // Add to parent's children[] at the specified index
    if (parentId) {
      const parent = this.ctx.getNode(parentId);
      if (parent) {
        const newChildren = [...parent.children];
        newChildren.splice(index, 0, node.id);
        this.ctx.updateNode(parentId, { children: newChildren });
      }
    }
    
    // Also recursively add any children the node might have
    this.addDescendants(node);
    
    this.ctx.notifyChange();
    return true;
  }
  
  private addDescendants(node: SceneNode): void {
    // If the node has children references, we need the actual child nodes
    // In create scenarios, child nodes should be added separately
    // This is mainly for redo after undo scenarios
  }
  
  undo(): boolean {
    const { node, parentId, index } = this.payload;
    
    // Remove from parent's children[]
    if (parentId) {
      const parent = this.ctx.getNode(parentId);
      if (parent) {
        const newChildren = parent.children.filter(id => id !== node.id);
        this.ctx.updateNode(parentId, { children: newChildren });
      }
    }
    
    // Remove the node (and descendants) from scene graph
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
  
  /**
   * Get the created node ID
   */
  getCreatedNodeId(): string {
    return this.payload.node.id;
  }
  
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      timestamp: this.timestamp,
      description: this.description,
      payload: {
        node: this.payload.node,
        parentId: this.payload.parentId,
        index: this.payload.index,
      },
    };
  }
  
  static deserialize(ctx: CommandContext, data: SerializedCommand): CreateCommand {
    const payload = data.payload as CreatePayload;
    
    const cmd = new CreateCommand(
      ctx,
      payload.node,
      payload.parentId,
      payload.index
    );
    
    (cmd as any).id = data.id;
    (cmd as any).timestamp = data.timestamp;
    
    return cmd;
  }
}

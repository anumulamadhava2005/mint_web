/**
 * ComponentSystem - Complete component/instance system with Figma-like behavior
 * 
 * Features:
 * - Component definitions (main components)
 * - Instances (linked copies)
 * - Override system (text, fills, visibility, etc.)
 * - Variant support
 * - Nested instances
 * - Component library
 * - Reset instance to main
 * - Detach instance
 */

import type { FigmaNode, ComponentData, Fill, Stroke } from '../scene-graph/FigmaNode';
import { generateNodeId } from '../scene-graph/FigmaNode';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComponentDefinition {
  /** Unique component ID */
  id: string;
  /** Component name */
  name: string;
  /** Component description */
  description?: string;
  /** Root node of the component */
  node: FigmaNode;
  /** Variant properties (if part of variant set) */
  variantProperties?: Record<string, string>;
  /** Parent variant set ID */
  variantSetId?: string;
  /** Defined component properties */
  properties: ComponentProperty[];
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
}

export interface ComponentProperty {
  /** Property name */
  name: string;
  /** Property type */
  type: 'TEXT' | 'BOOLEAN' | 'INSTANCE_SWAP' | 'VARIANT';
  /** Default value */
  defaultValue: string | boolean;
  /** For instance swap: allowed component IDs */
  allowedComponentIds?: string[];
  /** For variant: allowed values */
  variantOptions?: string[];
}

export interface InstanceOverride {
  /** Node ID within instance */
  nodeId: string;
  /** Property being overridden */
  property: string;
  /** Override value */
  value: any;
}

export interface Instance {
  /** Instance node */
  node: FigmaNode;
  /** Reference to main component */
  componentId: string;
  /** Applied overrides */
  overrides: InstanceOverride[];
  /** Property values */
  propertyValues: Record<string, any>;
  /** Whether instance is detached */
  isDetached: boolean;
}

export interface VariantSet {
  /** Variant set ID */
  id: string;
  /** Variant set name */
  name: string;
  /** Component IDs in this set */
  componentIds: string[];
  /** Variant axes (property name -> possible values) */
  axes: Record<string, string[]>;
}

export type ComponentChangeListener = (componentId: string) => void;

// ═══════════════════════════════════════════════════════════════════════════════
// OVERRIDABLE PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════

export const OVERRIDABLE_PROPERTIES = [
  'textContent',
  'fills',
  'strokes',
  'opacity',
  'visible',
  'effects',
  'cornerRadius',
  'x',
  'y',
  'width',
  'height',
  'rotation',
] as const;

export type OverridableProperty = typeof OVERRIDABLE_PROPERTIES[number];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export class ComponentSystem {
  private components: Map<string, ComponentDefinition> = new Map();
  private instances: Map<string, Instance> = new Map();
  private variantSets: Map<string, VariantSet> = new Map();
  private listeners: Set<ComponentChangeListener> = new Set();
  
  // ─── Component Management ───
  
  /**
   * Create a component from a node
   */
  createComponent(node: FigmaNode, name: string): ComponentDefinition {
    const componentId = generateNodeId();
    
    // Clone the node for the component
    const componentNode = this.deepCloneNode(node);
    componentNode.type = 'COMPONENT';
    componentNode.id = componentId;
    
    const definition: ComponentDefinition = {
      id: componentId,
      name,
      node: componentNode,
      properties: [],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    
    this.components.set(componentId, definition);
    this.notifyListeners(componentId);
    
    return definition;
  }
  
  /**
   * Get a component by ID
   */
  getComponent(componentId: string): ComponentDefinition | undefined {
    return this.components.get(componentId);
  }
  
  /**
   * Update a component
   */
  updateComponent(componentId: string, updates: Partial<ComponentDefinition>): void {
    const component = this.components.get(componentId);
    if (!component) return;
    
    Object.assign(component, updates);
    component.modifiedAt = Date.now();
    
    // Update all instances
    this.updateAllInstances(componentId);
    
    this.notifyListeners(componentId);
  }
  
  /**
   * Delete a component
   */
  deleteComponent(componentId: string): void {
    // Detach all instances first
    this.instances.forEach((instance, instanceId) => {
      if (instance.componentId === componentId) {
        this.detachInstance(instanceId);
      }
    });
    
    this.components.delete(componentId);
    this.notifyListeners(componentId);
  }
  
  /**
   * Get all components
   */
  getAllComponents(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }
  
  // ─── Instance Management ───
  
  /**
   * Create an instance of a component
   */
  createInstance(componentId: string, x: number = 0, y: number = 0): Instance | null {
    const component = this.components.get(componentId);
    if (!component) return null;
    
    // Clone the component node
    const instanceNode = this.deepCloneNode(component.node);
    instanceNode.type = 'INSTANCE';
    instanceNode.id = generateNodeId();
    instanceNode.x = x;
    instanceNode.y = y;
    
    // Set component reference
    instanceNode.componentData = {
      isComponentRoot: false,
      componentId,
    };
    
    // Initialize property values from defaults
    const propertyValues: Record<string, any> = {};
    for (const prop of component.properties) {
      propertyValues[prop.name] = prop.defaultValue;
    }
    
    const instance: Instance = {
      node: instanceNode,
      componentId,
      overrides: [],
      propertyValues,
      isDetached: false,
    };
    
    this.instances.set(instanceNode.id, instance);
    
    return instance;
  }
  
  /**
   * Get an instance by node ID
   */
  getInstance(nodeId: string): Instance | undefined {
    return this.instances.get(nodeId);
  }
  
  /**
   * Set an override on an instance
   */
  setOverride(instanceId: string, nodeId: string, property: string, value: any): void {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.isDetached) return;
    
    // Check if property is overridable
    if (!OVERRIDABLE_PROPERTIES.includes(property as OverridableProperty)) {
      console.warn(`Property ${property} is not overridable`);
      return;
    }
    
    // Find existing override
    const existingIdx = instance.overrides.findIndex(
      o => o.nodeId === nodeId && o.property === property
    );
    
    if (existingIdx >= 0) {
      instance.overrides[existingIdx].value = value;
    } else {
      instance.overrides.push({ nodeId, property, value });
    }
    
    // Apply override to node
    this.applyOverride(instance.node, nodeId, property, value);
  }
  
  /**
   * Remove an override from an instance
   */
  removeOverride(instanceId: string, nodeId: string, property: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    const idx = instance.overrides.findIndex(
      o => o.nodeId === nodeId && o.property === property
    );
    
    if (idx >= 0) {
      instance.overrides.splice(idx, 1);
      // Restore original value from component
      this.restoreOriginalValue(instanceId, nodeId, property);
    }
  }
  
  /**
   * Reset instance to match main component
   */
  resetInstance(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.isDetached) return;
    
    const component = this.components.get(instance.componentId);
    if (!component) return;
    
    // Clear all overrides
    instance.overrides = [];
    
    // Re-clone from component
    const newNode = this.deepCloneNode(component.node);
    newNode.type = 'INSTANCE';
    newNode.id = instance.node.id;
    newNode.x = instance.node.x;
    newNode.y = instance.node.y;
    newNode.componentData = {
      isComponentRoot: false,
      componentId: instance.componentId,
    };
    
    instance.node = newNode;
  }
  
  /**
   * Detach instance (break link to component)
   */
  detachInstance(instanceId: string): FigmaNode | null {
    const instance = this.instances.get(instanceId);
    if (!instance) return null;
    
    // Convert to regular frame
    instance.node.type = 'FRAME';
    instance.node.componentData = undefined;
    instance.isDetached = true;
    
    // Remove from instances
    this.instances.delete(instanceId);
    
    return instance.node;
  }
  
  /**
   * Update all instances when component changes
   */
  private updateAllInstances(componentId: string): void {
    const component = this.components.get(componentId);
    if (!component) return;
    
    this.instances.forEach((instance, instanceId) => {
      if (instance.componentId === componentId && !instance.isDetached) {
        // Preserve position and overrides
        const x = instance.node.x;
        const y = instance.node.y;
        const overrides = [...instance.overrides];
        
        // Re-clone from component
        const newNode = this.deepCloneNode(component.node);
        newNode.type = 'INSTANCE';
        newNode.id = instanceId;
        newNode.x = x;
        newNode.y = y;
        newNode.componentData = {
          isComponentRoot: false,
          componentId,
        };
        
        instance.node = newNode;
        
        // Re-apply overrides
        for (const override of overrides) {
          this.applyOverride(instance.node, override.nodeId, override.property, override.value);
        }
      }
    });
  }
  
  // ─── Variants ───
  
  /**
   * Create a variant set from components
   */
  createVariantSet(name: string, componentIds: string[]): VariantSet {
    const setId = generateNodeId();
    const axes: Record<string, Set<string>> = {};
    
    // Collect all variant axes from components
    for (const compId of componentIds) {
      const comp = this.components.get(compId);
      if (comp?.variantProperties) {
        for (const [key, value] of Object.entries(comp.variantProperties)) {
          if (!axes[key]) axes[key] = new Set();
          axes[key].add(value);
        }
      }
      
      // Update component to reference this set
      if (comp) {
        comp.variantSetId = setId;
      }
    }
    
    const variantSet: VariantSet = {
      id: setId,
      name,
      componentIds,
      axes: Object.fromEntries(
        Object.entries(axes).map(([k, v]) => [k, Array.from(v)])
      ),
    };
    
    this.variantSets.set(setId, variantSet);
    
    return variantSet;
  }
  
  /**
   * Get variant by properties
   */
  getVariant(setId: string, properties: Record<string, string>): ComponentDefinition | null {
    const set = this.variantSets.get(setId);
    if (!set) return null;
    
    for (const compId of set.componentIds) {
      const comp = this.components.get(compId);
      if (!comp?.variantProperties) continue;
      
      // Check if all properties match
      let match = true;
      for (const [key, value] of Object.entries(properties)) {
        if (comp.variantProperties[key] !== value) {
          match = false;
          break;
        }
      }
      
      if (match) return comp;
    }
    
    return null;
  }
  
  /**
   * Switch instance to different variant
   */
  switchVariant(instanceId: string, properties: Record<string, string>): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    const component = this.components.get(instance.componentId);
    if (!component?.variantSetId) return;
    
    const newVariant = this.getVariant(component.variantSetId, properties);
    if (!newVariant) return;
    
    // Update component reference
    instance.componentId = newVariant.id;
    
    // Re-sync from new variant
    const x = instance.node.x;
    const y = instance.node.y;
    const overrides = [...instance.overrides];
    
    const newNode = this.deepCloneNode(newVariant.node);
    newNode.type = 'INSTANCE';
    newNode.id = instanceId;
    newNode.x = x;
    newNode.y = y;
    newNode.componentData = {
      isComponentRoot: false,
      componentId: newVariant.id,
    };
    
    instance.node = newNode;
    
    // Re-apply valid overrides
    for (const override of overrides) {
      this.applyOverride(instance.node, override.nodeId, override.property, override.value);
    }
  }
  
  // ─── Component Properties ───
  
  /**
   * Add a component property
   */
  addComponentProperty(componentId: string, property: ComponentProperty): void {
    const component = this.components.get(componentId);
    if (!component) return;
    
    component.properties.push(property);
    component.modifiedAt = Date.now();
    
    this.notifyListeners(componentId);
  }
  
  /**
   * Set property value on instance
   */
  setPropertyValue(instanceId: string, propertyName: string, value: any): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    const component = this.components.get(instance.componentId);
    if (!component) return;
    
    const property = component.properties.find(p => p.name === propertyName);
    if (!property) return;
    
    instance.propertyValues[propertyName] = value;
    
    // Apply property change to instance node
    this.applyPropertyValue(instance, propertyName, value, property.type);
  }
  
  /**
   * Apply a property value to instance
   */
  private applyPropertyValue(
    instance: Instance,
    propertyName: string,
    value: any,
    propertyType: ComponentProperty['type']
  ): void {
    switch (propertyType) {
      case 'TEXT':
        // Find text node with this property binding
        this.findAndUpdateTextProperty(instance.node, propertyName, value);
        break;
        
      case 'BOOLEAN':
        // Find node with this boolean property binding
        this.findAndUpdateBooleanProperty(instance.node, propertyName, value);
        break;
        
      case 'INSTANCE_SWAP':
        // Swap nested instance
        this.findAndSwapInstance(instance.node, propertyName, value);
        break;
        
      case 'VARIANT':
        // This is handled by switchVariant
        break;
    }
  }
  
  private findAndUpdateTextProperty(node: FigmaNode, propertyName: string, value: string, nodeMap?: Map<string, FigmaNode>): void {
    // Check if this node has the property binding
    if (node.type === 'TEXT' && (node as any).textPropertyBinding === propertyName) {
      (node as any).textContent = value;
    }
    
    // Recurse to children (requires nodeMap to resolve child IDs)
    if (node.children && nodeMap) {
      for (const childId of node.children) {
        const child = nodeMap.get(childId);
        if (child) {
          this.findAndUpdateTextProperty(child, propertyName, value, nodeMap);
        }
      }
    }
  }
  
  private findAndUpdateBooleanProperty(node: FigmaNode, propertyName: string, value: boolean, nodeMap?: Map<string, FigmaNode>): void {
    if ((node as any).booleanPropertyBinding === propertyName) {
      node.visible = value;
    }
    
    if (node.children && nodeMap) {
      for (const childId of node.children) {
        const child = nodeMap.get(childId);
        if (child) {
          this.findAndUpdateBooleanProperty(child, propertyName, value, nodeMap);
        }
      }
    }
  }
  
  private findAndSwapInstance(node: FigmaNode, propertyName: string, componentId: string, nodeMap?: Map<string, FigmaNode>): void {
    if (node.type === 'INSTANCE' && (node as any).instanceSwapPropertyBinding === propertyName) {
      // Replace with new component instance
      const newComponent = this.components.get(componentId);
      if (newComponent) {
        const swapped = this.deepCloneNode(newComponent.node);
        swapped.x = node.x;
        swapped.y = node.y;
        swapped.id = node.id;
        // Replace node properties
        Object.assign(node, swapped);
      }
    }
    
    if (node.children && nodeMap) {
      for (const childId of node.children) {
        const child = nodeMap.get(childId);
        if (child) {
          this.findAndSwapInstance(child, propertyName, componentId, nodeMap);
        }
      }
    }
  }
  
  // ─── Helpers ───
  
  /**
   * Deep clone a node and all children
   */
  private deepCloneNode(node: FigmaNode, nodeMap?: Map<string, FigmaNode>): FigmaNode {
    const cloned = { ...node };
    
    // Clone arrays
    cloned.fills = [...node.fills];
    cloned.strokes = [...node.strokes];
    cloned.effects = [...node.effects];
    cloned.cornerRadius = { ...node.cornerRadius };
    cloned.bounds = {
      localBounds: { ...node.bounds.localBounds },
      worldBounds: { ...node.bounds.worldBounds },
      renderBounds: { ...node.bounds.renderBounds },
    };
    
    // Clone children (note: children is string[] of IDs)
    // If we have a nodeMap, we can recursively clone child nodes
    if (node.children && nodeMap) {
      const newChildIds: string[] = [];
      for (const childId of node.children) {
        const childNode = nodeMap.get(childId);
        if (childNode) {
          const clonedChild = this.deepCloneNode(childNode, nodeMap);
          nodeMap.set(clonedChild.id, clonedChild);
          newChildIds.push(clonedChild.id);
        }
      }
      cloned.children = newChildIds;
    } else {
      // Without nodeMap, just copy the child IDs (shallow clone behavior)
      cloned.children = [...node.children];
    }
    
    // Generate new ID
    cloned.id = generateNodeId();
    
    return cloned;
  }
  
  /**
   * Apply override to a node within an instance
   */
  private applyOverride(instanceNode: FigmaNode, nodeId: string, property: string, value: any): void {
    const targetNode = this.findNodeById(instanceNode, nodeId);
    if (!targetNode) return;
    
    (targetNode as any)[property] = value;
  }
  
  /**
   * Restore original value from component
   */
  private restoreOriginalValue(instanceId: string, nodeId: string, property: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    const component = this.components.get(instance.componentId);
    if (!component) return;
    
    const originalNode = this.findNodeById(component.node, nodeId);
    const targetNode = this.findNodeById(instance.node, nodeId);
    
    if (originalNode && targetNode) {
      (targetNode as any)[property] = (originalNode as any)[property];
    }
  }
  
  /**
   * Find a node by ID within a tree (requires nodeMap to resolve children)
   */
  private findNodeById(root: FigmaNode, nodeId: string, nodeMap?: Map<string, FigmaNode>): FigmaNode | null {
    if (root.id === nodeId) return root;
    
    if (root.children && nodeMap) {
      for (const childId of root.children) {
        const child = nodeMap.get(childId);
        if (child) {
          const found = this.findNodeById(child, nodeId, nodeMap);
          if (found) return found;
        }
      }
    }
    
    return null;
  }
  
  // ─── Listeners ───
  
  subscribe(listener: ComponentChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(componentId: string): void {
    for (const listener of this.listeners) {
      listener(componentId);
    }
  }
  
  // ─── Serialization ───
  
  /**
   * Export all components for saving
   */
  exportComponents(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }
  
  /**
   * Import components from saved data
   */
  importComponents(definitions: ComponentDefinition[]): void {
    for (const def of definitions) {
      this.components.set(def.id, def);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const componentSystem = new ComponentSystem();

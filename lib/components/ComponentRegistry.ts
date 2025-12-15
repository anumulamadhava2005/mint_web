/**
 * ComponentRegistry.ts
 * 
 * Registry for managing reusable components with variants.
 * Supports component definition, variant switching, and instance management.
 */

export type PropertyType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'color' 
  | 'enum';

export interface PropertyDefinition {
  name: string;
  type: PropertyType;
  defaultValue: any;
  enumValues?: string[]; // For enum type
  description?: string;
}

export interface VariantProperty {
  name: string;
  value: any;
}

export interface ComponentVariant {
  id: string;
  name: string;
  description?: string;
  properties: Record<string, any>; // Property overrides for this variant
  conditions?: Record<string, any>; // Conditions that activate this variant
}

export interface ComponentNode {
  id: string;
  type: string; // 'frame', 'text', 'rectangle', etc.
  name: string;
  properties: Record<string, any>;
  children?: ComponentNode[];
}

export interface ComponentDefinition {
  id: string;
  name: string;
  description?: string;
  baseNode: ComponentNode; // The master component structure
  properties: PropertyDefinition[]; // Exposed properties
  variants: ComponentVariant[]; // Available variants
  defaultVariantId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ComponentInstance {
  id: string;
  componentId: string; // Reference to component definition
  variantId?: string; // Current variant
  overrides: Record<string, any>; // Property overrides
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface ComponentOverride {
  nodeId: string; // ID of node within component
  propertyName: string;
  value: any;
}

/**
 * Registry for managing component definitions and instances
 */
export class ComponentRegistry {
  private components: Map<string, ComponentDefinition> = new Map();
  private instances: Map<string, ComponentInstance> = new Map();
  
  /**
   * Register a new component definition
   */
  registerComponent(definition: ComponentDefinition): void {
    this.components.set(definition.id, definition);
  }
  
  /**
   * Get a component definition by ID
   */
  getComponent(id: string): ComponentDefinition | undefined {
    return this.components.get(id);
  }
  
  /**
   * Get all registered components
   */
  getAllComponents(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }
  
  /**
   * Update a component definition
   */
  updateComponent(id: string, updates: Partial<ComponentDefinition>): void {
    const component = this.components.get(id);
    if (!component) {
      throw new Error(`Component ${id} not found`);
    }
    
    this.components.set(id, {
      ...component,
      ...updates,
      updatedAt: Date.now(),
    });
  }
  
  /**
   * Delete a component definition
   */
  deleteComponent(id: string): void {
    this.components.delete(id);
    
    // Remove all instances of this component
    const instancesToRemove: string[] = [];
    this.instances.forEach((instance, instanceId) => {
      if (instance.componentId === id) {
        instancesToRemove.push(instanceId);
      }
    });
    instancesToRemove.forEach(instanceId => this.instances.delete(instanceId));
  }
  
  /**
   * Create a new component instance
   */
  createInstance(
    componentId: string,
    options?: {
      variantId?: string;
      overrides?: Record<string, any>;
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    }
  ): ComponentInstance {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }
    
    const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const instance: ComponentInstance = {
      id: instanceId,
      componentId,
      variantId: options?.variantId || component.defaultVariantId,
      overrides: options?.overrides || {},
      position: options?.position || { x: 0, y: 0 },
      size: options?.size || { width: 100, height: 100 },
    };
    
    this.instances.set(instanceId, instance);
    return instance;
  }
  
  /**
   * Get a component instance by ID
   */
  getInstance(id: string): ComponentInstance | undefined {
    return this.instances.get(id);
  }
  
  /**
   * Update a component instance
   */
  updateInstance(id: string, updates: Partial<ComponentInstance>): void {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`Instance ${id} not found`);
    }
    
    this.instances.set(id, { ...instance, ...updates });
  }
  
  /**
   * Delete a component instance
   */
  deleteInstance(id: string): void {
    this.instances.delete(id);
  }
  
  /**
   * Get all instances of a specific component
   */
  getInstancesOfComponent(componentId: string): ComponentInstance[] {
    const instances: ComponentInstance[] = [];
    this.instances.forEach(instance => {
      if (instance.componentId === componentId) {
        instances.push(instance);
      }
    });
    return instances;
  }
  
  /**
   * Apply a variant to an instance
   */
  applyVariant(instanceId: string, variantId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    const component = this.components.get(instance.componentId);
    if (!component) {
      throw new Error(`Component ${instance.componentId} not found`);
    }
    
    const variant = component.variants.find(v => v.id === variantId);
    if (!variant) {
      throw new Error(`Variant ${variantId} not found in component ${component.id}`);
    }
    
    this.instances.set(instanceId, { ...instance, variantId });
  }
  
  /**
   * Apply an override to a specific node within an instance
   */
  applyOverride(
    instanceId: string,
    nodeId: string,
    propertyName: string,
    value: any
  ): void {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    const overrideKey = `${nodeId}.${propertyName}`;
    const newOverrides = { ...instance.overrides, [overrideKey]: value };
    
    this.instances.set(instanceId, { ...instance, overrides: newOverrides });
  }
  
  /**
   * Resolve the final properties for an instance
   * Combines base component + variant + overrides
   */
  resolveInstance(instanceId: string): ComponentNode {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    const component = this.components.get(instance.componentId);
    if (!component) {
      throw new Error(`Component ${instance.componentId} not found`);
    }
    
    // Start with base component node
    let resolvedNode = this.cloneNode(component.baseNode);
    
    // Apply variant properties
    if (instance.variantId) {
      const variant = component.variants.find(v => v.id === instance.variantId);
      if (variant) {
        resolvedNode = this.applyVariantToNode(resolvedNode, variant);
      }
    }
    
    // Apply instance overrides
    resolvedNode = this.applyOverridesToNode(resolvedNode, instance.overrides);
    
    return resolvedNode;
  }
  
  /**
   * Clone a component node (deep copy)
   */
  private cloneNode(node: ComponentNode): ComponentNode {
    return {
      ...node,
      properties: { ...node.properties },
      children: node.children?.map(child => this.cloneNode(child)),
    };
  }
  
  /**
   * Apply variant properties to a node tree
   */
  private applyVariantToNode(
    node: ComponentNode,
    variant: ComponentVariant
  ): ComponentNode {
    const updatedNode = { ...node };
    
    // Apply variant properties to this node
    Object.entries(variant.properties).forEach(([key, value]) => {
      if (key.startsWith(node.id + '.')) {
        const propertyName = key.substring(node.id.length + 1);
        updatedNode.properties = {
          ...updatedNode.properties,
          [propertyName]: value,
        };
      }
    });
    
    // Recursively apply to children
    if (updatedNode.children) {
      updatedNode.children = updatedNode.children.map(child =>
        this.applyVariantToNode(child, variant)
      );
    }
    
    return updatedNode;
  }
  
  /**
   * Apply instance overrides to a node tree
   */
  private applyOverridesToNode(
    node: ComponentNode,
    overrides: Record<string, any>
  ): ComponentNode {
    const updatedNode = { ...node };
    
    // Apply overrides to this node
    Object.entries(overrides).forEach(([key, value]) => {
      if (key.startsWith(node.id + '.')) {
        const propertyName = key.substring(node.id.length + 1);
        updatedNode.properties = {
          ...updatedNode.properties,
          [propertyName]: value,
        };
      }
    });
    
    // Recursively apply to children
    if (updatedNode.children) {
      updatedNode.children = updatedNode.children.map(child =>
        this.applyOverridesToNode(child, overrides)
      );
    }
    
    return updatedNode;
  }
  
  /**
   * Find variant by property values
   */
  findVariantByProperties(
    componentId: string,
    properties: Record<string, any>
  ): ComponentVariant | undefined {
    const component = this.components.get(componentId);
    if (!component) return undefined;
    
    // Find variant that matches all specified properties
    return component.variants.find(variant => {
      if (!variant.conditions) return false;
      
      return Object.entries(properties).every(
        ([key, value]) => variant.conditions![key] === value
      );
    });
  }
  
  /**
   * Clone an instance (creates a new instance with same settings)
   */
  cloneInstance(instanceId: string): ComponentInstance {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    
    return this.createInstance(instance.componentId, {
      variantId: instance.variantId,
      overrides: { ...instance.overrides },
      position: { ...instance.position },
      size: { ...instance.size },
    });
  }
}

// Global registry instance
export const componentRegistry = new ComponentRegistry();

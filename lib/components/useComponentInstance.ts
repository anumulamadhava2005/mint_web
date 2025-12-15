/**
 * useComponentInstance.ts
 * 
 * React hook for managing component instances.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComponentRegistry,
  ComponentInstance,
  ComponentNode,
  ComponentDefinition,
  componentRegistry,
} from './ComponentRegistry';

export interface UseComponentInstanceOptions {
  componentId: string;
  variantId?: string;
  overrides?: Record<string, any>;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface UseComponentInstanceResult {
  instance: ComponentInstance | null;
  resolvedNode: ComponentNode | null;
  definition: ComponentDefinition | null;
  setVariant: (variantId: string) => void;
  applyOverride: (nodeId: string, propertyName: string, value: any) => void;
  removeOverride: (nodeId: string, propertyName: string) => void;
  updatePosition: (position: { x: number; y: number }) => void;
  updateSize: (size: { width: number; height: number }) => void;
  clone: () => ComponentInstance | null;
}

/**
 * Hook for managing a component instance
 */
export function useComponentInstance(
  options: UseComponentInstanceOptions
): UseComponentInstanceResult {
  const [instance, setInstance] = useState<ComponentInstance | null>(null);
  const [registry] = useState(() => componentRegistry);
  
  // Get component definition
  const definition = useMemo(() => {
    return registry.getComponent(options.componentId) || null;
  }, [registry, options.componentId]);
  
  // Initialize instance
  useEffect(() => {
    if (!definition) return;
    
    const newInstance = registry.createInstance(options.componentId, {
      variantId: options.variantId,
      overrides: options.overrides,
      position: options.position,
      size: options.size,
    });
    
    setInstance(newInstance);
    
    // Cleanup
    return () => {
      if (newInstance) {
        registry.deleteInstance(newInstance.id);
      }
    };
  }, [registry, options.componentId]); // Only re-initialize if component changes
  
  // Resolve the instance (combine base + variant + overrides)
  const resolvedNode = useMemo(() => {
    if (!instance) return null;
    try {
      return registry.resolveInstance(instance.id);
    } catch (error) {
      console.error('Failed to resolve instance:', error);
      return null;
    }
  }, [instance, registry]);
  
  // Set variant
  const setVariant = useCallback(
    (variantId: string) => {
      if (!instance) return;
      registry.applyVariant(instance.id, variantId);
      // Update local state
      const updated = registry.getInstance(instance.id);
      if (updated) setInstance({ ...updated });
    },
    [instance, registry]
  );
  
  // Apply override
  const applyOverride = useCallback(
    (nodeId: string, propertyName: string, value: any) => {
      if (!instance) return;
      registry.applyOverride(instance.id, nodeId, propertyName, value);
      // Update local state
      const updated = registry.getInstance(instance.id);
      if (updated) setInstance({ ...updated });
    },
    [instance, registry]
  );
  
  // Remove override
  const removeOverride = useCallback(
    (nodeId: string, propertyName: string) => {
      if (!instance) return;
      const overrideKey = `${nodeId}.${propertyName}`;
      const newOverrides = { ...instance.overrides };
      delete newOverrides[overrideKey];
      
      registry.updateInstance(instance.id, { overrides: newOverrides });
      const updated = registry.getInstance(instance.id);
      if (updated) setInstance({ ...updated });
    },
    [instance, registry]
  );
  
  // Update position
  const updatePosition = useCallback(
    (position: { x: number; y: number }) => {
      if (!instance) return;
      registry.updateInstance(instance.id, { position });
      const updated = registry.getInstance(instance.id);
      if (updated) setInstance({ ...updated });
    },
    [instance, registry]
  );
  
  // Update size
  const updateSize = useCallback(
    (size: { width: number; height: number }) => {
      if (!instance) return;
      registry.updateInstance(instance.id, { size });
      const updated = registry.getInstance(instance.id);
      if (updated) setInstance({ ...updated });
    },
    [instance, registry]
  );
  
  // Clone instance
  const clone = useCallback(() => {
    if (!instance) return null;
    const cloned = registry.cloneInstance(instance.id);
    return cloned;
  }, [instance, registry]);
  
  return {
    instance,
    resolvedNode,
    definition,
    setVariant,
    applyOverride,
    removeOverride,
    updatePosition,
    updateSize,
    clone,
  };
}

/**
 * Hook for managing all instances of a component
 */
export function useComponentInstances(componentId: string) {
  const [instances, setInstances] = useState<ComponentInstance[]>([]);
  const [registry] = useState(() => componentRegistry);
  
  useEffect(() => {
    const updateInstances = () => {
      const allInstances = registry.getInstancesOfComponent(componentId);
      setInstances(allInstances);
    };
    
    updateInstances();
    
    // Poll for changes (in real app, use event system)
    const interval = setInterval(updateInstances, 100);
    return () => clearInterval(interval);
  }, [componentId, registry]);
  
  return instances;
}

/**
 * Hook for the component registry itself
 */
export function useComponentRegistry() {
  const [registry] = useState(() => componentRegistry);
  const [components, setComponents] = useState<ComponentDefinition[]>([]);
  
  useEffect(() => {
    const updateComponents = () => {
      setComponents(registry.getAllComponents());
    };
    
    updateComponents();
    
    // Poll for changes
    const interval = setInterval(updateComponents, 100);
    return () => clearInterval(interval);
  }, [registry]);
  
  return {
    registry,
    components,
    createInstance: (componentId: string, options?: any) =>
      registry.createInstance(componentId, options),
    getComponent: (id: string) => registry.getComponent(id),
  };
}

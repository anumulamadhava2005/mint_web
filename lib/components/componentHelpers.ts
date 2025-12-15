/**
 * componentHelpers.ts
 * 
 * Helper functions for creating and managing components.
 */

import {
  ComponentDefinition,
  ComponentNode,
  ComponentVariant,
  PropertyDefinition,
  componentRegistry,
} from './ComponentRegistry';

/**
 * Create a new component definition
 */
export function createComponent(
  name: string,
  baseNode: ComponentNode,
  options?: {
    description?: string;
    properties?: PropertyDefinition[];
    variants?: ComponentVariant[];
    defaultVariantId?: string;
  }
): ComponentDefinition {
  const id = `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const component: ComponentDefinition = {
    id,
    name,
    description: options?.description,
    baseNode,
    properties: options?.properties || [],
    variants: options?.variants || [],
    defaultVariantId: options?.defaultVariantId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  componentRegistry.registerComponent(component);
  return component;
}

/**
 * Create a component node helper
 */
export function createNode(
  id: string,
  type: string,
  properties: Record<string, any>,
  children?: ComponentNode[]
): ComponentNode {
  return {
    id,
    type,
    name: id,
    properties,
    children,
  };
}

/**
 * Create a variant
 */
export function createVariant(
  name: string,
  properties: Record<string, any>,
  options?: {
    description?: string;
    conditions?: Record<string, any>;
  }
): ComponentVariant {
  const id = `variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    name,
    description: options?.description,
    properties,
    conditions: options?.conditions,
  };
}

/**
 * Create a property definition
 */
export function createProperty(
  name: string,
  type: PropertyDefinition['type'],
  defaultValue: any,
  options?: {
    enumValues?: string[];
    description?: string;
  }
): PropertyDefinition {
  return {
    name,
    type,
    defaultValue,
    enumValues: options?.enumValues,
    description: options?.description,
  };
}

/**
 * Example: Create a Button component with variants
 */
export function createButtonComponent(): ComponentDefinition {
  // Define base button structure
  const baseNode = createNode(
    'button-root',
    'frame',
    {
      width: 120,
      height: 40,
      backgroundColor: '#3b82f6',
      borderRadius: 8,
      paddingX: 16,
      paddingY: 12,
    },
    [
      createNode('button-text', 'text', {
        text: 'Button',
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
      }),
    ]
  );
  
  // Define variants
  const variants = [
    // Primary variant (default)
    createVariant(
      'Primary',
      {
        'button-root.backgroundColor': '#3b82f6',
        'button-text.color': '#ffffff',
      },
      {
        description: 'Primary button style',
        conditions: { variant: 'primary', state: 'default' },
      }
    ),
    
    // Secondary variant
    createVariant(
      'Secondary',
      {
        'button-root.backgroundColor': '#6b7280',
        'button-text.color': '#ffffff',
      },
      {
        description: 'Secondary button style',
        conditions: { variant: 'secondary', state: 'default' },
      }
    ),
    
    // Outline variant
    createVariant(
      'Outline',
      {
        'button-root.backgroundColor': 'transparent',
        'button-root.borderWidth': 2,
        'button-root.borderColor': '#3b82f6',
        'button-text.color': '#3b82f6',
      },
      {
        description: 'Outline button style',
        conditions: { variant: 'outline', state: 'default' },
      }
    ),
    
    // Disabled state
    createVariant(
      'Disabled',
      {
        'button-root.backgroundColor': '#d1d5db',
        'button-root.opacity': 0.6,
        'button-text.color': '#9ca3af',
      },
      {
        description: 'Disabled state',
        conditions: { state: 'disabled' },
      }
    ),
  ];
  
  // Define exposed properties
  const properties = [
    createProperty('text', 'string', 'Button', {
      description: 'Button text content',
    }),
    createProperty('variant', 'enum', 'primary', {
      enumValues: ['primary', 'secondary', 'outline'],
      description: 'Button style variant',
    }),
    createProperty('state', 'enum', 'default', {
      enumValues: ['default', 'hover', 'active', 'disabled'],
      description: 'Button state',
    }),
    createProperty('width', 'number', 120, {
      description: 'Button width',
    }),
  ];
  
  return createComponent('Button', baseNode, {
    description: 'A versatile button component with multiple variants',
    properties,
    variants,
    defaultVariantId: variants[0].id,
  });
}

/**
 * Example: Create a Card component
 */
export function createCardComponent(): ComponentDefinition {
  const baseNode = createNode(
    'card-root',
    'frame',
    {
      width: 300,
      height: 200,
      backgroundColor: '#ffffff',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
    [
      createNode('card-header', 'text', {
        text: 'Card Title',
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
      }),
      createNode('card-content', 'text', {
        text: 'Card content goes here',
        fontSize: 14,
        color: '#6b7280',
        lineHeight: 1.5,
      }),
    ]
  );
  
  const variants = [
    createVariant(
      'Default',
      {
        'card-root.backgroundColor': '#ffffff',
        'card-root.boxShadow': '0 2px 8px rgba(0,0,0,0.1)',
      },
      {
        conditions: { variant: 'default' },
      }
    ),
    createVariant(
      'Elevated',
      {
        'card-root.backgroundColor': '#ffffff',
        'card-root.boxShadow': '0 10px 25px rgba(0,0,0,0.15)',
      },
      {
        conditions: { variant: 'elevated' },
      }
    ),
    createVariant(
      'Outlined',
      {
        'card-root.backgroundColor': 'transparent',
        'card-root.borderWidth': 1,
        'card-root.borderColor': '#e5e7eb',
        'card-root.boxShadow': 'none',
      },
      {
        conditions: { variant: 'outlined' },
      }
    ),
  ];
  
  const properties = [
    createProperty('title', 'string', 'Card Title'),
    createProperty('content', 'string', 'Card content goes here'),
    createProperty('variant', 'enum', 'default', {
      enumValues: ['default', 'elevated', 'outlined'],
    }),
  ];
  
  return createComponent('Card', baseNode, {
    description: 'A card container component',
    properties,
    variants,
    defaultVariantId: variants[0].id,
  });
}

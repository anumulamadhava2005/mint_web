/**
 * ComponentExample.tsx
 * 
 * Example demonstrating the component system with variants.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createButtonComponent, createCardComponent } from '../lib/components/componentHelpers';
import { useComponentInstance, useComponentRegistry } from '../lib/components/useComponentInstance';
import { ComponentNode } from '../lib/components/ComponentRegistry';

// Initialize example components
const initializeComponents = () => {
  createButtonComponent();
  createCardComponent();
};

export function ComponentExample() {
  const [initialized, setInitialized] = useState(false);
  const { components, createInstance } = useComponentRegistry();
  
  useEffect(() => {
    if (!initialized && components.length === 0) {
      initializeComponents();
      setInitialized(true);
    }
  }, [initialized, components.length]);
  
  // Get button component
  const buttonComponent = components.find(c => c.name === 'Button');
  const cardComponent = components.find(c => c.name === 'Card');
  
  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Component System with Variants</h1>
      
      {/* Button Component Examples */}
      {buttonComponent && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Button Component</h2>
          <p className="text-gray-600 mb-6">
            A reusable button with multiple variants: Primary, Secondary, Outline, and Disabled states
          </p>
          
          <div className="space-y-8">
            {/* Primary Variant */}
            <ButtonVariantDemo
              componentId={buttonComponent.id}
              variantName="Primary"
              variantId={buttonComponent.variants[0]?.id}
              text="Primary Button"
            />
            
            {/* Secondary Variant */}
            <ButtonVariantDemo
              componentId={buttonComponent.id}
              variantName="Secondary"
              variantId={buttonComponent.variants[1]?.id}
              text="Secondary Button"
            />
            
            {/* Outline Variant */}
            <ButtonVariantDemo
              componentId={buttonComponent.id}
              variantName="Outline"
              variantId={buttonComponent.variants[2]?.id}
              text="Outline Button"
            />
            
            {/* Disabled Variant */}
            <ButtonVariantDemo
              componentId={buttonComponent.id}
              variantName="Disabled"
              variantId={buttonComponent.variants[3]?.id}
              text="Disabled Button"
            />
          </div>
          
          {/* Interactive Demo */}
          <div className="mt-8 pt-8 border-t">
            <h3 className="text-lg font-semibold mb-4">Interactive Demo</h3>
            <InteractiveButtonDemo componentId={buttonComponent.id} variants={buttonComponent.variants} />
          </div>
        </section>
      )}
      
      {/* Card Component Examples */}
      {cardComponent && (
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Card Component</h2>
          <p className="text-gray-600 mb-6">
            A card container with three variants: Default, Elevated, and Outlined
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cardComponent.variants.map((variant, index) => (
              <CardVariantDemo
                key={variant.id}
                componentId={cardComponent.id}
                variantName={variant.name}
                variantId={variant.id}
              />
            ))}
          </div>
        </section>
      )}
      
      {/* Component Registry Info */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Component Registry</h2>
        <div className="space-y-4">
          {components.map(component => (
            <div key={component.id} className="border rounded p-4">
              <h3 className="font-semibold text-lg">{component.name}</h3>
              <p className="text-sm text-gray-600 mb-2">{component.description}</p>
              <div className="text-xs text-gray-500">
                <div>Variants: {component.variants.length}</div>
                <div>Properties: {component.properties.length}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Button variant demo component
function ButtonVariantDemo({
  componentId,
  variantName,
  variantId,
  text,
}: {
  componentId: string;
  variantName: string;
  variantId?: string;
  text: string;
}) {
  const { resolvedNode, applyOverride } = useComponentInstance({
    componentId,
    variantId,
  });
  
  useEffect(() => {
    if (resolvedNode) {
      applyOverride('button-text', 'text', text);
    }
  }, [text, resolvedNode, applyOverride]);
  
  if (!resolvedNode) return null;
  
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">{variantName}</div>
      <ComponentRenderer node={resolvedNode} />
    </div>
  );
}

// Card variant demo component
function CardVariantDemo({
  componentId,
  variantName,
  variantId,
}: {
  componentId: string;
  variantName: string;
  variantId: string;
}) {
  const { resolvedNode } = useComponentInstance({
    componentId,
    variantId,
  });
  
  if (!resolvedNode) return null;
  
  return (
    <div>
      <div className="text-sm font-medium text-gray-700 mb-2">{variantName}</div>
      <ComponentRenderer node={resolvedNode} />
    </div>
  );
}

// Interactive button demo with live variant switching
function InteractiveButtonDemo({
  componentId,
  variants,
}: {
  componentId: string;
  variants: any[];
}) {
  const [selectedVariant, setSelectedVariant] = useState(variants[0]?.id);
  const [customText, setCustomText] = useState('Click Me!');
  
  const { resolvedNode, setVariant, applyOverride } = useComponentInstance({
    componentId,
    variantId: selectedVariant,
  });
  
  useEffect(() => {
    if (selectedVariant) {
      setVariant(selectedVariant);
    }
  }, [selectedVariant, setVariant]);
  
  useEffect(() => {
    if (resolvedNode) {
      applyOverride('button-text', 'text', customText);
    }
  }, [customText, resolvedNode, applyOverride]);
  
  if (!resolvedNode) return null;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Variant</label>
          <select
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          >
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Button Text</label>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </div>
      
      <div className="pt-4">
        <div className="text-sm text-gray-600 mb-2">Live Preview:</div>
        <ComponentRenderer node={resolvedNode} />
      </div>
      
      <div className="pt-4 border-t">
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">View Resolved Properties</summary>
          <pre className="mt-2 bg-gray-50 p-3 rounded overflow-auto text-xs">
            {JSON.stringify(resolvedNode, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

// Simple component renderer
function ComponentRenderer({ node }: { node: ComponentNode }) {
  const props = node.properties;
  
  if (node.type === 'frame') {
    return (
      <div
        style={{
          width: props.width || 'auto',
          height: props.height || 'auto',
          backgroundColor: props.backgroundColor,
          borderRadius: props.borderRadius,
          padding: props.padding || `${props.paddingY || 0}px ${props.paddingX || 0}px`,
          boxShadow: props.boxShadow,
          borderWidth: props.borderWidth,
          borderColor: props.borderColor,
          borderStyle: props.borderWidth ? 'solid' : 'none',
          opacity: props.opacity,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {node.children?.map((child) => (
          <ComponentRenderer key={child.id} node={child} />
        ))}
      </div>
    );
  }
  
  if (node.type === 'text') {
    return (
      <span
        style={{
          fontSize: props.fontSize,
          fontWeight: props.fontWeight,
          color: props.color,
          textAlign: props.textAlign,
          lineHeight: props.lineHeight,
          marginBottom: props.marginBottom,
        }}
      >
        {props.text}
      </span>
    );
  }
  
  return null;
}

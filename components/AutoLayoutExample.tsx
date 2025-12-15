/**
 * AutoLayoutExample.tsx
 * 
 * Live example demonstrating auto-layout with real-time updates.
 * Shows horizontal/vertical layouts, alignment, padding, and constraints.
 */

'use client';

import React, { useState } from 'react';
import {
  useAutoLayout,
  createDefaultAutoLayoutConfig,
  createLayoutNode,
  LayoutDirection,
  AlignItems,
  AlignContent,
  LayoutResult,
} from '../lib/auto-layout/useAutoLayout';

export function AutoLayoutExample() {
  // Example 1: Button that resizes with text
  const [buttonText, setButtonText] = useState('Click Me');
  
  const buttonLayout = useAutoLayout({
    config: createDefaultAutoLayoutConfig({
      layoutMode: 'HORIZONTAL',
      paddingTop: 12,
      paddingRight: 24,
      paddingBottom: 12,
      paddingLeft: 24,
      itemSpacing: 8,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    }),
    children: [
      createLayoutNode('icon', 20, 20),
      createLayoutNode('text', buttonText.length * 8, 20, {
        layoutGrow: 1, // Text grows to fill space
      }),
    ],
    autoResize: true, // Button auto-resizes based on content
  });
  
  // Example 2: Toolbar with various alignments
  const [toolbarDirection, setToolbarDirection] = useState<LayoutDirection>('HORIZONTAL');
  const [toolbarAlignment, setToolbarAlignment] = useState<AlignContent>('MIN');
  const [crossAxisAlignment, setCrossAxisAlignment] = useState<AlignItems>('CENTER');
  
  const toolbarLayout = useAutoLayout({
    config: createDefaultAutoLayoutConfig({
      layoutMode: toolbarDirection,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      itemSpacing: 12,
      primaryAxisAlignItems: toolbarAlignment,
      counterAxisAlignItems: crossAxisAlignment,
    }),
    children: [
      createLayoutNode('tool1', 40, 40),
      createLayoutNode('tool2', 40, 40),
      createLayoutNode('tool3', 40, 40),
      createLayoutNode('tool4', 40, 40),
    ],
    frameSize: { width: 400, height: 200 },
  });
  
  // Example 3: Card with flex-grow
  const cardLayout = useAutoLayout({
    config: createDefaultAutoLayoutConfig({
      layoutMode: 'VERTICAL',
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      itemSpacing: 16,
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'STRETCH',
    }),
    children: [
      createLayoutNode('header', 300, 60),
      createLayoutNode('content', 300, 100, {
        layoutGrow: 1, // Content grows to fill available space
      }),
      createLayoutNode('footer', 300, 40),
    ],
    frameSize: { width: 340, height: 400 },
  });

  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Auto Layout Examples</h1>
      
      {/* Example 1: Auto-resizing Button */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">1. Auto-Resizing Button</h2>
        <p className="text-gray-600 mb-4">
          Button automatically resizes when text changes
        </p>
        
        <input
          type="text"
          value={buttonText}
          onChange={(e) => setButtonText(e.target.value)}
          className="px-4 py-2 border rounded mb-4 w-full max-w-md"
          placeholder="Enter button text..."
        />
        
        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">
            Frame size: {buttonLayout.frameSize.width.toFixed(0)}px × {buttonLayout.frameSize.height.toFixed(0)}px
          </div>
          
          <div
            style={{
              position: 'relative',
              width: buttonLayout.frameSize.width,
              height: buttonLayout.frameSize.height,
              backgroundColor: '#3b82f6',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            {buttonLayout.layout.map((item: LayoutResult) => (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: item.height,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.id === 'icon' && (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
                    <circle cx="10" cy="10" r="8" />
                  </svg>
                )}
                {item.id === 'text' && (
                  <span className="text-white font-medium">{buttonText}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Example 2: Toolbar with Alignment Controls */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">2. Toolbar with Alignment</h2>
        <p className="text-gray-600 mb-4">
          Adjust direction and alignment to see how items reposition
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Direction</label>
            <select
              value={toolbarDirection}
              onChange={(e) => setToolbarDirection(e.target.value as LayoutDirection)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="HORIZONTAL">Horizontal</option>
              <option value="VERTICAL">Vertical</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Main Axis</label>
            <select
              value={toolbarAlignment}
              onChange={(e) => setToolbarAlignment(e.target.value as AlignContent)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="MIN">Start</option>
              <option value="CENTER">Center</option>
              <option value="MAX">End</option>
              <option value="SPACE_BETWEEN">Space Between</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Cross Axis</label>
            <select
              value={crossAxisAlignment}
              onChange={(e) => setCrossAxisAlignment(e.target.value as AlignItems)}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="MIN">Start</option>
              <option value="CENTER">Center</option>
              <option value="MAX">End</option>
              <option value="STRETCH">Stretch</option>
            </select>
          </div>
        </div>
        
        <div
          style={{
            position: 'relative',
            width: toolbarLayout.frameSize.width,
            height: toolbarLayout.frameSize.height,
            backgroundColor: '#f3f4f6',
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
          }}
        >
          {toolbarLayout.layout.map((item: LayoutResult, index: number) => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'][index],
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </section>
      
      {/* Example 3: Card with Flex-Grow */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">3. Card with Flexible Content</h2>
        <p className="text-gray-600 mb-4">
          Middle section grows to fill available space (layoutGrow: 1)
        </p>
        
        <div
          style={{
            position: 'relative',
            width: cardLayout.frameSize.width,
            height: cardLayout.frameSize.height,
            backgroundColor: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {cardLayout.layout.map((item: LayoutResult) => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.height,
                backgroundColor:
                  item.id === 'header'
                    ? '#f9fafb'
                    : item.id === 'content'
                    ? '#ffffff'
                    : '#f3f4f6',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: '#6b7280',
                fontWeight: '500',
              }}
            >
              <div className="text-center">
                <div className="font-semibold text-gray-900">{item.id.toUpperCase()}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {item.height.toFixed(0)}px height
                  {item.id === 'content' && ' (flexible)'}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>• Header: Fixed height (60px)</p>
          <p>• Content: Grows to fill space (layoutGrow: 1)</p>
          <p>• Footer: Fixed height (40px)</p>
        </div>
      </section>
      
      {/* Layout Info Panel */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Layout Debug Info</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Button Layout:</h3>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
              {JSON.stringify(buttonLayout.layout, null, 2)}
            </pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Toolbar Config:</h3>
            <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
              {JSON.stringify(toolbarLayout.config, null, 2)}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

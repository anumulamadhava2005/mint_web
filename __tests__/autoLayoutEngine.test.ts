/**
 * Tests for AutoLayoutEngine
 */

import { AutoLayoutEngine } from '../lib/layout/AutoLayoutEngine';
import { createFigmaNode, DEFAULT_AUTO_LAYOUT } from '../lib/scene-graph/FigmaNode';

describe('AutoLayoutEngine', () => {
  let engine: AutoLayoutEngine;
  
  beforeEach(() => {
    engine = new AutoLayoutEngine();
  });
  
  describe('Horizontal Layout', () => {
    test('basic horizontal layout', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child3', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      expect(result.applied).toBe(true);
      expect(result.childBounds.get('child1')).toEqual({ x: 10, y: 10, width: 50, height: 50 });
      expect(result.childBounds.get('child2')).toEqual({ x: 70, y: 10, width: 50, height: 50 });
      expect(result.childBounds.get('child3')).toEqual({ x: 130, y: 10, width: 50, height: 50 });
    });
    
    test('horizontal layout with center alignment', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlignItems: 'CENTER',
          counterAxisAlignItems: 'CENTER',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Total content width = 50 + 10 + 50 = 110
      // Start X = (400 - 110) / 2 = 145
      expect(result.childBounds.get('child1')?.x).toBe(145);
      expect(result.childBounds.get('child2')?.x).toBe(205);
      
      // Center Y = (100 - 50) / 2 = 25
      expect(result.childBounds.get('child1')?.y).toBe(25);
    });
    
    test('horizontal layout with fill children', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FILL' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Available = 400 - 20 = 380
      // Fixed = 50 + 10 gap = 60
      // Fill gets = 380 - 60 = 320
      expect(result.childBounds.get('child2')?.width).toBe(320);
    });
    
    test('horizontal layout with space-between', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 0,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlignItems: 'SPACE_BETWEEN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child3', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // 3 children of 50px each = 150px content
      // 400 - 150 = 250px to distribute
      // Gap = 250 / 2 = 125
      expect(result.childBounds.get('child1')?.x).toBe(0);
      expect(result.childBounds.get('child2')?.x).toBe(175);
      expect(result.childBounds.get('child3')?.x).toBe(350);
    });
  });
  
  describe('Vertical Layout', () => {
    test('basic vertical layout', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 100,
        height: 400,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'VERTICAL',
          itemSpacing: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      expect(result.childBounds.get('child1')).toEqual({ x: 10, y: 10, width: 50, height: 50 });
      expect(result.childBounds.get('child2')).toEqual({ x: 10, y: 70, width: 50, height: 50 });
    });
    
    test('vertical layout with stretch counter-axis', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 200,
        height: 400,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'VERTICAL',
          itemSpacing: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'STRETCH',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FILL' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Available width = 200 - 20 = 180
      expect(result.childBounds.get('child1')?.width).toBe(180);
    });
  });
  
  describe('Min/Max Constraints', () => {
    test('respects minimum size', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 100,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 200, height: 50, minWidth: 80, layoutSizingHorizontal: 'FILL' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Fill would give 100px, but min is 80, so it gets 100 (min doesn't reduce)
      expect(result.childBounds.get('child1')?.width).toBe(100);
    });
    
    test('respects maximum size', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 500,
        height: 100,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, maxWidth: 100, layoutSizingHorizontal: 'FILL' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Fill would give 500px, but max is 100
      expect(result.childBounds.get('child1')?.width).toBe(100);
    });
  });
  
  describe('Absolute Positioning', () => {
    test('absolute children are not affected by layout', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 400,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'absolute1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const, layoutPositioning: 'ABSOLUTE' as const, constraints: { horizontal: 'CENTER' as const, vertical: 'CENTER' as const } },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Absolute child is centered
      expect(result.childBounds.get('absolute1')?.x).toBe(175); // (400 - 50) / 2
      expect(result.childBounds.get('absolute1')?.y).toBe(175);
    });
  });
  
  describe('Hug Sizing', () => {
    test('hug sizing calculates container size', () => {
      const frame = createFigmaNode({
        type: 'FRAME',
        width: 400,
        height: 400,
        autoLayout: {
          ...DEFAULT_AUTO_LAYOUT,
          layoutMode: 'HORIZONTAL',
          itemSpacing: 10,
          primaryAxisSizingMode: 'HUG',
          counterAxisSizingMode: 'HUG',
          padding: { top: 10, right: 10, bottom: 10, left: 10 },
          primaryAxisAlignItems: 'MIN',
          counterAxisAlignItems: 'MIN',
          layoutWrap: 'NO_WRAP',
        },
      });
      
      const children = [
        { id: 'child1', width: 50, height: 80, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
        { id: 'child2', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
      ];
      
      const result = engine.applyLayout(frame, children);
      
      // Width = 10 + 50 + 10 + 50 + 10 = 130
      // Height = 10 + 80 + 10 = 100
      expect(result.containerSize.width).toBe(130);
      expect(result.containerSize.height).toBe(100);
    });
  });
  
  test('no auto-layout returns unchanged', () => {
    const frame = createFigmaNode({
      type: 'FRAME',
      width: 400,
      height: 400,
    });
    
    const children = [
      { id: 'child1', width: 50, height: 50, layoutSizingHorizontal: 'FIXED' as const, layoutSizingVertical: 'FIXED' as const },
    ];
    
    const result = engine.applyLayout(frame, children);
    
    expect(result.applied).toBe(false);
    expect(result.childBounds.size).toBe(0);
  });
});

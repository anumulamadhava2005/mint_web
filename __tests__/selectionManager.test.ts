/**
 * Tests for SelectionManager
 */

import { SelectionManager } from '../lib/scene-graph/SelectionManager';
import { createFigmaNode } from '../lib/scene-graph/FigmaNode';

describe('SelectionManager', () => {
  let manager: SelectionManager;
  
  beforeEach(() => {
    manager = new SelectionManager();
    
    // Create test nodes
    const nodes = new Map([
      ['node1', createFigmaNode({ id: 'node1', x: 0, y: 0, width: 100, height: 100 })],
      ['node2', createFigmaNode({ id: 'node2', x: 200, y: 0, width: 100, height: 100 })],
      ['node3', createFigmaNode({ id: 'node3', x: 0, y: 200, width: 100, height: 100, locked: true })],
    ]);
    
    manager.setNodes(nodes);
  });
  
  test('select single node', () => {
    manager.select('node1');
    expect(manager.isSelected('node1')).toBe(true);
    expect(manager.isSelected('node2')).toBe(false);
    expect(manager.getSelection().size).toBe(1);
  });
  
  test('multi-select with shift', () => {
    manager.select('node1');
    manager.select('node2', { multiSelect: true });
    expect(manager.isSelected('node1')).toBe(true);
    expect(manager.isSelected('node2')).toBe(true);
    expect(manager.getSelection().size).toBe(2);
  });
  
  test('cannot select locked node', () => {
    manager.select('node3');
    expect(manager.isSelected('node3')).toBe(false);
  });
  
  test('clear selection', () => {
    manager.select('node1');
    manager.clearSelection();
    expect(manager.getSelection().size).toBe(0);
  });
  
  test('deselect single node', () => {
    manager.selectMultiple(['node1', 'node2']);
    manager.deselect('node1');
    expect(manager.isSelected('node1')).toBe(false);
    expect(manager.isSelected('node2')).toBe(true);
  });
  
  test('toggle selection', () => {
    manager.select('node1');
    manager.select('node1', { toggle: true });
    expect(manager.isSelected('node1')).toBe(false);
  });
  
  test('selection bounds calculated correctly', () => {
    manager.selectMultiple(['node1', 'node2']);
    const bounds = manager.getBounds();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBe(0);
    expect(bounds!.y).toBe(0);
    expect(bounds!.width).toBe(300);
    expect(bounds!.height).toBe(100);
  });
  
  test('handle positions returned correctly', () => {
    manager.select('node1');
    const handles = manager.getHandlePositions(1);
    expect(handles.length).toBe(8);
    
    // Check corner handles exist
    const handleTypes = handles.map(h => h.handle);
    expect(handleTypes).toContain('nw');
    expect(handleTypes).toContain('ne');
    expect(handleTypes).toContain('sw');
    expect(handleTypes).toContain('se');
  });
  
  test('hover does not include locked nodes', () => {
    manager.setHovered('node3');
    expect(manager.getHoveredId()).toBeNull();
    
    manager.setHovered('node1');
    expect(manager.getHoveredId()).toBe('node1');
  });
  
  test('listener notified on selection change', () => {
    const listener = jest.fn();
    manager.subscribe(listener);
    
    manager.select('node1');
    expect(listener).toHaveBeenCalledWith(expect.any(Set));
    expect(listener.mock.calls[0][0].has('node1')).toBe(true);
  });
  
  test('unsubscribe works', () => {
    const listener = jest.fn();
    const unsubscribe = manager.subscribe(listener);
    
    unsubscribe();
    manager.select('node1');
    
    expect(listener).not.toHaveBeenCalled();
  });
});

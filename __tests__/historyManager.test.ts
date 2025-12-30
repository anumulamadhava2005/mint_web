/**
 * Tests for HistoryManager
 */

import {
  HistoryManager,
  createMoveCommand,
  createPropertyCommand,
  COALESCE_WINDOW,
} from '../lib/interaction/HistoryManager';

describe('HistoryManager', () => {
  let manager: HistoryManager;
  let testValue: number;
  
  beforeEach(() => {
    manager = new HistoryManager();
    testValue = 0;
  });
  
  test('execute runs command', () => {
    const command = {
      type: 'test',
      description: 'Test command',
      execute: () => { testValue = 1; },
      undo: () => { testValue = 0; },
    };
    
    manager.execute(command);
    expect(testValue).toBe(1);
  });
  
  test('undo reverses command', () => {
    const command = {
      type: 'test',
      description: 'Test command',
      execute: () => { testValue = 1; },
      undo: () => { testValue = 0; },
    };
    
    manager.execute(command);
    manager.undo();
    expect(testValue).toBe(0);
  });
  
  test('redo re-applies command', () => {
    const command = {
      type: 'test',
      description: 'Test command',
      execute: () => { testValue = 1; },
      undo: () => { testValue = 0; },
    };
    
    manager.execute(command);
    manager.undo();
    manager.redo();
    expect(testValue).toBe(1);
  });
  
  test('canUndo/canRedo reflect state', () => {
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
    
    manager.execute({
      type: 'test',
      description: 'Test',
      execute: () => {},
      undo: () => {},
    });
    
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    
    manager.undo();
    
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);
  });
  
  test('new command clears redo stack', () => {
    manager.execute({
      type: 'test',
      description: 'Test 1',
      execute: () => { testValue = 1; },
      undo: () => { testValue = 0; },
    });
    
    manager.undo();
    
    manager.execute({
      type: 'test',
      description: 'Test 2',
      execute: () => { testValue = 2; },
      undo: () => { testValue = 0; },
    });
    
    expect(manager.canRedo()).toBe(false);
  });
  
  test('history limit enforced', () => {
    manager.setLimit(3);
    
    for (let i = 0; i < 5; i++) {
      manager.execute({
        type: 'test',
        description: `Test ${i}`,
        execute: () => {},
        undo: () => {},
      });
    }
    
    // Can only undo 3 times
    let undoCount = 0;
    while (manager.canUndo()) {
      manager.undo();
      undoCount++;
    }
    
    expect(undoCount).toBe(3);
  });
  
  test('transaction groups multiple commands', () => {
    manager.beginTransaction('Grouped');
    
    manager.execute({
      type: 'test',
      description: 'Part 1',
      execute: () => { testValue += 1; },
      undo: () => { testValue -= 1; },
    });
    
    manager.execute({
      type: 'test',
      description: 'Part 2',
      execute: () => { testValue += 10; },
      undo: () => { testValue -= 10; },
    });
    
    manager.commitTransaction();
    
    expect(testValue).toBe(11);
    
    // Single undo should reverse both
    manager.undo();
    expect(testValue).toBe(0);
  });
  
  test('abort transaction reverses all commands', () => {
    manager.beginTransaction('Grouped');
    
    manager.execute({
      type: 'test',
      description: 'Part 1',
      execute: () => { testValue = 5; },
      undo: () => { testValue = 0; },
    });
    
    manager.abortTransaction();
    
    expect(testValue).toBe(0);
    expect(manager.canUndo()).toBe(false);
  });
  
  test('pause prevents history recording', () => {
    manager.pause();
    
    manager.execute({
      type: 'test',
      description: 'Test',
      execute: () => { testValue = 1; },
      undo: () => { testValue = 0; },
    });
    
    expect(testValue).toBe(1); // Command still executed
    expect(manager.canUndo()).toBe(false); // But not recorded
    
    manager.resume();
  });
  
  test('listeners notified on changes', () => {
    const listener = jest.fn();
    manager.subscribe(listener);
    
    manager.execute({
      type: 'test',
      description: 'Test',
      execute: () => {},
      undo: () => {},
    });
    
    expect(listener).toHaveBeenCalledWith(true, false);
    
    manager.undo();
    expect(listener).toHaveBeenCalledWith(false, true);
  });
  
  test('clear removes all history', () => {
    manager.execute({
      type: 'test',
      description: 'Test',
      execute: () => {},
      undo: () => {},
    });
    
    manager.clear();
    
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(false);
  });
  
  test('descriptions returned correctly', () => {
    manager.execute({
      type: 'test',
      description: 'First action',
      execute: () => {},
      undo: () => {},
    });
    
    expect(manager.getUndoDescription()).toBe('First action');
    
    manager.undo();
    expect(manager.getRedoDescription()).toBe('First action');
  });
});

describe('Command Coalescing', () => {
  test('move commands coalesce within time window', () => {
    const positions = { x: 0, y: 0 };
    
    const applyPositions = (pos: Map<string, { x: number; y: number }>) => {
      const p = pos.get('node1');
      if (p) {
        positions.x = p.x;
        positions.y = p.y;
      }
    };
    
    const manager = new HistoryManager();
    
    // First move
    const cmd1 = createMoveCommand(
      ['node1'],
      new Map([['node1', { x: 0, y: 0 }]]),
      new Map([['node1', { x: 10, y: 10 }]]),
      applyPositions
    );
    manager.execute(cmd1);
    
    // Second move within coalesce window
    const cmd2 = createMoveCommand(
      ['node1'],
      new Map([['node1', { x: 10, y: 10 }]]),
      new Map([['node1', { x: 20, y: 20 }]]),
      applyPositions
    );
    cmd2.timestamp = Date.now(); // Ensure within window
    manager.execute(cmd2);
    
    expect(positions.x).toBe(20);
    
    // Single undo should go back to original
    manager.undo();
    expect(positions.x).toBe(0);
  });
});

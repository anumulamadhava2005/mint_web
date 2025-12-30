/**
 * Tests for ViewportManager
 */

import { ViewportManager, MIN_ZOOM, MAX_ZOOM } from '../lib/interaction/ViewportManager';

describe('ViewportManager', () => {
  let manager: ViewportManager;
  
  beforeEach(() => {
    manager = new ViewportManager();
    manager.setCanvasSize(800, 600);
  });
  
  test('initial state', () => {
    const state = manager.getState();
    expect(state.zoom).toBe(1);
    expect(state.panX).toBe(0);
    expect(state.panY).toBe(0);
  });
  
  describe('Coordinate Transforms', () => {
    test('screen to world at 1x zoom', () => {
      const world = manager.screenToWorld(100, 100);
      expect(world.x).toBe(100);
      expect(world.y).toBe(100);
    });
    
    test('world to screen at 1x zoom', () => {
      const screen = manager.worldToScreen(100, 100);
      expect(screen.x).toBe(100);
      expect(screen.y).toBe(100);
    });
    
    test('screen to world at 2x zoom', () => {
      manager.setZoom(2);
      const world = manager.screenToWorld(100, 100);
      expect(world.x).toBe(50);
      expect(world.y).toBe(50);
    });
    
    test('screen to world with pan offset', () => {
      manager.panTo(100, 100);
      const world = manager.screenToWorld(0, 0);
      // At 1x zoom, screen (0,0) with pan centered on (100,100) 
      // means top-left of viewport is at world coords
      expect(world.x).toBeLessThan(100);
      expect(world.y).toBeLessThan(100);
    });
    
    test('visible bounds calculated correctly', () => {
      manager.setZoom(1);
      const bounds = manager.getVisibleBounds();
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });
    
    test('visible bounds at 2x zoom', () => {
      manager.setZoom(2);
      const bounds = manager.getVisibleBounds();
      expect(bounds.width).toBe(400);
      expect(bounds.height).toBe(300);
    });
  });
  
  describe('Zoom Operations', () => {
    test('zoom at point keeps point fixed', () => {
      // Zoom in at screen center
      const beforeWorld = manager.screenToWorld(400, 300);
      manager.zoomAtPoint(400, 300, -1); // Negative delta = zoom in
      const afterWorld = manager.screenToWorld(400, 300);
      
      // World position under cursor should stay approximately the same
      expect(afterWorld.x).toBeCloseTo(beforeWorld.x, 1);
      expect(afterWorld.y).toBeCloseTo(beforeWorld.y, 1);
    });
    
    test('zoom respects min limit', () => {
      for (let i = 0; i < 100; i++) {
        manager.zoomAtPoint(400, 300, 1); // Zoom out
      }
      expect(manager.getZoom()).toBeGreaterThanOrEqual(MIN_ZOOM);
    });
    
    test('zoom respects max limit', () => {
      for (let i = 0; i < 100; i++) {
        manager.zoomAtPoint(400, 300, -1); // Zoom in
      }
      expect(manager.getZoom()).toBeLessThanOrEqual(MAX_ZOOM);
    });
    
    test('zoomIn increases zoom', () => {
      const before = manager.getZoom();
      manager.zoomIn();
      expect(manager.getZoom()).toBeGreaterThan(before);
    });
    
    test('zoomOut decreases zoom', () => {
      const before = manager.getZoom();
      manager.zoomOut();
      expect(manager.getZoom()).toBeLessThan(before);
    });
    
    test('resetZoom sets zoom to 1', () => {
      manager.setZoom(2);
      manager.resetZoom();
      expect(manager.getZoom()).toBe(1);
    });
  });
  
  describe('Pan Operations', () => {
    test('panBy moves viewport', () => {
      manager.panBy(100, 100);
      const pan = manager.getPan();
      expect(pan.x).toBe(-100);
      expect(pan.y).toBe(-100);
    });
    
    test('panTo centers on world point', () => {
      manager.panTo(200, 200);
      const screen = manager.worldToScreen(200, 200);
      expect(screen.x).toBeCloseTo(400, 0); // Screen center
      expect(screen.y).toBeCloseTo(300, 0);
    });
  });
  
  describe('Fit Operations', () => {
    test('fitBounds centers and scales to fit', () => {
      manager.fitBounds({ x: 0, y: 0, width: 400, height: 300 });
      
      // Should fit with padding
      const zoom = manager.getZoom();
      expect(zoom).toBeLessThan(2); // Has some room for padding
      expect(zoom).toBeGreaterThan(0.5);
    });
    
    test('fitBounds handles small content', () => {
      manager.fitBounds({ x: 0, y: 0, width: 10, height: 10 });
      
      // Should not over-zoom
      expect(manager.getZoom()).toBeLessThanOrEqual(MAX_ZOOM);
    });
    
    test('fitBounds handles large content', () => {
      manager.fitBounds({ x: 0, y: 0, width: 10000, height: 10000 });
      
      // Should not under-zoom
      expect(manager.getZoom()).toBeGreaterThanOrEqual(MIN_ZOOM);
    });
    
    test('centerOn does not change zoom', () => {
      const beforeZoom = manager.getZoom();
      manager.centerOn({ x: 100, y: 100, width: 50, height: 50 });
      expect(manager.getZoom()).toBe(beforeZoom);
    });
  });
  
  describe('Listeners', () => {
    test('listener notified on zoom change', () => {
      const listener = jest.fn();
      manager.subscribe(listener);
      
      manager.setZoom(2);
      
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].zoom).toBe(2);
    });
    
    test('listener notified on pan', () => {
      const listener = jest.fn();
      manager.subscribe(listener);
      
      manager.panBy(50, 50);
      
      expect(listener).toHaveBeenCalled();
    });
    
    test('unsubscribe stops notifications', () => {
      const listener = jest.fn();
      const unsubscribe = manager.subscribe(listener);
      
      unsubscribe();
      manager.setZoom(2);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('Serialization', () => {
    test('export and import state', () => {
      manager.setZoom(2);
      manager.panTo(100, 100);
      
      const exported = manager.exportState();
      
      const newManager = new ViewportManager();
      newManager.importState(exported);
      
      expect(newManager.getZoom()).toBe(2);
      expect(newManager.getPan().x).toBe(exported.panX);
      expect(newManager.getPan().y).toBe(exported.panY);
    });
  });
});

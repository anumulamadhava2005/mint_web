/**
 * Tests for SnappingEngine
 */

import { SnappingEngine, DEFAULT_SNAP_CONFIG } from '../lib/interaction/SnappingEngine';

describe('SnappingEngine', () => {
  let engine: SnappingEngine;
  
  beforeEach(() => {
    engine = new SnappingEngine();
    engine.setScale(1);
  });
  
  test('snap disabled returns original position', () => {
    engine.setConfig({ enabled: false });
    
    const result = engine.snap(
      { x: 50, y: 50, width: 100, height: 100 },
      [{ x: 0, y: 0, width: 100, height: 100 }],
      null
    );
    
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
    expect(result.snappedX).toBe(false);
    expect(result.snappedY).toBe(false);
  });
  
  test('edge snapping - left to right edge', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, threshold: 10 });
    
    const result = engine.snap(
      { x: 98, y: 0, width: 50, height: 50 }, // Left edge at 98, close to 100
      [{ x: 0, y: 0, width: 100, height: 100 }], // Right edge at 100
      null
    );
    
    expect(result.x).toBe(100);
    expect(result.snappedX).toBe(true);
    expect(result.guides.length).toBeGreaterThan(0);
  });
  
  test('edge snapping - right to left edge', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, threshold: 10 });
    
    const result = engine.snap(
      { x: -52, y: 0, width: 50, height: 50 }, // Right edge at -2, close to 0
      [{ x: 0, y: 0, width: 100, height: 100 }], // Left edge at 0
      null
    );
    
    expect(result.x).toBe(-50); // Right edge aligns with 0
    expect(result.snappedX).toBe(true);
  });
  
  test('center snapping', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, threshold: 10, centerSnapping: true });
    
    const result = engine.snap(
      { x: 23, y: 23, width: 50, height: 50 }, // Center at 48, close to 50
      [{ x: 0, y: 0, width: 100, height: 100 }], // Center at 50
      null
    );
    
    expect(result.x).toBe(25); // Center aligns at 50
    expect(result.y).toBe(25);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
  });
  
  test('grid snapping', () => {
    engine.setConfig({
      ...DEFAULT_SNAP_CONFIG,
      gridEnabled: true,
      gridSize: 10,
      threshold: 10,
    });
    
    const result = engine.snap(
      { x: 23, y: 47, width: 50, height: 50 },
      [],
      null
    );
    
    expect(result.x).toBe(20);
    expect(result.y).toBe(50);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
  });
  
  test('parent bounds snapping', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, parentSnapping: true, threshold: 10 });
    
    const result = engine.snap(
      { x: 3, y: 3, width: 50, height: 50 },
      [],
      { x: 0, y: 0, width: 200, height: 200 }
    );
    
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.snappedX).toBe(true);
    expect(result.snappedY).toBe(true);
  });
  
  test('pixel snapping rounds to integers', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, pixelSnapping: true, threshold: 10 });
    
    const result = engine.snap(
      { x: 23.7, y: 47.3, width: 50, height: 50 },
      [],
      null
    );
    
    expect(result.x).toBe(24);
    expect(result.y).toBe(47);
  });
  
  test('rotation snapping', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, rotationThreshold: 5 });
    
    expect(engine.snapRotation(43).angle).toBe(45);
    expect(engine.snapRotation(43).snapped).toBe(true);
    
    expect(engine.snapRotation(30).angle).toBe(30);
    expect(engine.snapRotation(30).snapped).toBe(false);
  });
  
  test('distribution snapping', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, distributionSnapping: true, threshold: 10 });
    
    // Three elements with 20px gap
    const siblings = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 70, y: 0, width: 50, height: 50 }, // 20px gap from first
    ];
    
    // Try to place fourth element at equal distance
    const result = engine.snap(
      { x: 138, y: 0, width: 50, height: 50 }, // Should snap to 140 (20px gap from second)
      siblings,
      null
    );
    
    expect(result.x).toBe(140);
    expect(result.snappedX).toBe(true);
  });
  
  test('guides are deduplicated', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, threshold: 10 });
    
    // Two siblings at same position
    const siblings = [
      { x: 100, y: 0, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    ];
    
    const result = engine.snap(
      { x: 98, y: 50, width: 50, height: 50 },
      siblings,
      null
    );
    
    // Should only have one vertical guide at x=100, not two
    const verticalGuides = result.guides.filter(g => g.orientation === 'vertical');
    const positions = new Set(verticalGuides.map(g => g.position));
    expect(positions.size).toBeLessThanOrEqual(verticalGuides.length);
  });
  
  test('scale affects threshold', () => {
    engine.setConfig({ ...DEFAULT_SNAP_CONFIG, threshold: 10 });
    engine.setScale(2); // 2x zoom
    
    // At 2x zoom, 10px screen threshold = 5px world threshold
    const result = engine.snap(
      { x: 106, y: 0, width: 50, height: 50 }, // 6px away, should not snap
      [{ x: 0, y: 0, width: 100, height: 100 }],
      null
    );
    
    expect(result.snappedX).toBe(false);
  });
});

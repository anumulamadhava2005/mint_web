import { describe, it, expect } from 'vitest'
import { TransformEngine, identity, translate, multiply } from '../lib/canvas-engine/transform/TransformEngine'
import type { Matrix2D } from '../lib/canvas-engine/transform/TransformEngine'

function approxEqualMatrix(a: Matrix2D, b: Matrix2D, eps = 1e-6) {
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

describe('TransformEngine worldTransform computation', () => {
  it('computes worldTransform = parent.worldTransform × localTransform', () => {
    const engine = new TransformEngine();
    // Root A: local translate (10,20)
    const A_local = translate(10, 20);
    // Child B: local translate (5,7)
    const B_local = translate(5, 7);

    engine.registerNode('A', null, A_local, { width: 100, height: 80 });
    engine.registerNode('B', 'A', B_local, { width: 50, height: 40 });

    engine.recomputeAllWorldTransforms();

    const A_world = engine.getWorldTransform('A')!;
    const B_world = engine.getWorldTransform('B')!;

    const expectedA = multiply(identity(), A_local);
    const expectedB = multiply(expectedA, B_local);

    expect(approxEqualMatrix(A_world, expectedA)).toBe(true);
    expect(approxEqualMatrix(B_world, expectedB)).toBe(true);
  });

  it('recomputes children recursively regardless of registration order', () => {
    const engine = new TransformEngine();
    const A_local = translate(3, 4);
    const B_local = translate(2, 1);
    const C_local = translate(-5, 6);

    // Register child first, then parent
    engine.registerNode('B', 'A', B_local, { width: 10, height: 10 });
    engine.registerNode('C', 'B', C_local, { width: 5, height: 5 });
    engine.registerNode('A', null, A_local, { width: 20, height: 20 });

    // Before recompute, order may be wrong; after recompute, should be correct
    engine.recomputeAllWorldTransforms();

    const A_world = engine.getWorldTransform('A')!;
    const B_world = engine.getWorldTransform('B')!;
    const C_world = engine.getWorldTransform('C')!;

    const expectedA = multiply(identity(), A_local);
    const expectedB = multiply(expectedA, B_local);
    const expectedC = multiply(expectedB, C_local);

    expect(approxEqualMatrix(A_world, expectedA)).toBe(true);
    expect(approxEqualMatrix(B_world, expectedB)).toBe(true);
    expect(approxEqualMatrix(C_world, expectedC)).toBe(true);
  });
});

describe('GeometryService uses TransformEngine with local transforms', () => {
  it('produces consistent world transforms for nested frames', () => {
    const engine = new TransformEngine();
    // Register mimicking GeometryService: local transforms
    const rootLocal = translate(100, 50);
    const childLocal = translate(20, 10);

    engine.registerNode('root', null, rootLocal, { width: 100, height: 100 });
    engine.registerNode('child', 'root', childLocal, { width: 50, height: 50 });
    engine.recomputeAllWorldTransforms();

    const rootWorld = engine.getWorldTransform('root')!;
    const childWorld = engine.getWorldTransform('child')!;

    const expectedRoot = multiply(identity(), rootLocal);
    const expectedChild = multiply(expectedRoot, childLocal);

    expect(approxEqualMatrix(rootWorld, expectedRoot)).toBe(true);
    expect(approxEqualMatrix(childWorld, expectedChild)).toBe(true);
  });
});

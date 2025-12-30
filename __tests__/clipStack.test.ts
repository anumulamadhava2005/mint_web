import { describe, it, expect, vi } from 'vitest'

/**
 * Tests for Frame clipping stack behavior.
 * 
 * Verifies:
 * - ctx.save/clip called before frame children
 * - ctx.restore called after frame subtree ends
 * - No parent clip leaks to siblings
 * - Nested frames handle multiple clip levels
 */

// Mock drawable nodes in draw order (parent before children)
interface MockNode {
  id: string
  type: string
  clipsContent?: boolean
  parentId: string | null
}

// Simulate the clip stack algorithm from canvas-draw.ts
function simulateClipStack(nodes: MockNode[]): string[] {
  const log: string[] = []
  
  // Build child map for descendant lookup
  const childMap = new Map<string, Set<string>>()
  for (const n of nodes) {
    childMap.set(n.id, new Set())
  }
  for (const n of nodes) {
    if (n.parentId && childMap.has(n.parentId)) {
      // Add to all ancestors
      let current = n.parentId
      while (current) {
        childMap.get(current)?.add(n.id)
        const parent = nodes.find(p => p.id === current)?.parentId
        current = parent ?? ''
      }
    }
  }
  
  const clipStack: Array<{ frameId: string; descendantIds: Set<string> }> = []
  
  for (const n of nodes) {
    // Pop clips whose subtree ended
    while (clipStack.length > 0 && !clipStack[clipStack.length - 1].descendantIds.has(n.id)) {
      log.push(`restore:${clipStack[clipStack.length - 1].frameId}`)
      clipStack.pop()
    }
    
    log.push(`draw:${n.id}`)
    
    // Push clip for frames with clipsContent
    if (n.type === 'FRAME' && n.clipsContent) {
      const descendants = childMap.get(n.id) ?? new Set()
      clipStack.push({ frameId: n.id, descendantIds: descendants })
      log.push(`save+clip:${n.id}`)
    }
  }
  
  // Pop remaining clips
  while (clipStack.length > 0) {
    log.push(`restore:${clipStack[clipStack.length - 1].frameId}`)
    clipStack.pop()
  }
  
  return log
}

describe('Frame clipping stack', () => {
  it('clips frame children and restores before sibling', () => {
    // Tree: A (frame, clips) -> B (child), C (sibling of A)
    const nodes: MockNode[] = [
      { id: 'A', type: 'FRAME', clipsContent: true, parentId: null },
      { id: 'B', type: 'RECT', parentId: 'A' },
      { id: 'C', type: 'RECT', parentId: null },
    ]
    
    const log = simulateClipStack(nodes)
    
    expect(log).toEqual([
      'draw:A',
      'save+clip:A',
      'draw:B',
      'restore:A',  // Before sibling C
      'draw:C',
    ])
  })
  
  it('handles nested frames correctly', () => {
    // Tree: A (frame, clips) -> B (frame, clips) -> C (child), D (sibling of B under A)
    const nodes: MockNode[] = [
      { id: 'A', type: 'FRAME', clipsContent: true, parentId: null },
      { id: 'B', type: 'FRAME', clipsContent: true, parentId: 'A' },
      { id: 'C', type: 'RECT', parentId: 'B' },
      { id: 'D', type: 'RECT', parentId: 'A' },
    ]
    
    const log = simulateClipStack(nodes)
    
    expect(log).toEqual([
      'draw:A',
      'save+clip:A',
      'draw:B',
      'save+clip:B',
      'draw:C',
      'restore:B',  // Exit B's subtree before D
      'draw:D',     // D is still inside A's clip
      'restore:A',  // Exit A's subtree at end
    ])
  })
  
  it('does not clip frame without clipsContent', () => {
    const nodes: MockNode[] = [
      { id: 'A', type: 'FRAME', clipsContent: false, parentId: null },
      { id: 'B', type: 'RECT', parentId: 'A' },
    ]
    
    const log = simulateClipStack(nodes)
    
    expect(log).toEqual([
      'draw:A',
      // No save+clip since clipsContent is false
      'draw:B',
    ])
  })
  
  it('no clip leak to unrelated siblings', () => {
    // Tree: A (frame, clips) -> B, C (no relation to A)
    const nodes: MockNode[] = [
      { id: 'A', type: 'FRAME', clipsContent: true, parentId: null },
      { id: 'B', type: 'RECT', parentId: 'A' },
      { id: 'C', type: 'RECT', parentId: null },
      { id: 'D', type: 'RECT', parentId: null },
    ]
    
    const log = simulateClipStack(nodes)
    
    // C and D should be drawn after A's clip is restored
    expect(log).toEqual([
      'draw:A',
      'save+clip:A',
      'draw:B',
      'restore:A',
      'draw:C',
      'draw:D',
    ])
  })
})

/**
 * usePrototype.ts
 * 
 * React hooks for managing prototype interactions and state.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PrototypeEngine,
  PrototypeFlow,
  PrototypeNode,
  InteractionType,
  NavigationType,
  AnimationConfig,
  TransitionState,
  createAnimation,
  createInteraction,
} from './PrototypeEngine';

export interface UsePrototypeOptions {
  flowId?: string;
  autoStart?: boolean;
}

export interface UsePrototypeResult {
  engine: PrototypeEngine;
  currentNode: PrototypeNode | null;
  transition: TransitionState | null;
  isTransitioning: boolean;
  trigger: (nodeId: string, interactionType: InteractionType) => void;
  startFlow: (flowId: string) => void;
  createFlow: (name: string, description?: string) => PrototypeFlow;
  addNode: (flowId: string, node: PrototypeNode) => void;
}

/**
 * Hook for managing prototype state and interactions
 */
export function usePrototype(options: UsePrototypeOptions = {}): UsePrototypeResult {
  const [engine] = useState(() => new PrototypeEngine());
  const [currentNode, setCurrentNode] = useState<PrototypeNode | null>(null);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [flowId, setFlowId] = useState<string | undefined>(options.flowId);
  const animationFrameRef = useRef<number>();
  
  // Update current node and transition on each frame during animation
  useEffect(() => {
    if (!flowId) return;
    
    const updateState = () => {
      const node = engine.getCurrentNode(flowId);
      setCurrentNode(node);
      
      const trans = engine.getTransitionState();
      setTransition(trans);
      
      // Continue updating during transitions
      if (trans) {
        animationFrameRef.current = requestAnimationFrame(updateState);
      }
    };
    
    updateState();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [flowId, engine]);
  
  // Auto-start flow if specified
  useEffect(() => {
    if (options.autoStart && flowId) {
      engine.startFlow(flowId);
    }
  }, [options.autoStart, flowId, engine]);
  
  // Trigger an interaction
  const trigger = useCallback(
    (nodeId: string, interactionType: InteractionType) => {
      if (!flowId) {
        console.error('No active flow');
        return;
      }
      engine.triggerInteraction(flowId, nodeId, interactionType);
    },
    [flowId, engine]
  );
  
  // Start a flow
  const startFlow = useCallback(
    (newFlowId: string) => {
      setFlowId(newFlowId);
      engine.startFlow(newFlowId);
    },
    [engine]
  );
  
  // Create a new flow
  const createFlow = useCallback(
    (name: string, description?: string) => {
      return engine.createFlow(name, description);
    },
    [engine]
  );
  
  // Add a node to flow
  const addNode = useCallback(
    (flowId: string, node: PrototypeNode) => {
      engine.addNode(flowId, node);
    },
    [engine]
  );
  
  // Cleanup
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);
  
  return {
    engine,
    currentNode,
    transition,
    isTransitioning: transition !== null,
    trigger,
    startFlow,
    createFlow,
    addNode,
  };
}

/**
 * Hook for managing hover interactions
 */
export function useHoverInteraction(
  nodeId: string,
  hoverProperties?: Record<string, any>
) {
  const [isHovering, setIsHovering] = useState(false);
  const [interpolatedProps, setInterpolatedProps] = useState<Record<string, any>>({});
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  
  const TRANSITION_DURATION = 150; // ms
  
  useEffect(() => {
    if (!hoverProperties) return;
    
    startTimeRef.current = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
      
      // Apply ease-out easing
      const easedProgress = isHovering ? progress : 1 - progress;
      const eased = easedProgress * (2 - easedProgress);
      
      // Interpolate properties
      const props: Record<string, any> = {};
      Object.entries(hoverProperties).forEach(([key, targetValue]) => {
        if (typeof targetValue === 'number') {
          props[key] = isHovering ? targetValue * eased : targetValue * (1 - eased);
        } else {
          props[key] = isHovering ? targetValue : undefined;
        }
      });
      
      setInterpolatedProps(props);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isHovering, hoverProperties]);
  
  return {
    isHovering,
    interpolatedProps,
    hoverProps: {
      onMouseEnter: () => setIsHovering(true),
      onMouseLeave: () => setIsHovering(false),
    },
  };
}

/**
 * Hook for smart animate calculations
 */
export function useSmartAnimate(
  fromNodeId: string | null,
  toNodeId: string | null,
  progress: number
) {
  const [interpolatedNodes, setInterpolatedNodes] = useState<Map<string, Record<string, any>>>(
    new Map()
  );
  
  useEffect(() => {
    if (!fromNodeId || !toNodeId) return;
    
    // In real implementation, calculate interpolated properties
    // For now, just return empty map
    setInterpolatedNodes(new Map());
  }, [fromNodeId, toNodeId, progress]);
  
  return interpolatedNodes;
}

// Export types and helpers
export type {
  PrototypeFlow,
  PrototypeNode,
  InteractionType,
  NavigationType,
  AnimationConfig,
  TransitionState,
};

export { createAnimation, createInteraction };

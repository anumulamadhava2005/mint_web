/**
 * PrototypeEngine.ts
 * 
 * Engine for managing prototyping interactions and transitions.
 * Supports click interactions, hover states, and smart animate transitions.
 */

export type InteractionType = 'ON_CLICK' | 'ON_HOVER' | 'WHILE_HOVERING' | 'ON_PRESS';

export type NavigationType = 
  | 'NAVIGATE'          // Navigate to another frame
  | 'BACK'              // Go back to previous frame
  | 'CLOSE_OVERLAY'     // Close overlay/modal
  | 'OPEN_OVERLAY'      // Open frame as overlay
  | 'SWAP'              // Swap with another component
  | 'CHANGE_TO';        // Change to variant

export type AnimationType =
  | 'INSTANT'           // No animation
  | 'DISSOLVE'          // Fade transition
  | 'SMART_ANIMATE'     // Animate matching layers
  | 'MOVE_IN'           // Slide in
  | 'MOVE_OUT'          // Slide out
  | 'PUSH'              // Push current frame out
  | 'SLIDE_IN'          // Slide in from direction
  | 'SLIDE_OUT';        // Slide out to direction

export type EasingType =
  | 'LINEAR'
  | 'EASE_IN'
  | 'EASE_OUT'
  | 'EASE_IN_OUT'
  | 'EASE_IN_BACK'
  | 'EASE_OUT_BACK'
  | 'EASE_IN_OUT_BACK'
  | 'CUSTOM';

export interface AnimationConfig {
  type: AnimationType;
  duration: number; // milliseconds
  easing: EasingType;
  direction?: 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM'; // For directional animations
}

export interface Interaction {
  id: string;
  trigger: InteractionType;
  action: NavigationType;
  destinationId?: string; // Frame or component ID
  animation?: AnimationConfig;
  delay?: number; // Delay before action (ms)
  // For hover states
  hoverProperties?: Record<string, any>;
}

export interface PrototypeNode {
  id: string;
  name: string;
  frameId?: string; // For navigation targets
  interactions: Interaction[];
  isStartingFrame?: boolean;
}

export interface PrototypeFlow {
  id: string;
  name: string;
  description?: string;
  nodes: Map<string, PrototypeNode>;
  startingNodeId?: string;
}

export interface TransitionState {
  fromNodeId: string;
  toNodeId: string;
  animation: AnimationConfig;
  startTime: number;
  progress: number; // 0 to 1
}

/**
 * Prototype engine for managing interactive flows
 */
export class PrototypeEngine {
  private flows: Map<string, PrototypeFlow> = new Map();
  private currentNodeId: string | null = null;
  private navigationHistory: string[] = [];
  private activeTransition: TransitionState | null = null;
  private animationFrameId: number | null = null;
  
  /**
   * Create a new prototype flow
   */
  createFlow(name: string, description?: string): PrototypeFlow {
    const id = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const flow: PrototypeFlow = {
      id,
      name,
      description,
      nodes: new Map(),
    };
    this.flows.set(id, flow);
    return flow;
  }
  
  /**
   * Add a node to a flow
   */
  addNode(flowId: string, node: PrototypeNode): void {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);
    
    flow.nodes.set(node.id, node);
    
    // Set as starting node if it's marked or if it's the first node
    if (node.isStartingFrame || flow.nodes.size === 1) {
      flow.startingNodeId = node.id;
    }
  }
  
  /**
   * Add an interaction to a node
   */
  addInteraction(
    flowId: string,
    nodeId: string,
    interaction: Omit<Interaction, 'id'>
  ): void {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);
    
    const node = flow.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in flow ${flowId}`);
    
    const id = `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    node.interactions.push({ id, ...interaction });
  }
  
  /**
   * Start a prototype flow
   */
  startFlow(flowId: string): void {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);
    
    if (!flow.startingNodeId) {
      throw new Error(`Flow ${flowId} has no starting node`);
    }
    
    this.currentNodeId = flow.startingNodeId;
    this.navigationHistory = [flow.startingNodeId];
  }
  
  /**
   * Trigger an interaction
   */
  triggerInteraction(
    flowId: string,
    nodeId: string,
    trigger: InteractionType
  ): void {
    const flow = this.flows.get(flowId);
    if (!flow) throw new Error(`Flow ${flowId} not found`);
    
    const node = flow.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    
    // Find matching interaction
    const interaction = node.interactions.find(i => i.trigger === trigger);
    if (!interaction) return;
    
    // Execute interaction after delay
    const delay = interaction.delay || 0;
    setTimeout(() => {
      this.executeInteraction(flowId, interaction);
    }, delay);
  }
  
  /**
   * Execute an interaction action
   */
  private executeInteraction(flowId: string, interaction: Interaction): void {
    switch (interaction.action) {
      case 'NAVIGATE':
        if (interaction.destinationId) {
          this.navigateTo(flowId, interaction.destinationId, interaction.animation);
        }
        break;
      case 'BACK':
        this.navigateBack(flowId, interaction.animation);
        break;
      case 'OPEN_OVERLAY':
        // Would open destination as overlay
        console.log('Open overlay:', interaction.destinationId);
        break;
      case 'CLOSE_OVERLAY':
        // Would close current overlay
        console.log('Close overlay');
        break;
      default:
        console.warn('Unsupported action:', interaction.action);
    }
  }
  
  /**
   * Navigate to a specific node
   */
  private navigateTo(
    flowId: string,
    destinationId: string,
    animation?: AnimationConfig
  ): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;
    
    const destination = flow.nodes.get(destinationId);
    if (!destination) {
      console.error(`Destination ${destinationId} not found`);
      return;
    }
    
    if (!this.currentNodeId) return;
    
    // Add to history
    this.navigationHistory.push(destinationId);
    
    // Start transition
    if (animation && animation.type !== 'INSTANT') {
      this.startTransition(this.currentNodeId, destinationId, animation);
    } else {
      this.currentNodeId = destinationId;
    }
  }
  
  /**
   * Navigate back in history
   */
  private navigateBack(flowId: string, animation?: AnimationConfig): void {
    if (this.navigationHistory.length < 2) return;
    
    // Remove current from history
    this.navigationHistory.pop();
    const previousId = this.navigationHistory[this.navigationHistory.length - 1];
    
    if (!this.currentNodeId) return;
    
    // Start transition
    if (animation && animation.type !== 'INSTANT') {
      this.startTransition(this.currentNodeId, previousId, animation);
    } else {
      this.currentNodeId = previousId;
    }
  }
  
  /**
   * Start an animated transition
   */
  private startTransition(
    fromNodeId: string,
    toNodeId: string,
    animation: AnimationConfig
  ): void {
    this.activeTransition = {
      fromNodeId,
      toNodeId,
      animation,
      startTime: Date.now(),
      progress: 0,
    };
    
    this.animateTransition();
  }
  
  /**
   * Animate transition frame by frame
   */
  private animateTransition(): void {
    if (!this.activeTransition) return;
    
    const elapsed = Date.now() - this.activeTransition.startTime;
    const progress = Math.min(elapsed / this.activeTransition.animation.duration, 1);
    
    // Apply easing
    this.activeTransition.progress = this.applyEasing(
      progress,
      this.activeTransition.animation.easing
    );
    
    if (progress >= 1) {
      // Transition complete
      this.currentNodeId = this.activeTransition.toNodeId;
      this.activeTransition = null;
      return;
    }
    
    // Continue animation
    this.animationFrameId = requestAnimationFrame(() => this.animateTransition());
  }
  
  /**
   * Apply easing function to progress
   */
  private applyEasing(t: number, easing: EasingType): number {
    switch (easing) {
      case 'LINEAR':
        return t;
      case 'EASE_IN':
        return t * t;
      case 'EASE_OUT':
        return t * (2 - t);
      case 'EASE_IN_OUT':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'EASE_IN_BACK':
        const c1 = 1.70158;
        return t * t * ((c1 + 1) * t - c1);
      case 'EASE_OUT_BACK':
        const c2 = 1.70158;
        const t2 = t - 1;
        return t2 * t2 * ((c2 + 1) * t2 + c2) + 1;
      case 'EASE_IN_OUT_BACK':
        const c3 = 1.70158 * 1.525;
        const t3 = t * 2;
        if (t3 < 1) {
          return 0.5 * (t3 * t3 * ((c3 + 1) * t3 - c3));
        }
        const t4 = t3 - 2;
        return 0.5 * (t4 * t4 * ((c3 + 1) * t4 + c3) + 2);
      default:
        return t;
    }
  }
  
  /**
   * Get current node
   */
  getCurrentNode(flowId: string): PrototypeNode | null {
    if (!this.currentNodeId) return null;
    const flow = this.flows.get(flowId);
    return flow?.nodes.get(this.currentNodeId) || null;
  }
  
  /**
   * Get active transition state
   */
  getTransitionState(): TransitionState | null {
    return this.activeTransition;
  }
  
  /**
   * Calculate smart animate properties
   * Finds matching nodes between frames and generates interpolated values
   */
  calculateSmartAnimate(
    fromNodeId: string,
    toNodeId: string,
    progress: number
  ): Map<string, Record<string, any>> {
    // In a real implementation, this would:
    // 1. Match nodes between frames by ID or name
    // 2. Calculate interpolated positions, sizes, colors, etc.
    // 3. Return a map of node IDs to interpolated properties
    
    const interpolatedProperties = new Map<string, Record<string, any>>();
    
    // Example: interpolate position and opacity
    // This is a simplified version - real implementation would be more sophisticated
    
    return interpolatedProperties;
  }
  
  /**
   * Cleanup
   */
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

/**
 * Helper to create default animation config
 */
export function createAnimation(
  type: AnimationType = 'SMART_ANIMATE',
  duration: number = 300,
  easing: EasingType = 'EASE_IN_OUT'
): AnimationConfig {
  return { type, duration, easing };
}

/**
 * Helper to create an interaction
 */
export function createInteraction(
  trigger: InteractionType,
  action: NavigationType,
  options?: {
    destinationId?: string;
    animation?: AnimationConfig;
    delay?: number;
    hoverProperties?: Record<string, any>;
  }
): Omit<Interaction, 'id'> {
  return {
    trigger,
    action,
    destinationId: options?.destinationId,
    animation: options?.animation,
    delay: options?.delay,
    hoverProperties: options?.hoverProperties,
  };
}

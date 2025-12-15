/**
 * Figma Canvas Engine - Feature Index
 * 
 * This file exports all the main features of the simplified Figma-style canvas engine.
 */

// Auto Layout Feature
export {
  AutoLayoutEngine,
  type LayoutDirection,
  type AlignItems,
  type AlignContent,
  type ConstraintType,
  type Constraints,
  type AutoLayoutConfig,
  type LayoutNode,
  type LayoutResult,
  type FrameSize,
} from '../auto-layout/AutoLayoutEngine';

export {
  useAutoLayout,
  useConstraints,
  createDefaultAutoLayoutConfig,
  createLayoutNode,
  type UseAutoLayoutOptions,
  type UseAutoLayoutResult,
} from '../auto-layout/useAutoLayout';

// Component System Feature
export {
  ComponentRegistry,
  componentRegistry,
  type PropertyType,
  type PropertyDefinition,
  type VariantProperty,
  type ComponentVariant,
  type ComponentNode,
  type ComponentDefinition,
  type ComponentInstance,
  type ComponentOverride,
} from '../components/ComponentRegistry';

export {
  createComponent,
  createNode,
  createVariant,
  createProperty,
  createButtonComponent,
  createCardComponent,
} from '../components/componentHelpers';

export {
  useComponentInstance,
  useComponentInstances,
  useComponentRegistry,
  type UseComponentInstanceOptions,
  type UseComponentInstanceResult,
} from '../components/useComponentInstance';

// Prototyping Feature
export {
  PrototypeEngine,
  createAnimation,
  createInteraction,
  type InteractionType,
  type NavigationType,
  type AnimationType,
  type EasingType,
  type AnimationConfig,
  type Interaction,
  type PrototypeNode,
  type PrototypeFlow,
  type TransitionState,
} from '../prototype/PrototypeEngine';

export {
  usePrototype,
  useHoverInteraction,
  useSmartAnimate,
  type UsePrototypeOptions,
  type UsePrototypeResult,
} from '../prototype/usePrototype';

// Example Components
export { AutoLayoutExample } from '../../components/AutoLayoutExample';
export { ComponentExample } from '../../components/ComponentExample';
export { PrototypeExample } from '../../components/PrototypeExample';

# Figma-Style Canvas Engine

A simplified, modular Figma-style canvas engine built with TypeScript and React. This engine provides three core features: Auto Layout, Component System with Variants, and Prototyping with Interactions.

## 🎯 Features

### 1️⃣ Auto Layout + Constraints

A complete layout engine similar to Figma's Auto Layout system.

**Features:**
- Horizontal and vertical layout directions
- Flexible padding, gap, and alignment controls
- Multiple alignment options (start, center, end, space-between)
- Constraint system (left, right, top, bottom, center, scale)
- Auto-resizing frames based on children
- Flex-grow support for expanding elements
- Min/max width and height constraints

**Files:**
- `lib/auto-layout/AutoLayoutEngine.ts` - Pure layout calculation engine
- `lib/auto-layout/useAutoLayout.ts` - React hook for auto-layout
- `components/AutoLayoutExample.tsx` - Live examples

**Usage:**
```typescript
import { useAutoLayout, createDefaultAutoLayoutConfig, createLayoutNode } from '@/lib/auto-layout/useAutoLayout';

const { layout, frameSize, updateConfig } = useAutoLayout({
  config: createDefaultAutoLayoutConfig({
    layoutMode: 'HORIZONTAL',
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 16,
    itemSpacing: 12,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  }),
  children: [
    createLayoutNode('item1', 100, 40),
    createLayoutNode('item2', 120, 40, { layoutGrow: 1 }),
  ],
  autoResize: true,
});
```

### 2️⃣ Component System + Variants

A reusable component system with variant support, similar to Figma's components.

**Features:**
- Define master components with base structure
- Multiple variants per component (e.g., primary/secondary, enabled/disabled)
- Property overrides at instance level
- Component instances maintain link to master
- Clone instances with all settings
- Automatic property resolution (base + variant + overrides)

**Files:**
- `lib/components/ComponentRegistry.ts` - Component registry and management
- `lib/components/componentHelpers.ts` - Helper functions for creating components
- `lib/components/useComponentInstance.ts` - React hook for component instances
- `components/ComponentExample.tsx` - Live examples

**Usage:**
```typescript
import { createButtonComponent } from '@/lib/components/componentHelpers';
import { useComponentInstance } from '@/lib/components/useComponentInstance';

// Create a button component with variants
const buttonComponent = createButtonComponent();

// Use an instance
const { instance, resolvedNode, setVariant, applyOverride } = useComponentInstance({
  componentId: buttonComponent.id,
  variantId: 'primary',
});

// Switch variant
setVariant('secondary');

// Apply override
applyOverride('button-text', 'text', 'Custom Text');
```

**Built-in Components:**
- **Button**: 4 variants (Primary, Secondary, Outline, Disabled)
- **Card**: 3 variants (Default, Elevated, Outlined)

### 3️⃣ Prototyping + Interactions

Interactive prototyping with animations and transitions.

**Features:**
- Click interactions with frame navigation
- Hover states with smooth transitions
- Multiple animation types (Instant, Dissolve, Smart Animate, Slide, etc.)
- Easing functions (Linear, Ease In/Out, Back, etc.)
- Navigation history with back support
- Interaction delays
- Overlay support (open/close)
- Transition progress tracking

**Files:**
- `lib/prototype/PrototypeEngine.ts` - Core prototyping engine
- `lib/prototype/usePrototype.ts` - React hooks for prototyping
- `components/PrototypeExample.tsx` - Interactive demo

**Usage:**
```typescript
import { usePrototype, createAnimation, createInteraction } from '@/lib/prototype/usePrototype';

const { engine, currentNode, trigger, createFlow, addNode } = usePrototype();

// Create a flow
const flow = createFlow('App Navigation');

// Add nodes
addNode(flow.id, {
  id: 'home',
  name: 'Home Screen',
  interactions: [],
  isStartingFrame: true,
});

// Add interaction
engine.addInteraction(flow.id, 'home', 
  createInteraction('ON_CLICK', 'NAVIGATE', {
    destinationId: 'profile',
    animation: createAnimation('SMART_ANIMATE', 400, 'EASE_IN_OUT'),
  })
);

// Trigger interaction
trigger('home', 'ON_CLICK');
```

**Supported Interactions:**
- `ON_CLICK` - Click to navigate
- `ON_HOVER` - Hover state changes
- `WHILE_HOVERING` - Continuous hover effect
- `ON_PRESS` - Press/touch interaction

**Animation Types:**
- `INSTANT` - No animation
- `DISSOLVE` - Fade transition
- `SMART_ANIMATE` - Automatically animate matching elements
- `MOVE_IN/OUT` - Slide animations
- `PUSH` - Push transition
- `SLIDE_IN/OUT` - Directional slides

## 📁 Project Structure

```
lib/
├── auto-layout/
│   ├── AutoLayoutEngine.ts        # Pure layout calculation logic
│   └── useAutoLayout.ts            # React hook for auto-layout
├── components/
│   ├── ComponentRegistry.ts        # Component management system
│   ├── componentHelpers.ts         # Helper functions
│   └── useComponentInstance.ts     # React hook for instances
├── prototype/
│   ├── PrototypeEngine.ts          # Prototyping engine
│   └── usePrototype.ts             # React hooks for prototyping
└── canvas-engine/
    └── index.ts                    # Main export file

components/
├── AutoLayoutExample.tsx           # Auto-layout examples
├── ComponentExample.tsx            # Component system examples
└── PrototypeExample.tsx            # Prototyping examples
```

## 🚀 Getting Started

### Installation

The code is already integrated into your Next.js project. Import from the lib directory:

```typescript
// Import everything
import * from '@/lib/canvas-engine';

// Or import specific features
import { useAutoLayout } from '@/lib/auto-layout/useAutoLayout';
import { useComponentInstance } from '@/lib/components/useComponentInstance';
import { usePrototype } from '@/lib/prototype/usePrototype';
```

### Running Examples

To see the examples in action, create a page that imports the example components:

```typescript
// app/canvas-demo/page.tsx
import { AutoLayoutExample } from '@/components/AutoLayoutExample';
import { ComponentExample } from '@/components/ComponentExample';
import { PrototypeExample } from '@/components/PrototypeExample';

export default function CanvasDemoPage() {
  return (
    <div>
      <AutoLayoutExample />
      <ComponentExample />
      <PrototypeExample />
    </div>
  );
}
```

## 🎨 Code Architecture

### Design Principles

1. **Separation of Concerns**: Pure logic in engine files, React-specific code in hooks
2. **Type Safety**: Full TypeScript typing throughout
3. **Modularity**: Each feature is independent and can be used separately
4. **Composability**: Features can be combined (e.g., auto-layout with components)
5. **Performance**: Efficient calculations with memoization and requestAnimationFrame

### Key Patterns

**Pure Logic Layer:**
- `AutoLayoutEngine` - Pure layout calculations
- `ComponentRegistry` - Component management without React
- `PrototypeEngine` - Prototyping logic

**React Integration Layer:**
- `useAutoLayout` - React state management for layouts
- `useComponentInstance` - React hooks for component instances
- `usePrototype` - React hooks for prototyping

**Example Layer:**
- Visual demonstrations of each feature
- Interactive controls
- Debug information panels

## 🔧 Advanced Usage

### Combining Features

You can combine all three features to create rich interactive designs:

```typescript
// Auto-layout frame with component instances that have interactions
const frame = useAutoLayout({
  config: { layoutMode: 'VERTICAL', itemSpacing: 16 },
  children: componentInstances,
  autoResize: true,
});

const button = useComponentInstance({
  componentId: buttonComponentId,
  variantId: 'primary',
});

const { trigger } = usePrototype();

// Render button with interaction
<div onClick={() => trigger(buttonNode.id, 'ON_CLICK')}>
  <ComponentRenderer node={button.resolvedNode} />
</div>
```

### Custom Components

Create your own component library:

```typescript
import { createComponent, createNode, createVariant } from '@/lib/components/componentHelpers';

const myComponent = createComponent('CustomCard', baseNode, {
  description: 'My custom card component',
  properties: [
    { name: 'title', type: 'string', defaultValue: 'Title' },
    { name: 'color', type: 'color', defaultValue: '#ffffff' },
  ],
  variants: [
    createVariant('Light', { 'root.backgroundColor': '#ffffff' }),
    createVariant('Dark', { 'root.backgroundColor': '#1f2937' }),
  ],
});
```

### Custom Animations

Create custom easing functions:

```typescript
const customAnimation: AnimationConfig = {
  type: 'SMART_ANIMATE',
  duration: 600,
  easing: 'EASE_IN_OUT_BACK', // Bouncy animation
  direction: 'LEFT',
};
```

## 📝 API Reference

### Auto Layout

**AutoLayoutEngine**
- `calculate()` - Calculate layout for children
- `calculateFrameSize()` - Calculate auto frame size
- `applyConstraints()` - Apply constraints on resize

**useAutoLayout()**
- Returns: `{ layout, frameSize, updateConfig, updateChild, addChild, removeChild }`

### Components

**ComponentRegistry**
- `registerComponent()` - Register a component
- `createInstance()` - Create an instance
- `resolveInstance()` - Resolve final properties
- `applyVariant()` - Apply variant to instance
- `applyOverride()` - Apply property override

**useComponentInstance()**
- Returns: `{ instance, resolvedNode, setVariant, applyOverride, clone }`

### Prototyping

**PrototypeEngine**
- `createFlow()` - Create a prototype flow
- `addNode()` - Add node to flow
- `addInteraction()` - Add interaction to node
- `triggerInteraction()` - Trigger an interaction
- `startFlow()` - Start the flow

**usePrototype()**
- Returns: `{ currentNode, transition, trigger, startFlow, createFlow }`

## 🎯 Next Steps

1. **Extend Auto Layout**: Add wrapping, absolute positioning
2. **Enhance Components**: Add more built-in components (Input, Checkbox, etc.)
3. **Advanced Prototyping**: Add variables, conditional logic, data binding
4. **Canvas Integration**: Integrate with your existing canvas renderer
5. **Performance**: Add virtualization for large canvases
6. **Persistence**: Save/load designs to/from JSON

## 📄 License

Part of the mint_web project.

## 🤝 Contributing

This is a modular system designed to be extended. Each feature is independent and can be enhanced separately.

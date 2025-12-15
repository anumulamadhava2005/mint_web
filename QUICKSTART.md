# Quick Start Guide - Figma Canvas Engine

Get up and running with the canvas engine in 5 minutes!

## 🚀 Instant Demo

Visit the demo page to see everything in action:

```bash
npm run dev
# Navigate to: http://localhost:3000/canvas-demo
```

## 📦 Installation

The engine is already installed in your project. No additional dependencies needed!

## 🎯 Basic Usage

### 1. Auto Layout (5 lines)

```typescript
import { useAutoLayout, createDefaultAutoLayoutConfig, createLayoutNode } from '@/lib/auto-layout/useAutoLayout';

function MyComponent() {
  const { layout } = useAutoLayout({
    config: createDefaultAutoLayoutConfig({ layoutMode: 'HORIZONTAL', itemSpacing: 16 }),
    children: [
      createLayoutNode('item1', 100, 40),
      createLayoutNode('item2', 100, 40),
    ],
  });
  
  return (
    <div>
      {layout.map(item => (
        <div key={item.id} style={{ left: item.x, top: item.y, width: item.width, height: item.height }} />
      ))}
    </div>
  );
}
```

### 2. Components with Variants (3 lines)

```typescript
import { createButtonComponent } from '@/lib/components/componentHelpers';
import { useComponentInstance } from '@/lib/components/useComponentInstance';

function MyButton() {
  const button = createButtonComponent(); // Create once
  const instance = useComponentInstance({ componentId: button.id, variantId: 'primary' });
  
  return <YourRenderer node={instance.resolvedNode} />;
}
```

### 3. Interactive Prototyping (4 lines)

```typescript
import { usePrototype, createAnimation, createInteraction } from '@/lib/prototype/usePrototype';

function MyPrototype() {
  const { trigger, createFlow, addNode, engine } = usePrototype();
  
  useEffect(() => {
    const flow = createFlow('App');
    addNode(flow.id, { id: 'home', name: 'Home', interactions: [], isStartingFrame: true });
    engine.addInteraction(flow.id, 'home', 
      createInteraction('ON_CLICK', 'NAVIGATE', {
        destinationId: 'profile',
        animation: createAnimation('SMART_ANIMATE', 300),
      })
    );
  }, []);
  
  return <button onClick={() => trigger('home', 'ON_CLICK')}>Navigate</button>;
}
```

## 🧪 Try These Examples

### Example 1: Button that Grows with Text

```typescript
import { useAutoLayout } from '@/lib/auto-layout/useAutoLayout';
import { useState } from 'react';

function GrowingButton() {
  const [text, setText] = useState('Click me');
  
  const { layout, frameSize } = useAutoLayout({
    config: {
      layoutMode: 'HORIZONTAL',
      paddingTop: 12,
      paddingRight: 24,
      paddingBottom: 12,
      paddingLeft: 24,
      itemSpacing: 8,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    },
    children: [
      { id: 'icon', width: 20, height: 20, constraints: { horizontal: 'MIN', vertical: 'CENTER' } },
      { id: 'text', width: text.length * 8, height: 20, constraints: { horizontal: 'MIN', vertical: 'CENTER' } },
    ],
    autoResize: true,
  });
  
  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <div style={{ width: frameSize.width, height: frameSize.height, background: 'blue' }}>
        {layout.map(item => (
          <div key={item.id} style={{
            position: 'absolute',
            left: item.x,
            top: item.y,
            width: item.width,
            height: item.height,
          }}>
            {item.id === 'icon' ? '⭐' : text}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 2: Button with Hover Effect

```typescript
import { useHoverInteraction } from '@/lib/prototype/usePrototype';

function HoverButton() {
  const { hoverProps, isHovering } = useHoverInteraction('btn', {
    scale: 1.1,
    shadow: 20,
  });
  
  return (
    <button
      {...hoverProps}
      style={{
        transform: isHovering ? 'scale(1.1)' : 'scale(1)',
        boxShadow: isHovering ? '0 10px 20px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.2s',
      }}
    >
      Hover Me
    </button>
  );
}
```

### Example 3: Multi-Screen Prototype

```typescript
import { usePrototype } from '@/lib/prototype/usePrototype';
import { useEffect } from 'react';

function AppPrototype() {
  const prototype = usePrototype();
  
  useEffect(() => {
    const flow = prototype.createFlow('MyApp');
    
    // Add screens
    ['home', 'profile', 'settings'].forEach((screen, index) => {
      prototype.addNode(flow.id, {
        id: screen,
        name: screen.charAt(0).toUpperCase() + screen.slice(1),
        interactions: [],
        isStartingFrame: index === 0,
      });
    });
    
    // Add navigation
    prototype.engine.addInteraction(flow.id, 'home', {
      trigger: 'ON_CLICK',
      action: 'NAVIGATE',
      destinationId: 'profile',
      animation: { type: 'SMART_ANIMATE', duration: 300, easing: 'EASE_IN_OUT' },
    });
    
    prototype.startFlow(flow.id);
  }, []);
  
  const currentScreen = prototype.currentNode?.id || 'home';
  
  return (
    <div>
      <h1>Current: {currentScreen}</h1>
      <button onClick={() => prototype.trigger('home', 'ON_CLICK')}>
        Go to Profile
      </button>
    </div>
  );
}
```

## 📚 Learn More

- **Full Documentation**: `CANVAS_ENGINE_README.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Interactive Demos**: `/canvas-demo` page
- **Source Code**: Explore `lib/` directory

## 🎨 Common Patterns

### Pattern 1: Combine Auto Layout + Components

```typescript
// Create a component with auto-layout
const card = createComponent('Card', baseNode, { /* ... */ });

// Use it with auto-layout
const { layout } = useAutoLayout({
  config: { layoutMode: 'VERTICAL', itemSpacing: 16 },
  children: componentInstances.map(inst => ({
    id: inst.id,
    width: inst.size.width,
    height: inst.size.height,
  })),
});
```

### Pattern 2: Components + Prototyping

```typescript
// Button that changes variant on click
const button = useComponentInstance({ componentId, variantId: 'default' });

<div onClick={() => {
  button.setVariant('pressed');
  setTimeout(() => button.setVariant('default'), 100);
}}>
  <Renderer node={button.resolvedNode} />
</div>
```

### Pattern 3: All Three Together

```typescript
function DesignTool() {
  const layout = useAutoLayout({ /* config */ });
  const button = useComponentInstance({ /* component */ });
  const prototype = usePrototype({ /* flow */ });
  
  // Layout manages positions
  // Components manage appearance
  // Prototype manages interactions
  
  return (
    <div onClick={() => prototype.trigger('node', 'ON_CLICK')}>
      {layout.layout.map(item => (
        <ComponentRenderer
          key={item.id}
          position={{ x: item.x, y: item.y }}
          node={button.resolvedNode}
        />
      ))}
    </div>
  );
}
```

## 🐛 Troubleshooting

**Q: Types not found?**
```typescript
// Use relative imports if @ alias doesn't work
import { useAutoLayout } from '../lib/auto-layout/useAutoLayout';
```

**Q: Components not updating?**
```typescript
// Make sure to use state updates from hooks
const { setVariant } = useComponentInstance({ /* ... */ });
setVariant('newVariant'); // This triggers re-render
```

**Q: Animations not smooth?**
```typescript
// Check animation duration and easing
createAnimation('SMART_ANIMATE', 300, 'EASE_IN_OUT'); // 300ms is usually smooth
```

## ✨ Tips

1. **Start Simple**: Try one feature at a time
2. **Use Examples**: Copy from `components/*Example.tsx`
3. **Read Comments**: Every function is documented
4. **Check Types**: TypeScript will guide you
5. **Visit Demo**: See everything working at `/canvas-demo`

## 🎉 You're Ready!

Start building your Figma-style design tool now! 🚀

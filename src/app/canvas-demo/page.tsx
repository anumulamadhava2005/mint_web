/**
 * Canvas Engine Demo Page
 * 
 * Showcases all three features of the Figma-style canvas engine.
 */

'use client';

import React, { useState } from 'react';
import { AutoLayoutExample } from '../../../components/AutoLayoutExample';
import { ComponentExample } from '../../../components/ComponentExample';
import { PrototypeExample } from '../../../components/PrototypeExample';

type DemoTab = 'autolayout' | 'components' | 'prototyping' | 'overview';

export default function CanvasEngineDemoPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Figma-Style Canvas Engine
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                TypeScript + React · Modular & Scalable
              </p>
            </div>
            
            <a
              href="/CANVAS_ENGINE_README.md"
              target="_blank"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              📖 Documentation
            </a>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-1">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              🎯 Overview
            </TabButton>
            <TabButton
              active={activeTab === 'autolayout'}
              onClick={() => setActiveTab('autolayout')}
            >
              📐 Auto Layout
            </TabButton>
            <TabButton
              active={activeTab === 'components'}
              onClick={() => setActiveTab('components')}
            >
              🧩 Components
            </TabButton>
            <TabButton
              active={activeTab === 'prototyping'}
              onClick={() => setActiveTab('prototyping')}
            >
              ⚡ Prototyping
            </TabButton>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'autolayout' && <AutoLayoutExample />}
        {activeTab === 'components' && <ComponentExample />}
        {activeTab === 'prototyping' && <PrototypeExample />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-8 py-6 text-center text-sm text-gray-600">
          <p>Built with ❤️ using TypeScript, React, and Next.js</p>
        </div>
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-6 py-3 font-medium transition-colors relative
        ${
          active
            ? 'text-blue-600'
            : 'text-gray-600 hover:text-gray-900'
        }
      `}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
      )}
    </button>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <div className="inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
          Production Ready
        </div>
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Build Design Tools Like Figma
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          A complete, modular canvas engine with Auto Layout, Component System, and Interactive Prototyping
        </p>
      </section>

      {/* Features Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FeatureCard
          icon="📐"
          title="Auto Layout"
          description="Flexbox-style layout engine with constraints, padding, gaps, and auto-resizing frames."
          features={[
            'Horizontal & Vertical layouts',
            'Flexible alignment options',
            'Constraint system (scale, center, edges)',
            'Auto-sizing based on children',
          ]}
        />
        
        <FeatureCard
          icon="🧩"
          title="Components & Variants"
          description="Reusable component system with variant support and property overrides."
          features={[
            'Master components with variants',
            'Property-based customization',
            'Instance overrides',
            'Component cloning',
          ]}
        />
        
        <FeatureCard
          icon="⚡"
          title="Interactive Prototyping"
          description="Add interactions, animations, and navigation flows to your designs."
          features={[
            'Click & hover interactions',
            'Smart animate transitions',
            'Multiple easing functions',
            'Navigation history',
          ]}
        />
      </section>

      {/* Architecture */}
      <section className="bg-white p-8 rounded-lg shadow">
        <h3 className="text-2xl font-bold mb-6">Clean Architecture</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold text-lg mb-3 text-blue-600">
              📦 Modular Structure
            </h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Independent feature modules</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Pure logic separated from React</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Fully typed with TypeScript</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Tree-shakeable exports</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-lg mb-3 text-purple-600">
              ⚡ Performance Optimized
            </h4>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Efficient layout calculations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Memoized React hooks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>RequestAnimationFrame for animations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Minimal re-renders</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="bg-white p-8 rounded-lg shadow">
        <h3 className="text-2xl font-bold mb-6">Quick Start</h3>
        
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">
              1. Import the features you need:
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`import { useAutoLayout } from '@/lib/auto-layout/useAutoLayout';
import { useComponentInstance } from '@/lib/components/useComponentInstance';
import { usePrototype } from '@/lib/prototype/usePrototype';`}
            </pre>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-600 mb-2">
              2. Use in your React components:
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`const { layout, frameSize } = useAutoLayout({
  config: {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    primaryAxisAlignItems: 'CENTER',
  },
  children: [...],
  autoResize: true,
});`}
            </pre>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard number="3" label="Core Features" />
        <StatCard number="12" label="TypeScript Files" />
        <StatCard number="100%" label="Type Coverage" />
        <StatCard number="0" label="Dependencies" />
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg text-white text-center">
        <h3 className="text-2xl font-bold mb-4">Ready to Build?</h3>
        <p className="text-lg mb-6 opacity-90">
          Explore the interactive demos above or read the full documentation
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/CANVAS_ENGINE_README.md"
            target="_blank"
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Read Documentation
          </a>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="px-6 py-3 bg-white/20 backdrop-blur text-white rounded-lg font-semibold hover:bg-white/30 transition-colors"
          >
            Try Demos
          </button>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  features,
}: {
  icon: string;
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 mb-4 text-sm">{description}</p>
      <ul className="space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <span className="text-green-500 mt-0.5">✓</span>
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow text-center">
      <div className="text-3xl font-bold text-blue-600 mb-1">{number}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

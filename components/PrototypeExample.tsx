/**
 * PrototypeExample.tsx
 * 
 * Interactive example demonstrating prototyping features:
 * - Click interactions with navigation
 * - Hover states with smooth transitions
 * - Smart animate between frames
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  usePrototype,
  useHoverInteraction,
  createAnimation,
  createInteraction,
  PrototypeNode,
} from '../lib/prototype/usePrototype';

export function PrototypeExample() {
  const prototype = usePrototype({ autoStart: false });
  const [flowId, setFlowId] = useState<string>('');
  
  // Initialize prototype flow
  useEffect(() => {
    // Create a simple app flow
    const flow = prototype.createFlow('Mobile App Flow', 'Example mobile app navigation');
    setFlowId(flow.id);
    
    // Create home screen
    const homeNode: PrototypeNode = {
      id: 'home',
      name: 'Home Screen',
      frameId: 'home-frame',
      interactions: [],
      isStartingFrame: true,
    };
    prototype.addNode(flow.id, homeNode);
    
    // Create profile screen
    const profileNode: PrototypeNode = {
      id: 'profile',
      name: 'Profile Screen',
      frameId: 'profile-frame',
      interactions: [],
    };
    prototype.addNode(flow.id, profileNode);
    
    // Create settings screen
    const settingsNode: PrototypeNode = {
      id: 'settings',
      name: 'Settings Screen',
      frameId: 'settings-frame',
      interactions: [],
    };
    prototype.addNode(flow.id, settingsNode);
    
    // Add interactions to home screen
    prototype.engine.addInteraction(flow.id, 'home', 
      createInteraction('ON_CLICK', 'NAVIGATE', {
        destinationId: 'profile',
        animation: createAnimation('SMART_ANIMATE', 400, 'EASE_IN_OUT'),
      })
    );
    
    // Add back interaction to profile
    prototype.engine.addInteraction(flow.id, 'profile',
      createInteraction('ON_CLICK', 'BACK', {
        animation: createAnimation('SMART_ANIMATE', 400, 'EASE_IN_OUT'),
      })
    );
    
    // Add navigation to settings
    prototype.engine.addInteraction(flow.id, 'home',
      createInteraction('ON_CLICK', 'NAVIGATE', {
        destinationId: 'settings',
        animation: createAnimation('SLIDE_IN', 300, 'EASE_OUT'),
      })
    );
    
    // Start the flow
    prototype.startFlow(flow.id);
  }, []);
  
  const currentScreen = prototype.currentNode?.id || 'home';
  const isTransitioning = prototype.isTransitioning;
  
  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Prototype & Interactions</h1>
      
      {/* Current State Info */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Prototype State</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Current Screen:</span>{' '}
            <span className="text-blue-600">{prototype.currentNode?.name || 'None'}</span>
          </div>
          <div>
            <span className="font-medium">Transitioning:</span>{' '}
            <span className={isTransitioning ? 'text-orange-600' : 'text-green-600'}>
              {isTransitioning ? 'Yes' : 'No'}
            </span>
          </div>
          {prototype.transition && (
            <div>
              <span className="font-medium">Progress:</span>{' '}
              <span>{(prototype.transition.progress * 100).toFixed(0)}%</span>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${prototype.transition.progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>
      
      {/* Interactive Prototype Viewer */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Interactive Prototype</h2>
        <p className="text-gray-600 mb-6">
          Click buttons to navigate between screens with smooth animations
        </p>
        
        <div className="flex justify-center">
          <div className="relative w-[375px] h-[667px] bg-gray-900 rounded-[40px] p-4 shadow-2xl">
            {/* Phone screen */}
            <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
              {/* Home Screen */}
              {currentScreen === 'home' && (
                <HomeScreen
                  onNavigateToProfile={() => flowId && prototype.trigger('home', 'ON_CLICK')}
                  onNavigateToSettings={() => flowId && prototype.trigger('home', 'ON_CLICK')}
                />
              )}
              
              {/* Profile Screen */}
              {currentScreen === 'profile' && (
                <ProfileScreen
                  onBack={() => flowId && prototype.trigger('profile', 'ON_CLICK')}
                />
              )}
              
              {/* Settings Screen */}
              {currentScreen === 'settings' && (
                <SettingsScreen
                  onBack={() => flowId && prototype.trigger('settings', 'ON_CLICK')}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      
      {/* Hover Interactions Demo */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Hover Interactions</h2>
        <p className="text-gray-600 mb-6">
          Hover over buttons to see smooth state transitions
        </p>
        
        <div className="flex gap-4 flex-wrap">
          <HoverButton variant="primary" />
          <HoverButton variant="secondary" />
          <HoverButton variant="success" />
          <HoverButton variant="danger" />
        </div>
      </section>
      
      {/* Smart Animate Demo */}
      <section className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Smart Animate</h2>
        <p className="text-gray-600 mb-6">
          Elements automatically animate between states
        </p>
        
        <SmartAnimateDemo />
      </section>
    </div>
  );
}

// Home Screen Component
function HomeScreen({
  onNavigateToProfile,
  onNavigateToSettings,
}: {
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
}) {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      <h1 className="text-2xl font-bold mb-8">Home</h1>
      
      <div className="flex-1 space-y-4">
        <button
          onClick={onNavigateToProfile}
          className="w-full py-4 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
        >
          View Profile
        </button>
        
        <button
          onClick={onNavigateToSettings}
          className="w-full py-4 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
        >
          Settings
        </button>
        
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Welcome!</h3>
          <p className="text-sm text-gray-600">
            This is a prototype demonstration. Click buttons to navigate.
          </p>
        </div>
      </div>
    </div>
  );
}

// Profile Screen Component
function ProfileScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      <button
        onClick={onBack}
        className="mb-6 text-blue-500 hover:text-blue-600 flex items-center gap-2"
      >
        <span>←</span> Back
      </button>
      
      <h1 className="text-2xl font-bold mb-8">Profile</h1>
      
      <div className="flex flex-col items-center">
        <div className="w-24 h-24 bg-blue-500 rounded-full mb-4" />
        <h2 className="text-xl font-semibold">John Doe</h2>
        <p className="text-gray-500">john@example.com</p>
        
        <div className="mt-8 w-full space-y-3">
          <div className="p-3 bg-gray-100 rounded-lg">
            <div className="text-sm text-gray-600">Posts</div>
            <div className="text-lg font-semibold">42</div>
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <div className="text-sm text-gray-600">Followers</div>
            <div className="text-lg font-semibold">1,234</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Screen Component
function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      <button
        onClick={onBack}
        className="mb-6 text-blue-500 hover:text-blue-600 flex items-center gap-2"
      >
        <span>←</span> Back
      </button>
      
      <h1 className="text-2xl font-bold mb-8">Settings</h1>
      
      <div className="space-y-4">
        <div className="p-4 border-b">
          <div className="font-semibold">Notifications</div>
          <div className="text-sm text-gray-500">Manage notification preferences</div>
        </div>
        <div className="p-4 border-b">
          <div className="font-semibold">Privacy</div>
          <div className="text-sm text-gray-500">Control your privacy settings</div>
        </div>
        <div className="p-4 border-b">
          <div className="font-semibold">Account</div>
          <div className="text-sm text-gray-500">Manage your account</div>
        </div>
      </div>
    </div>
  );
}

// Hover Button with interactions
function HoverButton({ variant }: { variant: 'primary' | 'secondary' | 'success' | 'danger' }) {
  const colors = {
    primary: { base: '#3b82f6', hover: '#2563eb' },
    secondary: { base: '#6b7280', hover: '#4b5563' },
    success: { base: '#10b981', hover: '#059669' },
    danger: { base: '#ef4444', hover: '#dc2626' },
  };
  
  const { hoverProps, isHovering } = useHoverInteraction('button', {
    scale: 1.05,
    shadowSize: 20,
  });
  
  return (
    <button
      {...hoverProps}
      className="px-6 py-3 rounded-lg font-semibold text-white transition-all duration-150"
      style={{
        backgroundColor: isHovering ? colors[variant].hover : colors[variant].base,
        transform: isHovering ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isHovering
          ? `0 10px 20px rgba(0,0,0,0.2)`
          : `0 2px 8px rgba(0,0,0,0.1)`,
      }}
    >
      {variant.charAt(0).toUpperCase() + variant.slice(1)}
    </button>
  );
}

// Smart Animate Demo
function SmartAnimateDemo() {
  const [state, setState] = useState<'A' | 'B'>('A');
  
  const positions = {
    A: { x: 0, y: 0, scale: 1, rotate: 0, color: '#3b82f6' },
    B: { x: 200, y: 100, scale: 1.5, rotate: 45, color: '#ef4444' },
  };
  
  const current = positions[state];
  
  return (
    <div className="space-y-6">
      <button
        onClick={() => setState(state === 'A' ? 'B' : 'A')}
        className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
      >
        Toggle State ({state})
      </button>
      
      <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
        <div
          className="absolute w-16 h-16 rounded-lg transition-all duration-500 ease-in-out"
          style={{
            backgroundColor: current.color,
            transform: `translate(${current.x}px, ${current.y}px) scale(${current.scale}) rotate(${current.rotate}deg)`,
            left: '50px',
            top: '50px',
          }}
        />
      </div>
      
      <div className="text-sm text-gray-600">
        <p>This demonstrates smart animate:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Position: ({current.x}, {current.y})</li>
          <li>Scale: {current.scale}x</li>
          <li>Rotation: {current.rotate}°</li>
          <li>Color: {current.color}</li>
        </ul>
      </div>
    </div>
  );
}

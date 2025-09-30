"use client";

import { useState, useEffect } from 'react';

interface HomeProps {
  onGetStarted: () => void;
}

export default function Home({ onGetStarted }: HomeProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" fill="#3B82F6"/>
            <rect x="14" y="3" width="7" height="7" rx="1" fill="#8B5CF6"/>
            <rect x="3" y="14" width="7" height="7" rx="1" fill="#EC4899"/>
            <rect x="14" y="14" width="7" height="7" rx="1" fill="#10B981"/>
          </svg>
          <span className="text-xl font-semibold tracking-tight">FigmaFlow</span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => window.location.href = "/api/auth/login"}
            className="px-5 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button 
            onClick={() => window.location.href = "/api/auth/login"}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center px-8 py-24 max-w-6xl mx-auto">
        <div className={`text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight tracking-tight">
            Turn Figma designs into
            <br />
            <span className="text-blue-500">clean, production code</span>
          </h1>
          
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            A powerful converter that transforms your Figma files into developer-ready code.
            Fast, accurate, and built for modern workflows.
          </p>

          <button
            onClick={() => window.location.href = "/api/auth/login"}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-base transition-colors"
          >
            Get Started
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-28 w-full">
          <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="w-11 h-11 mb-5 bg-blue-600/10 border border-blue-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-3">Fast Conversion</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Process entire Figma files in seconds. Our engine is optimized for speed without compromising quality.
            </p>
          </div>

          <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="w-11 h-11 mb-5 bg-purple-600/10 border border-purple-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-3">Precise Output</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Maintain design integrity with accurate spacing, typography, and styling that matches your Figma source.
            </p>
          </div>

          <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="w-11 h-11 mb-5 bg-green-600/10 border border-green-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-3">Multiple Formats</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Export to React, HTML, Vue, or other frameworks. Choose the format that fits your project requirements.
            </p>
          </div>
        </div>

        {/* Secondary CTA */}
        
      </main>

      {/* Footer */}
      <footer className="mt-24 py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
          <div className="mb-4 md:mb-0">
            © 2025 FigmaFlow. All rights reserved.
          </div>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
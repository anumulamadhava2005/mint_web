/**
 * AuthRedirect component
 * If user is not logged in (i.e. 'figma_access' cookie is missing),
 * clear localStorage and redirect to home.
 * 
 * FIXED: Preserve localStorage on refresh, only clear on actual logout
 */

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import React, { Fragment } from 'react';

export default function AuthRedirect(): React.ReactElement {
  const router = useRouter();
  const hasCheckedRef = useRef(false);
  const authCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only check once on mount to avoid repeated checks on re-renders
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    if (typeof document !== 'undefined') {
      const checkAuthStatus = () => {
        const hasCookie = document.cookie.includes('figma_access');
        const currentPath = window.location.pathname;

        // If no auth cookie and not already on home page, redirect to home
        if (!hasCookie && currentPath !== '/') {
          console.log('No authentication found - redirecting to home');
          
          // Keep essential data but clear session-specific items
          try {
            sessionStorage.clear();
          } catch (e) {
            console.warn('Failed to clear session storage:', e);
          }
          
          router.push('/');
          return;
        }
        
        // Cookie exists - update session timestamp
        console.log('Valid authentication found');
        localStorage.setItem('canvas-session-timestamp', Date.now().toString());
        
        // Dispatch event to notify that authentication is confirmed
        window.dispatchEvent(new CustomEvent('auth-confirmed', {
          detail: { authenticated: true }
        }));
      };

      // Small initial delay to allow Next.js hydration and cookie setting
      setTimeout(checkAuthStatus, 100);
    }

    // Cleanup timeout on unmount
    return () => {
      if (authCheckTimeoutRef.current) {
        clearTimeout(authCheckTimeoutRef.current);
      }
    };
  }, [router]);

  // Listen for manual logout events
  useEffect(() => {
    const handleLogout = () => {
      console.log('Manual logout detected - clearing all storage');
      
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
      
      // Reset the check flag so auth will be re-evaluated
      hasCheckedRef.current = false;
      
      router.replace('/');
    };

    window.addEventListener('logout', handleLogout);
    
    return () => {
      window.removeEventListener('logout', handleLogout);
    };
  }, [router]);

  return <Fragment />;
}
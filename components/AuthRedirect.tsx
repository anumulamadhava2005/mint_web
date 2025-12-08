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
      const checkAuthStatus = async () => {
        const hasCookie = document.cookie.includes('figma_access') || document.cookie.includes('figma_refresh');
        const currentPath = window.location.pathname;

        // If no auth cookie and not already on home page, redirect to home
        if (!hasCookie && currentPath !== '/') {
          console.log('No authentication found - redirecting to home');
          router.push('/');
          return;
        }
        
        if (hasCookie) {
          try {
            // Only make one auth check on initial load
            const response = await fetch('/api/figma/me');
            if (response.ok) {
              console.log('Valid authentication confirmed');
              localStorage.setItem('canvas-session-timestamp', Date.now().toString());
              window.dispatchEvent(new CustomEvent('auth-confirmed', {
                detail: { authenticated: true }
              }));
            } else if (response.status === 401) {
              console.log('Auth invalid - redirecting to home');
              router.push('/');
            }
          } catch (e) {
            console.warn('Auth check failed:', e);
          }
        }
      };

      // Small initial delay to allow Next.js hydration and cookie setting
      authCheckTimeoutRef.current = setTimeout(checkAuthStatus, 100);
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
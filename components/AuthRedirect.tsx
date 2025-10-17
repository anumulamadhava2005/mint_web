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

export default function AuthRedirect() {
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
        const hasStoredSession = localStorage.getItem('canvas-stage-state');
        const sessionTimestamp = localStorage.getItem('canvas-session-timestamp');
        
        // Check if stored session is recent (within last 24 hours)
        const isRecentSession = sessionTimestamp && 
          (Date.now() - parseInt(sessionTimestamp)) < 24 * 60 * 60 * 1000;

        console.log('Auth check:', {
          hasCookie,
          hasStoredSession: !!hasStoredSession,
          isRecentSession,
          timestamp: sessionTimestamp
        });

        if (!hasCookie) {
          // If we have recent session data, this is likely a refresh where cookie is being reestablished
          if (hasStoredSession && isRecentSession) {
            console.log('Preserving session data - likely a page refresh');
            
            // Set a longer timeout to check again for auth restoration
            authCheckTimeoutRef.current = setTimeout(() => {
              const recheckCookie = document.cookie.includes('figma_access');
              
              if (!recheckCookie) {
                console.warn('Cookie still not available after grace period. Session may have expired.');
                
                // Show warning but preserve data
                window.dispatchEvent(new CustomEvent('auth-warning', {
                  detail: { 
                    message: 'Your session may have expired. Please save your work and re-authenticate if needed.',
                    type: 'warning'
                  }
                }));
              } else {
                console.log('Cookie restored after grace period');
                // Update session timestamp since auth was confirmed
                localStorage.setItem('canvas-session-timestamp', Date.now().toString());
                
                // Dispatch confirmation event
                window.dispatchEvent(new CustomEvent('auth-confirmed', {
                  detail: { authenticated: true }
                }));
              }
            }, 2000); // 2 second grace period for cookie restoration
            
            return; // Don't redirect or clear - preserve user's work
          }
          
          // Only clear if there's no stored session OR it's very old
          if (!hasStoredSession || !isRecentSession) {
            console.log('No valid session found - clearing storage and redirecting');
            
            try {
              // Clear only auth-related data
              localStorage.removeItem('canvas-stage-state');
              localStorage.removeItem('canvas-session-timestamp');
              sessionStorage.clear();
            } catch (e) {
              console.warn('Failed to clear storage:', e);
            }
            
            router.replace('/');
          }
        } else {
          // Cookie exists - update session timestamp
          console.log('Valid authentication found');
          localStorage.setItem('canvas-session-timestamp', Date.now().toString());
          
          // Dispatch event to notify that authentication is confirmed
          window.dispatchEvent(new CustomEvent('auth-confirmed', {
            detail: { authenticated: true }
          }));
        }
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

  return null;
}
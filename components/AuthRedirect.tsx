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
        const currentPath = window.location.pathname;
        try {
          // Verify authentication via server (httpOnly cookies are not readable by JS)
          const response = await fetch('/api/figma/me', { credentials: 'include' });
          if (response.ok) {
            console.log('Valid authentication confirmed');
            localStorage.setItem('canvas-session-timestamp', Date.now().toString());
            window.dispatchEvent(new CustomEvent('auth-confirmed', {
              detail: { authenticated: true }
            }));
          } else if (response.status === 401) {
            if (currentPath !== '/') {
              console.log('Auth invalid - redirecting to home');
              router.push('/');
            }
          }
        } catch (e) {
          console.error('Auth check failed', e);
          if (currentPath !== '/') router.push('/');
        }
      };

      // Use a small delay to ensure cookies are set post-redirect back from OAuth
      authCheckTimeoutRef.current = setTimeout(checkAuthStatus, 50);
    }

    return () => {
      if (authCheckTimeoutRef.current) clearTimeout(authCheckTimeoutRef.current);
    };
  }, [router]);

  return <Fragment />;
}
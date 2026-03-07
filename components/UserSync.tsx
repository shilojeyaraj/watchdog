"use client";

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';

/**
 * Component to sync Clerk user with database after sign-in
 * Runs automatically when user is authenticated
 */
export function UserSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }

    // Sync user to database
    const syncUser = async () => {
      try {
        const response = await fetch('/api/users/sync', {
          method: 'POST',
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[UserSync] User synced:', data.userId);
        } else {
          // Get error details from response
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[UserSync] Failed to sync user:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
        }
      } catch (error) {
        console.error('[UserSync] Error syncing user:', error);
      }
    };

    syncUser();
  }, [user, isLoaded]);

  // This component doesn't render anything
  return null;
}

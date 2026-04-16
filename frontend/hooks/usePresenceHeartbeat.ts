'use client';

import { useEffect, useRef } from 'react';
import { presenceService } from '@/services/presenceService';
import { useAuthStore } from '@/store/useAuthStore';

export const usePresenceHeartbeat = () => {
  const { user, ready } = useAuthStore();
  const lastActiveRef = useRef<number>(0);

  useEffect(() => {
    if (!ready || !user) return undefined;
    let stopped = false;

    const markActive = () => {
      lastActiveRef.current = Date.now();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') markActive();
    };

    const sendHeartbeat = async () => {
      if (stopped) return;
      try {
        await presenceService.heartbeat(new Date(lastActiveRef.current).toISOString());
      } catch (error) {
        console.warn('Presence heartbeat failed', error);
      }
    };

    const goOffline = () => {
      if (stopped) return;
      stopped = true;
      presenceService.offline().catch((error) => {
        console.warn('Failed to mark offline', error);
      });
    };

    markActive();
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30_000);
    window.addEventListener('mousemove', markActive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('focus', markActive);
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', goOffline);

    return () => {
      goOffline();
      clearInterval(interval);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('focus', markActive);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', goOffline);
    };
  }, [ready, user]);
};

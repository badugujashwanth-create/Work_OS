'use client';

import { useEffect, useRef } from 'react';
import { workService } from '@/services/workService';
import { useAuthStore } from '@/store/useAuthStore';

const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const TICK_INTERVAL_MS = 30_000;

export const useWorkTimer = () => {
  const { user, ready } = useAuthStore();
  const startedRef = useRef(false);
  const lastActivityRef = useRef<number>(0);
  const statusRef = useRef<'active' | 'idle'>('active');

  useEffect(() => {
    if (!ready || !user) return undefined;
    let stopped = false;
    lastActivityRef.current = Date.now();

    const ensureStarted = async () => {
      if (startedRef.current || stopped) return;
      try {
        await workService.timerStart();
        startedRef.current = true;
      } catch (error) {
        console.warn('Failed to start work timer', error);
      }
    };

    const sendTick = async (status: 'active' | 'idle') => {
      if (stopped) return;
      try {
        await ensureStarted();
        await workService.timerTick({ status });
      } catch (error) {
        console.warn('Failed to tick work timer', error);
      }
    };

    const markActive = () => {
      lastActivityRef.current = Date.now();
      if (statusRef.current !== 'active') {
        statusRef.current = 'active';
        sendTick('active');
      }
    };

    const checkIdle = () => {
      const since = Date.now() - lastActivityRef.current;
      if (since >= IDLE_TIMEOUT_MS && statusRef.current !== 'idle') {
        statusRef.current = 'idle';
        sendTick('idle');
      }
    };

    ensureStarted().then(() => sendTick('active'));
    const tickInterval = setInterval(() => sendTick(statusRef.current), TICK_INTERVAL_MS);
    const idleInterval = setInterval(checkIdle, 5_000);

    window.addEventListener('mousemove', markActive);
    window.addEventListener('keydown', markActive);
    window.addEventListener('focus', markActive);

    return () => {
      stopped = true;
      clearInterval(tickInterval);
      clearInterval(idleInterval);
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('focus', markActive);
      workService.timerEnd({ status: statusRef.current }).catch(() => {});
    };
  }, [ready, user]);
};

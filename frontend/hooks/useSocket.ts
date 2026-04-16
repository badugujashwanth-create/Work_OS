'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSocketStore } from '@/store/useSocketStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'https://zettalogix-workos.onrender.com';
const HEARTBEAT_INTERVAL_MS = 30_000;
const ACTIVITY_THROTTLE_MS = 2_000;

export const useSocket = (userId?: string) => {
  const socketRef = useRef<Socket | null>(null);
  const setSocket = useSocketStore((state) => state.setSocket);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') {
      setSocket(null);
      return;
    }

    const token = localStorage.getItem('workhub-token');
    if (!token) {
      setSocket(null);
      return;
    }

    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token }
    });

    socketRef.current = socket;
    setSocket(socket);

    const heartbeat = setInterval(() => socket.emit('heartbeat'), HEARTBEAT_INTERVAL_MS);

    let lastActivity = 0;
    const activityHandler = () => {
      const now = Date.now();
      if (now - lastActivity < ACTIVITY_THROTTLE_MS) return;
      lastActivity = now;
      socket.emit('activity');
    };

    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('click', activityHandler);

    const handleVisibility = () => {
      if (!document.hidden) activityHandler();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    socket.on('connect_error', (error) => {
      console.warn('Socket failed to connect', error);
    });

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('click', activityHandler);
      document.removeEventListener('visibilitychange', handleVisibility);
      socket.disconnect();
      setSocket(null);
      socketRef.current = null;
    };
  }, [userId, setSocket]);

};

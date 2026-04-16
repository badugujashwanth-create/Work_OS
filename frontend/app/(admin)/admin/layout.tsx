'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useSocket } from '@/hooks/useSocket';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useAuthStore } from '@/store/useAuthStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, hydrate } = useAuthStore();
  const socketUserId = ready && user ? user._id : undefined;

  useSocket(socketUserId);
  usePresenceHeartbeat();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    if (!user || !['admin', 'manager'].includes(user.role)) router.replace('/dashboard');
  }, [user, ready, router]);

  if (!ready || !user || !['admin', 'manager'].includes(user.role))
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="admin" />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}

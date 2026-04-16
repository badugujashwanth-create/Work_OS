'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useSocket } from '@/hooks/useSocket';
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useWorkTimer } from '@/hooks/useWorkTimer';
import { useAuthStore } from '@/store/useAuthStore';
import { useWorkStore } from '@/store/useWorkStore';

const EMPLOYEE_ROLES = new Set(['employee', 'manager', 'hr', 'auditor']);

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, ready, hydrate } = useAuthStore();
  const { refresh } = useWorkStore();
  const socketUserId = ready && user ? user._id : undefined;

  useSocket(socketUserId);
  usePresenceHeartbeat();
  useWorkTimer();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!EMPLOYEE_ROLES.has(user.role)) {
      router.replace(user.role === 'admin' ? '/admin/dashboard' : '/login');
      return;
    }
    refresh();
  }, [user, ready, router, refresh]);

  if (!ready || !user || !EMPLOYEE_ROLES.has(user.role))
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="employee" />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}




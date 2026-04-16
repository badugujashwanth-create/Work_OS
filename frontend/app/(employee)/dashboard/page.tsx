'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import StatusBadge from '@/components/StatusBadge';
import TaskBoard from '@/components/TaskBoard';
import PermissionRequestModal from '@/components/PermissionRequestModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useWorkStore } from '@/store/useWorkStore';
import { notificationService } from '@/services/notificationService';
import { statusService } from '@/services/statusService';
import { workService } from '@/services/workService';
import { getCachedPermissionStatus } from '@/lib/permissionManager';
import { ActivityStatus, IEmployeeStatusRecord, INotification, IWorkdayTotals } from '@/types';

const TAB_DEFINITIONS = [
  { id: 'work', label: 'Work' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'mail', label: 'Company Mail' },
  { id: 'browser', label: 'Internal Browser' }
] as const;

const formatMinutes = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!minutes) return '0m';
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
};

const getIframeSource = (envKey: string, fallback: string) =>
  process.env[envKey] || fallback;

export default function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { tasks, fetch } = useTaskStore();
  const { session } = useWorkStore();
  const [status, setStatus] = useState<IEmployeeStatusRecord | null>(null);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [workTotals, setWorkTotals] = useState<IWorkdayTotals | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof TAB_DEFINITIONS)[number]['id']>('work');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(user._id);
    
    // Check if permissions have been requested
    const cached = getCachedPermissionStatus();
    // Show modal if no permissions have been cached yet
    if (!cached) {
      setShowPermissionModal(true);
    }
  }, [user, fetch]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    statusService
      .me()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => setStatus(null));

    const loadTotals = async () => {
      try {
        const totals = await workService.todayTotals();
        if (!cancelled) setWorkTotals(totals);
      } catch {
        if (!cancelled) setWorkTotals(null);
      }
    };
    loadTotals();
    const interval = setInterval(loadTotals, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    notificationService
      .list()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  const primaryStatus = (status?.status ?? 'offline') as ActivityStatus;
  const mailUrl = useMemo(
    () => getIframeSource('NEXT_PUBLIC_COMPANY_MAIL_URL', 'https://outlook.office.com/mail'),
    []
  );
  const browserUrl = useMemo(
    () => getIframeSource('NEXT_PUBLIC_INTERNAL_BROWSER_URL', 'https://www.workhub.com/tools'),
    []
  );

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'tasks':
        return <TaskBoard tasks={tasks} />;
      case 'mail':
        return (
          <iframe
            title="Company Mail"
            src={mailUrl}
            className="h-[520px] w-full rounded-2xl border border-slate-200 shadow-inner"
            loading="lazy"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          />
        );
      case 'browser':
        return (
          <iframe
            title="Internal Browser"
            src={browserUrl}
            className="h-[520px] w-full rounded-2xl border border-slate-200 shadow-inner"
            loading="lazy"
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
          />
        );
      default:
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Session status</p>
              <p className="text-2xl font-semibold text-slate-900">
                {session?.status === 'active' ? 'Active focus' : 'Idle tracking'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {session?.startTime
                  ? `Tracking since ${new Date(session.startTime).toLocaleTimeString()}`
                  : 'Your work timer begins as soon as you land here.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Focus minutes</p>
              <p className="text-3xl font-semibold text-slate-900">
                {formatMinutes(Math.round((workTotals?.activeMs || 0) / 60000))}
              </p>
              <p className="mt-2 text-sm text-slate-500">Idle auto-pauses after inactivity.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Idle time</p>
              <p className="text-3xl font-semibold text-slate-900">
                {workTotals?.idleMs ? `${Math.round(workTotals.idleMs / 60000)}m` : 'Fresh'}
              </p>
              <p className="mt-2 text-sm text-slate-500">We resume tracking as soon as you return.</p>
            </div>
          </div>
        );
    }
  }, [activeTab, browserUrl, mailUrl, session, tasks, workTotals]);

  const featuredTasks = tasks.slice(0, 3);

  return (
    <div className="space-y-6">
      <PermissionRequestModal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        employeeName={user?.name || 'Employee'}
      />
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
              <h1 className="text-2xl font-semibold text-slate-900">Unified workspace</h1>
            </div>
            <StatusBadge status={primaryStatus} label={primaryStatus} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Today Active Time</p>
              <p className="text-3xl font-semibold text-slate-900">
                {formatMinutes(Math.round((workTotals?.activeMs || 0) / 60000))}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {status?.sessionStart
                  ? `Session started ${new Date(status.sessionStart).toLocaleTimeString()}`
                  : 'Auto timer starts on login.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Today Idle Time</p>
              <p className="text-3xl font-semibold text-slate-900">
                {workTotals?.idleMs ? `${Math.round(workTotals.idleMs / 60000)}m` : 'Fresh'}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Idle time is captured automatically so you stay focused when you return.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            This workspace tracks only the signals inside Work OS. Content in iframes stays private to you.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Notifications</p>
          <div className="mt-4 space-y-3">
            {notifications.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
                No alerts. Your workspace is calm and ready.
              </p>
            )}
            {notifications.slice(0, 4).map((note) => (
              <div key={note._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{note.message}</p>
                <p className="text-xs text-slate-500">
                  {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <nav className="flex flex-wrap gap-3">
          {TAB_DEFINITIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'rounded-2xl border px-4 py-2 text-sm font-semibold transition',
                activeTab === tab.id
                  ? 'border-slate-900 bg-slate-900 text-white shadow'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="mt-6">{tabContent}</div>
      </section>
      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Assigned tasks</p>
              <h2 className="text-xl font-semibold text-slate-900">Top priorities</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">{tasks.length} total</span>
          </div>
          <div className="mt-5 space-y-4">
            {featuredTasks.length === 0 && (
              <p className="text-sm text-slate-500">You have no assigned tasks yet. Grab something from the backlog.</p>
            )}
            {featuredTasks.map((task) => (
              <div key={task._id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="font-semibold text-slate-900">{task.title}</p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{task.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Pulse snapshot</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Focus score</p>
              <p className="text-3xl font-semibold text-slate-900">{session?.focusScore ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live tasks</p>
              <p className="text-3xl font-semibold text-slate-900">
                {tasks.filter((task) => task.status !== 'done').length}
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-500">
            Activity tracking is limited to this dashboard. Work OS respects your privacy while keeping the team aligned.
          </p>
        </div>
      </section>
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Transparency</p>
            <h2 className="text-xl font-semibold text-slate-900">Why your status changed</h2>
          </div>
          <StatusBadge status={primaryStatus} label={primaryStatus} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Idle timer</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {workTotals?.idleMs ? `${Math.round(workTotals.idleMs / 60000)}m` : 'Fresh'}
            </p>
            <p className="text-xs text-slate-500">Auto-paused when idle.</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Working minutes</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatMinutes(Math.round((workTotals?.activeMs || 0) / 60000))}
            </p>
            <p className="text-xs text-slate-500">Tracked within Work OS only.</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Reason</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {status?.reason || (primaryStatus === 'idle' ? 'Idle due to inactivity' : 'Working within Work OS')}
            </p>
            <p className="text-xs text-slate-500">You control when the timer runs.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

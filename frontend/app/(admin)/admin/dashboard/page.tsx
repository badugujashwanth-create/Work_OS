'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import AlertList from '@/components/AlertList';
import StatusBadge from '@/components/StatusBadge';
import RealtimePresencePanel from '@/components/RealtimePresencePanel';
import { useAuthStore } from '@/store/useAuthStore';
import { usePresenceSync } from '@/hooks/usePresenceSync';
import { alertService } from '@/services/alertService';
import { reportService } from '@/services/reportService';
import { settingsService } from '@/services/settingsService';
import { statusService } from '@/services/statusService';
import {
  ActivityStatus,
  IActivityAlert,
  IEmployeeStatusSnapshot,
  IDailyActivityReport,
  ISystemSettings
} from '@/types';

type FilterKey = ActivityStatus | 'all';
const FILTERS: FilterKey[] = ['all', 'active', 'idle', 'offline'];
const STATUS_LABELS: Record<ActivityStatus, string> = {
  active: 'Working',
  idle: 'Idle',
  offline: 'Offline'
};

export default function AdminDashboard() {
  const { user, ready } = useAuthStore();
  const [snapshot, setSnapshot] = useState<IEmployeeStatusSnapshot | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(false);
  const [smartAlerts, setSmartAlerts] = useState<IActivityAlert[]>([]);
  const [dailyReport, setDailyReport] = useState<IDailyActivityReport | null>(null);
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  usePresenceSync();

  const canViewAnalytics = Boolean(user && ['admin', 'manager'].includes(user.role));

  useEffect(() => {
    if (canViewAnalytics) setAccessDenied(false);
  }, [canViewAnalytics, user?._id]);

  const loadStatuses = useCallback(async () => {
    if (!canViewAnalytics || accessDenied) return;
    setLoading(true);
    try {
      const data = await statusService.list();
      setSnapshot(data);
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 403) {
        setAccessDenied(true);
        setSnapshot(null);
        return;
      }
      console.error('Failed to load employee statuses', error);
    } finally {
      setLoading(false);
    }
  }, [accessDenied, canViewAnalytics]);

  useEffect(() => {
    if (!ready || !user || !canViewAnalytics || accessDenied) return;
    loadStatuses();
    const interval = setInterval(loadStatuses, 15000);
    return () => clearInterval(interval);
  }, [ready, user, canViewAnalytics, accessDenied, loadStatuses]);

  useEffect(() => {
    if (!ready || !user || !canViewAnalytics || accessDenied) return;
    alertService
      .list()
      .then(setSmartAlerts)
      .catch((error) => {
        if ((error as { response?: { status?: number } })?.response?.status === 403) {
          setAccessDenied(true);
          setSmartAlerts([]);
          return;
        }
        setSmartAlerts([]);
      });
    reportService
      .daily()
      .then(setDailyReport)
      .catch((error) => {
        if ((error as { response?: { status?: number } })?.response?.status === 403) {
          setAccessDenied(true);
          setDailyReport(null);
          return;
        }
        setDailyReport(null);
      });
    settingsService
      .getActivitySettings()
      .then(setSettings)
      .catch((error) => {
        if ((error as { response?: { status?: number } })?.response?.status === 403) {
          setAccessDenied(true);
          setSettings(null);
          return;
        }
        setSettings(null);
      });
  }, [ready, user, canViewAnalytics, accessDenied]);

  const filteredUsers = useMemo(() => {
    if (!snapshot) return [];
    if (filter === 'all') return snapshot.users;
    return snapshot.users.filter((entry) => entry.status === filter);
  }, [filter, snapshot]);

  const workingNow = useMemo(() => snapshot?.users.filter((entry) => entry.status === 'active') ?? [], [snapshot]);
  const idleTooLong = useMemo(
    () => snapshot?.users.filter((entry) => entry.status === 'idle' && entry.idleMinutes >= 5) ?? [],
    [snapshot]
  );

  const summaryCards = useMemo(() => {
    const totals = snapshot?.summary ?? { active: 0, idle: 0, offline: 0, onLeave: 0, absent: 0 };
    return [
      { label: 'Working now', value: totals.active, status: 'active' as ActivityStatus },
      { label: 'Active idle', value: totals.idle, status: 'idle' as ActivityStatus },
      { label: 'Offline', value: totals.offline, status: 'offline' as ActivityStatus }
    ];
  }, [snapshot]);

  const leaveSummary = useMemo(
    () => ({
      onLeave: snapshot?.summary?.onLeave ?? 0,
      absent: snapshot?.summary?.absent ?? 0
    }),
    [snapshot]
  );

  return (
    <div className="space-y-6">
      {accessDenied && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          Access denied. Sign in as an admin or manager to view live status, alerts, and reports.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.status} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{card.label}</p>
              <StatusBadge status={card.status} />
            </div>
            <p className="mt-4 text-4xl font-semibold text-slate-900">{card.value}</p>
            {snapshot?.updatedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Updated {new Date(snapshot.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">On leave</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{leaveSummary.onLeave}</p>
          <p className="mt-2 text-xs text-slate-500">Approved full-day leave today</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Absent</p>
          <p className="mt-4 text-4xl font-semibold text-slate-900">{leaveSummary.absent}</p>
          <p className="mt-2 text-xs text-slate-500">No leave and no work recorded</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr,1fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alert controls</p>
          <div className="mt-4 space-y-2 text-sm text-slate-900">
            <p className="flex items-center justify-between">
              Soft idle
              <span className="font-semibold">{settings?.idleAlertSoftMinutes ?? 15}m</span>
            </p>
            <p className="flex items-center justify-between">
              Hard idle
              <span className="font-semibold">{settings?.idleAlertAdminMinutes ?? 30}m</span>
            </p>
            <p className="text-xs text-slate-500">
              Work hours {settings?.workStartHour ?? 9}h — {settings?.workEndHour ?? 18}h
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Daily activity</p>
          {dailyReport ? (
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {[...dailyReport.users]
                .sort((a, b) => b.activeMinutes - a.activeMinutes)
                .slice(0, 3)
                .map((row) => (
                  <div key={row.user._id} className="flex items-center justify-between">
                    <span>{row.user.name}</span>
                    <span className="text-xs text-slate-500">
                      {row.activeMinutes}m active · {row.idleMinutes}m idle
                    </span>
                  </div>
                ))}
              <p className="text-xs text-slate-500">{dailyReport.workMinutes}m window total</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading today’s session data…</p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Smart alerts</p>
          <div className="mt-3 max-h-48 overflow-hidden">
            <AlertList alerts={smartAlerts.slice(0, 3)} />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>Live filters</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setFilter(candidate)}
                className={clsx(
                  'rounded-2xl border px-4 py-2 text-xs font-semibold transition',
                  candidate === filter
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-900'
                )}
              >
                {candidate === 'all' ? 'All employees' : STATUS_LABELS[candidate]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Employee</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Idle</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Today</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Session</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? 'Refreshing statuses…' : 'No employees match this filter.'}
                  </td>
                </tr>
              )}
              {filteredUsers.map((record) => (
                <tr key={record._id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{record.name}</p>
                    <p className="text-xs text-slate-500">{record.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.status} label={STATUS_LABELS[record.status]} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-slate-900">{record.idleMinutes}m</p>
                    <p className="text-xs text-slate-500">idle</p>
                  </td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(record.workingMinutes)}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{record.sessionStatus}</p>
                    {record.sessionStart && (
                      <p className="text-xs text-slate-500">
                        {new Date(record.sessionStart).toLocaleTimeString()}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <RealtimePresencePanel />
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Working now</p>
            {workingNow.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No active contributors right now.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {workingNow.slice(0, 4).map((person) => (
                  <div
                    key={person._id}
                    className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.role}</p>
                    </div>
                    <StatusBadge status="active" label="active" />
                  </div>
                ))}
                {workingNow.length > 4 && (
                  <p className="text-xs font-semibold text-slate-500">{`+${workingNow.length - 4} more active`}</p>
                )}
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Idle too long</p>
            {idleTooLong.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Everyone is responsive.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {idleTooLong.map((person) => (
                  <div
                    key={person._id}
                    className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{person.name}</p>
                      <p className="text-xs text-slate-500">{person.idleMinutes} minutes idle</p>
                    </div>
                    <StatusBadge status="idle" label="idle" />
                  </div>
                ))}
              </div>
            )}
            {snapshot?.summary && snapshot.summary.idle > 0 && (
              <p className="mt-3 text-xs text-slate-500">Idle threshold triggers after 5 minutes of inactivity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!minutes) return '0m';
  if (hours === 0) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
};

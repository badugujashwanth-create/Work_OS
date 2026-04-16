'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { leaveService } from '@/services/leaveService';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  ILeaveBalance,
  ILeaveRequest,
  ILeaveType,
  LeaveDurationType,
  LeaveRequestStatus
} from '@/types';
import { formatDateInput } from '@/lib/timesheet';

type LeaveFormState = {
  leaveTypeId: string;
  startAt: string;
  endAt: string;
  durationType: LeaveDurationType;
  hoursRequested: string;
  reason: string;
};

const STATUS_STYLES: Record<LeaveRequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-600'
};

const DURATION_LABELS: Record<LeaveDurationType, string> = {
  full_day: 'Full day',
  half_day: 'Half day',
  hours: 'Hours'
};

const hoursToDays = (hours: number) => Math.round((hours / 8) * 100) / 100;

export default function LeavePage() {
  const { user, ready } = useAuthStore();
  const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([]);
  const [balances, setBalances] = useState<ILeaveBalance[]>([]);
  const [requests, setRequests] = useState<ILeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState<LeaveFormState>(() => {
    const today = formatDateInput(new Date());
    return {
      leaveTypeId: '',
      startAt: today,
      endAt: today,
      durationType: 'full_day',
      hoursRequested: '',
      reason: ''
    };
  });

  const typeMap = useMemo(
    () => new Map(leaveTypes.map((type) => [type._id, type])),
    [leaveTypes]
  );

  const selectedType = form.leaveTypeId ? typeMap.get(form.leaveTypeId) : undefined;

  const loadLeaveData = useCallback(async () => {
    if (!ready || !user) return;
    setLoading(true);
    try {
      const [types, balancesData, requestsData] = await Promise.all([
        leaveService.listTypes(),
        leaveService.listBalances(),
        leaveService.listMyRequests()
      ]);
      setLeaveTypes(types);
      setBalances(balancesData);
      setRequests(requestsData);
      if (!form.leaveTypeId && types.length) {
        setForm((prev) => ({ ...prev, leaveTypeId: types[0]._id }));
      }
    } catch (error: any) {
      setActionError(error?.response?.data?.message || 'Failed to load leave data.');
    } finally {
      setLoading(false);
    }
  }, [ready, user, form.leaveTypeId]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  const requestedDays = useMemo(() => {
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const daySpan = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (daySpan <= 0) return 0;
    if (form.durationType === 'hours') {
      const hours = Number(form.hoursRequested);
      if (!Number.isFinite(hours) || hours <= 0) return 0;
      return hoursToDays(hours);
    }
    const multiplier = form.durationType === 'half_day' ? 0.5 : 1;
    return daySpan * multiplier;
  }, [form]);

  const handleSubmit = async () => {
    setFormError(null);
    setActionError(null);
    if (!form.leaveTypeId) {
      setFormError('Select a leave type.');
      return;
    }
    if (!form.startAt || !form.endAt) {
      setFormError('Select start and end dates.');
      return;
    }
    if (form.durationType === 'hours' && !form.hoursRequested) {
      setFormError('Enter hours requested.');
      return;
    }

    try {
      const payload = {
        leaveTypeId: form.leaveTypeId,
        startAt: form.startAt,
        endAt: form.endAt,
        durationType: form.durationType,
        hoursRequested: form.durationType === 'hours' ? Number(form.hoursRequested) : undefined,
        reason: form.reason
      };
      const created = await leaveService.createRequest(payload);
      setRequests((prev) => [created, ...prev]);
      setForm((prev) => ({
        ...prev,
        reason: '',
        hoursRequested: '',
        startAt: formatDateInput(new Date()),
        endAt: formatDateInput(new Date())
      }));
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Failed to submit leave request.');
    }
  };

  const cancelRequest = async (id: string) => {
    setActionError(null);
    try {
      const updated = await leaveService.cancelRequest(id);
      setRequests((prev) => prev.map((item) => (item._id === id ? updated : item)));
    } catch (error: any) {
      setActionError(error?.response?.data?.message || 'Failed to cancel leave request.');
    }
  };

  const formatRange = (start: string, end: string) => {
    const startLabel = new Date(start).toLocaleDateString();
    const endLabel = new Date(end).toLocaleDateString();
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  };

  const formatDuration = (request: ILeaveRequest) => {
    if (request.durationType === 'hours') {
      return `${request.hoursRequested || 0} hrs`;
    }
    return DURATION_LABELS[request.durationType];
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leave & PTO</p>
          <h1 className="text-2xl font-semibold text-slate-900">My leave requests</h1>
        </div>
        <div className="text-xs text-slate-500">
          {loading ? 'Refreshing...' : `${requests.length} requests`}
        </div>
      </header>

      {actionError && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {actionError}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Request leave</p>
            {selectedType && (
              <span className="text-xs text-slate-500">
                {selectedType.paid ? 'Paid leave' : 'Unpaid leave'}
              </span>
            )}
          </div>
          {formError && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {formError}
            </p>
          )}
          {leaveTypes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No leave types configured yet.</p>
          ) : (
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Leave type</label>
                  <select
                    value={form.leaveTypeId}
                    onChange={(event) => setForm((prev) => ({ ...prev, leaveTypeId: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  >
                    {leaveTypes.map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Duration</label>
                  <select
                    value={form.durationType}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        durationType: event.target.value as LeaveDurationType
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  >
                    {Object.entries(DURATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start date</label>
                  <input
                    type="date"
                    value={form.startAt}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        startAt: event.target.value,
                        endAt: event.target.value > prev.endAt ? event.target.value : prev.endAt
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">End date</label>
                  <input
                    type="date"
                    value={form.endAt}
                    onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </div>
              </div>
              {form.durationType === 'hours' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Hours requested</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.hoursRequested}
                    onChange={(event) => setForm((prev) => ({ ...prev, hoursRequested: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Requested: <span className="font-semibold text-slate-700">{requestedDays || 0} days</span>
                </p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm"
                >
                  Submit request
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leave balance</p>
          {balances.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Balances will appear once leave types are configured.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {balances.map((balance) => {
                const type =
                  typeof balance.leaveTypeId === 'string'
                    ? typeMap.get(balance.leaveTypeId)
                    : balance.leaveTypeId;
                return (
                  <div
                    key={balance._id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                      <span>{type?.name || 'Leave'}</span>
                      <span>{balance.remainingDays} days left</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {balance.usedDays} used of {balance.totalDays} total
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Request history</p>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Dates</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Type</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Duration</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? 'Loading requests...' : 'No leave requests yet.'}
                  </td>
                </tr>
              )}
              {requests.map((request) => {
                const type =
                  typeof request.leaveTypeId === 'string'
                    ? typeMap.get(request.leaveTypeId)
                    : request.leaveTypeId;
                const canCancel = request.status === 'pending';
                return (
                  <tr key={request._id} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-900">
                      {formatRange(request.startAt, request.endAt)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">{type?.name || 'Leave'}</td>
                    <td className="px-4 py-4 text-slate-700">{formatDuration(request)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          STATUS_STYLES[request.status]
                        )}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={!canCancel}
                        onClick={() => cancelRequest(request._id)}
                        className={clsx(
                          'rounded-full border px-3 py-1 text-xs font-semibold',
                          canCancel
                            ? 'border-rose-200 text-rose-700'
                            : 'border-slate-200 text-slate-400'
                        )}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

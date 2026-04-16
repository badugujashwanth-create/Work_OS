'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { adminLeaveService } from '@/services/adminLeaveService';
import { adminTeamService } from '@/services/adminTeamService';
import { leaveService } from '@/services/leaveService';
import { teamService } from '@/services/teamService';
import { useAuthStore } from '@/store/useAuthStore';
import type {
  ILeaveRequest,
  ILeaveType,
  LeaveDecisionStatus,
  LeaveRequestStatus
} from '@/types';

type TeamOption = { id: string; name: string };
type LeaveTypeForm = {
  name: string;
  paid: boolean;
  defaultAnnualDays: string;
  isActive: boolean;
};

const STATUS_OPTIONS: Array<{ value: 'all' | LeaveRequestStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' }
];

const statusBadge = (status: LeaveRequestStatus) =>
  ({
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
    cancelled: 'bg-slate-100 text-slate-600'
  })[status];

export default function AdminLeavePage() {
  const { user, ready } = useAuthStore();
  const [requests, setRequests] = useState<ILeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<ILeaveType[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveRequestStatus>('pending');
  const [teamFilter, setTeamFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState<LeaveTypeForm>({
    name: '',
    paid: true,
    defaultAnnualDays: '0',
    isActive: true
  });
  const [editingType, setEditingType] = useState<ILeaveType | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canView = isAdmin || isManager;

  const loadTeams = useCallback(async () => {
    if (!ready || !user) return;
    try {
      if (isAdmin) {
        const data = await adminTeamService.list();
        setTeams(data.map((team) => ({ id: team._id, name: team.name })));
        return;
      }
      const memberships = await teamService.myTeams();
      setTeams(memberships.map((member) => ({ id: member.team._id, name: member.team.name })));
    } catch {
      setTeams([]);
    }
  }, [ready, user, isAdmin]);

  const loadRequests = useCallback(async () => {
    if (!ready || !user || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        status: statusFilter === 'all' ? undefined : statusFilter,
        teamId: teamFilter === 'all' ? undefined : teamFilter
      };
      const data = await leaveService.listRequests(params);
      setRequests(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load leave requests.');
    } finally {
      setLoading(false);
    }
  }, [ready, user, canView, statusFilter, teamFilter]);

  const loadLeaveTypes = useCallback(async () => {
    if (!ready || !user || !isAdmin) return;
    try {
      const data = await adminLeaveService.listTypes();
      setLeaveTypes(data);
    } catch {
      setLeaveTypes([]);
    }
  }, [ready, user, isAdmin]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    loadLeaveTypes();
  }, [loadLeaveTypes]);

  const approveLabel = isManager ? 'Manager approve' : 'Admin approve';
  const rejectLabel = isManager ? 'Manager reject' : 'Admin reject';

  const handleDecision = async (request: ILeaveRequest, decision: LeaveDecisionStatus) => {
    setError(null);
    try {
      let updated: ILeaveRequest;
      if (isManager) {
        updated =
          decision === 'approved'
            ? await leaveService.managerApprove(request._id)
            : await leaveService.managerReject(request._id);
      } else {
        updated =
          decision === 'approved'
            ? await leaveService.adminApprove(request._id)
            : await leaveService.adminReject(request._id);
      }
      setRequests((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update leave request.');
    }
  };

  const openCreateType = () => {
    setEditingType(null);
    setTypeForm({ name: '', paid: true, defaultAnnualDays: '0', isActive: true });
    setTypeError(null);
    setShowTypeModal(true);
  };

  const openEditType = (type: ILeaveType) => {
    setEditingType(type);
    setTypeForm({
      name: type.name,
      paid: type.paid,
      defaultAnnualDays: String(type.defaultAnnualDays ?? 0),
      isActive: type.isActive ?? true
    });
    setTypeError(null);
    setShowTypeModal(true);
  };

  const saveLeaveType = async () => {
    setTypeError(null);
    if (!typeForm.name.trim()) {
      setTypeError('Name is required.');
      return;
    }
    const defaultAnnualDays = Number(typeForm.defaultAnnualDays);
    if (!Number.isFinite(defaultAnnualDays) || defaultAnnualDays < 0) {
      setTypeError('Default annual days must be a positive number.');
      return;
    }

    try {
      if (editingType) {
        const updated = await adminLeaveService.updateType(editingType._id, {
          name: typeForm.name.trim(),
          paid: typeForm.paid,
          defaultAnnualDays,
          isActive: typeForm.isActive
        });
        setLeaveTypes((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      } else {
        const created = await adminLeaveService.createType({
          name: typeForm.name.trim(),
          paid: typeForm.paid,
          defaultAnnualDays
        });
        setLeaveTypes((prev) => [created, ...prev]);
      }
      setShowTypeModal(false);
    } catch (err: any) {
      setTypeError(err?.response?.data?.message || 'Failed to save leave type.');
    }
  };

  const toggleTypeActive = async (type: ILeaveType) => {
    try {
      const updated = await adminLeaveService.updateType(type._id, { isActive: !(type.isActive ?? true) });
      setLeaveTypes((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err: any) {
      setTypeError(err?.response?.data?.message || 'Failed to update leave type.');
    }
  };

  const calendarItems = useMemo(() => {
    return [...requests]
      .filter((request) => request.status === 'approved')
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 6);
  }, [requests]);

  if (!canView) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800">
        Access denied. Admins and managers only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leave approvals</p>
          <h1 className="text-2xl font-semibold text-slate-900">Team leave queue</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | LeaveRequestStatus)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            <option value="all">All teams</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.3fr,0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Requests</p>
            {loading && <span className="text-xs text-slate-500">Loading...</span>}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Employee</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Dates</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Type</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Decisions</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                      {loading ? 'Loading requests...' : 'No leave requests found.'}
                    </td>
                  </tr>
                )}
                {requests.map((request) => {
                  const type =
                    typeof request.leaveTypeId === 'string'
                      ? leaveTypes.find((item) => item._id === request.leaveTypeId)
                      : request.leaveTypeId;
                  const canAct = isManager
                    ? request.managerDecision === 'pending' && request.status === 'pending'
                    : request.adminDecision === 'pending' && request.status === 'pending';
                  return (
                    <tr key={request._id} className="border-t border-slate-100">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {typeof request.userId === 'string' ? 'Employee' : request.userId?.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {typeof request.userId === 'string' ? '' : request.userId?.email}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {new Date(request.startAt).toLocaleDateString()} -{' '}
                        {new Date(request.endAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{type?.name || 'Leave'}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        <p>Manager: {request.managerDecision}</p>
                        <p>Admin: {request.adminDecision}</p>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={clsx(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            statusBadge(request.status)
                          )}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!canAct}
                            onClick={() => handleDecision(request, 'approved')}
                            className={clsx(
                              'rounded-full border px-3 py-1 text-xs font-semibold',
                              canAct
                                ? 'border-emerald-200 text-emerald-700'
                                : 'border-slate-200 text-slate-400'
                            )}
                          >
                            {approveLabel}
                          </button>
                          <button
                            type="button"
                            disabled={!canAct}
                            onClick={() => handleDecision(request, 'rejected')}
                            className={clsx(
                              'rounded-full border px-3 py-1 text-xs font-semibold',
                              canAct
                                ? 'border-rose-200 text-rose-700'
                                : 'border-slate-200 text-slate-400'
                            )}
                          >
                            {rejectLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Calendar</p>
          {calendarItems.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No approved leave on the calendar yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {calendarItems.map((request) => (
                <div
                  key={request._id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {typeof request.userId === 'string' ? 'Employee' : request.userId?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(request.startAt).toLocaleDateString()} -{' '}
                    {new Date(request.endAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {isAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leave types</p>
            <button
              type="button"
              onClick={openCreateType}
              className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm"
            >
              New type
            </button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Name</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Paid</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Default</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      No leave types configured.
                    </td>
                  </tr>
                )}
                {leaveTypes.map((type) => (
                  <tr key={type._id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{type.name}</td>
                    <td className="px-4 py-4 text-slate-600">{type.paid ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-4 text-slate-600">{type.defaultAnnualDays ?? 0} days</td>
                    <td className="px-4 py-4">
                      <span
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          type.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {type.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditType(type)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTypeActive(type)}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-xs font-semibold',
                            type.isActive
                              ? 'border-rose-200 text-rose-700'
                              : 'border-emerald-200 text-emerald-700'
                          )}
                        >
                          {type.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {editingType ? 'Edit type' : 'Create type'}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingType ? editingType.name : 'New leave type'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            {typeError && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {typeError}
              </p>
            )}
            <div className="mt-5 space-y-3">
              <input
                value={typeForm.name}
                onChange={(event) => setTypeForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Leave type name"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <input
                type="number"
                min="0"
                step="0.5"
                value={typeForm.defaultAnnualDays}
                onChange={(event) =>
                  setTypeForm((prev) => ({ ...prev, defaultAnnualDays: event.target.value }))
                }
                placeholder="Default annual days"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.paid}
                    onChange={(event) =>
                      setTypeForm((prev) => ({ ...prev, paid: event.target.checked }))
                    }
                  />
                  Paid leave
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={typeForm.isActive}
                    onChange={(event) =>
                      setTypeForm((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLeaveType}
                className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

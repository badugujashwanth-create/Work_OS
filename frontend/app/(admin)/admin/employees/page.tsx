'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { adminUserService } from '@/services/adminUserService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IUser } from '@/types';

const ROLE_OPTIONS = ['admin', 'manager', 'employee', 'hr', 'auditor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MIN_PASSWORD_LENGTH = 8;

type CreateForm = {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
};

type EditForm = {
  name: string;
  email: string;
  role: string;
};

const isInactiveUser = (user: IUser) => user.isActive === false || user.isDeactivated;

const formatLastSeen = (value?: string) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

export default function AdminEmployeesPage() {
  const { user, ready } = useAuthStore();
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '',
    email: '',
    role: 'employee',
    tempPassword: ''
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<IUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', email: '', role: 'employee' });
  const [editError, setEditError] = useState<string | null>(null);
  const [tempPasswordReveal, setTempPasswordReveal] = useState<{ user: string; password: string } | null>(null);

  const canManage = user?.role === 'admin';

  const loadUsers = useCallback(async () => {
    if (!ready || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminUserService.list();
      setUsers(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [ready, canManage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      }),
    [users]
  );

  const openEdit = (target: IUser) => {
    setEditUser(target);
    setEditForm({ name: target.name, email: target.email, role: target.role });
    setEditError(null);
  };

  const closeEdit = () => {
    setEditUser(null);
    setEditError(null);
  };

  const validateEmail = (email: string) => EMAIL_REGEX.test(email);

  const handleCreate = async () => {
    setCreateError(null);
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    if (!validateEmail(createForm.email)) {
      setCreateError('Enter a valid email address.');
      return;
    }
    if (!ROLE_OPTIONS.includes(createForm.role)) {
      setCreateError('Select a valid role.');
      return;
    }
    if (createForm.tempPassword && createForm.tempPassword.length < MIN_PASSWORD_LENGTH) {
      setCreateError(`Temp password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    try {
      const response = await adminUserService.create({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        tempPassword: createForm.tempPassword.trim() || undefined
      });
      setTempPasswordReveal(
        response.tempPassword
          ? { user: response.user.name, password: response.tempPassword }
          : null
      );
      setUsers((prev) => [response.user, ...prev]);
      setShowCreate(false);
      setCreateForm({ name: '', email: '', role: 'employee', tempPassword: '' });
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create user.');
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setEditError(null);
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Name and email are required.');
      return;
    }
    if (!validateEmail(editForm.email)) {
      setEditError('Enter a valid email address.');
      return;
    }
    if (!ROLE_OPTIONS.includes(editForm.role)) {
      setEditError('Select a valid role.');
      return;
    }

    try {
      const response = await adminUserService.update(editUser._id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role
      });
      setUsers((prev) =>
        prev.map((item) => (item._id === editUser._id ? response.user : item))
      );
      closeEdit();
    } catch (err: any) {
      setEditError(err?.response?.data?.message || 'Failed to update user.');
    }
  };

  const handleResetPassword = async (target: IUser) => {
    setError(null);
    try {
      const response = await adminUserService.update(target._id, { resetPassword: true });
      if (response.tempPassword) {
        setTempPasswordReveal({ user: target.name, password: response.tempPassword });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reset password.');
    }
  };

  const handleToggleActive = async (target: IUser) => {
    setError(null);
    try {
      if (isInactiveUser(target)) {
        const response = await adminUserService.update(target._id, { isActive: true });
        setUsers((prev) =>
          prev.map((item) => (item._id === target._id ? response.user : item))
        );
        return;
      }
      await adminUserService.deactivate(target._id);
      setUsers((prev) =>
        prev.map((item) =>
          item._id === target._id
            ? { ...item, isActive: false, isDeactivated: true, status: 'inactive' }
            : item
        )
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update user status.');
    }
  };

  if (!canManage) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800">
        Access denied. Admins only.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">User management</p>
          <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm"
          >
            Create employee
          </button>
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
          >
            Refresh
          </button>
        </div>
      </header>

      {tempPasswordReveal && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800">
          <div>
            Temporary password for {tempPasswordReveal.user}:{' '}
            <strong>{tempPasswordReveal.password}</strong>
          </div>
          <button
            type="button"
            onClick={() => setTempPasswordReveal(null)}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Team roster</p>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Name</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Email</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Role</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Last seen</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? 'Loading users...' : 'No users found.'}
                  </td>
                </tr>
              )}
              {sortedUsers.map((row) => {
                const inactive = isInactiveUser(row);
                const isSelf = user?._id === row._id;
                return (
                  <tr key={row._id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{row.email}</td>
                    <td className="px-4 py-4 text-slate-600 capitalize">{row.role}</td>
                    <td className="px-4 py-4">
                      <span
                        className={clsx(
                          'rounded-full px-3 py-1 text-xs font-semibold',
                          inactive ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {inactive ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatLastSeen(row.lastActiveAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(row)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                        >
                          Reset password
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(row)}
                          disabled={isSelf}
                          className={clsx(
                            'rounded-full border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60',
                            inactive
                              ? 'border-emerald-200 text-emerald-700'
                              : 'border-rose-200 text-rose-700'
                          )}
                        >
                          {inactive ? 'Activate' : 'Deactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create employee</p>
                <h2 className="text-xl font-semibold text-slate-900">New account</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            {createError && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {createError}
              </p>
            )}
            <div className="mt-5 space-y-3">
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Full name"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <input
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email address"
                type="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <input
                value={createForm.tempPassword}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, tempPassword: event.target.value }))
                }
                placeholder="Temp password (optional)"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <p className="text-xs text-slate-500">
                Leave the temp password blank to auto-generate one.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Edit employee</p>
                <h2 className="text-xl font-semibold text-slate-900">{editUser.name}</h2>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            {editError && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {editError}
              </p>
            )}
            <div className="mt-5 space-y-3">
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Full name"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <input
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email address"
                type="email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              />
              <select
                value={editForm.role}
                onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
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

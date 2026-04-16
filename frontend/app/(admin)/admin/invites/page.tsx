'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { adminInviteService } from '@/services/adminInviteService';
import { useAuthStore } from '@/store/useAuthStore';
import type { IInvite, InviteStatus } from '@/types';

const ROLE_OPTIONS = ['admin', 'manager', 'employee', 'hr', 'auditor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type InviteForm = {
  email: string;
  role: string;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const statusLabel = (status: InviteStatus) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'used':
      return 'Used';
    case 'expired':
      return 'Expired';
    default:
      return status;
  }
};

export default function AdminInvitesPage() {
  const { user, ready } = useAuthStore();
  const [invites, setInvites] = useState<IInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InviteForm>({ email: '', role: 'employee' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const canManage = user?.role === 'admin';

  const loadInvites = useCallback(async () => {
    if (!ready || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminInviteService.list();
      setInvites(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, [ready, canManage]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const sortedInvites = useMemo(
    () =>
      [...invites].sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      }),
    [invites]
  );

  const handleCreate = async () => {
    setCreateError(null);
    setInviteLink(null);
    setCopyStatus(null);
    if (!form.email.trim()) {
      setCreateError('Email is required.');
      return;
    }
    if (!EMAIL_REGEX.test(form.email)) {
      setCreateError('Enter a valid email address.');
      return;
    }
    if (!ROLE_OPTIONS.includes(form.role)) {
      setCreateError('Select a valid role.');
      return;
    }

    try {
      const response = await adminInviteService.create({
        email: form.email.trim(),
        role: form.role
      });
      setInvites((prev) => [response.invite, ...prev]);
      setInviteLink(response.inviteLink);
      setForm({ email: '', role: 'employee' });
    } catch (err: any) {
      setCreateError(err?.response?.data?.message || 'Failed to create invite.');
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopyStatus('Copied to clipboard');
    } catch {
      setCopyStatus('Copy failed. Please copy manually.');
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Onboarding</p>
          <h1 className="text-2xl font-semibold text-slate-900">Invites</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadInvites}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create invite</p>
            <h2 className="text-lg font-semibold text-slate-900">Invite a new teammate</h2>
          </div>
          <span className="text-xs text-slate-500">Link expires in 7 days</span>
        </div>
        {createError && (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {createError}
          </p>
        )}
        <div className="mt-5 grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
          <input
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="employee@company.com"
            type="email"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
          />
          <select
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none"
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            className="rounded-2xl border border-slate-200 bg-slate-900 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            Create invite
          </button>
        </div>

        {inviteLink && (
          <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold">Invite link (copy once):</span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                Copy link
              </button>
            </div>
            <code className="break-all rounded-2xl bg-white/80 px-3 py-2 text-xs text-emerald-800">
              {inviteLink}
            </code>
            {copyStatus && <span className="text-xs text-emerald-700">{copyStatus}</span>}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Invites</p>
            <h2 className="text-lg font-semibold text-slate-900">Invitation history</h2>
          </div>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Email</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Role</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Expires</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Created</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Used</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvites.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? 'Loading invites...' : 'No invites yet.'}
                  </td>
                </tr>
              )}
              {sortedInvites.map((invite) => (
                <tr key={invite._id} className="border-t border-slate-100">
                  <td className="px-4 py-4 text-slate-900">{invite.email}</td>
                  <td className="px-4 py-4 capitalize">{invite.role}</td>
                  <td className="px-4 py-4">
                    <span
                      className={clsx(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        invite.status === 'active' && 'bg-emerald-100 text-emerald-700',
                        invite.status === 'used' && 'bg-slate-100 text-slate-600',
                        invite.status === 'expired' && 'bg-rose-100 text-rose-700'
                      )}
                    >
                      {statusLabel(invite.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">{formatDate(invite.expiresAt)}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{formatDate(invite.createdAt)}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">{formatDate(invite.usedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

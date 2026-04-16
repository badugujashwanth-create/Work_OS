'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import { authService } from '@/services/authService';

const MIN_PASSWORD_LENGTH = 8;

function InviteAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ name: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!token) {
      setError('Invite token is missing. Please request a new invite.');
      return;
    }
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    try {
      await authService.acceptInvite({
        token,
        name: form.name.trim(),
        password: form.password
      });
      setSuccess('Invite accepted. Please sign in.');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to accept invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950/5 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-brand-500 blur-[120px] animate-[pulse-soft_14s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-indigo-300 blur-[130px] animate-[float_12s_ease-in-out_infinite]" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-3xl items-center">
        <div className="w-full rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Invitation
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900">
              Set up your Work OS account
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Finish onboarding by choosing your name and password.
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 shadow-sm">
              {error}
            </p>
          )}

          {success && (
            <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm">
              {success}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Full name
              </label>
              <input
                required
                placeholder="Alex Carter"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <input
                required
                type="password"
                placeholder="********"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg transition',
                loading && 'opacity-70'
              )}
            >
              <span className="absolute inset-0 translate-x-[-100%] bg-white/20 transition duration-700 group-hover:translate-x-0" />
              <span className="relative">{loading ? 'Finishing...' : 'Accept invite'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="font-semibold text-brand-600 underline decoration-2 underline-offset-4 transition hover:text-brand-500"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading invite...
        </div>
      }
    >
      <InviteAcceptForm />
    </Suspense>
  );
}

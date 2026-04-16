'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useAuthStore } from '@/store/useAuthStore';
import { IUser } from '@/types';

type Props = { mode: 'login' | 'register' };

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const { login, register, loading } = useAuthStore();
  const demoAccounts = {
    admin: { email: 'admin@workos.dev', password: 'Admin@123' },
    employee: { email: 'eli@workos.dev', password: 'Employee@123' }
  };
  const [form, setForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'employee';
  }>({
    name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [error, setError] = useState('');

  const redirectAfterAuth = (user: IUser) =>
    user.role === 'admin' || user.role === 'manager' ? '/admin/dashboard' : '/dashboard';

  const fillDemo = (type: 'admin' | 'employee') => {
    setForm((prev) => ({
      ...prev,
      email: demoAccounts[type].email,
      password: demoAccounts[type].password
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        const user = await login({ email: form.email, password: form.password });
        router.replace(redirectAfterAuth(user));
        return;
      }
      const user = await register(form);
      router.replace(redirectAfterAuth(user));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950/5">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-brand-500 blur-[120px] animate-[pulse-soft_14s_ease-in-out_infinite]" />
        <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-indigo-300 blur-[130px] animate-[float_12s_ease-in-out_infinite]" />
      </div>
      <div className="relative mx-auto flex min-h-screen items-center px-6 py-12 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 rounded-[32px] border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur lg:grid-cols-[1.05fr_1fr]">
          <div className="card relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-slate-900 p-8 text-white shadow-xl">
            <div className="absolute left-1/2 top-6 h-14 w-14 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              WorkHub Cloud
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight lg:text-4xl">
              {mode === 'login' ? 'Welcome back' : 'Create your workspace'}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-indigo-100">
              Track focus, tasks, and productivity with a modern dashboard designed for hybrid
              teams. Enjoy live insights, AI summaries, and an elegant, distraction-free UI.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Focus scoring', desc: 'Live score based on activity + idle time.' },
                { title: 'AI summaries', desc: 'Daily recaps with red flags and suggestions.' },
                { title: 'Task board', desc: 'Drag-friendly columns and quick status updates.' },
                { title: 'Live pulse', desc: 'Monitor tab switches and active sessions.' }
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:border-white/30"
                >
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-indigo-100/90">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-indigo-100">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Realtime sync
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 font-semibold">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                Secure by default
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative z-10 h-full rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {mode === 'login' ? 'Sign in' : 'Register'}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {mode === 'login' ? 'Access your desk' : 'Launch your workspace'}
                </h2>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                v1.0
              </div>
            </div>

            {mode === 'login' && (
              <div className="mb-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fillDemo('admin')}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-white"
                >
                  Use Admin Demo
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo('employee')}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-white"
                >
                  Use Employee Demo
                </button>
              </div>
            )}

            {error && (
              <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600 shadow-sm">
                {error}
              </p>
            )}

            <div className="space-y-3">
              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Full name
                  </label>
                  <input
                    required
                    placeholder="Alex Carter"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 shadow-inner outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              {mode === 'register' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Role
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:-translate-y-0.5 focus:border-brand-500 focus:bg-white focus:shadow-lg"
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, role: e.target.value as 'admin' | 'employee' }))
                    }
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-4">
              <button
                disabled={loading}
                className={clsx(
                  'group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg transition focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 focus:ring-offset-white',
                  loading && 'opacity-70'
                )}
              >
                <span className="absolute inset-0 translate-x-[-100%] bg-white/20 transition duration-700 group-hover:translate-x-0" />
                <span className="relative">
                  {loading
                    ? 'Please wait'
                    : mode === 'login'
                      ? 'Sign in to WorkHub'
                      : 'Create my account'}
                </span>
              </button>
              <p className="text-center text-sm text-slate-500">
                {mode === 'login' ? (
                  <>Need an account? Contact your admin for access.</>
                ) : (
                  <>
                    Already registered?{' '}
                    <button
                      type="button"
                      className="font-semibold text-brand-600 underline decoration-2 underline-offset-4 transition hover:text-brand-500"
                      onClick={() => router.push('/login')}
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

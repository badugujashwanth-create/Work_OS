'use client';

import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Registration disabled
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Contact your admin</h1>
        <p className="mt-3 text-sm text-slate-600">
          Work OS accounts are provisioned by administrators only.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}

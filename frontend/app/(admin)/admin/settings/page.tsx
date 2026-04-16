'use client';

import { useEffect, useState } from 'react';
import { settingsService } from '@/services/settingsService';
import { adminService } from '@/services/adminService';
import { ISystemSettings } from '@/types';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ISystemSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    settingsService
      .getActivitySettings()
      .then((data) => {
        setSettings(data);
        setForm(data);
      })
      .catch(() => setSettings(null));
  }, []);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await settingsService.updateActivitySettings(form);
      setSettings(updated);
      setForm(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = await adminService.exportData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `workhub-export-${new Date().toISOString().split('T')[0]}.json`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const payload = json.data ? json : { data: json };
      const result = await adminService.importData({ data: payload.data, mode: importMode });
      setImportStatus(`Imported with ${result?.results?.length ?? 0} collections updated.`);
    } catch (error: any) {
      setImportStatus(error?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!form) {
    return <p className="text-sm text-slate-500">Loading settings...</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">Activity controls</h2>
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Soft idle threshold (minutes)</label>
          <input
            type="number"
            min={5}
            value={form.idleAlertSoftMinutes}
            onChange={(e) => setForm({ ...form, idleAlertSoftMinutes: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Hard idle threshold</label>
          <input
            type="number"
            min={10}
            value={form.idleAlertAdminMinutes}
            onChange={(e) => setForm({ ...form, idleAlertAdminMinutes: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Work start hour (0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={form.workStartHour}
            onChange={(e) => setForm({ ...form, workStartHour: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Work end hour</label>
          <input
            type="number"
            min={0}
            max={23}
            value={form.workEndHour}
            onChange={(e) => setForm({ ...form, workEndHour: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Enable alerts</label>
          <select
            value={form.alertsEnabled ? 'enabled' : 'disabled'}
            onChange={(e) => setForm({ ...form, alertsEnabled: e.target.value === 'enabled' })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Active outside work hours</label>
          <select
            value={form.activeOutsideWorkHours ? 'enabled' : 'disabled'}
            onChange={(e) => setForm({ ...form, activeOutsideWorkHours: e.target.value === 'enabled' })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value="enabled">Notify</option>
            <option value="disabled">Ignore</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">Chat retention (days)</label>
          <select
            value={form.chatRetentionDays ?? 180}
            onChange={(e) => setForm({ ...form, chatRetentionDays: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          >
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        className="rounded-2xl bg-brand-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save settings'}
      </button>
      <p className="text-xs text-slate-500">
        Settings persist across the workspace and apply to all monitors. Changes may take a few seconds to propagate.
      </p>
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Data utilities</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">Export or restore demo data</h3>
        <p className="mt-1 text-sm text-slate-600">
          Dump the in-memory database to JSON or restore a saved snapshot for QA.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow disabled:opacity-60"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Preparing...' : 'Export JSON'}
          </button>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm">
            Import JSON
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0] || null)}
              disabled={importing}
            />
          </label>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as 'replace' | 'merge')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm"
          >
            <option value="replace">Replace data</option>
            <option value="merge">Merge data</option>
          </select>
        </div>
        {importStatus && <p className="mt-3 text-xs text-slate-500">{importStatus}</p>}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { riskAlertService } from "@/services/riskAlertService";
import { useAuthStore } from "@/store/useAuthStore";
import type { IRiskAlert, RiskAlertStatus } from "@/types";

const STATUS_OPTIONS: RiskAlertStatus[] | Array<RiskAlertStatus | "all"> = ["open", "snoozed", "resolved", "all"];

const severityStyles = (severity: string) =>
  ({
    info: "bg-slate-100 text-slate-600",
    warning: "bg-amber-100 text-amber-700",
    critical: "bg-rose-100 text-rose-700"
  }[severity] || "bg-slate-100 text-slate-600");

const getAlertUser = (alert: IRiskAlert) => (typeof alert.userId === "string" ? null : alert.userId);

export default function AdminAlertsPage() {
  const { user, ready } = useAuthStore();
  const [alerts, setAlerts] = useState<IRiskAlert[]>([]);
  const [statusFilter, setStatusFilter] = useState<RiskAlertStatus | "all">("open");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteAlert, setNoteAlert] = useState<IRiskAlert | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const isAdmin = user?.role === "admin";

  const loadAlerts = useCallback(async () => {
    if (!ready || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await riskAlertService.list(statusFilter);
      setAlerts(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }, [ready, isAdmin, statusFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleResolve = async (alert: IRiskAlert) => {
    setError(null);
    try {
      const updated = await riskAlertService.resolve(alert._id);
      setAlerts((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to resolve alert.");
    }
  };

  const handleSnooze = async (alert: IRiskAlert) => {
    setError(null);
    try {
      const updated = await riskAlertService.snooze(alert._id, { days: 1 });
      setAlerts((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to snooze alert.");
    }
  };

  const openNote = (alert: IRiskAlert) => {
    setNoteAlert(alert);
    setNoteValue(alert.note || "");
  };

  const saveNote = async () => {
    if (!noteAlert) return;
    if (!noteValue.trim()) {
      setError("Note cannot be empty.");
      return;
    }
    try {
      const updated = await riskAlertService.addNote(noteAlert._id, noteValue.trim());
      setAlerts((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setNoteAlert(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to save note.");
    }
  };

  if (!isAdmin) {
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Risk alerts</p>
          <h1 className="text-2xl font-semibold text-slate-900">Actionable alerts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as RiskAlertStatus | "all")}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadAlerts}
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

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alerts</p>
          {loading && <span className="text-xs text-slate-500">Loading...</span>}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Employee</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Alert</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Severity</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Last triggered</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading alerts..." : "No alerts found."}
                  </td>
                </tr>
              )}
              {alerts.map((alert) => {
                const alertUser = getAlertUser(alert);
                return (
                  <tr key={alert._id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{alertUser?.name || "Employee"}</p>
                      <p className="text-xs text-slate-500">{alertUser?.email || ""}</p>
                    </td>
                  <td className="px-4 py-4 text-slate-700">
                    <p className="font-semibold">{alert.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{alert.message}</p>
                    {alert.note && <p className="text-xs text-slate-400">Note: {alert.note}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", severityStyles(alert.severity))}>
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">{alert.status}</td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt).toLocaleString() : "n/a"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolve(alert)}
                        className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSnooze(alert)}
                        className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                      >
                        Snooze 1d
                      </button>
                      <button
                        type="button"
                        onClick={() => openNote(alert)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      >
                        Add note
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

      {noteAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Add note</p>
                <h2 className="text-xl font-semibold text-slate-900">
                  {getAlertUser(noteAlert)?.name || "Alert note"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setNoteAlert(null)}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>
            <textarea
              rows={4}
              value={noteValue}
              onChange={(event) => setNoteValue(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-900 outline-none"
              placeholder="Add a note for this alert..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteAlert(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNote}
                className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

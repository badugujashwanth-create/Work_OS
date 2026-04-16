"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import StatusBadge from "@/components/StatusBadge";
import { controlCenterService } from "@/services/controlCenterService";
import { exportService } from "@/services/exportService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  ActivityStatus,
  IControlCenterDetail,
  IControlCenterEmployee,
  IControlCenterSnapshot,
  RiskLevel
} from "@/types";
import { formatDateInput, formatMinutes } from "@/lib/timesheet";

type FilterStatus = "all" | ActivityStatus;
type FilterRisk = "all" | RiskLevel;

const RISK_STYLES: Record<RiskLevel, string> = {
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700"
};

const buildCsv = (headers: string[], rows: Array<Array<string | number>>) => {
  const encode = (value: string | number) =>
    `"${String(value ?? "").replace(/\"/g, "\"\"")}"`;
  return [headers, ...rows].map((row) => row.map(encode).join(",")).join("\n");
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function ControlCenterPage() {
  const { user, ready } = useAuthStore();
  const [snapshot, setSnapshot] = useState<IControlCenterSnapshot | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [riskFilter, setRiskFilter] = useState<FilterRisk>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<IControlCenterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<IControlCenterEmployee | null>(null);
  const [exportStart, setExportStart] = useState(() => formatDateInput(new Date()));
  const [exportEnd, setExportEnd] = useState(() => formatDateInput(new Date()));
  const [exporting, setExporting] = useState<null | "timesheets" | "leave" | "usage">(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const loadSnapshot = useCallback(async () => {
    if (!ready || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await controlCenterService.list();
      setSnapshot(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load control center.");
    } finally {
      setLoading(false);
    }
  }, [ready, isAdmin]);

  const loadDetail = useCallback(async (employee: IControlCenterEmployee) => {
    setSelectedEmployee(employee);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await controlCenterService.getEmployee(employee.user._id);
      setDetail(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load employee detail.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const filteredEmployees = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.employees.filter((employee) => {
      if (statusFilter !== "all" && employee.status !== statusFilter) return false;
      if (riskFilter !== "all" && employee.risk !== riskFilter) return false;
      if (teamFilter !== "all") {
        const match = employee.teams.some((team) => team._id === teamFilter);
        if (!match) return false;
      }
      return true;
    });
  }, [snapshot, statusFilter, riskFilter, teamFilter]);

  const trendRows = useMemo(() => {
    if (!detail) return [];
    const map = new Map(
      detail.timesheetTrend.map((row) => [formatDateInput(new Date(row.date)), row])
    );
    const rows = [];
    const today = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = formatDateInput(date);
      const existing = map.get(key);
      if (existing) {
        rows.push(existing);
      } else {
        rows.push({
          date: date.toISOString(),
          workedMinutes: 0,
          breakMinutes: 0,
          payableMinutes: 0,
          approvalStatus: "pending"
        });
      }
    }
    return rows;
  }, [detail]);

  const exportPayload = () => ({
    startDate: exportStart,
    endDate: exportEnd,
    teamId: teamFilter !== "all" ? teamFilter : undefined
  });

  const exportTimesheets = async () => {
    setExporting("timesheets");
    try {
      const data = await exportService.timesheets(exportPayload());
      const rows = data.rows.map((row: any) => [
        row.date,
        row.user?.name,
        row.user?.email,
        row.user?.department || "",
        row.workedMinutes,
        row.breakMinutes,
        row.payableMinutes,
        row.activeMinutes,
        row.idleMinutes,
        row.approvalStatus
      ]);
      const csv = buildCsv(
        [
          "Date",
          "Name",
          "Email",
          "Team",
          "Worked Minutes",
          "Break Minutes",
          "Payable Minutes",
          "Active Minutes",
          "Idle Minutes",
          "Approval Status"
        ],
        rows
      );
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `timesheets-${exportStart}-to-${exportEnd}.csv`);
    } finally {
      setExporting(null);
    }
  };

  const exportLeave = async () => {
    setExporting("leave");
    try {
      const data = await exportService.leave(exportPayload());
      const rows = data.rows.map((row: any) => [
        row.userId?.name,
        row.userId?.email,
        row.userId?.department || "",
        row.leaveTypeId?.name,
        row.startAt,
        row.endAt,
        row.durationType,
        row.status,
        row.managerDecision,
        row.adminDecision
      ]);
      const csv = buildCsv(
        [
          "Name",
          "Email",
          "Team",
          "Leave Type",
          "Start Date",
          "End Date",
          "Duration",
          "Status",
          "Manager Decision",
          "Admin Decision"
        ],
        rows
      );
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `leave-${exportStart}-to-${exportEnd}.csv`);
    } finally {
      setExporting(null);
    }
  };

  const exportUsage = async () => {
    setExporting("usage");
    try {
      const data = await exportService.usage(exportPayload());
      const rows = data.rows.map((row: any) => [
        row.user?.name || row.user,
        row.user?.email || "",
        row.user?.department || "",
        row.app,
        row.minutes,
        row.activeMinutes,
        row.idleMinutes,
        row.nonWorkMinutes,
        row.isWhitelisted ? "yes" : "no"
      ]);
      const csv = buildCsv(
        [
          "Name",
          "Email",
          "Team",
          "App",
          "Minutes",
          "Active Minutes",
          "Idle Minutes",
          "Non-work Minutes",
          "Whitelisted"
        ],
        rows
      );
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `usage-${exportStart}-to-${exportEnd}.csv`);
    } finally {
      setExporting(null);
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Boss control center</p>
          <h1 className="text-2xl font-semibold text-slate-900">Live workforce pulse</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={teamFilter}
            onChange={(event) => setTeamFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            <option value="all">All teams</option>
            {snapshot?.teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
          </select>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as FilterRisk)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600"
          >
            <option value="all">All risk</option>
            <option value="green">Green</option>
            <option value="yellow">Yellow</option>
            <option value="red">Red</option>
          </select>
          <button
            type="button"
            onClick={loadSnapshot}
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Employee pulse</p>
          {loading && <span className="text-xs text-slate-500">Refreshing...</span>}
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Employee</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Worked</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Break</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Leave</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Platform</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Modules</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Risk</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Last active</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading employees..." : "No employees match these filters."}
                  </td>
                </tr>
              )}
              {filteredEmployees.map((employee) => (
                <tr
                  key={employee.user._id}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/70"
                  onClick={() => loadDetail(employee)}
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{employee.user.name}</p>
                    <p className="text-xs text-slate-500">{employee.user.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={employee.status} label={employee.status} />
                  </td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(employee.workedMinutes)}</td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(employee.breakMinutes)}</td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {employee.leaveStatus === "on_leave" ? (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
                        On leave {employee.leaveType ? `(${employee.leaveType})` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        Not on leave
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {employee.platformTop.length === 0
                      ? "No data"
                      : employee.platformTop.map((item) => `${item.app} (${item.minutes}m)`).join(", ")}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {employee.moduleTop.length === 0
                      ? "No data"
                      : employee.moduleTop.map((item) => `${item.module} (${item.minutes}m)`).join(", ")}
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", RISK_STYLES[employee.risk])}>
                      {employee.risk.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {employee.lastActivityAt ? new Date(employee.lastActivityAt).toLocaleString() : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Exports</p>
            <h2 className="text-lg font-semibold text-slate-900">Download CSV reports</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            <span>From</span>
            <input
              type="date"
              value={exportStart}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
              onChange={(event) => setExportStart(event.target.value)}
            />
            <span>To</span>
            <input
              type="date"
              value={exportEnd}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
              onChange={(event) => setExportEnd(event.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportTimesheets}
            disabled={exporting !== null}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm disabled:opacity-60"
          >
            {exporting === "timesheets" ? "Exporting..." : "Timesheets CSV"}
          </button>
          <button
            type="button"
            onClick={exportLeave}
            disabled={exporting !== null}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm disabled:opacity-60"
          >
            {exporting === "leave" ? "Exporting..." : "Leave CSV"}
          </button>
          <button
            type="button"
            onClick={exportUsage}
            disabled={exporting !== null}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm disabled:opacity-60"
          >
            {exporting === "usage" ? "Exporting..." : "Platform Usage CSV"}
          </button>
        </div>
      </section>

      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Employee detail</p>
                <h2 className="text-xl font-semibold text-slate-900">{selectedEmployee.user.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployee(null);
                  setDetail(null);
                }}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Close
              </button>
            </div>

            {detailLoading && <p className="mt-4 text-sm text-slate-500">Loading detail...</p>}
            {detail && (
              <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">7-day trend</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-left text-sm text-slate-600">
                        <thead>
                          <tr>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">Date</th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">Worked</th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">Break</th>
                            <th className="px-3 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">Approval</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trendRows.map((row) => (
                            <tr key={row.date} className="border-t border-slate-200">
                              <td className="px-3 py-2 text-slate-700">
                                {new Date(row.date).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{formatMinutes(row.workedMinutes)}</td>
                              <td className="px-3 py-2 text-slate-700">{formatMinutes(row.breakMinutes)}</td>
                              <td className="px-3 py-2 text-xs text-slate-500">
                                {row.approvalStatus || "pending"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Platform breakdown</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      {detail.platformBreakdown.length === 0 && (
                        <p className="text-sm text-slate-500">No platform data in the last 7 days.</p>
                      )}
                      {detail.platformBreakdown.slice(0, 8).map((row) => (
                        <div key={row.app} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2">
                          <span>{row.app}</span>
                          <span className="text-xs text-slate-500">{row.minutes}m</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Work OS modules</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      {detail.moduleBreakdown.length === 0 && (
                        <p className="text-sm text-slate-500">No module activity tracked.</p>
                      )}
                      {detail.moduleBreakdown.slice(0, 8).map((row) => (
                        <div key={row.module} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2">
                          <span>{row.module}</span>
                          <span className="text-xs text-slate-500">{row.minutes}m</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leave history</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-700">
                      {detail.leaveHistory.length === 0 && (
                        <p className="text-sm text-slate-500">No leave requests yet.</p>
                      )}
                      {detail.leaveHistory.slice(0, 6).map((leave) => (
                        <div key={leave._id} className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {typeof leave.leaveTypeId === "string" ? "Leave" : leave.leaveTypeId?.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(leave.startAt).toLocaleDateString()} - {new Date(leave.endAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-500">Status: {leave.status}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

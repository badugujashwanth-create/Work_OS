'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PlatformBreakdownCard from '@/components/PlatformBreakdown';
import { settingsService } from '@/services/settingsService';
import { timesheetService } from '@/services/timesheetService';
import { usageService } from '@/services/usageService';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/useAuthStore';
import { ISystemSettings, IUser, IUsageSummary } from '@/types';
import {
  PlatformBreakdown,
  addDays,
  aggregateUsageSummaries,
  buildDateRange,
  computeClockedMinutes,
  formatDateInput,
  formatMinutes
} from '@/lib/timesheet';

type TimesheetRow = {
  user: IUser;
  shiftMinutes: number;
  clockedMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  breakdown: PlatformBreakdown;
};

const DEFAULT_RANGE_DAYS = 7;

const buildCsv = (headers: string[], rows: Array<Array<string | number>>) => {
  const encode = (value: string | number) =>
    `"${String(value ?? '').replace(/\"/g, '\"\"')}"`;
  return [headers, ...rows].map((row) => row.map(encode).join(',')).join('\n');
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function AdminTimesheetsPage() {
  const { user, ready } = useAuthStore();
  const [employees, setEmployees] = useState<IUser[]>([]);
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return formatDateInput(addDays(now, -(DEFAULT_RANGE_DAYS - 1)));
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    userService
      .getRoster('employee')
      .then(setEmployees)
      .catch(() => setEmployees([]));
    settingsService
      .getActivitySettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, [ready, user]);

  const teamEmployees = useMemo(() => {
    if (selectedTeam === 'all') return employees;
    return employees.filter((employee) => employee.department === selectedTeam);
  }, [employees, selectedTeam]);

  useEffect(() => {
    if (selectedEmployee === 'all') return;
    const stillVisible = teamEmployees.some((employee) => employee._id === selectedEmployee);
    if (!stillVisible) setSelectedEmployee('all');
  }, [selectedEmployee, teamEmployees]);

  const teams = useMemo(() => {
    const unique = new Set<string>();
    employees.forEach((employee) => {
      if (employee.department) unique.add(employee.department);
    });
    return Array.from(unique.values()).sort();
  }, [employees]);

  const dateRange = useMemo(
    () => buildDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const filteredEmployees = useMemo(() => {
    if (selectedEmployee === 'all') return teamEmployees;
    return teamEmployees.filter((employee) => employee._id === selectedEmployee);
  }, [selectedEmployee, teamEmployees]);

  const shiftMinutesPerDay = useMemo(() => {
    const start = settings?.workStartHour ?? 9;
    const end = settings?.workEndHour ?? 18;
    return Math.max(0, end - start) * 60;
  }, [settings]);

  const loadRows = useCallback(async () => {
    if (!ready || !user) return;
    if (!dateRange.length) {
      setError('Select a valid date range.');
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const shiftMinutes = shiftMinutesPerDay * dateRange.length;
      const dayRecords = await Promise.all(
        dateRange.map((date) => timesheetService.getAdmin(date).catch(() => []))
      );

      const rowMap = new Map<string, TimesheetRow>();
      filteredEmployees.forEach((employee) => {
        rowMap.set(employee._id, {
          user: employee,
          shiftMinutes,
          clockedMinutes: 0,
          breakMinutes: 0,
          payableMinutes: 0,
          breakdown: { code: 0, browser: 0, workos: 0, meetings: 0, idle: 0, totalMinutes: 0 }
        });
      });

      dayRecords.forEach((records) => {
        records.forEach((record) => {
          const userId =
            typeof record.user === 'string'
              ? record.user
              : record.user?._id;
          if (!userId) return;
          const row = rowMap.get(userId);
          if (!row) return;

          const clockedMinutes = computeClockedMinutes(record);
          const breakMinutes = Number(record.breakMinutes || 0);
          const payableMinutes =
            record.payableMinutes ?? Math.max(0, clockedMinutes - breakMinutes);

          row.clockedMinutes += clockedMinutes;
          row.breakMinutes += breakMinutes;
          row.payableMinutes += Number(payableMinutes || 0);
        });
      });

      const usageResults = await Promise.all(
        filteredEmployees.map(async (employee) => {
          const summaries = await Promise.all(
            dateRange.map((date) => usageService.summary(date, employee._id).catch(() => null))
          );
          const validSummaries = summaries.filter(Boolean) as IUsageSummary[];
          return {
            userId: employee._id,
            breakdown: aggregateUsageSummaries(validSummaries)
          };
        })
      );

      usageResults.forEach(({ userId, breakdown }) => {
        const row = rowMap.get(userId);
        if (row) row.breakdown = breakdown;
      });

      const sortedRows = Array.from(rowMap.values()).sort((a, b) =>
        a.user.name.localeCompare(b.user.name)
      );
      setRows(sortedRows);
    } catch (err) {
      console.error('Failed to load timesheets', err);
      setError('Unable to load timesheets. Try again shortly.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, filteredEmployees, ready, shiftMinutesPerDay, user]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const exportCsv = () => {
    if (!rows.length) return;
    const csvRows = rows.map((row) => [
      row.user.name,
      row.user.email,
      row.user.department || '',
      row.shiftMinutes,
      row.clockedMinutes,
      row.breakMinutes,
      row.payableMinutes,
      row.breakdown.code,
      row.breakdown.browser,
      row.breakdown.workos,
      row.breakdown.meetings,
      row.breakdown.idle
    ]);
    const csv = buildCsv(
      [
        'Name',
        'Email',
        'Team',
        'Shift Minutes',
        'Clocked Minutes',
        'Break Minutes',
        'Payable Minutes',
        'VS Code Minutes',
        'Browser Minutes',
        'Work OS Minutes',
        'Meetings/Other Minutes',
        'Idle Minutes'
      ],
      csvRows
    );
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `timesheets-${startDate}-to-${endDate}.csv`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Timesheet overview</p>
          <h1 className="text-2xl font-semibold text-slate-900">Admin timesheets</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
          <select
            value={selectedTeam}
            onChange={(event) => setSelectedTeam(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="all">All teams</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
          <select
            value={selectedEmployee}
            onChange={(event) => setSelectedEmployee(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
          >
            <option value="all">All employees</option>
            {teamEmployees.map((employee) => (
              <option key={employee._id} value={employee._id}>
                {employee.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!rows.length}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 shadow-sm disabled:opacity-50"
          >
            Export CSV
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
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Team breakdown</p>
          <span className="text-xs text-slate-500">
            {dateRange.length ? `${dateRange.length} day range` : 'No range selected'}
          </span>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Employee</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Shift</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Clocked</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Break</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Payable</th>
                <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                  Platform usage
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? 'Loading timesheets...' : 'No timesheet data for this selection.'}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.user._id} className="border-t border-slate-100">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{row.user.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.user.department || 'Team'} - {row.user.email}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(row.shiftMinutes)}</td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(row.clockedMinutes)}</td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(row.breakMinutes)}</td>
                  <td className="px-4 py-4 text-slate-900">{formatMinutes(row.payableMinutes)}</td>
                  <td className="px-4 py-4">
                    <PlatformBreakdownCard data={row.breakdown} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

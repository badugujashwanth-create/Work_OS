'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import PlatformBreakdownCard from '@/components/PlatformBreakdown';
import { settingsService } from '@/services/settingsService';
import { timesheetService } from '@/services/timesheetService';
import { usageService } from '@/services/usageService';
import { useAuthStore } from '@/store/useAuthStore';
import { ISystemSettings, ITimeSheetDay, IUsageSummary } from '@/types';
import {
  PlatformBreakdown,
  addDays,
  aggregateUsageSummaries,
  buildDateRange,
  computeClockedMinutes,
  formatDateInput,
  formatMinutes,
  parseDateInput
} from '@/lib/timesheet';

type DayRow = {
  date: string;
  record: ITimeSheetDay | null;
};

const DEFAULT_RANGE_DAYS = 7;

export default function MyTimesheetPage() {
  const { user, ready } = useAuthStore();
  const [settings, setSettings] = useState<ISystemSettings | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return formatDateInput(addDays(now, -(DEFAULT_RANGE_DAYS - 1)));
  });
  const [endDate, setEndDate] = useState(() => formatDateInput(new Date()));
  const [dayRows, setDayRows] = useState<DayRow[]>([]);
  const [breakdown, setBreakdown] = useState<PlatformBreakdown>({
    code: 0,
    browser: 0,
    workos: 0,
    meetings: 0,
    idle: 0,
    totalMinutes: 0
  });
  const [loading, setLoading] = useState(false);
  const [noteDate, setNoteDate] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!ready || !user) return;
    settingsService
      .getActivitySettings()
      .then(setSettings)
      .catch(() => setSettings(null));
  }, [ready, user]);

  const dateRange = useMemo(
    () => buildDateRange(startDate, endDate),
    [startDate, endDate]
  );

  const shiftMinutesPerDay = useMemo(() => {
    const start = settings?.workStartHour ?? 9;
    const end = settings?.workEndHour ?? 18;
    return Math.max(0, end - start) * 60;
  }, [settings]);

  const loadTimesheet = useCallback(async () => {
    if (!ready || !user) return;
    if (!dateRange.length) {
      setDayRows([]);
      setBreakdown({ code: 0, browser: 0, workos: 0, meetings: 0, idle: 0, totalMinutes: 0 });
      return;
    }

    setLoading(true);
    try {
      const records = await Promise.all(
        dateRange.map((date) => timesheetService.getMe(date).catch(() => null))
      );
      setDayRows(
        dateRange.map((date, index) => ({
          date,
          record: records[index] || null
        }))
      );

      const summaries = await Promise.all(
        dateRange.map((date) => usageService.summary(date).catch(() => null))
      );
      const validSummaries = summaries.filter(Boolean) as IUsageSummary[];
      setBreakdown(aggregateUsageSummaries(validSummaries));
    } finally {
      setLoading(false);
    }
  }, [dateRange, ready, user]);

  useEffect(() => {
    loadTimesheet();
  }, [loadTimesheet]);

  useEffect(() => {
    if (!dateRange.length) return;
    if (!noteDate || !dateRange.includes(noteDate)) {
      setNoteDate(dateRange[dateRange.length - 1]);
    }
  }, [dateRange, noteDate]);

  useEffect(() => {
    const row = dayRows.find((entry) => entry.date === noteDate);
    setNoteValue(row?.record?.note || '');
    setNoteStatus('idle');
  }, [dayRows, noteDate]);

  const summary = useMemo(() => {
    return dayRows.reduce(
      (acc, entry) => {
        const record = entry.record;
        const clockedMinutes = computeClockedMinutes(record);
        const breakMinutes = Number(record?.breakMinutes || 0);
        const payableMinutes = record?.payableMinutes ?? Math.max(0, clockedMinutes - breakMinutes);
        acc.clockedMinutes += clockedMinutes;
        acc.breakMinutes += breakMinutes;
        acc.payableMinutes += Number(payableMinutes || 0);
        return acc;
      },
      { clockedMinutes: 0, breakMinutes: 0, payableMinutes: 0 }
    );
  }, [dayRows]);

  const shiftMinutes = shiftMinutesPerDay * dateRange.length;

  const saveNote = async () => {
    if (!noteDate) return;
    setNoteStatus('saving');
    try {
      const updated = await timesheetService.saveNote({ date: noteDate, note: noteValue });
      setDayRows((prev) =>
        prev.map((entry) => (entry.date === noteDate ? { ...entry, record: updated } : entry))
      );
      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 2000);
    } catch (error) {
      setNoteStatus('error');
    }
  };

  const formatDisplayDate = (value: string) => {
    const parsed = parseDateInput(value);
    return parsed ? parsed.toLocaleDateString() : value;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Transparency</p>
          <h1 className="text-2xl font-semibold text-slate-900">My timesheet</h1>
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
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Shift hours</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMinutes(shiftMinutes)}</p>
          <p className="text-xs text-slate-500">Scheduled across {dateRange.length} days</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Clocked hours</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMinutes(summary.clockedMinutes)}</p>
          <p className="text-xs text-slate-500">Based on clock-in/out</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Break time</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMinutes(summary.breakMinutes)}</p>
          <p className="text-xs text-slate-500">Manual breaks recorded</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Payable</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMinutes(summary.payableMinutes)}</p>
          <p className="text-xs text-slate-500">Clocked minus breaks</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Platform breakdown</p>
          <span className="text-xs text-slate-500">
            {dateRange.length ? `${dateRange.length} day range` : 'No range selected'}
          </span>
        </div>
        <div className="mt-4">
          <PlatformBreakdownCard data={breakdown} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr,0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Daily details</p>
            {loading && <span className="text-xs text-slate-500">Refreshing...</span>}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-600">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Date</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Clocked</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Break</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Payable</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">Note</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                      {loading ? 'Loading timesheet data...' : 'No entries for this range.'}
                    </td>
                  </tr>
                )}
                {dayRows.map((entry) => {
                  const record = entry.record;
                  const clockedMinutes = computeClockedMinutes(record);
                  const breakMinutes = Number(record?.breakMinutes || 0);
                  const payableMinutes = record?.payableMinutes ?? Math.max(0, clockedMinutes - breakMinutes);
                  return (
                    <tr
                      key={entry.date}
                      className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50/80 ${
                        entry.date === noteDate ? 'bg-slate-50/60' : ''
                      }`}
                      onClick={() => setNoteDate(entry.date)}
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">{formatDisplayDate(entry.date)}</td>
                      <td className="px-4 py-4 text-slate-900">{formatMinutes(clockedMinutes)}</td>
                      <td className="px-4 py-4 text-slate-900">{formatMinutes(breakMinutes)}</td>
                      <td className="px-4 py-4 text-slate-900">{formatMinutes(Number(payableMinutes || 0))}</td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {record?.note ? record.note : 'Add note'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dispute or note</p>
          <p className="mt-2 text-sm text-slate-500">
            Share context for {noteDate ? formatDisplayDate(noteDate) : 'selected day'}.
          </p>
          <textarea
            rows={8}
            value={noteValue}
            onChange={(event) => setNoteValue(event.target.value)}
            className="mt-4 w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-900 outline-none"
            placeholder="Add a note about this day..."
          />
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={saveNote}
              disabled={!noteDate || noteStatus === 'saving'}
              className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-sm disabled:opacity-60"
            >
              {noteStatus === 'saving' ? 'Saving...' : 'Save note'}
            </button>
            <span className="text-xs text-slate-500">
              {noteStatus === 'saved' && 'Saved'}
              {noteStatus === 'error' && 'Failed to save'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

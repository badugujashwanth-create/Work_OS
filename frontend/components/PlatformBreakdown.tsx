'use client';

import { PlatformBreakdown, formatMinutes } from '@/lib/timesheet';

type Props = {
  data: PlatformBreakdown;
  compact?: boolean;
};

const LABELS = [
  { key: 'code', label: 'VS Code', color: 'bg-indigo-500', text: 'text-indigo-600' },
  { key: 'browser', label: 'Browser', color: 'bg-sky-500', text: 'text-sky-600' },
  { key: 'workos', label: 'Work OS', color: 'bg-emerald-500', text: 'text-emerald-600' },
  { key: 'meetings', label: 'Meetings/Other', color: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'idle', label: 'Idle', color: 'bg-rose-400', text: 'text-rose-500' }
];

export default function PlatformBreakdownCard({ data, compact }: Props) {
  const total = data.totalMinutes;
  if (!total) {
    return <p className="text-sm text-slate-500">No usage data for this range.</p>;
  }

  return (
    <div className={compact ? 'space-y-2 text-[11px]' : 'space-y-3 text-xs'}>
      <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${compact ? 'h-2' : 'h-3'}`}>
        {LABELS.map((item) => {
          const minutes = data[item.key as keyof PlatformBreakdown] as number;
          if (!minutes) return null;
          const width = Math.max(0, Math.min(100, (minutes / total) * 100));
          return (
            <div
              key={item.key}
              className={item.color}
              style={{ width: `${width}%` }}
            />
          );
        })}
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {LABELS.map((item) => {
          const minutes = data[item.key as keyof PlatformBreakdown] as number;
          return (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <span className={`font-semibold ${item.text}`}>{item.label}</span>
              <span className="text-slate-600">{formatMinutes(minutes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

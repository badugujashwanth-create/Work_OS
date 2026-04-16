import { ITimeSheetDay, IUsageSummary } from '@/types';

export type PlatformBreakdown = {
  code: number;
  browser: number;
  workos: number;
  meetings: number;
  idle: number;
  totalMinutes: number;
};

const CODE_TOKENS = ['code', 'vscode', 'visual studio code'];
const BROWSER_TOKENS = ['chrome', 'edge', 'firefox', 'safari', 'brave', 'opera', 'vivaldi', 'arc'];
const WORKOS_TOKENS = ['workos', 'work os', 'work-os'];
const MEETING_TOKENS = [
  'teams',
  'zoom',
  'meet',
  'webex',
  'skype',
  'gotomeeting',
  'go to meeting',
  'hangouts',
  'bluejeans'
];

const normalizeName = (value: string | undefined) => String(value || '').toLowerCase();

const matchesToken = (name: string, tokens: string[]) =>
  tokens.some((token) => name.includes(token));

export const categorizeApp = (appName: string) => {
  const name = normalizeName(appName);
  if (!name) return 'meetings';
  if (matchesToken(name, WORKOS_TOKENS)) return 'workos';
  if (matchesToken(name, CODE_TOKENS)) return 'code';
  if (matchesToken(name, BROWSER_TOKENS)) return 'browser';
  if (matchesToken(name, MEETING_TOKENS)) return 'meetings';
  return 'meetings';
};

export const aggregateUsageSummaries = (summaries: IUsageSummary[]) => {
  const breakdown: PlatformBreakdown = {
    code: 0,
    browser: 0,
    workos: 0,
    meetings: 0,
    idle: 0,
    totalMinutes: 0
  };

  summaries.forEach((summary) => {
    summary.apps.forEach((app) => {
      const activeMinutes = Math.max(0, (app.minutes || 0) - (app.idleMinutes || 0));
      const bucket = categorizeApp(app.app);
      breakdown[bucket] += activeMinutes;
    });

    const idleMinutes =
      summary.totals?.idleMinutes ??
      summary.apps.reduce((sum, app) => sum + (app.idleMinutes || 0), 0);
    breakdown.idle += idleMinutes;
  });

  breakdown.totalMinutes =
    breakdown.code + breakdown.browser + breakdown.workos + breakdown.meetings + breakdown.idle;

  return breakdown;
};

export const formatMinutes = (minutes = 0) => {
  const safe = Math.max(0, Math.round(minutes));
  if (safe === 0) return '0m';
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (hours === 0) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
};

export const computeClockedMinutes = (record?: ITimeSheetDay | null) => {
  if (!record?.clockInAt || !record?.clockOutAt) return 0;
  const start = new Date(record.clockInAt).getTime();
  const end = new Date(record.clockOutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 60000));
};

export const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateInput = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const buildDateRange = (start: string, end: string) => {
  const startDate = parseDateInput(start);
  const endDate = parseDateInput(end);
  if (!startDate || !endDate) return [];
  if (endDate.getTime() < startDate.getTime()) return [];

  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const addDays = (date: Date, delta: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
};

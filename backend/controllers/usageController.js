import dayjs from 'dayjs';
import mongoose from 'mongoose';
import AppUsageTick from '../models/AppUsageTick.js';
import TimeSheetDay from '../models/TimeSheetDay.js';
import { getSettings } from '../services/settingsService.js';

const IDLE_THRESHOLD_SECONDS = 120;
const TICK_MINUTES = 0.25;
const MAX_TITLE_LENGTH = 80;

const normalizeList = (value) =>
  Array.isArray(value)
    ? value
        .filter(Boolean)
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0)
    : [];

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const parseDateParam = (value) => {
  const parsed = value ? dayjs(value) : dayjs();
  if (!parsed.isValid()) return null;
  const start = parsed.startOf('day').toDate();
  const end = parsed.add(1, 'day').startOf('day').toDate();
  return { start, end };
};

const resolveUserId = (req) => {
  let userId = req.user._id;
  if (req.query.userId) {
    if (!['admin', 'manager'].includes(req.user.role)) {
      return { error: 'Forbidden' };
    }
    userId = req.query.userId;
  }

  if (typeof userId === 'string') {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { error: 'Invalid userId' };
    }
    userId = new mongoose.Types.ObjectId(userId);
  }

  return { userId };
};

const updateTimesheetFromTick = async ({ userId, timestamp, idleSeconds, activeApp }) => {
  const settings = await getSettings();
  const whitelist = normalizeList(settings.appWhitelist);
  const whitelistSet = new Set(whitelist.map(normalizeKey));
  const isIdle = idleSeconds >= IDLE_THRESHOLD_SECONDS;
  const isActiveWork =
    !isIdle && whitelistSet.has(normalizeKey(activeApp));

  if (!isIdle && !isActiveWork) return;

  const day = dayjs(timestamp).startOf('day').toDate();
  const update = isIdle
    ? { $inc: { idleMinutes: TICK_MINUTES } }
    : { $inc: { activeMinutes: TICK_MINUTES } };
  await TimeSheetDay.updateOne(
    { user: userId, date: day },
    { $setOnInsert: { user: userId, date: day }, ...update },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

export const recordUsageTick = async (req, res) => {
  const body = req.body || {};
  const ts = body.ts ? new Date(body.ts) : new Date();
  const timestamp = Number.isNaN(ts.getTime()) ? new Date() : ts;
  const idleSecondsRaw = Number(body.idleSeconds);
  const idleSeconds = Number.isFinite(idleSecondsRaw) ? Math.max(0, idleSecondsRaw) : 0;
  const activeApp = typeof body.activeApp === 'string' ? body.activeApp.trim() : undefined;
  const rawTitle =
    typeof body.activeAppTitle === 'string'
      ? body.activeAppTitle
      : typeof body.activeTitle === 'string'
        ? body.activeTitle
        : '';
  const activeAppTitle = rawTitle ? rawTitle.trim().slice(0, MAX_TITLE_LENGTH) : undefined;
  const isWorkOSFocused = Boolean(body.isWorkOSFocused);
  const workosModule =
    typeof body.workosModule === 'string' ? body.workosModule.trim() : undefined;
  const source = typeof body.source === 'string' ? body.source.trim() : undefined;

  const tick = await AppUsageTick.create({
    user: req.user._id,
    ts: timestamp,
    idleSeconds,
    activeApp,
    activeAppTitle,
    isWorkOSFocused,
    workosModule,
    source
  });

  await updateTimesheetFromTick({
    userId: req.user._id,
    timestamp,
    idleSeconds,
    activeApp
  });

  res.status(201).json(tick);
};

export const getUsageSummary = async (req, res) => {
  const range = parseDateParam(req.query.date);
  if (!range) return res.status(400).json({ message: 'Invalid date' });

  const resolved = resolveUserId(req);
  if (resolved.error === 'Forbidden') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (resolved.error) {
    return res.status(400).json({ message: resolved.error });
  }

  const settings = await getSettings();
  const whitelist = normalizeList(settings.appWhitelist);
  const whitelistSet = new Set(whitelist.map(normalizeKey));
  const ticksToMinutes = (ticks) => Math.round(ticks * TICK_MINUTES * 100) / 100;

  const rows = await AppUsageTick.aggregate([
    { $match: { user: resolved.userId, ts: { $gte: range.start, $lt: range.end } } },
    {
      $project: {
        activeApp: { $ifNull: ['$activeApp', 'Unknown'] },
        idleSeconds: 1
      }
    },
    {
      $group: {
        _id: '$activeApp',
        ticks: { $sum: 1 },
        idleTicks: {
          $sum: {
            $cond: [{ $gte: ['$idleSeconds', IDLE_THRESHOLD_SECONDS] }, 1, 0]
          }
        }
      }
    },
    { $sort: { ticks: -1, _id: 1 } }
  ]);

  const apps = rows.map((row) => {
    const appName = row._id || 'Unknown';
    const totalMinutes = ticksToMinutes(row.ticks || 0);
    const idleMinutes = ticksToMinutes(row.idleTicks || 0);
    const isWhitelisted = whitelistSet.has(normalizeKey(appName));
    const activeMinutes = isWhitelisted ? Math.max(0, totalMinutes - idleMinutes) : 0;
    const nonWorkMinutes = Math.max(0, totalMinutes - idleMinutes - activeMinutes);
    return {
      app: appName,
      minutes: totalMinutes,
      activeMinutes,
      idleMinutes,
      nonWorkMinutes,
      isWhitelisted
    };
  });

  const totals = apps.reduce(
    (acc, app) => {
      acc.minutes += app.minutes;
      acc.activeMinutes += app.activeMinutes;
      acc.idleMinutes += app.idleMinutes;
      acc.nonWorkMinutes += app.nonWorkMinutes;
      return acc;
    },
    { minutes: 0, activeMinutes: 0, idleMinutes: 0, nonWorkMinutes: 0 }
  );

  const moduleRows = await AppUsageTick.aggregate([
    {
      $match: {
        user: resolved.userId,
        ts: { $gte: range.start, $lt: range.end },
        isWorkOSFocused: true
      }
    },
    {
      $project: {
        module: { $ifNull: ['$workosModule', 'dashboard'] }
      }
    },
    {
      $group: {
        _id: '$module',
        ticks: { $sum: 1 }
      }
    },
    { $sort: { ticks: -1, _id: 1 } }
  ]);

  const totalsByWorkosModule = moduleRows.map((row) => ({
    module: row._id || 'dashboard',
    minutes: ticksToMinutes(row.ticks || 0)
  }));

  res.json({
    date: range.start.toISOString(),
    userId: resolved.userId,
    appWhitelist: whitelist,
    totals,
    apps,
    totalsByExternalApp: apps.map((app) => ({ app: app.app, minutes: app.minutes })),
    totalsByWorkosModule,
    idleMinutes: totals.idleMinutes,
    activeMinutes: totals.activeMinutes
  });
};

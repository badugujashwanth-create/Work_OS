import { getSettings, updateSettings } from '../services/settingsService.js';

const normalizeList = (value) => {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter(Boolean)
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
};

export const getActivitySettings = async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
};

export const saveActivitySettings = async (req, res) => {
  const updates = { ...(req.body || {}) };
  const appWhitelist = normalizeList(updates.appWhitelist);
  const domainWhitelist = normalizeList(updates.domainWhitelist);
  if (updates.chatRetentionDays !== undefined) {
    const days = Number(updates.chatRetentionDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return res.status(400).json({ message: 'chatRetentionDays must be between 1 and 365' });
    }
    updates.chatRetentionDays = Math.floor(days);
  }
  if (appWhitelist !== undefined) updates.appWhitelist = appWhitelist;
  if (domainWhitelist !== undefined) updates.domainWhitelist = domainWhitelist;
  const settings = await updateSettings(updates);
  res.json(settings);
};

export const getBrowserSettings = async (req, res) => {
  const settings = await getSettings();
  res.json({
    browserEnabled: settings.browserEnabled ?? false,
    browserHomeUrl: settings.browserHomeUrl ?? '',
    browserAllowedUrls: settings.browserAllowedUrls ?? []
  });
};

export const saveBrowserSettings = async (req, res) => {
  const { browserEnabled, browserHomeUrl, browserAllowedUrls } = req.body || {};
  const normalizedList = Array.isArray(browserAllowedUrls)
    ? browserAllowedUrls
        .filter(Boolean)
        .map((url) => String(url).trim())
        .filter((url) => url.length > 0)
    : undefined;

  const updates = {};
  if (typeof browserEnabled === 'boolean') updates.browserEnabled = browserEnabled;
  if (typeof browserHomeUrl === 'string') updates.browserHomeUrl = browserHomeUrl;
  if (normalizedList !== undefined) updates.browserAllowedUrls = normalizedList;

  const settings = await updateSettings(updates);
  res.json({
    browserEnabled: settings.browserEnabled ?? false,
    browserHomeUrl: settings.browserHomeUrl ?? '',
    browserAllowedUrls: settings.browserAllowedUrls ?? []
  });
};

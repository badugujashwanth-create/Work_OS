import SystemSetting from '../models/SystemSetting.js';

const DEFAULTS = {
  idleAlertSoftMinutes: 15,
  idleAlertAdminMinutes: 30,
  workStartHour: 9,
  workEndHour: 18,
  alertsEnabled: true,
  alertRoles: ['admin', 'manager'],
  activeOutsideWorkHours: false,
  browserEnabled: false,
  browserHomeUrl: 'https://www.example.com',
  browserAllowedUrls: [],
  appWhitelist: ['Code', 'Chrome', 'Teams', 'WorkOS'],
  domainWhitelist: [],
  chatRetentionDays: 180
};

export const getSettings = async () => {
  const entries = await SystemSetting.find({});
  const map = entries.reduce((acc, entry) => {
    acc[entry.key] = entry.value;
    return acc;
  }, {});
  return {
    ...DEFAULTS,
    ...map
  };
};

export const updateSettings = async (updates = {}) => {
  const entries = Object.entries(updates);
  await Promise.all(
    entries.map(([key, value]) =>
      SystemSetting.updateOne({ key }, { value }, { upsert: true, setDefaultsOnInsert: true })
    )
  );
  return getSettings();
};

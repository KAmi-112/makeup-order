const SETTINGS_KEYS = [
  'makeupTypes',
  'extraServices',
  'notice',
  'theme',
  'menuPass',
];

export function buildSettingsImportPayload(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('备份文件格式不正确');
  }

  const payload = {};
  for (const key of SETTINGS_KEYS) {
    if (backup[key] !== undefined) payload[key] = backup[key];
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('备份文件中没有可恢复的设置');
  }

  return {
    payload,
    skippedOrderCount: Array.isArray(backup.orders) ? backup.orders.length : 0,
  };
}

/**
 * 2026年中国法定节假日（简化版）
 */
const HOLIDAYS_2026 = {
  '2026-01-01': '元旦',
  '2026-01-02': '元旦假期',
  '2026-02-16': '除夕',
  '2026-02-17': '春节',
  '2026-02-18': '春节假期',
  '2026-02-19': '春节假期',
  '2026-02-20': '春节假期',
  '2026-02-21': '春节假期',
  '2026-02-22': '春节假期',
  '2026-04-05': '清明节',
  '2026-04-06': '清明假期',
  '2026-05-01': '劳动节',
  '2026-05-02': '劳动节假期',
  '2026-05-03': '劳动节假期',
  '2026-05-04': '劳动节假期',
  '2026-05-05': '劳动节假期',
  '2026-06-19': '端午节',
  '2026-06-20': '端午假期',
  '2026-06-21': '端午假期',
  '2026-09-25': '中秋节',
  '2026-09-26': '中秋假期',
  '2026-09-27': '中秋假期',
  '2026-10-01': '国庆节',
  '2026-10-02': '国庆假期',
  '2026-10-03': '国庆假期',
  '2026-10-04': '国庆假期',
  '2026-10-05': '国庆假期',
  '2026-10-06': '国庆假期',
  '2026-10-07': '国庆假期',
};

export function getHoliday(dateStr) {
  return HOLIDAYS_2026[dateStr] || null;
}

export function isHoliday(dateStr) {
  return dateStr in HOLIDAYS_2026;
}

/** 获取未来7天内的节假日提示 */
export function upcomingHolidays() {
  const today = new Date();
  const results = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const h = getHoliday(ds);
    if (h) results.push({ date: ds, name: h });
  }
  return results;
}

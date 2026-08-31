export function isComplimentaryService(makeupType, serviceId) {
  return serviceId === 'e2' && /COS正片|COS华改/.test(String(makeupType || ''));
}

export function getEffectiveServicePrice(makeupType, service) {
  return isComplimentaryService(makeupType, service?.id) ? 0 : Number(service?.price) || 0;
}

export function getServicePriceLabel(makeupType, service) {
  if (isComplimentaryService(makeupType, service?.id)) return '正片/华改专享免费';
  const price = getEffectiveServicePrice(makeupType, service);
  return price > 0 ? `+¥${price}` : '免费';
}

const toMinutes = value => {
  const [hour, minute] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + (minute || 0);
};

export function getPriceAdjustment(date, time, rules) {
  if (!date || !time || !rules) return { amount: 0, label: '' };
  const current = toMinutes(time);
  const evening = rules.evening_surcharge || {};
  if (evening.enabled && current >= toMinutes(evening.startTime || '18:00') && current < toMinutes(evening.endTime || '23:00')) {
    return { amount: Math.abs(Number(evening.amount || 10)), label: '晚间妆位加价' };
  }
  if (current >= toMinutes('05:00') && current < toMinutes('07:00')) {
    const day = new Date(`${date}T00:00:00`).getDay();
    const special = (rules.special_dates?.dates || []).includes(date);
    if (special || day === 0 || day === 6) {
      const discount = rules.morning_weekend_special_discount || {};
      return discount.enabled ? { amount: -Math.abs(Number(discount.amount || -10)), label: special ? '漫展日早间优惠' : '周末早间优惠' } : { amount: 0, label: '' };
    }
    const surcharge = rules.morning_weekday_surcharge || {};
    return surcharge.enabled ? { amount: Math.abs(Number(surcharge.amount || 10)), label: '工作日早间加价' } : { amount: 0, label: '' };
  }
  return { amount: 0, label: '' };
}

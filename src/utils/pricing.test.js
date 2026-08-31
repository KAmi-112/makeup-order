import { describe, expect, it } from 'vitest';
import { getEffectiveServicePrice, getPriceAdjustment } from './pricing.js';

const rules = {
  evening_surcharge: { enabled: true, startTime: '18:00', endTime: '23:00', amount: 10 },
  morning_weekday_surcharge: { enabled: true, amount: 10 },
  morning_weekend_special_discount: { enabled: true, amount: -10 },
  special_dates: { dates: ['2026-10-01'] },
};

describe('确认卡核价', () => {
  it('Lo妆身体素颜霜收费3元，美瞳免费', () => {
    const services = [{ id: 'e2', price: 3 }, { id: 'e6', price: 0 }];
    expect(48 + services.reduce((sum, service) => sum + getEffectiveServicePrice('Lo妆/约会妆/生日妆', service), 0)).toBe(51);
  });

  it('08:30不产生时段调整', () => {
    expect(getPriceAdjustment('2026-08-31', '08:30', rules).amount).toBe(0);
  });

  it('18:00后增加10元', () => {
    expect(getPriceAdjustment('2026-08-31', '18:00', rules).amount).toBe(10);
  });
});

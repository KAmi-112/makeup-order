import { describe, expect, it } from 'vitest';
import { getMonthExpectedRevenue, getOrderReceivedRevenue, getYearExpectedRevenue } from './revenue.js';

describe('预期收入统计', () => {
  it('历史月使用估算基准且不与已有订单重复相加', () => {
    const orders = [{ date: '2026-07-10', price: 100, status: 'completed', paymentStatus: 'full' }];
    expect(getMonthExpectedRevenue(orders, 2026, 6)).toBe(2980);
  });

  it('订单总额高于历史基准时采用真实订单总额', () => {
    const orders = [{ date: '2026-08-10', price: 6000, status: 'confirmed', paymentStatus: 'deposit', deposit: 18 }];
    expect(getMonthExpectedRevenue(orders, 2026, 7)).toBe(6000);
  });

  it('取消和拒绝订单不进入预期或已收收入', () => {
    const orders = [
      { date: '2027-01-01', price: 100, status: 'cancelled', paymentStatus: 'full' },
      { date: '2027-01-02', price: 200, status: 'rejected', paymentStatus: 'full' },
    ];
    expect(getMonthExpectedRevenue(orders, 2027, 0)).toBe(0);
    expect(getOrderReceivedRevenue(orders)).toBe(0);
  });

  it('年度预期收入包含七八月历史基准', () => {
    expect(getYearExpectedRevenue([], 2026)).toBe(8800);
  });
});

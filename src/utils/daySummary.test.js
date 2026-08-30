import { describe, expect, it } from 'vitest';
import { buildDaySummary } from './daySummary.js';

describe('每日订单汇总', () => {
  it('取消订单不计入有效单、金额和附加服务', () => {
    const orders = [
      { status: 'confirmed', price: 69, deposit: 18, paymentStatus: 'deposit', duration: 1.5, notes: '敏感肌', extraServices: ['e2', 'e7'], cardCoveredAmount: 0 },
      { status: 'completed', price: 45, deposit: 18, paymentStatus: 'full', duration: 1, notes: '', extraServices: ['e7'], cardCoveredAmount: 42 },
      { status: 'cancelled', price: 100, paymentStatus: 'full', duration: 2, notes: '不应统计', extraServices: ['e2'] },
    ];
    const result = buildDaySummary(orders, [{ id: 'e2', name: '身体素颜霜' }, { id: 'e7', name: '下睫毛' }]);
    expect(result.activeCount).toBe(2);
    expect(result.cancelledCount).toBe(1);
    expect(result.totalAmount).toBe(114);
    expect(result.receivedAmount).toBe(63);
    expect(result.totalHours).toBe(2.5);
    expect(result.noteCount).toBe(1);
    expect(result.cardCount).toBe(1);
    expect(result.serviceCounts).toEqual([{ name: '下睫毛', count: 2 }, { name: '身体素颜霜', count: 1 }]);
  });
});

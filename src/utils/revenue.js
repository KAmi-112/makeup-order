// 历史日历只有月总览，无法安全还原为逐笔订单。
// 这里保存“月度收入基准”，仅用于预期收入统计，不生成订单、不占用档期。
export const historicalMonthlyEstimates = Object.freeze({
  '2026-07': 2980,
  '2026-08': 5820,
});

export function isActiveOrder(order) {
  return !['cancelled', 'rejected'].includes(order?.status);
}

export function getOrderExpectedRevenue(orders = []) {
  return orders.reduce((sum, order) => (
    isActiveOrder(order) ? sum + (Number(order.price) || 0) : sum
  ), 0);
}

export function getOrderReceivedRevenue(orders = []) {
  return orders.reduce((sum, order) => {
    if (!isActiveOrder(order)) return sum;
    if (order.paymentStatus === 'full') return sum + (Number(order.price) || 0);
    if (order.paymentStatus === 'deposit') return sum + (Number(order.deposit) || 0);
    if (order.status === 'completed' || order.status === 'confirmed') return sum + (Number(order.price) || 0);
    return sum;
  }, 0);
}

export function getMonthExpectedRevenue(orders = [], year, monthIndex) {
  const monthOrders = orders.filter(order => {
    const [orderYear, orderMonth] = String(order.date || '').split('-').map(Number);
    return orderYear === year && orderMonth === monthIndex + 1;
  });
  const orderTotal = getOrderExpectedRevenue(monthOrders);
  const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  // 取较大值而不是相加，避免历史总览与已存在订单重复计算。
  return Math.max(orderTotal, historicalMonthlyEstimates[key] || 0);
}

export function getYearExpectedRevenue(orders = [], year) {
  return Array.from({ length: 12 }, (_, month) => getMonthExpectedRevenue(orders, year, month))
    .reduce((sum, amount) => sum + amount, 0);
}


export function getShanghaiDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function buildDaySummary(orders, extraServices) {
  const all = Array.isArray(orders) ? orders : [];
  const active = all.filter(order => !['cancelled', 'rejected'].includes(order.status));
  const serviceMap = new Map((extraServices || []).map(service => [service.id, service.name]));
  const serviceCounts = new Map();

  active.forEach(order => {
    (order.extraServices || []).forEach(serviceId => {
      const name = serviceMap.get(serviceId) || `未知服务（${serviceId}）`;
      serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1);
    });
  });

  return {
    activeCount: active.length,
    cancelledCount: all.length - active.length,
    totalAmount: active.reduce((sum, order) => sum + (Number(order.price) || 0), 0),
    receivedAmount: active.reduce((sum, order) => {
      if (order.paymentStatus === 'full') return sum + (Number(order.price) || 0);
      if (order.paymentStatus === 'deposit') return sum + (Number(order.deposit) || 0);
      return sum;
    }, 0),
    totalHours: active.reduce((sum, order) => sum + (Number(order.duration) || 0), 0),
    noteCount: active.filter(order => String(order.notes || '').trim()).length,
    cardCount: active.filter(order => Number(order.cardCoveredAmount) > 0).length,
    serviceCounts: [...serviceCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')),
  };
}

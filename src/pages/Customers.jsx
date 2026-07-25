import { useMemo, useState } from 'react';
import { useStore, paymentLabels, statusLabels, sources } from '../store.jsx';
import { Search, X, Users, Phone, MessageCircle, TrendingUp, CalendarDays, Sparkles } from 'lucide-react';

export default function Customers() {
  const { state } = useStore();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const customers = useMemo(() => {
    const map = new Map();
    state.orders.forEach(o => {
      const key = o.customerPhone || o.customerWechat || o.customerName;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          name: o.customerName,
          phone: o.customerPhone,
          wechat: o.customerWechat,
          orders: [],
        });
      }
      map.get(key).orders.push(o);
    });

    let list = Array.from(map.values()).map(c => ({
      ...c,
      orderCount: c.orders.length,
      totalSpent: c.orders.reduce((sum, o) => {
        if (o.paymentStatus === 'full') return sum + o.price;
        if (o.paymentStatus === 'deposit') return sum + (o.deposit || 0);
        return sum;
      }, 0),
      lastOrder: c.orders.reduce((latest, o) =>
        o.date > latest.date ? o : latest, c.orders[0]
      ),
    }));

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.wechat?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => b.lastOrder.date.localeCompare(a.lastOrder.date));
    return list;
  }, [state.orders, search]);

  const totalStats = useMemo(() => ({
    count: customers.length,
    totalRevenue: customers.reduce((s, c) => s + c.totalSpent, 0),
    avgPerCustomer: customers.length > 0
      ? Math.round(customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length)
      : 0,
  }), [customers]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-warm-800">👥 客户管理 ({customers.length})</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, label: '客户总数', value: totalStats.count, color: 'rose' },
          { icon: TrendingUp, label: '总营收', value: `¥${totalStats.totalRevenue.toLocaleString()}`, color: 'emerald' },
          { icon: Sparkles, label: '人均消费', value: `¥${totalStats.avgPerCustomer.toLocaleString()}`, color: 'amber' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 animate-scale-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
                <s.icon className="w-4.5 h-4.5 text-rose-400" />
              </div>
              <div>
                <p className="text-[11px] text-warm-800/50">{s.label}</p>
                <p className="text-lg font-bold text-warm-800">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-800/30" />
        <input
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-rose-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
          placeholder="搜索客户姓名、手机号、微信号..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-warm-800/40" />
          </button>
        )}
      </div>

      {/* Customer grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <Users className="w-12 h-12 mx-auto mb-3 text-rose-200" />
            <p className="text-warm-800/40 text-sm">暂无客户数据</p>
          </div>
        ) : (
          customers.map(c => (
            <div
              key={c.phone || c.wechat || c.name}
              onClick={() => setSelectedCustomer(c)}
              className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5 hover:shadow-md hover:border-rose-200 cursor-pointer transition-all group animate-scale-in"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-300 to-rose-500 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-rose-200">
                    {c.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-warm-800">{c.name || '未知名'}</p>
                    <p className="text-xs text-warm-800/40">{c.orderCount} 次消费</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-rose-600">¥{c.totalSpent}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-warm-800/50">
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                {c.wechat && <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{c.wechat}</span>}
              </div>
              <div className="mt-3 pt-3 border-t border-rose-50 flex items-center gap-2 text-xs text-warm-800/40">
                <CalendarDays className="w-3 h-3" />
                最近: {c.lastOrder.date} · {c.lastOrder.makeupType}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer detail modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-start justify-center lg:pt-[8vh] lg:px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
          <div className="relative bg-white lg:rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in h-[100dvh] lg:max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-300 to-rose-500 flex items-center justify-center text-white font-bold shadow-md">
                  {selectedCustomer.name?.charAt(0) || '?'}
                </div>
                <div>
                  <h3 className="font-semibold text-warm-800">{selectedCustomer.name || '未知名'}</h3>
                  <p className="text-xs text-warm-800/40">{selectedCustomer.orderCount} 次消费 · 累计 ¥{selectedCustomer.totalSpent}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-1.5 rounded-lg hover:bg-warm-100 transition-colors">
                <X className="w-5 h-5 text-warm-800/50" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-3">
              {(selectedCustomer.phone || selectedCustomer.wechat) && (
                <div className="flex gap-4 text-sm mb-2">
                  {selectedCustomer.phone && (
                    <span className="flex items-center gap-1.5 text-warm-800/60"><Phone className="w-4 h-4" />{selectedCustomer.phone}</span>
                  )}
                  {selectedCustomer.wechat && (
                    <span className="flex items-center gap-1.5 text-warm-800/60"><MessageCircle className="w-4 h-4" />{selectedCustomer.wechat}</span>
                  )}
                </div>
              )}
              <h4 className="text-sm font-semibold text-warm-800/70 pt-2">消费记录</h4>
              {selectedCustomer.orders
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(o => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/30 hover:bg-rose-50/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-warm-800">{o.date}</span>
                        <span className="text-xs text-warm-800/40">{o.time}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                          o.status === 'confirmed' ? 'bg-blue-50 text-blue-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {statusLabels[o.status]}
                        </span>
                      </div>
                      <p className="text-xs text-warm-800/50 mt-0.5">{o.makeupType} · {o.location || '未填地点'} · {o.source}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-warm-800">¥{o.price}</p>
                      <p className={`text-[11px] ${
                        o.paymentStatus === 'full' ? 'text-emerald-500' :
                        o.paymentStatus === 'deposit' ? 'text-amber-500' :
                        'text-red-400'
                      }`}>{paymentLabels[o.paymentStatus]}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

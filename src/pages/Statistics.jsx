import { useMemo, useState } from 'react';
import { useStore, paymentLabels, sources } from '../store.jsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import { TrendingUp, DollarSign, Sparkles } from 'lucide-react';
import { getMonthExpectedRevenue } from '../utils/revenue.js';

const COLORS = ['#f43f5e', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#94a3b8'];

export default function Statistics() {
  const { state } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());

  const yearlyRevenue = useMemo(() => {
    const months = Array(12).fill(0).map((_, i) => ({
      month: `${i + 1}月`,
      revenue: 0,
      expectedRevenue: 0,
      orders: 0,
    }));

    state.orders.forEach(o => {
      const d = new Date(o.date);
      if (d.getFullYear() === year) {
        const m = d.getMonth();
        months[m].orders += 1;
        if (o.status === 'cancelled' || o.status === 'rejected') return;
        if (o.paymentStatus === 'full') months[m].revenue += o.price;
        else if (o.paymentStatus === 'deposit') months[m].revenue += (o.deposit || 0);
        else if (o.status === 'completed' || o.status === 'confirmed') months[m].revenue += o.price;
      }
    });

    months.forEach((item, monthIndex) => {
      item.expectedRevenue = getMonthExpectedRevenue(state.orders, year, monthIndex);
    });

    return months;
  }, [state.orders, year]);

  const yearlyTotal = useMemo(() => {
    return yearlyRevenue.reduce((s, m) => s + m.expectedRevenue, 0);
  }, [yearlyRevenue]);

  const sourceStats = useMemo(() => {
    const map = {};
    state.orders.forEach(o => {
      if (o.status === 'cancelled' || o.status === 'rejected') return;
      const source = o.source || '其他';
      if (!map[source]) map[source] = { name: source, value: 0, count: 0 };
      map[source].count += 1;
      if (o.paymentStatus === 'full') map[source].value += o.price;
      else if (o.paymentStatus === 'deposit') map[source].value += (o.deposit || 0);
      else if (o.status === 'completed' || o.status === 'confirmed') map[source].value += o.price;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [state.orders]);

  const makeupTypeStats = useMemo(() => {
    const map = {};
    state.orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const t = o.makeupType || '未分类';
      if (!map[t]) map[t] = { name: t, count: 0, revenue: 0 };
      map[t].count += 1;
      if (o.paymentStatus === 'full') map[t].revenue += o.price;
      else if (o.paymentStatus === 'deposit') map[t].revenue += (o.deposit || 0);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [state.orders]);

  const avgPrice = useMemo(() => {
    const validOrders = state.orders.filter(o => o.status !== 'cancelled' && o.price > 0);
    if (validOrders.length === 0) return 0;
    return Math.round(validOrders.reduce((s, o) => s + o.price, 0) / validOrders.length);
  }, [state.orders]);

  const completionRate = useMemo(() => {
    const total = state.orders.filter(o => o.status !== 'cancelled').length;
    const completed = state.orders.filter(o => o.status === 'completed').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [state.orders]);

  const years = useMemo(() => {
    const set = new Set(state.orders.map(o => new Date(o.date).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [state.orders]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-brand-100 rounded-xl p-3 shadow-lg text-sm">
          <p className="font-medium text-warm-800 mb-1">{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color }} className="text-xs">
              {p.name}: {p.name.includes('收入') || p.name === '已收' ? `¥${p.value.toLocaleString()}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 本月统计 - 主视图 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-warm-800 font-heading">本月概览</h2>
        <select value={year} onChange={e => setYear(+e.target.value)}
          className="px-3 py-2 rounded-xl border border-brand-200 bg-white text-sm">
          {years.map(y => <option key={y} value={y}>{y}年</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: `${year}年预期收入`, value: `¥${yearlyTotal.toLocaleString()}`, color: 'from-rose-400 to-brand-600' },
          { icon: Sparkles, label: '客单价（均价）', value: `¥${avgPrice.toLocaleString()}`, color: 'from-amber-400 to-amber-600' },
          { icon: TrendingUp, label: '完成率', value: `${completionRate}%`, color: 'from-emerald-400 to-emerald-600' },
          { icon: DollarSign, label: '总订单数', value: state.orders.filter(o => o.status !== 'cancelled').length, color: 'from-blue-400 to-blue-600' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4 animate-scale-in" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <p className="text-[11px] text-warm-800/50">{s.label}</p>
                <p className="text-lg font-bold text-warm-800">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly revenue chart */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-4">📈 月度收入趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#fce7f3' }} />
            <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#fce7f3' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="expectedRevenue" name="预期收入" fill="#f43f5e" radius={[8, 8, 0, 0]} />
            <Bar dataKey="revenue" name="已收" fill="#fda4af" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Source distribution */}
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
          <h3 className="font-semibold text-warm-800 mb-4">🍰 客源收入分布</h3>
          {sourceStats.length === 0 ? (
            <p className="text-sm text-warm-800/40 text-center py-12">暂无数据</p>
          ) : (
            <div className="flex items-center gap-2">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie data={sourceStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                    {sourceStats.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {sourceStats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-warm-800/70 truncate">{s.name}</span>
                    <span className="text-warm-800/40 ml-auto">{s.count}单</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Makeup type stats */}
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
          <h3 className="font-semibold text-warm-800 mb-4">💄 妆造类型热榜</h3>
          {makeupTypeStats.length === 0 ? (
            <p className="text-sm text-warm-800/40 text-center py-12">暂无数据</p>
          ) : (
            <div className="space-y-2">
              {makeupTypeStats.map((t, i) => {
                const max = makeupTypeStats[0].count;
                const pct = Math.round((t.count / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-warm-800 font-medium">{i + 1}. {t.name}</span>
                      <span className="text-xs text-warm-800/50">{t.count}单 · ¥{t.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-brand-50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-300 to-rose-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

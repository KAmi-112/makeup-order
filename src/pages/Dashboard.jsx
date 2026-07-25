import { useMemo } from 'react';
import { useStore, paymentLabels } from '../store.jsx';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, ClipboardList, DollarSign,
  CalendarDays, ArrowRight, CheckCircle2, Clock, AlertCircle,
  Sparkles
} from 'lucide-react';

function StatCard({ icon: Icon, title, value, sub, color, delay = 0 }) {
  const gradients = {
    rose: 'from-rose-400 to-rose-600',
    blue: 'from-blue-400 to-blue-600',
    amber: 'from-amber-400 to-amber-600',
    emerald: 'from-emerald-400 to-emerald-600',
    violet: 'from-violet-400 to-violet-600',
  };
  return (
    <div
      className="bg-white rounded-2xl p-4 sm:p-5 border border-rose-100 shadow-sm hover:shadow-md transition-all duration-300 animate-scale-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs text-warm-800/50 font-medium mb-1 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-warm-800 truncate">{value}</p>
          {sub && <p className="text-[11px] sm:text-xs text-warm-800/40 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${gradients[color] || gradients.rose} flex items-center justify-center shadow-lg shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const today = now.toISOString().slice(0, 10);

    const monthOrders = state.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const todayOrders = state.orders.filter(o => o.date === today);

    const monthIncome = monthOrders.reduce((sum, o) => {
      if (o.paymentStatus === 'full') return sum + o.price;
      if (o.paymentStatus === 'deposit') return sum + (o.deposit || 0);
      return sum;
    }, 0);

    const pending = state.orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;

    const customers = new Set(state.orders.map(o => o.customerPhone).filter(Boolean)).size;

    return { monthOrders: monthOrders.length, monthIncome, todayOrders: todayOrders.length, pending, customers };
  }, [state.orders]);

  const recentOrders = useMemo(() => {
    return [...state.orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [state.orders]);

  const upcomingOrders = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return state.orders
      .filter(o => o.date >= today && o.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [state.orders]);

  const statusIcons = {
    pending: <Clock className="w-3.5 h-3.5" />,
    confirmed: <CheckCircle2 className="w-3.5 h-3.5" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5" />,
    cancelled: <AlertCircle className="w-3.5 h-3.5" />,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-warm-800">👋 欢迎回来</h2>
          <p className="text-sm text-warm-800/50 mt-0.5">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/orders?new=1')}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-rose-200 hover:shadow-xl hover:shadow-rose-300 transition-all active:scale-95"
        >
          <Sparkles className="w-4 h-4" /> 新建订单
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="本月收入" value={`¥${stats.monthIncome.toLocaleString()}`} sub={`${stats.monthOrders} 单`} color="emerald" delay={0} />
        <StatCard icon={ClipboardList} title="待处理" value={stats.pending} sub="待确认 / 已确认" color="amber" delay={50} />
        <StatCard icon={CalendarDays} title="今日订单" value={stats.todayOrders} sub="今天" color="blue" delay={100} />
        <StatCard icon={Users} title="客户总数" value={stats.customers} sub="去重客户" color="rose" delay={150} />
      </div>

      {/* Two columns */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" /> 最近订单
            </h3>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
            >
              全部 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-10 text-warm-800/30">
              <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无订单，点击右上角新建</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div
                  key={o.id}
                  onClick={() => navigate('/orders')}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-rose-50/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600 shrink-0">
                      {o.customerName?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-warm-800 truncate">{o.customerName}</p>
                      <p className="text-xs text-warm-800/40">{o.makeupType} · {o.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-warm-800">¥{o.price}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      o.paymentStatus === 'full' ? 'bg-emerald-50 text-emerald-600' :
                      o.paymentStatus === 'deposit' ? 'bg-amber-50 text-amber-600' :
                      'bg-red-50 text-red-500'
                    }`}>
                      {paymentLabels[o.paymentStatus]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-rose-400" /> 即将到来
            </h3>
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 transition-colors"
            >
              日历 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {upcomingOrders.length === 0 ? (
            <div className="text-center py-10 text-warm-800/30">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无即将到来的订单</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingOrders.map(o => {
                const d = new Date(o.date);
                const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                return (
                  <div
                    key={o.id}
                    onClick={() => navigate('/orders')}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50/50 cursor-pointer transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-rose-50 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs text-rose-400">{d.getMonth() + 1}月</span>
                      <span className="text-base font-bold text-rose-600 leading-tight">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-warm-800 truncate">{o.customerName}</p>
                      <p className="text-xs text-warm-800/40">{o.time} · {o.makeupType}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      o.status === 'confirmed' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {o.status === 'confirmed' ? '已确认' : '待确认'}
                    </span>
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

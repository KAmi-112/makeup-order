import { useMemo } from 'react';
import { useStore, paymentLabels, statusLabels, statusColors } from '../store.jsx';
import { useNavigate } from 'react-router-dom';
import { DollarSign, ClipboardList, CalendarDays, Users, Clock, TrendingUp, Sparkles, ArrowRight, Sun, CloudSun, Cloud, CloudRain, Snowflake, CloudLightning, PartyPopper } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchWeather } from '../utils/weather.js';
import { getHoliday, upcomingHolidays } from '../utils/holidays.js';

/* ---- 统计卡片 ---- */
function StatCard({ icon: Icon, title, value, sub, gradient, delay = 0 }) {
  const gradients = {
    peach:  'from-[#d69ba6] to-[#b96f7e]',
    orange: 'from-[#d4a85f] to-[#b77b32]',
    blue:   'from-[#6d8d8a] to-[#476d69]',
    rose:   'from-[#67a17a] to-[#356f4c]',
  };
  return (
    <div className="group panel-luxe rounded-[22px] p-5 transition-all duration-300 cursor-default stagger-item hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(35,68,48,.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-warm-muted font-medium mb-2 tracking-wide uppercase">{title}</p>
          <p className="text-3xl font-extrabold text-warm-800 tracking-tight font-heading">{value}</p>
          {sub && <p className="text-xs text-warm-muted mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" /> {sub}
          </p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[gradient] || gradients.peach} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform shrink-0`}>
          <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function WeatherIcon({ text = '' }) {
  const props = { className: 'w-6 h-6', strokeWidth: 1.7 };
  if (text.includes('雷')) return <CloudLightning {...props} />;
  if (text.includes('雪')) return <Snowflake {...props} />;
  if (text.includes('雨')) return <CloudRain {...props} />;
  if (text.includes('阴') || text.includes('雾')) return <Cloud {...props} />;
  if (text.includes('云')) return <CloudSun {...props} />;
  return <Sun {...props} />;
}

/* ---- 主组件 ---- */
export default function Dashboard() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [weather, setWeather] = useState(null);

  useEffect(() => { fetchWeather().then(setWeather); }, []);

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
      if (o.status === 'cancelled' || o.status === 'rejected') return sum;
      if (o.paymentStatus === 'full') return sum + o.price;
      if (o.paymentStatus === 'deposit') return sum + (o.deposit || 0);
      if (o.status === 'completed' || o.status === 'confirmed') return sum + o.price;
      return sum;
    }, 0);

    const pending = state.orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length;
    const customers = new Set(state.orders.map(o => o.customerName).filter(Boolean)).size;
    return { monthIncome, todayOrders: todayOrders.length, pending, customers };
  }, [state.orders]);

  const recentOrders = useMemo(() => {
    return [...state.orders]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [state.orders]);

  const upcomingOrders = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return state.orders
      .filter(o => o.date >= today && o.status !== 'cancelled' && o.status !== 'rejected')
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
      .slice(0, 8);
  }, [state.orders]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#edf8ef] via-[#fffaf9] to-[#f8dfe5] text-[#355844] px-6 py-7 md:px-9 md:py-8 border border-white shadow-[0_22px_60px_rgba(91,132,102,.11)] flex items-center justify-between flex-wrap gap-5">
        <img src={`${import.meta.env.BASE_URL}lotus-watercolor.webp`} alt="" className="absolute inset-0 w-full h-full object-cover object-center opacity-[.15] mix-blend-multiply pointer-events-none" />
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full border border-[#d98ba0]/25 bg-white/25" />
        <div className="absolute right-8 -bottom-28 w-64 h-64 rounded-full bg-[#e59bae]/25 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] tracking-[.24em] text-[#c7627a] mb-2">小荷·今日工作台</p>
          <h2 className="text-3xl md:text-4xl font-semibold font-heading tracking-wide">下午好，小荷</h2>
          <p className="text-sm text-[#6f8878] mt-2">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <button onClick={() => navigate('/orders?new=1')}
          className="relative flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#df8298] to-[#ec9caf] text-white text-sm font-bold rounded-xl shadow-[0_12px_28px_rgba(220,127,149,.24)] hover:-translate-y-0.5 transition-all active:scale-95">
          <Sparkles className="w-4 h-4" /> 新建预约
        </button>
      </div>

      {/* Weather + Holiday row */}
      {(weather || upcomingHolidays().length > 0) && (
        <div className="flex items-stretch gap-3 flex-wrap">
          {weather && (
            <div className="flex items-center gap-3 bg-white rounded-2xl border border-brand-100 shadow-sm px-5 py-3 flex-1 min-w-[200px]">
              <span className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                <WeatherIcon text={weather.current.text} />
              </span>
              <div>
                <p className="text-lg font-extrabold text-warm-800">{weather.current.temp}°C <span className="text-sm font-normal text-warm-muted">{weather.current.text}</span></p>
                <p className="text-xs text-warm-muted">
                  {weather.forecast.map(f => `${f.date} ${f.low}~${f.high}° ${f.text}`).join('  ·  ')}
                </p>
              </div>
            </div>
          )}
          {upcomingHolidays().map(h => (
            <div key={h.date} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <PartyPopper className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-amber-700">{h.name}</p>
                <p className="text-xs text-amber-500">{h.date.slice(5)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="本月收入" value={`¥${stats.monthIncome.toLocaleString()}`} gradient="peach" delay={0} />
        <StatCard icon={ClipboardList} title="待处理订单" value={stats.pending} sub="需确认/处理" gradient="orange" delay={50} />
        <StatCard icon={CalendarDays} title="今日预约" value={stats.todayOrders} sub="今日排期" gradient="blue" delay={100} />
        <StatCard icon={Users} title="客户数量" value={stats.customers} sub="去重统计" gradient="rose" delay={150} />
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Recent Orders — 占3份 */}
        <div className="lg:col-span-3 panel-luxe rounded-[24px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-warm-800 flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-brand-500" strokeWidth={1.5} /> 最近订单
            </h3>
            <button onClick={() => navigate('/orders')}
              className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 font-medium transition-colors">
              全部 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-warm-muted">
              <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无订单</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.id} onClick={() => navigate('/orders')}
                  className="flex items-center gap-4 p-3 rounded-2xl hover:bg-brand-50 cursor-pointer transition-all group hover:scale-[1.01]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center text-sm font-bold text-brand-600 shrink-0">
                    {o.customerName?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-warm-800 truncate">{o.customerName}</p>
                    <p className="text-xs text-warm-muted">{o.makeupType} · {o.date}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-warm-800">¥{o.price}</span>
                    <span className={`text-xs px-2.5 py-1.5 rounded-xl font-medium whitespace-nowrap ${statusColors[o.status]}`}>
                      {statusLabels[o.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming — 占2份，Timeline风格 */}
        <div className="lg:col-span-2 panel-luxe rounded-[24px] p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-warm-800 flex items-center gap-2 text-lg">
              <CalendarDays className="w-5 h-5 text-brand-500" strokeWidth={1.5} /> 即将到来
            </h3>
            <button onClick={() => navigate('/calendar')}
              className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1 font-medium transition-colors">
              日历 <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {upcomingOrders.length === 0 ? (
            <div className="text-center py-12 text-warm-muted">
              <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">暂无预约</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-brand-100 rounded" />
              {upcomingOrders.map((o, i) => {
                const d = new Date(o.date);
                const today = new Date().toISOString().slice(0,10);
                const isToday = o.date === today;
                // 智能提醒：距现在多久
                const now = new Date();
                let urgency = null;
                if (isToday && o.time) {
                  const [h, m] = (o.time || '00:00').split(':').map(Number);
                  const orderTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m || 0);
                  const diffMin = Math.floor((orderTime - now) / 60000);
                  if (diffMin <= 60 && diffMin > 0) urgency = 'urgent';    // 1小时内
                  else if (diffMin <= 120 && diffMin > 0) urgency = 'soon'; // 2小时内
                  else if (diffMin > 0) urgency = 'today';
                }
                const urgencyColors = {
                  urgent: 'ring-red-400 bg-red-50 border-red-300',
                  soon: 'ring-amber-400 bg-amber-50 border-amber-300',
                  today: '',
                };
                return (
                  <div key={o.id} onClick={() => navigate('/orders')}
                    className={`relative pb-5 last:pb-0 cursor-pointer group ${urgency ? 'rounded-xl p-2 -mx-2 ' + (urgencyColors[urgency] || '') : ''}`}>
                    {/* Dot */}
                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 transition-all ${
                      isToday ? 'bg-brand-500 border-brand-300 ring-4 ring-brand-50' : 'bg-white border-brand-200 group-hover:border-brand-400'
                    } ${urgency === 'urgent' ? '!bg-red-500 !border-red-300 animate-pulse' : ''} ${urgency === 'soon' ? '!bg-amber-500 !border-amber-300' : ''}`} />
                    <div className={`pl-4 py-2 rounded-xl transition-all group-hover:bg-brand-50/50 ${isToday && !urgency ? 'bg-brand-50/30' : ''}`}>
                      <p className="text-xs text-warm-muted flex items-center gap-2">
                        {o.time} · {d.getMonth()+1}月{d.getDate()}日
                        {isToday && <span className="text-xs px-1.5 py-0.5 rounded bg-brand-100 text-brand-600 font-medium">今天</span>}
                        {urgency === 'urgent' && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium animate-pulse">即将开始</span>}
                        {urgency === 'soon' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-medium">临近</span>}
                      </p>
                      <p className="text-sm font-semibold text-warm-800 mt-0.5">{o.customerName} <span className="font-normal text-warm-muted text-xs">{o.makeupType}</span></p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[11px] px-2 py-1 rounded-lg font-medium ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                      </div>
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

import { useState, useMemo } from 'react';
import { useStore, statusLabels, statusColors, paymentLabels } from '../store.jsx';
import { buildDaySummary, getShanghaiDateString } from '../utils/daySummary.js';
import { ChevronLeft, ChevronRight, Clock, Download, Printer, Copy, BarChart3, Banknote, CalendarDays, CircleDollarSign, Timer, StickyNote, WalletCards, Sparkles, MapPin, UserRound } from 'lucide-react';

export default function Calendar() {
  const { state } = useStore();
  const today = getShanghaiDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const year = viewYear, month = viewMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    if (month === 0) { setViewMonth(11); setViewYear(year - 1); }
    else setViewMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setViewMonth(0); setViewYear(year + 1); }
    else setViewMonth(month + 1);
  };

  const allDayOrders = useMemo(() =>
    state.orders
      .filter(o => o.date === selectedDate)
      .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')),
  [state.orders, selectedDate]);

  const dayOrders = useMemo(() =>
    allDayOrders.filter(o => !['cancelled', 'rejected'].includes(o.status)),
  [allDayOrders]);

  const daySummary = useMemo(() =>
    buildDaySummary(allDayOrders, state.extraServices),
  [allDayOrders, state.extraServices]);

  const serviceName = id => state.extraServices.find(service => service.id === id)?.name || `未知服务（${id}）`;

  // 工作小时 7-18
  const hours = Array.from({ length: 12 }, (_, i) => i + 7);

  // 计算订单在时间线中的位置
  function getOrderStyle(order) {
    const start = timeToMin(order.time);
    const duration = order.duration || 1;
    const top = ((start - 420) / 720) * 100; // 420=7:00, 720=12h
    const height = (duration * 60 / 720) * 100;
    return { top: `${top}%`, height: `${Math.max(height, 4)}%` };
  }

  // 导出日历
  const exportICS = () => {
    const monthOrders = state.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === month && d.getFullYear() === year && o.status !== 'cancelled';
    });

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//小荷约妆//CN',
      'X-WR-CALNAME:小荷约妆 - 排期',
    ];

    monthOrders.forEach(o => {
      const startH = parseInt(o.time?.split(':')[0] || '0');
      const startM = parseInt(o.time?.split(':')[1] || '0');
      const endH = startH + Math.ceil(o.duration || 1);
      const date = o.date.replace(/-/g, '');
      const dtStart = `${date}T${String(startH).padStart(2,'0')}${String(startM).padStart(2,'0')}00`;
      const dtEnd = `${date}T${String(endH).padStart(2,'0')}0000`;

      ics.push(
        'BEGIN:VEVENT',
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${o.makeupType} - ${o.customerName}`,
        `DESCRIPTION:${o.customerPhone || ''} | 定金¥${o.deposit} | 总价¥${o.price} | ${o.notes || ''}`,
        `LOCATION:${o.location || '地铁5号线凌大塘站D口附近'}`,
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');
    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `小荷排期_${year}年${month+1}月.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 打印视图：打开新窗口，浏览器打印→另存PDF
  const printView = () => {
    const monthOrders = state.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>小荷约妆 ${year}年${month+1}月</title>
<style>body{font-family:'PingFang SC',sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}
h1{text-align:center;font-size:22px;margin-bottom:4px}h1 span{color:#e11d48;font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{background:#f43f5e;color:#fff;padding:8px 10px;font-size:13px;text-align:left}
td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}
tr:nth-child(even){background:#fafafa}
.footer{text-align:center;margin-top:20px;font-size:12px;color:#999}
.c-green{color:#10b981}.c-blue{color:#3b82f6}.c-amber{color:#f59e0b}.c-red{color:#ef4444}.c-gray{color:#9ca3af}
@media print{body{padding:0}@page{size:A4;margin:1cm}}
</style></head><body>
<h1>🪷 小荷约妆 <span>${year}年${month+1}月排期</span></h1>
<table><thead><tr><th>日期</th><th>时间</th><th>客户</th><th>妆造</th><th>状态</th><th>价格</th></tr></thead><tbody>
${monthOrders.map(o => {
  const sc = {pending:'c-amber',confirmed:'c-blue',completed:'c-green',cancelled:'c-gray',rejected:'c-red'};
  const sl = {pending:'待确认',confirmed:'已确认',completed:'已完成',cancelled:'已取消',rejected:'已拒绝'};
  return `<tr><td>${o.date.slice(5)}</td><td>${o.time||''}·${o.duration}h</td><td>${o.customerName}</td><td>${o.makeupType}</td><td class="${sc[o.status]||''}">${sl[o.status]||o.status}</td><td>¥${o.price}</td></tr>`;
}).join('')}
</tbody></table>
<p class="footer">小荷约妆 · ${year}年${month+1}月 · 共${monthOrders.length}单 · 收入¥${monthIncome.toLocaleString()}</p>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // 复制文本版排期
  const copyText = () => {
    const monthOrders = state.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));
    
    const grouped = {};
    monthOrders.forEach(o => {
      if (!grouped[o.date]) grouped[o.date] = [];
      grouped[o.date].push(o);
    });

    const sl = {pending:'待确认',confirmed:'已确认',completed:'已完成',cancelled:'已取消',rejected:'已拒绝'};
    let text = `🪷 小荷约妆 ${year}年${month+1}月排期\n${'─'.repeat(30)}\n`;
    Object.keys(grouped).sort().forEach(date => {
      text += `\n📅 ${date}\n`;
      grouped[date].forEach(o => {
        text += `  ${o.time||'--'} ${o.makeupType} · ${o.customerName} · ¥${o.price} [${sl[o.status]||o.status}]\n`;
      });
    });
    text += `\n${'─'.repeat(30)}\n共${monthOrders.length}单 · 收入¥${monthIncome.toLocaleString()}`;

    navigator.clipboard.writeText(text).then(
      () => alert('已复制！可直接粘贴到微信发送'),
      () => alert('复制失败，请手动选择复制')
    );
  };

  // 月收入
  const monthIncome = useMemo(() =>
    state.orders.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === month && d.getFullYear() === year;
    }).reduce((sum, o) => {
      if (o.paymentStatus === 'full') return sum + o.price;
      if (o.paymentStatus === 'deposit') return sum + (o.deposit || 0);
      return sum;
    }, 0),
  [state.orders, year, month]);

  // 本月预期收入：有效订单的总价，不含已取消、已拒绝订单
  const monthExpectedIncome = useMemo(() =>
    state.orders.filter(o => {
      const d = new Date(`${o.date}T00:00:00`);
      return d.getMonth() === month && d.getFullYear() === year && !['cancelled', 'rejected'].includes(o.status);
    }).reduce((sum, o) => sum + (Number(o.price) || 0), 0),
  [state.orders, year, month]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 月历格子
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = state.orders.filter(o => o.date === ds && o.status !== 'cancelled').length;
      days.push({ day: d, dateStr: ds, count });
    }
    return days;
  }, [year, month, daysInMonth, firstDayOfWeek, state.orders]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-warm-800 font-heading flex items-center gap-2"><CalendarDays className="w-5 h-5 text-brand-500" />排期日历</h2>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-white transition-colors">
            <ChevronLeft className="w-4 h-4 text-warm-800" />
          </button>
          <span className="text-base font-bold text-warm-800 min-w-[80px] text-center">{year}年{month + 1}月</span>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-white transition-colors">
            <ChevronRight className="w-4 h-4 text-warm-800" />
          </button>
          <button onClick={exportICS}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-brand-200 text-brand-600 rounded-xl hover:bg-brand-50 transition-colors ml-2">
            <Download className="w-4 h-4" /> ics
          </button>
          <button onClick={printView}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-brand-200 text-brand-600 rounded-xl hover:bg-brand-50 transition-colors">
            <Printer className="w-4 h-4" />打印
          </button>
          <button onClick={copyText}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-brand-200 text-brand-600 rounded-xl hover:bg-brand-50 transition-colors">
            <Copy className="w-4 h-4" />复制文本
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-warm-800/60 inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-[#6f927a]" />当月 <strong className="text-warm-800">{state.orders.filter(o => {const d=new Date(o.date);return d.getMonth()===month&&d.getFullYear()===year;}).length}</strong> 单</span>
        <span className="text-warm-800/60 inline-flex items-center gap-1.5"><Banknote className="w-4 h-4 text-brand-500" />本月已收 <strong className="text-brand-600">¥{monthIncome.toLocaleString()}</strong></span>
        <span className="text-warm-800/60 inline-flex items-center gap-1.5"><CircleDollarSign className="w-4 h-4 text-[#6f927a]" />本月预期收入 <strong className="text-[#52745e]">¥{monthExpectedIncome.toLocaleString()}</strong></span>
      </div>

      {/* 选中日期后首屏可见的每日摘要 */}
      <div className="rounded-2xl border border-brand-100 bg-white/85 shadow-sm p-3 md:p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-warm-800">{selectedDate}</span>
            <span className="text-sm text-warm-800/55">有效 <strong className="text-emerald-700">{daySummary.activeCount}</strong> 单</span>
            <span className="text-sm text-warm-800/55">总额 <strong className="text-brand-600">¥{daySummary.totalAmount}</strong></span>
            <span className="text-sm text-warm-800/55">已收 <strong className="text-amber-700">¥{daySummary.receivedAmount}</strong></span>
            <span className="text-sm text-warm-800/55">工时 <strong>{daySummary.totalHours}h</strong></span>
            <span className="text-sm text-warm-800/55">备注 <strong>{daySummary.noteCount}</strong> 单</span>
          </div>
          <button
            type="button"
            onClick={() => document.getElementById('daily-order-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-4 py-2 rounded-xl bg-[#eaf5ed] text-[#37694d] text-sm font-semibold hover:bg-[#deeee3] transition-colors"
          >
            查看当日完整详情 ↓
          </button>
        </div>
        {daySummary.serviceCounts.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-brand-50">
          <span className="text-xs text-warm-800/40 mr-1">附加服务</span>
          {daySummary.serviceCounts.map(item => <span key={item.name} className="px-2 py-1 rounded-full bg-[#edf7f0] text-[#46745a] text-[11px]">{item.name} × {item.count}</span>)}
        </div>}
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Left: Mini calendar */}
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm">
          <div className="grid grid-cols-7 border-b border-brand-50">
            {weekDays.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-semibold text-warm-800/40">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, i) => (
              <div key={i}
                onClick={() => cell && setSelectedDate(cell.dateStr)}
                className={`aspect-square p-1 flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-brand-50/50 text-sm ${
                  !cell ? 'bg-gray-50/50 text-gray-300' :
                  cell.dateStr === selectedDate ? 'bg-brand-100 text-rose-700 font-bold' :
                  cell.dateStr === today ? 'bg-brand-50 text-brand-600 font-semibold' :
                  'text-warm-800'
                }`}>
                {cell && <>
                  <span>{cell.day}</span>
                  {cell.count > 0 && <span className="text-[10px] text-rose-400 leading-none">{cell.count}单</span>}
                </>}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Day timeline */}
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm">
          <div className="px-4 py-3 border-b border-brand-100 flex items-center justify-between">
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" />
              {selectedDate}
            </h3>
            <span className="text-sm text-warm-800/40">{dayOrders.length} 单</span>
          </div>

          {/* Timeline */}
          <div className="relative" style={{ height: '500px', overflowY: 'auto' }}>
            {/* Hour grid */}
            <div className="absolute inset-0">
              {hours.map(h => (
                <div key={h} className="absolute left-0 right-0 border-t border-brand-50 flex"
                  style={{ top: `${((h - 7) / 12) * 100}%`, height: `${(1 / 12) * 100}%` }}>
                  <span className="text-[10px] text-warm-800/30 w-12 shrink-0 text-right pr-2 pt-0.5">
                    {String(h).padStart(2, '0')}:00
                  </span>
                  <div className="flex-1" />
                </div>
              ))}
            </div>

            {/* Orders */}
            <div className="relative ml-12 mr-3" style={{ height: '100%' }}>
              {dayOrders.map(o => {
                const style = getOrderStyle(o);
                const colors = {
                  pending: 'bg-amber-100 border-amber-300 text-amber-800',
                  confirmed: 'bg-blue-100 border-blue-300 text-blue-800',
                  completed: 'bg-emerald-100 border-emerald-300 text-emerald-800',
                  rejected: 'bg-red-100 border-red-300 text-red-600',
                };
                return (
                  <div key={o.id}
                    className={`absolute left-1 right-1 rounded-lg border px-2 py-1 overflow-visible text-xs leading-relaxed ${colors[o.status] || colors.pending}`}
                    style={style}
                    title={`${o.customerName} · ${o.makeupType} · ¥${o.price}`}>
                    <div className="font-semibold truncate">{o.time?.slice(0,5)} {o.makeupType}</div>
                    <div className="truncate">{o.customerName} · ¥{o.price}</div>
                  </div>
                );
              })}

              {dayOrders.length === 0 && (
                <div className="flex items-center justify-center h-full text-warm-800/25 text-sm">
                  当天暂无预约
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily overview */}
      <section id="daily-order-details" className="panel-luxe rounded-3xl p-4 md:p-5 space-y-4 scroll-mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] tracking-[.18em] text-brand-500 font-semibold">DAILY OVERVIEW</p>
            <h3 className="font-bold text-warm-800 mt-1">{selectedDate} 每日经营概览</h3>
          </div>
          {daySummary.cancelledCount > 0 && <span className="text-xs text-warm-800/45">另有 {daySummary.cancelledCount} 笔已取消/拒绝订单</span>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: CalendarDays, label: '有效订单', value: `${daySummary.activeCount} 单`, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { icon: CircleDollarSign, label: '订单总额', value: `¥${daySummary.totalAmount}`, color: 'text-rose-700', bg: 'bg-rose-50' },
            { icon: Banknote, label: '当日已收', value: `¥${daySummary.receivedAmount}`, color: 'text-amber-700', bg: 'bg-amber-50' },
            { icon: Timer, label: '预计工时', value: `${daySummary.totalHours} 小时`, color: 'text-sky-700', bg: 'bg-sky-50' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="rounded-2xl border border-white/80 bg-white/75 p-3.5 shadow-sm flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center`}><Icon className="w-5 h-5" /></span>
              <div><p className="text-xs text-warm-800/45">{label}</p><p className="font-bold text-warm-800 mt-0.5">{value}</p></div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/70 border border-brand-100 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-warm-800 flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-500" />附加服务统计</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {daySummary.serviceCounts.length > 0 ? daySummary.serviceCounts.map(item => <span key={item.name} className="px-3 py-1.5 rounded-full bg-[#edf7f0] text-[#46745a] text-xs">{item.name} × {item.count}</span>) : <span className="text-xs text-warm-800/35">当天没有附加服务</span>}
            </div>
          </div>
          <div className="rounded-2xl bg-white/70 border border-brand-100 p-4 grid grid-cols-2 gap-3">
            <div><StickyNote className="w-4 h-4 text-amber-500" /><p className="text-xl font-bold mt-2">{daySummary.noteCount}</p><p className="text-xs text-warm-800/45">有备注订单</p></div>
            <div><WalletCards className="w-4 h-4 text-emerald-600" /><p className="text-xl font-bold mt-2">{daySummary.cardCount}</p><p className="text-xs text-warm-800/45">优惠卡订单</p></div>
          </div>
        </div>
      </section>

      {/* Daily order cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-bold text-warm-800">当日订单详情</h3><span className="text-xs text-warm-800/40">按预约时间排序</span></div>
        {allDayOrders.length === 0 ? <div className="panel-luxe rounded-2xl py-10 text-center text-sm text-warm-800/35">当天暂无订单</div> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allDayOrders.map(order => (
              <article key={order.id} className={`rounded-2xl border p-4 shadow-sm ${['cancelled','rejected'].includes(order.status) ? 'bg-gray-50 border-gray-200 opacity-65' : 'bg-white border-brand-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs text-brand-500 font-semibold">{order.time || '--:--'} · {order.duration || 0}h</p><h4 className="font-bold text-warm-800 mt-1">{order.makeupType}</h4>{order.roleName && <p className="text-xs text-[#b9637b] mt-1">角色：{order.roleName}</p>}</div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] ${statusColors[order.status] || 'bg-gray-100 text-gray-500'}`}>{statusLabels[order.status] || order.status}</span>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-warm-800"><UserRound className="w-4 h-4 text-warm-800/35" />{order.customerName || '未填写客户'}</p>
                  <p className="flex items-start gap-2 text-warm-800/60"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-warm-800/30" /><span>{order.location || '未填写地点'}</span></p>
                  {(order.extraServices || []).length > 0 && <div className="flex flex-wrap gap-1.5">{order.extraServices.map(id => <span key={id} className="px-2 py-1 rounded-lg bg-[#edf7f0] text-[#557c63] text-[11px]">{serviceName(id)}</span>)}</div>}
                  {order.notes && <div className="rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-900"><span className="font-semibold">备注：</span>{order.notes}</div>}
                </div>
                <div className="mt-4 pt-3 border-t border-brand-50 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-warm-800/35">总价</p><p className="font-bold text-brand-600 mt-0.5">¥{order.price || 0}</p></div>
                  <div><p className="text-warm-800/35">已收</p><p className="font-semibold mt-0.5">¥{order.paymentStatus === 'full' ? order.price || 0 : order.paymentStatus === 'deposit' ? order.deposit || 0 : 0}</p></div>
                  <div><p className="text-warm-800/35">付款</p><p className="font-semibold mt-0.5">{paymentLabels[order.paymentStatus] || order.paymentStatus || '未付款'}</p></div>
                </div>
                {Number(order.cardCoveredAmount) > 0 && <p className="mt-2 text-[11px] text-emerald-700">优惠卡抵扣 ¥{order.cardCoveredAmount}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function timeToMin(t) {
  if (!t) return 0;
  const p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1] || 0);
}

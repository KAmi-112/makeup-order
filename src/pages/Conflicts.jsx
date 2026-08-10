import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarCheck2, Clock3 } from 'lucide-react';
import { useStore } from '../store.jsx';

const toMinutes = time => { const [h, m] = (time || '00:00').split(':').map(Number); return h * 60 + (m || 0); };

export default function Conflicts() {
  const { state } = useStore();
  const navigate = useNavigate();
  const conflicts = useMemo(() => {
    const active = state.orders.filter(o => !['cancelled', 'rejected'].includes(o.status));
    const result = [];
    for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i], b = active[j];
      if (a.date !== b.date) continue;
      const buffer = Number(state.bookingRules?.bufferMinutes || 0);
      const aStart = toMinutes(a.time), bStart = toMinutes(b.time);
      const aEnd = aStart + Number(a.duration || 1) * 60 + buffer;
      const bEnd = bStart + Number(b.duration || 1) * 60 + buffer;
      if (aStart < bEnd && aEnd > bStart) result.push({ a, b });
    }
    return result;
  }, [state.orders, state.bookingRules]);

  return <div className="max-w-5xl mx-auto space-y-5">
    <div><p className="text-xs tracking-[.18em] text-brand-500 font-semibold">SCHEDULE CHECK</p><h2 className="text-2xl font-bold font-heading text-warm-800 mt-1">预约冲突中心</h2><p className="text-sm text-warm-800/45 mt-1">按照订单时长和设置中的整理间隔自动检查。</p></div>
    {conflicts.length === 0 ? <div className="panel-luxe rounded-3xl py-20 text-center"><CalendarCheck2 className="w-12 h-12 mx-auto text-[#70a683] mb-3" /><p className="font-semibold text-warm-800">当前没有时间冲突</p><p className="text-sm text-warm-800/40 mt-1">所有有效订单的时间安排都正常。</p></div> : <div className="space-y-3">{conflicts.map(({ a, b }) => <div key={`${a.id}-${b.id}`} className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-amber-700 font-semibold mb-3"><AlertTriangle className="w-4 h-4" />{a.date} 时间重叠</div>
      <div className="grid sm:grid-cols-2 gap-3">{[a,b].map(order => <button key={order.id} onClick={() => navigate('/orders')} className="text-left rounded-xl bg-amber-50/60 p-3 hover:bg-amber-50"><p className="font-semibold text-warm-800">{order.customerName} · {order.makeupType}</p><p className="text-sm text-warm-800/50 mt-1 inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{order.time}，约 {order.duration} 小时</p></button>)}</div>
    </div>)}</div>}
  </div>;
}

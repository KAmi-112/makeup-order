import { useEffect, useMemo, useState } from 'react';
import { Activity as ActivityIcon, Clock3, RefreshCw } from 'lucide-react';
import { fetchAuditLogs } from '../db.js';
import { useStore } from '../store.jsx';

const labels = { create: '创建订单', update: '修改订单', trash: '移入回收站', restore: '恢复订单', permanent_delete: '彻底删除' };

export default function Activity() {
  const { state } = useStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setLogs(await fetchAuditLogs()); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const names = useMemo(() => new Map([...state.orders, ...state.trashedOrders].map(o => [o.id, o.customerName])), [state.orders, state.trashedOrders]);
  return <div className="max-w-5xl mx-auto space-y-5">
    <div className="flex items-end justify-between"><div><p className="text-xs tracking-[.18em] text-brand-500 font-semibold">AUDIT TRAIL</p><h2 className="text-2xl font-bold font-heading text-warm-800 mt-1">订单操作记录</h2><p className="text-sm text-warm-800/45 mt-1">只记录操作与订单编号，不复制手机号、微信等隐私。</p></div><button onClick={load} className="p-2.5 rounded-xl bg-white border border-brand-100 text-[#597b63]"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    <div className="panel-luxe rounded-3xl overflow-hidden">{logs.length === 0 ? <div className="py-20 text-center text-warm-800/40"><ActivityIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />{loading ? '正在读取记录…' : '还没有操作记录'}</div> : logs.map(log => <div key={log.id} className="flex items-center gap-4 px-5 py-4 border-b border-[#edf1ed] last:border-0"><span className="w-9 h-9 rounded-xl bg-[#edf6ef] text-[#577b62] grid place-items-center"><ActivityIcon className="w-4 h-4" /></span><div className="flex-1"><p className="text-sm font-semibold text-warm-800">{labels[log.action] || log.action} · {names.get(log.orderId) || '订单已彻底删除'}</p><p className="text-xs text-warm-800/35 mt-1">订单编号：{log.orderId}</p></div><span className="text-xs text-warm-800/40 inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{new Date(log.createdAt).toLocaleString('zh-CN')}</span></div>)}</div>
  </div>;
}

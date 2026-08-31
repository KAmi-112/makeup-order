import { useMemo, useState } from 'react';
import { ArchiveRestore, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store.jsx';
import { runSequentialCloudActions } from '../utils/batchCloudActions.js';

export default function TrashPage() {
  const { state, dispatch } = useStore();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return state.trashedOrders;
    return state.trashedOrders.filter(order =>
      [order.customerName, order.customerPhone, order.customerWechat, order.makeupType]
        .some(value => value?.toLowerCase().includes(q))
    );
  }, [state.trashedOrders, search]);

  const toggle = id => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const finishBatch = (failed, total) => {
    setSelectedIds(new Set(failed));
    if (failed.length > 0) {
      window.alert(`${total - failed.length} 项已成功，${failed.length} 项同步失败并已保留选中，请检查网络后重试。`);
    }
  };

  const restore = async ids => {
    const { failed } = await runSequentialCloudActions(ids, dispatch, id => ({ type: 'RESTORE_ORDER', payload: id }));
    finishBatch(failed, ids.length);
  };

  const removeForever = async ids => {
    if (!window.confirm(`将彻底删除 ${ids.length} 个订单？此操作无法恢复。`)) return;
    const { failed } = await runSequentialCloudActions(ids, dispatch, id => ({ type: 'PERMANENT_DELETE_ORDER', payload: id }));
    finishBatch(failed, ids.length);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[#ba6076] mb-1">
            <ArchiveRestore className="w-5 h-5" />
            <span className="text-xs font-semibold tracking-[.18em] uppercase">Order Archive</span>
          </div>
          <h2 className="text-2xl font-bold text-warm-800 font-heading">订单回收站</h2>
          <p className="text-sm text-warm-800/45 mt-1">误删的订单可以恢复；只有“彻底删除”才无法找回。</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-[#ec9caf] to-[#72aa85] text-white px-5 py-3 shadow-[0_12px_28px_rgba(215,127,148,.20)]">
          <span className="text-2xl font-semibold">{state.trashedOrders.length}</span>
          <span className="text-xs text-white/55 ml-2">笔已删除订单</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-800/30" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索客户、手机、微信或妆造"
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          {selectedIds.size > 0 && <>
            <span className="text-sm text-warm-800/55">已选 {selectedIds.size} 项</span>
            <button onClick={() => restore([...selectedIds])} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#e7f2e9] text-[#29533a] text-sm font-semibold"><RotateCcw className="w-4 h-4" />批量恢复</button>
            <button onClick={() => removeForever([...selectedIds])} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold"><Trash2 className="w-4 h-4" />彻底删除</button>
          </>}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-brand-100 py-20 text-center">
          <ArchiveRestore className="w-12 h-12 mx-auto text-brand-200 mb-3" />
          <p className="font-semibold text-warm-800">回收站是空的</p>
          <p className="text-sm text-warm-800/40 mt-1">删除的订单会暂存在这里。</p>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-warm-800/55 px-2">
            <input type="checkbox" checked={orders.length > 0 && orders.every(o => selectedIds.has(o.id))}
              onChange={() => setSelectedIds(orders.every(o => selectedIds.has(o.id)) ? new Set() : new Set(orders.map(o => o.id)))} className="accent-brand-500" />
            选择当前全部
          </label>
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border border-brand-100 shadow-sm px-4 py-4 flex items-center gap-4">
              <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggle(order.id)} className="w-4 h-4 accent-brand-500" />
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center font-bold">{order.customerName?.charAt(0) || '?'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-warm-800 truncate">{order.customerName} · {order.makeupType}</p>
                <p className="text-xs text-warm-800/40 mt-1">预约 {order.date} {order.time} · 删除于 {order.deletedAt ? new Date(order.deletedAt).toLocaleString('zh-CN') : '刚刚'}</p>
              </div>
              <button onClick={() => restore([order.id])} title="恢复订单" className="p-2.5 rounded-xl bg-[#e7f2e9] text-[#29533a] hover:bg-[#d8eadc]"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={() => removeForever([order.id])} title="彻底删除" className="p-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore, generateId, sources, statusLabels, statusColors, paymentLabels, paymentColors, statuses, paymentStatuses } from '../store.jsx';
import {
  Plus, Search, Filter, X, Edit3, Trash2, ChevronDown,
  Sparkles, Copy, FileDown, MoreHorizontal, CheckCircle2, Eye
} from 'lucide-react';

/* ---- 生成可选时间段 ---- */
function generateTimeSlots(date, duration, orders) {
  const WORK_START = 7;  // 7:00
  const WORK_END = 18;   // 18:00
  const slots = [];

  // 收集当天已占用的时间段
  const bookedRanges = [];
  if (date) {
    orders.forEach(o => {
      if (o.date === date && o.status !== 'cancelled') {
        const startH = parseInt(o.time?.split(':')[0]) || 0;
        const endH = startH + (o.duration || 1);
        bookedRanges.push({ start: startH, end: endH });
      }
    });
  }

  // 生成整点时间段
  const maxStart = WORK_END - Math.ceil(duration || 1);
  for (let h = WORK_START; h <= maxStart; h++) {
    const endH = h + Math.ceil(duration || 1);
    // 检查是否与已预约冲突
    const booked = bookedRanges.some(r => h < r.end && endH > r.start);
    const label = `${String(h).padStart(2, '0')}:00 ~ ${String(endH).padStart(2, '0')}:00`;
    slots.push({ value: `${String(h).padStart(2, '0')}:00`, label, booked });
  }

  return slots;
}

/* ---- Order Form Modal ---- */
function OrderForm({ order, onClose }) {
  const { state, dispatch } = useStore();
  const isEdit = !!order;

  const [form, setForm] = useState(order || {
    id: '',
    customerName: '',
    customerPhone: '',
    customerWechat: '',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    duration: 1,
    location: '',
    makeupType: state.makeupTypes[0]?.name || '',
    price: state.makeupTypes[0]?.defaultPrice || 168,
    deposit: 0,
    source: '闲鱼',
    status: 'pending',
    paymentStatus: 'unpaid',
    notes: '',
    extraServices: [],
    createdAt: new Date().toISOString(),
  });

  const handleMakeupTypeChange = (name) => {
    const mt = state.makeupTypes.find(t => t.name === name);
    setForm(f => ({
      ...f,
      makeupType: name,
      price: mt ? mt.defaultPrice : f.price,
      duration: mt ? mt.defaultDuration : f.duration,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalPrice = form.price + (form.extraServices || []).reduce((s, sid) => {
      const svc = state.extraServices.find(es => es.id === sid);
      return s + (svc ? svc.price : 0);
    }, 0);
    const data = {
      ...form,
      price: totalPrice,
      id: isEdit ? form.id : generateId(),
      createdAt: isEdit ? form.createdAt : new Date().toISOString(),
    };
    if (isEdit) {
      dispatch({ type: 'UPDATE_ORDER', payload: data });
    } else {
      dispatch({ type: 'ADD_ORDER', payload: data });
    }
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这个订单吗？此操作不可撤销。')) {
      dispatch({ type: 'DELETE_ORDER', payload: form.id });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center lg:pt-[5vh] lg:px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white lg:rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in h-[100dvh] lg:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-warm-800 text-lg">
            {isEdit ? '✏️ 编辑订单' : '✨ 新建订单'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-warm-100 transition-colors">
            <X className="w-5 h-5 text-warm-800/50" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-4">
            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">客户姓名 *</label>
                <input required className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                  value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="必填" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">手机号</label>
                <input className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                  value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="选填" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-warm-800/60 mb-1">微信号</label>
              <input className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                value={form.customerWechat} onChange={e => setForm(f => ({ ...f, customerWechat: e.target.value }))} placeholder="选填" />
            </div>

            {/* Date / Time / Duration */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">日期 *</label>
                <input required type="date" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">时间 *</label>
                <select required className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition bg-white"
                  value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
                  <option value="" disabled>选择时间</option>
                  {generateTimeSlots(form.date, form.duration, state.orders).map(t => (
                    <option key={t.value} value={t.value} disabled={t.booked}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">时长(h)</label>
                <input type="text" inputMode="decimal" step="0.5" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                  value={form.duration || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); setForm(f => ({ ...f, duration: v === '' ? 0.5 : parseFloat(v) || 0.5 })); }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-warm-800/60 mb-1">地点</label>
              <input className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="如：XX工作室 / 上门" />
            </div>

            {/* Makeup type & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">妆造类型</label>
                <select className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition bg-white"
                  value={form.makeupType} onChange={e => handleMakeupTypeChange(e.target.value)}>
                  {state.makeupTypes.map(mt => (
                    <option key={mt.id} value={mt.name}>{mt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">总价 ¥</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition font-semibold"
                  value={form.price || ''} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, price: v === '' ? 0 : parseInt(v) || 0 })); }} />
              </div>
            </div>

            {/* Deposit & Payment Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">定金 ¥</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
                  value={form.deposit || ''} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, deposit: v === '' ? 0 : parseInt(v) || 0 })); }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">付款状态</label>
                <select className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition bg-white"
                  value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                  {paymentStatuses.map(s => (
                    <option key={s} value={s}>{paymentLabels[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">客源</label>
                <select className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition bg-white"
                  value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {sources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">订单状态</label>
                <select className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition bg-white"
                  value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {statuses.map(s => (
                    <option key={s} value={s}>{statusLabels[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extra Services */}
            {state.extraServices.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-2">附加服务</label>
                <div className="space-y-1.5">
                  {state.extraServices.map(svc => {
                    const checked = (form.extraServices || []).includes(svc.id);
                    const toggle = () => setForm(f => ({
                      ...f,
                      extraServices: checked
                        ? (f.extraServices || []).filter(id => id !== svc.id)
                        : [...(f.extraServices || []), svc.id],
                    }));
                    return (
                      <label key={svc.id}
                        className={`flex items-center justify-between p-3 lg:p-2.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                          checked ? 'border-rose-300 bg-rose-50/50' : 'border-rose-100 hover:border-rose-200'
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={checked} onChange={toggle}
                            className="accent-rose-500 w-4 h-4 rounded" />
                          <span className="text-sm text-warm-800">{svc.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-rose-500">{svc.price > 0 ? `+¥${svc.price}` : '免费'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-warm-800/60 mb-1">备注</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition resize-none"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="过敏史、特殊需求等..." />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-rose-100 flex items-center justify-between shrink-0">
            <div>
              {isEdit && (
                <button type="button" onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" /> 删除
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-warm-800/60 hover:bg-warm-100 rounded-xl transition-colors">
                取消
              </button>
              <button type="submit"
                className="px-5 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-rose-200 hover:shadow-xl transition-all active:scale-95">
                {isEdit ? '保存修改' : '创建订单'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---- Orders Page ---- */
export default function Orders() {
  const { state, dispatch } = useStore();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(!!searchParams.get('new'));
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewCardOrder, setViewCardOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [makeupFilter, setMakeupFilter] = useState('all');
  const [sortBy, setSortBy] = useState('smart');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // 响应式每页数量
  const [perPage, setPerPage] = useState(window.innerWidth < 768 ? 8 : 20);
  useEffect(() => {
    const h = () => setPerPage(window.innerWidth < 768 ? 8 : 20);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const filteredOrders = useMemo(() => {
    let list = state.orders;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.customerName?.toLowerCase().includes(q) ||
        o.customerPhone?.includes(q) ||
        o.customerWechat?.toLowerCase().includes(q) ||
        o.makeupType?.toLowerCase().includes(q) ||
        o.location?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (paymentFilter !== 'all') list = list.filter(o => o.paymentStatus === paymentFilter);
    if (sourceFilter !== 'all') list = list.filter(o => o.source === sourceFilter);
    if (makeupFilter !== 'all') list = list.filter(o => o.makeupType === makeupFilter);

    const today = new Date().toISOString().slice(0, 10);
    const priority = { pending: 0, confirmed: 1, completed: 2, cancelled: 3, rejected: 4 };

    switch (sortBy) {
      case 'smart':
        list.sort((a, b) => {
          if (a.date === today && b.date !== today) return -1;
          if (a.date !== today && b.date === today) return 1;
          const pa = priority[a.status] ?? 5, pb = priority[b.status] ?? 5;
          if (pa !== pb) return pa - pb;
          return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
        });
        break;
      case 'date-desc': list.sort((a, b) => b.date.localeCompare(a.date)); break;
      case 'date-asc': list.sort((a, b) => a.date.localeCompare(b.date)); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'newest': list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    }

    return list;
  }, [state.orders, search, statusFilter, paymentFilter, sourceFilter, makeupFilter, sortBy]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / perPage));
  const pageOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [filteredOrders.length, perPage, statusFilter, paymentFilter, sourceFilter, makeupFilter, search]);

  // 妆造类型列表
  const makeupTypes = [...new Set(state.orders.map(o => o.makeupType).filter(Boolean))];

  const handleEdit = (order) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleCopy = (order) => {
    setEditingOrder({
      ...order,
      id: '',
      customerName: '',
      customerPhone: '',
      customerWechat: '',
      status: 'pending',
      paymentStatus: 'unpaid',
      deposit: 0,
      createdAt: new Date().toISOString(),
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('确定删除此订单？')) {
      dispatch({ type: 'DELETE_ORDER', payload: id });
    }
  };

  const handleStatusChange = (order, newStatus) => {
    const labels = { confirmed: '确认这笔预约？', rejected: '确定拒绝？', completed: '标记为已完成？', pending: '撤回到待确认？' };
    if (labels[newStatus] && !window.confirm(labels[newStatus])) return;
    dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: newStatus } });
  };

  const handlePaymentChange = (order, newPayment) => {
    dispatch({ type: 'UPDATE_ORDER', payload: { ...order, paymentStatus: newPayment } });
  };

  // 批量操作
  const batchUpdateStatus = (newStatus) => {
    if (!window.confirm(`将选中的 ${selectedIds.size} 个订单状态改为「${statusLabels[newStatus]}」？`)) return;
    selectedIds.forEach(id => {
      const o = state.orders.find(x => x.id === id);
      if (o) dispatch({ type: 'UPDATE_ORDER', payload: { ...o, status: newStatus } });
    });
    setSelectedIds(new Set());
  };

  const batchUpdatePayment = (newPayment) => {
    if (!window.confirm(`将选中的 ${selectedIds.size} 个订单付款状态改为「${paymentLabels[newPayment]}」？`)) return;
    selectedIds.forEach(id => {
      const o = state.orders.find(x => x.id === id);
      if (o) dispatch({ type: 'UPDATE_ORDER', payload: { ...o, paymentStatus: newPayment } });
    });
    setSelectedIds(new Set());
  };

  const batchDelete = () => {
    if (window.confirm(`确定删除选中的 ${selectedIds.size} 个订单？`)) {
      selectedIds.forEach(id => dispatch({ type: 'DELETE_ORDER', payload: id }));
      setSelectedIds(new Set());
    }
  };

  // CSV 导出（支持部分导出）
  const exportCSV = (selectedOnly = false) => {
    const list = selectedOnly ? filteredOrders.filter(o => selectedIds.has(o.id)) : filteredOrders;
    if (list.length === 0) return;
    const headers = ['客户姓名', '手机号', '微信', '日期', '时间', '时长', '地点', '妆造类型', '总价', '定金', '付款状态', '客源', '订单状态', '备注'];
    const rows = list.map(o => [
      o.customerName, o.customerPhone, o.customerWechat, o.date, o.time, o.duration,
      o.location, o.makeupType, o.price, o.deposit, paymentLabels[o.paymentStatus],
      o.source, statusLabels[o.status], o.notes
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `订单导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    setSelectedIds(selectedIds.size === filteredOrders.length ? new Set() : new Set(filteredOrders.map(o => o.id)));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-warm-800">📋 订单管理 ({filteredOrders.length})</h2>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-warm-800/60 hover:bg-warm-100 rounded-xl transition-colors"
            disabled={filteredOrders.length === 0}>
            <FileDown className="w-4 h-4" /> 导出CSV
          </button>
          <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-rose-200 hover:shadow-xl transition-all active:scale-95">
            <Plus className="w-4 h-4" /> 新建订单
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-rose-50 rounded-2xl border border-rose-200 p-3 flex items-center gap-2 flex-wrap animate-scale-in">
          <span className="text-sm font-semibold text-rose-600 mr-2">已选 {selectedIds.size} 项</span>
          <button onClick={() => batchUpdateStatus('confirmed')} className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600">✓ 批量确认</button>
          <button onClick={() => batchUpdateStatus('rejected')} className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600">✕ 批量拒绝</button>
          <button onClick={() => batchUpdatePayment('deposit')} className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">💵 批量定金</button>
          <button onClick={() => batchUpdatePayment('full')} className="px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">💰 批量全款</button>
          <button onClick={() => exportCSV(true)} className="px-3 py-1.5 text-xs font-medium bg-violet-500 text-white rounded-lg hover:bg-violet-600">📥 导出选中</button>
          <button onClick={batchDelete} className="px-3 py-1.5 text-xs font-medium bg-gray-500 text-white rounded-lg hover:bg-gray-600 ml-auto">🗑 删除</button>
          <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-rose-500">取消选择</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-800/30" />
            <input
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-rose-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
              placeholder="搜索客户姓名、手机、微信、妆造..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-warm-800/40" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${
              showFilters ? 'bg-rose-50 text-rose-600' : 'text-warm-800/60 hover:bg-warm-100'
            }`}>
            <Filter className="w-4 h-4" /> 筛选
            {(statusFilter !== 'all' || paymentFilter !== 'all' || sourceFilter !== 'all') && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                {(statusFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">
            <option value="smart">智能排序</option>
            <option value="date-asc">日期 ↑</option>
            <option value="price-desc">价格 ↓</option>
            <option value="price-asc">价格 ↑</option>
            <option value="newest">最新创建</option>
          </select>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-rose-50 animate-fade-in">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">
              <option value="all">全部状态</option>
              {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">
              <option value="all">全部付款</option>
              {paymentStatuses.map(s => <option key={s} value={s}>{paymentLabels[s]}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">
              <option value="all">全部客源</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {makeupTypes.length > 0 && (
              <select value={makeupFilter} onChange={e => setMakeupFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">
                <option value="all">全部妆造</option>
                {makeupTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {(statusFilter !== 'all' || paymentFilter !== 'all' || sourceFilter !== 'all' || makeupFilter !== 'all') && (
              <button onClick={() => { setStatusFilter('all'); setPaymentFilter('all'); setSourceFilter('all'); setMakeupFilter('all'); }}
                className="px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Batch actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-rose-50 animate-fade-in">
            <span className="text-sm text-warm-800/60">已选 {selectedIds.size} 个</span>
            <button onClick={batchDelete}
              className="px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
              批量删除
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-sm text-warm-800/60 hover:bg-warm-100 rounded-lg transition-colors">
              取消选择
            </button>
          </div>
        )}
      </div>

      {/* Order List — Desktop Table */}
      <div className="hidden lg:block bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-rose-200" />
            <p className="text-warm-800/40 text-sm mb-3">暂无订单数据</p>
            <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="px-4 py-2 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-100 transition-colors">
              创建第一个订单
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-rose-100 bg-rose-50/30">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" className="accent-rose-500 rounded"
                      checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60">客户</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60 hidden md:table-cell">日期/时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60 hidden sm:table-cell">妆造</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60">价格</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60 hidden lg:table-cell">付款</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60 hidden lg:table-cell">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warm-800/60 hidden lg:table-cell">客源</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-warm-800/60">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageOrders.map(o => (
                  <tr key={o.id} className="border-b border-rose-50 hover:bg-rose-50/30 transition-colors group">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="accent-rose-500 rounded"
                        checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600 shrink-0">
                          {o.customerName?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-warm-800 truncate max-w-[120px]">{o.customerName}</p>
                          {o.customerPhone && <p className="text-[11px] text-warm-800/40">{o.customerPhone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-warm-800">{o.date}</p>
                      <p className="text-xs text-warm-800/40">{o.time} · {o.duration}h</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-warm-800">{o.makeupType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-warm-800">¥{o.price}</p>
                      {o.deposit > 0 && <p className="text-[11px] text-amber-600">定金 ¥{o.deposit}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <select value={o.paymentStatus} onChange={e => handlePaymentChange(o, e.target.value)}
                        className="text-[11px] font-medium rounded-lg border border-gray-200 bg-white py-1 px-1.5">
                        <option value="unpaid">未付</option>
                        <option value="deposit">定金</option>
                        <option value="full">全款</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[o.status]}`}>
                          {statusLabels[o.status]}
                        </span>
                        {o.status === 'pending' && (
                          <button onClick={() => handleStatusChange(o, 'confirmed')} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" title="确认">✓</button>
                        )}
                        {o.status === 'confirmed' && (
                          <button onClick={() => handleStatusChange(o, 'completed')} className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200" title="完成">✓</button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-warm-800/50">{o.source}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(o)}
                          className="p-1.5 rounded-lg hover:bg-rose-100 text-warm-800/50 hover:text-rose-600 transition-colors"
                          title="编辑">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleCopy(o)}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-warm-800/50 hover:text-blue-600 transition-colors"
                          title="复制">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(o.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-warm-800/50 hover:text-red-500 transition-colors"
                          title="删除">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order List — Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-rose-200" />
            <p className="text-warm-800/40 text-sm mb-3">暂无订单数据</p>
            <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="px-4 py-2 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-100 transition-colors">
              创建第一个订单
            </button>
          </div>
        ) : (
          pageOrders.map(o => (
            <div key={o.id}
              className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 active:bg-rose-50/50 transition-colors animate-scale-in">
              {/* Top row: avatar + name + price */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} className="w-4 h-4 accent-rose-500 shrink-0" />
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600 shrink-0">
                    {o.customerName?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-warm-800 truncate">{o.customerName}</p>
                    {o.customerPhone && <p className="text-[11px] text-warm-800/40">{o.customerPhone}</p>}
                  </div>
                </div>
                <p className="text-base font-bold text-rose-600 shrink-0 ml-2">¥{o.price}</p>
              </div>

              {/* Info tags */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">{o.makeupType}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColors[o.paymentStatus]}`}>{paymentLabels[o.paymentStatus]}</span>
                <span className="text-xs text-warm-800/40">{o.source}</span>
              </div>

              {/* Date row */}
              <div className="flex items-center gap-3 text-xs text-warm-800/50 mb-3">
                <span>📅 {o.date} {o.time}</span>
                <span>⏱ {o.duration}h</span>
                {o.location && <span>📍 {o.location}</span>}
              </div>

              {/* Notes */}
              {o.notes && (
                <p className="text-xs text-warm-800/40 mb-3 bg-warm-50 rounded-lg px-3 py-2">{o.notes}</p>
              )}

              {/* Quick status buttons */}
              <div className="flex items-center gap-1.5 mb-2">
                {o.status === 'pending' && (
                  <>
                    <button onClick={() => handleStatusChange(o, 'confirmed')}
                      className="flex-1 py-1.5 text-[11px] font-semibold bg-blue-500 text-white rounded-lg active:bg-blue-600">
                      ✓ 确认
                    </button>
                    <button onClick={() => handleStatusChange(o, 'rejected')}
                      className="flex-1 py-1.5 text-[11px] font-semibold bg-red-500 text-white rounded-lg active:bg-red-600">
                      ✕ 拒绝
                    </button>
                  </>
                )}
                {o.status === 'confirmed' && (
                  <button onClick={() => handleStatusChange(o, 'completed')}
                    className="flex-1 py-1.5 text-[11px] font-semibold bg-emerald-500 text-white rounded-lg active:bg-emerald-600">
                    ✅ 完成
                  </button>
                )}
                {(o.status === 'confirmed' || o.status === 'rejected') && (
                  <button onClick={() => handleStatusChange(o, 'pending')}
                    className="flex-1 py-1.5 text-[11px] font-semibold bg-gray-400 text-white rounded-lg active:bg-gray-500">
                    ↩ 撤回
                  </button>
                )}
                <select
                  value={o.paymentStatus}
                  onChange={e => handlePaymentChange(o, e.target.value)}
                  className="flex-1 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white text-center"
                  style={{ minWidth: 0 }}>
                  <option value="unpaid">未付款</option>
                  <option value="deposit">已付定金</option>
                  <option value="full">已付全款</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-rose-50">
                <button onClick={() => handleEdit(o)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-rose-600 bg-rose-50 rounded-lg active:bg-rose-100">
                  <Edit3 className="w-3 h-3" /> 编辑
                </button>
                <button onClick={() => setViewCardOrder(o)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded-lg active:bg-emerald-100">
                  <Eye className="w-3 h-3" /> 卡片
                </button>
                <button onClick={() => handleDelete(o.id)}
                  className="py-1.5 px-2 text-[11px] font-medium text-red-500 bg-red-50 rounded-lg active:bg-red-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button disabled={page <= 1} onClick={() => setPage(1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-rose-200 disabled:opacity-30 hover:bg-rose-50">首页</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-rose-200 disabled:opacity-30 hover:bg-rose-50">‹</button>
          <span className="text-xs text-warm-800/60 px-2">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-rose-200 disabled:opacity-30 hover:bg-rose-50">›</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-rose-200 disabled:opacity-30 hover:bg-rose-50">末页</button>
          <span className="text-[11px] text-warm-800/30 ml-2">共 {filteredOrders.length} 条</span>
        </div>
      )}

      {/* Order Form Modal */}
      {showForm && (
        <OrderForm
          order={editingOrder}
          onClose={() => { setShowForm(false); setEditingOrder(null); }}
        />
      )}

      {/* Confirmation Card Modal */}
      {viewCardOrder && <OrderConfirmCard order={viewCardOrder} onClose={() => setViewCardOrder(null)} />}
    </div>
  );
}

/* ---- Order Confirm Card ---- */
function OrderConfirmCard({ order, onClose }) {
  const { state } = useStore();
  const confirmedServices = state.extraServices.filter(s =>
    (order.extraServices || []).includes(s.id)
  );
  const basePrice = order.price - confirmedServices.reduce((s, svc) => s + svc.price, 0);
  const [copied, setCopied] = useState(false);

  const cardText = [
    '【妆造订单确认】💄',
    '',
    `👤 客户：${order.customerName}`,
    order.customerPhone ? `📱 手机：${order.customerPhone}` : '',
    order.customerWechat ? `💬 微信：${order.customerWechat}` : '',
    '',
    `💄 妆造：${order.makeupType}`,
    `📅 日期：${order.date}`,
    `⏰ 时间：${order.time}（约 ${order.duration} 小时）`,
    order.location ? `📍 地点：${order.location}` : '',
    '',
    `💰 妆造费：¥${basePrice}`,
    ...confirmedServices.map(s => `   + ${s.name}：¥${s.price}`),
    `   ──────────────`,
    `   合计：¥${order.price}`,
    order.deposit > 0 ? `💵 定金：¥${order.deposit}` : '',
    order.deposit > 0 ? `🧾 尾款：¥${order.price - order.deposit}（妆后面结）` : '',
    '',
    order.notes ? `📝 备注：${order.notes}` : '',
  ].filter(l => l !== '').join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(cardText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const emojiMap = { '日常妆': '🌸', 'lo妆': '🎀', 'COS': '🎭', '新娘': '👰', '舞台': '🎪', '写真': '📷', '主持': '🎤', '伴娘': '💐', '毕业': '🎓' };
  const emoji = Object.entries(emojiMap).find(([k]) => order.makeupType?.includes(k))?.[1] || '💄';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-gray-100">
          <h3 className="font-bold text-warm-800 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-500" /> 订单确认卡片
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-all active:scale-95 ${
                copied ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
              }`}>
              {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制文本</>}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Card Preview */}
        <div className="overflow-y-auto p-5 flex-1">
          <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50 rounded-2xl border-2 border-rose-100 p-5 shadow-inner">
            {/* Brand */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center mx-auto mb-2 shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-rose-400 font-medium tracking-widest uppercase">西瓜椰约妆</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-rose-100" />
              <span className="text-2xl">{emoji}</span>
              <div className="flex-1 h-px bg-rose-100" />
            </div>

            {/* Customer */}
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-warm-800">{order.customerName}</p>
              <p className="text-xs text-warm-800/40">{order.makeupType}</p>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center py-2 px-3 bg-white/70 rounded-xl">
                <span className="text-warm-800/50">📅 日期</span>
                <span className="font-semibold text-warm-800">{order.date}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-white/70 rounded-xl">
                <span className="text-warm-800/50">⏰ 时间</span>
                <span className="font-semibold text-warm-800">{order.time}（约{order.duration}h）</span>
              </div>
              {order.location && (
                <div className="flex justify-between items-center py-2 px-3 bg-white/70 rounded-xl">
                  <span className="text-warm-800/50">📍 地点</span>
                  <span className="font-semibold text-warm-800">{order.location}</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="bg-white rounded-xl p-3 mb-3 border border-rose-50">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-warm-800/50">妆造费</span>
                <span className="text-warm-800">¥{basePrice}</span>
              </div>
              {confirmedServices.map(s => (
                <div key={s.id} className="flex justify-between text-sm mb-1">
                  <span className="text-warm-800/40">+ {s.name}</span>
                  <span className="text-warm-800/60">¥{s.price}</span>
                </div>
              ))}
              <div className="border-t border-rose-100 pt-2 mt-1 flex justify-between">
                <span className="font-semibold text-warm-800">合计</span>
                <span className="text-lg font-extrabold text-rose-600">¥{order.price}</span>
              </div>
            </div>

            {/* Deposit */}
            {order.deposit > 0 && (
              <div className="flex gap-2 text-xs mb-3">
                <div className="flex-1 bg-amber-50 rounded-xl p-2.5 text-center">
                  <p className="text-amber-600 font-bold text-base">¥{order.deposit}</p>
                  <p className="text-amber-500">已付定金</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-gray-600 font-bold text-base">¥{order.price - order.deposit}</p>
                  <p className="text-gray-400">妆后面结</p>
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-amber-50/50 rounded-xl p-3 text-xs text-amber-700 mb-3">
                📝 {order.notes}
              </div>
            )}

            {/* Footer */}
            <p className="text-center text-[10px] text-warm-800/25">
              💡 约定时间为开始化妆时间，请提前到达整理美瞳和发网
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

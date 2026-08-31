import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { useStore, generateId, sources, statusLabels, statusColors, paymentLabels, paymentColors, statuses, paymentStatuses } from '../store.jsx';
import { loadLocalOrderBackgrounds, pickOrderBackground } from '../orderCardBackgrounds.js';
import { markCardOrderNoShow } from '../db.js';
import { runSequentialCloudActions } from '../utils/batchCloudActions.js';
import { getEffectiveServicePrice, getPriceAdjustment } from '../utils/pricing.js';
import {
  Plus, Search, Filter, X, Edit3, Trash2, ChevronDown,
  Sparkles, Copy, FileDown, MoreHorizontal, CheckCircle2, Eye, Printer, Brush,
  ArchiveRestore, BadgeCheck, WalletCards, MousePointer2, Tag, MessageSquareText, Shuffle
} from 'lucide-react';

/* ---- 生成可选时间段 ---- */
function generateTimeSlots(date, duration, orders, excludeOrderId, bookingRules) {
  const available = bookingRules?.availableHours || bookingRules?.workingHours || { start: '05:00', end: '23:00' };
  const toMinutes = value => { const [hour, minute] = String(value || '00:00').split(':').map(Number); return hour * 60 + (minute || 0); };
  const format = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const workStart = toMinutes(available.start);
  const workEnd = toMinutes(available.end);
  const durationMinutes = Math.max(30, Number(duration || 1) * 60);
  const slots = [];

  // 收集当天已占用的时间段
  const bookedRanges = [];
  if (date) {
    orders.forEach(o => {
      if (o.id !== excludeOrderId && o.date === date && !['cancelled', 'rejected', 'no_show'].includes(o.status)) {
        const start = toMinutes(o.time);
        const end = start + Number(o.duration || 1) * 60;
        bookedRanges.push({ start, end });
      }
    });
  }

  // 与小程序一致，按 30 分钟生成，并支持 05:00～23:00 等云端可约范围。
  for (let start = workStart; start + durationMinutes <= workEnd; start += 30) {
    const end = start + durationMinutes;
    const booked = bookedRanges.some(range => start < range.end && end > range.start);
    slots.push({ value: format(start), label: `${format(start)} ~ ${format(end)}`, booked });
  }

  return slots;
}

/* ---- Order Form Modal ---- */
function OrderForm({ order, onClose }) {
  const { state, dispatch } = useStore();
  const isEdit = !!order;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState(order || {
    id: '',
    customerName: '',
    customerPhone: '',
    customerWechat: '',
    roleName: '',
    date: new Date().toISOString().slice(0, 10),
    time: '09:00',
    duration: 1,
    location: '小荷工作室',
    makeupType: state.makeupTypes[0]?.name || '',
    price: state.makeupTypes[0]?.defaultPrice || 168,
    deposit: 0,
    source: '闲鱼',
    status: 'pending',
    paymentStatus: 'unpaid',
    notes: '',
    tags: [],
    extraServices: [],
    createdAt: new Date().toISOString(),
  });

  // 当 order prop 变化时同步表单
  useEffect(() => {
    if (order) setForm(order);
  }, [order]);

  const handleMakeupTypeChange = (name) => {
    const mt = state.makeupTypes.find(t => t.name === name);
    setForm(f => ({
      ...f,
      makeupType: name,
      price: mt ? mt.defaultPrice : f.price,
      duration: mt ? mt.defaultDuration : f.duration,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const normalizedDuration = Number(form.duration);
    if (!Number.isFinite(normalizedDuration) || normalizedDuration < 0.5 || normalizedDuration > 8) {
      setSaveError('时长需要填写 0.5～8 小时'); return;
    }
    const totalPrice = form.price + (form.extraServices || []).reduce((s, sid) => {
      const svc = state.extraServices.find(es => es.id === sid);
      return s + (svc ? getEffectiveServicePrice(form.makeupType, svc) : 0);
    }, 0);
    // 时间冲突检测
    const conflict = state.orders.find(o =>
      o.id !== form.id &&
      o.date === form.date &&
      o.status !== 'cancelled' &&
      o.status !== 'rejected' &&
      timeOverlap(form.time, normalizedDuration, o.time, o.duration)
    );
    if (conflict) {
      const ok = window.confirm(
        `⚠️ 时间冲突提醒\n\n${form.date} ${form.time}（约${form.duration}h）\n与以下订单时间重叠：\n\n「${conflict.customerName}」${conflict.makeupType}\n${conflict.time}（约${conflict.duration}h）\n\n是否仍然保存？`
      );
      if (!ok) return;
    }

    const data = {
      ...form,
      duration: normalizedDuration,
      price: totalPrice,
      id: isEdit ? form.id : generateId(),
      createdAt: isEdit ? form.createdAt : new Date().toISOString(),
    };
    setSaving(true); setSaveError('');
    const ok = await dispatch({ type: isEdit ? 'UPDATE_ORDER' : 'ADD_ORDER', payload: data });
    setSaving(false);
    if (!ok) { setSaveError('云端没有保存成功，请重试'); return; }
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('将这个订单移入回收站？之后仍可恢复。')) {
      dispatch({ type: 'DELETE_ORDER', payload: form.id });
      onClose();
    }
  };

  function timeOverlap(t1, d1, t2, d2) {
    if (!t1 || !t2) return false;
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const s1 = toMin(t1), e1 = s1 + (d1 || 1) * 60;
    const s2 = toMin(t2), e2 = s2 + (d2 || 1) * 60;
    return s1 < e2 && e1 > s2;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center lg:pt-[5vh] lg:px-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white lg:rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in h-screen lg:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-brand-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-warm-800 text-lg">
            {isEdit ? '编辑订单' : '✨ 新建订单'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-warm-100 transition-colors">
            <X className="w-5 h-5 text-warm-800/50" />
          </button>
        </div>

        {/* Body */}
        <form id="orderForm" onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-3.5 pb-6">
            {/* Customer info */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">客户姓名 <span className="text-red-500">*</span></label>
                <input required className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition placeholder:text-warm-muted/50"
                  value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} placeholder="必填" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">手机号</label>
                <input className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                  value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} placeholder="选填" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">微信号</label>
                <input className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                  value={form.customerWechat} onChange={e => setForm(f => ({ ...f, customerWechat: e.target.value }))} placeholder="选填" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1.5">角色名称 <span className="font-normal text-warm-800/40">COS预约建议填写</span></label>
              <input maxLength={80} className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                value={form.roleName || ''} onChange={e => setForm(f => ({ ...f, roleName: e.target.value }))} placeholder="例如：崩坏：星穹铁道·流萤" />
            </div>

            {/* Date / Time / Duration */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">日期 <span className="text-red-500">*</span></label>
                <input required type="date" className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                  value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">时间 <span className="text-red-500">*</span></label>
                <select required className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition bg-white"
                  value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}>
                  <option value="" disabled>选择时间</option>
                  {generateTimeSlots(form.date, form.duration, state.orders, form.id, state.bookingRules).map(t => (
                    <option key={t.value} value={t.value} disabled={t.booked}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">时长(h)</label>
                <input type="number" inputMode="decimal" step="0.5" min="0.5" max="8" className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                  value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1.5">地点</label>
              <input className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="如：XX工作室 / 上门" />
            </div>

            {/* Makeup type & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">妆造类型</label>
                <select className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition bg-white"
                  value={form.makeupType} onChange={e => handleMakeupTypeChange(e.target.value)}>
                  {state.makeupTypes.map(mt => (
                    <option key={mt.id} value={mt.name}>{mt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">总价 ¥</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-3 rounded-lg border-2 border-brand-300 text-sm bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400 transition font-bold text-brand-700"
                  value={form.price || ''} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, price: v === '' ? 0 : parseInt(v) || 0 })); }} />
              </div>
            </div>

            {/* Deposit & Payment Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">定金 ¥</label>
                <input type="text" inputMode="numeric" className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
                  value={form.deposit || ''} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, deposit: v === '' ? 0 : parseInt(v) || 0 })); }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">付款状态</label>
                <select className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition bg-white"
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
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">客源</label>
                <select className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition bg-white"
                  value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {sources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-800 mb-1.5">订单状态</label>
                <select className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition bg-white"
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
                <label className="block text-xs font-semibold text-warm-800/60 mb-2">附加服务</label>
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
                          checked ? 'border-rose-300 bg-brand-50/50' : 'border-brand-100 hover:border-brand-200'
                        }`}>
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" checked={checked} onChange={toggle}
                            className="accent-brand-500 w-4 h-4 rounded" />
                          <span className="text-sm text-warm-800">{svc.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-brand-600">{svc.price > 0 ? `+¥${svc.price}` : '免费'}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1.5">订单标签</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {['漫展', '外出妆', '老客户', '重点注意'].map(tag => {
                  const active = (form.tags || []).includes(tag);
                  return <button key={tag} type="button" onClick={() => setForm(f => ({ ...f, tags: active ? (f.tags || []).filter(t => t !== tag) : [...(f.tags || []), tag] }))} className={`px-3 py-1.5 rounded-full text-xs border ${active ? 'bg-[#edf6ef] border-[#aacbb4] text-[#477257]' : 'bg-white border-brand-100 text-warm-800/45'}`}>{tag}</button>;
                })}
              </div>
              <input value={(form.tags || []).join('、')} onChange={e => setForm(f => ({ ...f, tags: e.target.value.split(/[、,，]/).map(t => t.trim()).filter(Boolean).slice(0, 8) }))} placeholder="也可以输入自定义标签，用顿号分隔" className="w-full px-3 py-2.5 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-warm-800 mb-1.5">备注</label>
              <textarea rows={2} className="w-full px-3 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition resize-none"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="过敏史、特殊需求等..." />
            </div>
          </div>

        </form>

        {/* Footer — 始终可见 */}
        <div className="px-6 py-4 border-t border-brand-100 flex items-center justify-between shrink-0 sticky bottom-0 bg-white z-10">
          <div>
            {isEdit && (
              <button type="button" onClick={handleDelete}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl">
                 删除
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-warm-800/60 hover:bg-warm-100 rounded-xl">
              取消
            </button>
            {saveError && <span className="text-xs text-red-600 max-w-48">{saveError}</span>}
            <button type="submit" form="orderForm" disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-brand-200 hover:shadow-xl active:scale-95 disabled:opacity-50">
              {saving ? '正在同步…' : isEdit ? '💾 保存修改' : '✨ 创建订单'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const toMin = (t) => { const [h, m] = (t||'00:00').split(':').map(Number); return h * 60 + (m || 0); };
const timeOverlap = (t1, d1, t2, d2) => { if(!t1||!t2) return false; const s1=toMin(t1),e1=s1+(d1||1)*60,s2=toMin(t2),e2=s2+(d2||1)*60; return s1<e2&&e1>s2; };

/* ---- Orders Page ---- */
export default function Orders() {
  const { state, dispatch } = useStore();
  const [searchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(!!searchParams.get('new'));
  const [editingOrder, setEditingOrder] = useState(null);
  const [viewCardOrder, setViewCardOrder] = useState(null);
  const [orderBackgrounds, setOrderBackgrounds] = useState([]);
  const [reminderOrder, setReminderOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') || 'all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [makeupFilter, setMakeupFilter] = useState('all');
  const [sortBy, setSortBy] = useState('smart');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => { loadLocalOrderBackgrounds().then(setOrderBackgrounds); }, []);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const dragSelection = useRef({ active: false, mode: 'add' });
  const lastSelectedIndex = useRef(null);

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
        o.roleName?.toLowerCase().includes(q) ||
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

  const handleDelete = (id) => {
    if (window.confirm('将此订单移入回收站？之后仍可恢复。')) {
      dispatch({ type: 'DELETE_ORDER', payload: id });
    }
  };

  const printOrderCard = (order) => {
    const sl = statusLabels, pl = paymentLabels, loc = order.location || '小荷工作室';
    const background = pickOrderBackground(orderBackgrounds);
    const backgroundCss = background ? `background-image:url("${background.url}");` : '';
    const card = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>订单确认卡</title>
<style>body{font-family:'PingFang SC',sans-serif;color:#333;display:flex;justify-content:center;padding:20px}
.card{position:relative;overflow:hidden;border:2px dashed #ec4899;border-radius:16px;padding:24px;max-width:400px;width:100%;background-size:cover;background-position:center;${backgroundCss}}
.card:before{content:'';position:absolute;inset:0;background:rgba(255,252,252,.82);backdrop-filter:blur(1px)}
.card>*{position:relative;z-index:1}
.brand{text-align:center;color:#ec4899;font-weight:700;font-size:13px;margin-bottom:4px}
.title{text-align:center;font-size:20px;font-weight:800;margin-bottom:20px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #fce7f3;font-size:15px}
.row span{color:#888}.price{color:#ec4899;font-size:22px;font-weight:800}
.tips{margin-top:14px;padding:12px;background:#fef2f2;border-radius:10px;font-size:11px;color:#dc2626;line-height:1.9}
@media print{body{padding:0}.card{border:1px dashed #ec4899;margin:0}}
</style></head><body><div class="card">
<div class="brand">小荷约妆</div><div class="title">订单确认卡</div>
<div class="row"><span>客户</span><strong>${order.customerName}</strong></div>
${order.roleName ? '<div class="row"><span>角色</span><strong>'+order.roleName+'</strong></div>' : ''}
<div class="row"><span>妆造</span><strong>${order.makeupType}</strong></div>
<div class="row"><span>日期</span><strong>${order.date}</strong></div>
<div class="row"><span>时间</span><strong>${order.time}（约${order.duration}h）</strong></div>
<div class="row"><span>地点</span><strong>${loc}</strong></div>
<div class="row"><span>总价</span><strong class="price">¥${order.price}</strong></div>
${order.cardCoveredAmount > 0 ? '<div class="row"><span>优惠卡抵扣</span><strong>-¥'+order.cardCoveredAmount+'</strong></div>' : ''}
${order.deposit > 0 ? '<div class="row"><span>定金</span><strong>¥'+order.deposit+'</strong></div><div class="row"><span>尾款</span><strong>¥'+Math.max(0,order.price-order.deposit-(order.cardCoveredAmount||0))+'（妆后面结）</strong></div>' : ''}
<div class="row"><span>状态</span><strong>${sl[order.status]}</strong></div>
<div class="tips">⚠️ 不允许家长及异性亲友陪同 · 约定时间为开始化妆时间 · 迟到20分钟以上收取迟到费¥10 · 定金放鸽子不退，妆后面结</div>
</div></body></html>`;
    const win = window.open('', '_blank');
    win.document.write(card);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const handleStatusChange = async (order, newStatus) => {
    const labels = { confirmed: '确认这笔预约？', rejected: '确定拒绝？', completed: '标记为已完成？', pending: '撤回到待确认？', no_show: '确认客妹爽约？优惠卡不会扣次数，但会登记爽约费。' };
    if (labels[newStatus] && !window.confirm(labels[newStatus])) return;

    // 确认前检查时间冲突
    if (newStatus === 'confirmed') {
      const conflict = state.orders.find(o =>
        o.id !== order.id &&
        o.date === order.date &&
        o.status === 'confirmed' &&
        timeOverlap(order.time, order.duration, o.time, o.duration)
      );
      if (conflict) {
        if (!window.confirm(`⚠️ 该时段已被「${conflict.customerName}」预约（${conflict.time}），是否仍确认？`)) return;
      }
    }

    if (newStatus === 'no_show' && order.discountCardId) {
      try {
        const result = await markCardOrderNoShow(order.id);
        dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: 'no_show', noShowFee: Number(result.fee || 0), noShowFeePaid: false } });
      } catch (error) { window.alert(error.message || '爽约处理失败'); }
      return;
    }
    dispatch({ type: 'UPDATE_ORDER', payload: { ...order, status: newStatus } });
  };

  const handlePaymentChange = (order, newPayment) => {
    dispatch({ type: 'UPDATE_ORDER', payload: { ...order, paymentStatus: newPayment } });
  };

  const renderReminder = (template, order) => template.content.replace(/\{(\w+)\}/g, (_, key) => ({
    customerName: order.customerName || '', date: order.date || '', time: order.time || '',
    makeupType: order.makeupType || '', location: order.location || '', price: order.price || 0,
    deposit: order.deposit || 0, balance: (order.price || 0) - (order.deposit || 0),
  })[key] ?? `{${key}}`);

  // 批量操作
  const finishBatchSelection = (failed, total) => {
    setSelectedIds(new Set(failed));
    if (failed.length > 0) {
      window.alert(`${total - failed.length} 项已成功，${failed.length} 项同步失败并已保留选中，请检查网络后重试。`);
    }
  };

  const batchUpdateStatus = async (newStatus) => {
    if (!window.confirm(`将选中的 ${selectedIds.size} 个订单状态改为「${statusLabels[newStatus]}」？`)) return;
    // 批量确认时检查冲突
    if (newStatus === 'confirmed') {
      const conflicts = [];
      selectedIds.forEach(id => {
        const o = state.orders.find(x => x.id === id);
        if (!o) return;
        const conflict = state.orders.find(x =>
          x.id !== o.id && x.date === o.date && x.status === 'confirmed' &&
          timeOverlap(o.time, o.duration, x.time, x.duration)
        );
        if (conflict) conflicts.push(`「${o.customerName}」${o.time} 与「${conflict.customerName}」重叠`);
      });
      if (conflicts.length > 0) {
        if (!window.confirm(`⚠️ 以下订单存在时间冲突：\n${conflicts.join('\n')}\n\n是否仍确认？`)) return;
      }
    }
    const targets = [...selectedIds].map(id => {
      const o = state.orders.find(x => x.id === id);
      return o ? { id, order: o } : null;
    }).filter(Boolean);
    const { failed } = await runSequentialCloudActions(
      targets,
      dispatch,
      target => ({ type: 'UPDATE_ORDER', payload: { ...target.order, status: newStatus } }),
    );
    finishBatchSelection(failed.map(target => target.id), targets.length);
  };

  const batchUpdatePayment = async (newPayment) => {
    if (!window.confirm(`将选中的 ${selectedIds.size} 个订单付款状态改为「${paymentLabels[newPayment]}」？`)) return;
    const targets = [...selectedIds].map(id => {
      const o = state.orders.find(x => x.id === id);
      return o ? { id, order: o } : null;
    }).filter(Boolean);
    const { failed } = await runSequentialCloudActions(
      targets,
      dispatch,
      target => ({ type: 'UPDATE_ORDER', payload: { ...target.order, paymentStatus: newPayment } }),
    );
    finishBatchSelection(failed.map(target => target.id), targets.length);
  };

  const batchDelete = async () => {
    if (window.confirm(`将选中的 ${selectedIds.size} 个订单移入回收站？`)) {
      const targets = [...selectedIds];
      const { failed } = await runSequentialCloudActions(targets, dispatch, id => ({ type: 'DELETE_ORDER', payload: id }));
      finishBatchSelection(failed, targets.length);
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

  const toggleSelect = (id, shiftKey = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const currentIndex = filteredOrders.findIndex(order => order.id === id);
      if (shiftKey && lastSelectedIndex.current !== null && currentIndex >= 0) {
        const [start, end] = [lastSelectedIndex.current, currentIndex].sort((a, b) => a - b);
        filteredOrders.slice(start, end + 1).forEach(order => next.add(order.id));
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      lastSelectedIndex.current = currentIndex;
      return next;
    });
  };

  const beginDragSelect = (event, id) => {
    if (event.button !== 0 || event.target.closest('button, select, input, a')) return;
    event.preventDefault();
    const mode = selectedIds.has(id) ? 'remove' : 'add';
    dragSelection.current = { active: true, mode };
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (mode === 'add') next.add(id); else next.delete(id);
      return next;
    });
  };

  const continueDragSelect = id => {
    if (!dragSelection.current.active) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (dragSelection.current.mode === 'add') next.add(id); else next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    const stop = () => { dragSelection.current.active = false; };
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', stop);
    return () => { window.removeEventListener('mouseup', stop); window.removeEventListener('blur', stop); };
  }, []);
  const toggleAll = () => {
    setSelectedIds(selectedIds.size === filteredOrders.length ? new Set() : new Set(filteredOrders.map(o => o.id)));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-4 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-warm-800 font-heading">订单管理 ({filteredOrders.length})</h2>
        <div className="flex items-center gap-2">
          <Link to="/trash" className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-warm-800/55 hover:bg-warm-100 rounded-xl transition-colors">
            <ArchiveRestore className="w-4 h-4" /> 回收站{state.trashedOrders.length > 0 ? ` ${state.trashedOrders.length}` : ''}
          </Link>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-warm-800/60 hover:bg-warm-100 rounded-xl transition-colors"
            disabled={filteredOrders.length === 0}>
            <FileDown className="w-4 h-4" /> 导出CSV
          </button>
          <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-200 hover:shadow-xl transition-all active:scale-95">
            <Plus className="w-4 h-4" /> 新建订单
          </button>
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 text-xs text-warm-800/45 px-1">
        <MousePointer2 className="w-3.5 h-3.5" />
        在订单行空白处按住鼠标拖过多行可批量选择；按住 Shift 点击复选框可连续选择。
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="bg-brand-50 rounded-2xl border border-brand-200 p-3 flex items-center gap-2 flex-wrap animate-scale-in">
          <span className="text-sm font-semibold text-brand-600 mr-2">已选 {selectedIds.size} 项</span>
          <button onClick={() => batchUpdateStatus('confirmed')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600"><BadgeCheck className="w-3.5 h-3.5" />批量确认</button>
          <button onClick={() => batchUpdateStatus('rejected')} className="px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600">✕ 批量拒绝</button>
          <button onClick={() => batchUpdatePayment('deposit')} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"><WalletCards className="w-3.5 h-3.5" />批量定金</button>
          <button onClick={() => batchUpdatePayment('full')} className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">💰 批量全款</button>
          <button onClick={() => exportCSV(true)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-500 text-white rounded-lg hover:bg-violet-600"><FileDown className="w-3.5 h-3.5" />导出选中</button>
          <button onClick={batchDelete} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-gray-600 text-white rounded-lg hover:bg-gray-700 ml-auto"><ArchiveRestore className="w-3.5 h-3.5" />移入回收站</button>
          <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-brand-600">取消选择</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-800/30" />
            <input
              className="w-full pl-9 pr-4 py-3 rounded-lg border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-300 transition"
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
            className={`flex items-center gap-1.5 px-4 py-2.5.5 text-sm rounded-xl transition-colors ${
              showFilters ? 'bg-brand-50 text-brand-600' : 'text-warm-800/60 hover:bg-warm-100'
            }`}>
            <Filter className="w-4 h-4" /> 筛选
            {(statusFilter !== 'all' || paymentFilter !== 'all' || sourceFilter !== 'all') && (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">
                {(statusFilter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0) + (sourceFilter !== 'all' ? 1 : 0)}
              </span>
            )}
          </button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition">
            <option value="smart">智能排序</option>
            <option value="date-asc">日期 ↑</option>
            <option value="price-desc">价格 ↓</option>
            <option value="price-asc">价格 ↑</option>
            <option value="newest">最新创建</option>
          </select>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-brand-50 animate-fade-in">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition">
              <option value="all">全部状态</option>
              {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
              className="px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition">
              <option value="all">全部付款</option>
              {paymentStatuses.map(s => <option key={s} value={s}>{paymentLabels[s]}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
              className="px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition">
              <option value="all">全部客源</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {makeupTypes.length > 0 && (
              <select value={makeupFilter} onChange={e => setMakeupFilter(e.target.value)}
                className="px-3 py-3 rounded-lg border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition">
                <option value="all">全部妆造</option>
                {makeupTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {(statusFilter !== 'all' || paymentFilter !== 'all' || sourceFilter !== 'all' || makeupFilter !== 'all') && (
              <button onClick={() => { setStatusFilter('all'); setPaymentFilter('all'); setSourceFilter('all'); setMakeupFilter('all'); }}
                className="px-4 py-2.5 text-sm text-brand-600 hover:bg-brand-50 rounded-xl transition-colors">
                清除筛选
              </button>
            )}
          </div>
        )}

        {/* Batch actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-brand-50 animate-fade-in">
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
      <div className="hidden lg:block bg-white rounded-2xl border border-brand-100 shadow-sm pb-16">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-rose-200" />
            <p className="text-warm-800/40 text-sm mb-3">暂无订单数据</p>
            <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="px-4 py-2 bg-brand-50 text-brand-600 text-sm font-semibold rounded-xl hover:bg-brand-100 transition-colors">
              创建第一个订单
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50/30">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" className="accent-brand-500 rounded"
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
                  <tr key={o.id} onMouseDown={event => beginDragSelect(event, o.id)} onMouseEnter={() => continueDragSelect(o.id)}
                    className={`border-b border-brand-50 transition-colors group select-none ${selectedIds.has(o.id) ? 'bg-brand-50/70' : 'hover:bg-brand-50/30'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="accent-brand-500 rounded"
                        checked={selectedIds.has(o.id)} onChange={event => toggleSelect(o.id, event.nativeEvent.shiftKey)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                          {o.customerName?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-warm-800 truncate max-w-[120px]">{o.customerName}</p>
                          {o.customerPhone && <p className="text-[11px] text-warm-800/40">{o.customerPhone}</p>}
                          {(o.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-1">{o.tags.slice(0, 2).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-[#edf6ef] text-[#537760]">{tag}</span>)}</div>}
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
                        className="text-[11px] font-semibold rounded-lg border border-gray-200 bg-white py-1 px-1.5">
                        <option value="unpaid">未付</option>
                        <option value="deposit">定金</option>
                        <option value="full">全款</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1.5 rounded-xl font-semibold whitespace-nowrap ${statusColors[o.status]}`}>
                          {statusLabels[o.status]}
                        </span>
                        {o.status === 'pending' && (
                          <button onClick={() => handleStatusChange(o, 'confirmed')} className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200" title="确认">✓</button>
                        )}
                        {o.status === 'confirmed' && (
                          <><button onClick={() => handleStatusChange(o, 'completed')} className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-full hover:bg-emerald-200" title="完成">✓</button><button onClick={() => handleStatusChange(o, 'no_show')} className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full" title="爽约">爽约</button></>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-warm-800/50">{o.source}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(o)}
                          className="p-1.5 rounded-lg hover:bg-brand-100 text-warm-800/50 hover:text-brand-600 transition-colors"
                          title="编辑">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => printOrderCard(o)}
                          className="p-1.5 rounded-lg hover:bg-violet-100 text-warm-800/50 hover:text-violet-600 transition-colors"
                          title="打印卡片">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setReminderOrder(o)} className="p-1.5 rounded-lg hover:bg-[#edf6ef] text-warm-800/50 hover:text-[#52775e] transition-colors" title="客户提醒"><MessageSquareText className="w-3.5 h-3.5" /></button>
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
      <div className="lg:hidden space-y-3 pb-32">
        {/* 移动端全选 */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-sm text-warm-800/50">
              <input type="checkbox" checked={selectedIds.size === filteredOrders.length} onChange={toggleAll} className="w-4 h-4 accent-brand-500" />
              全选
            </label>
            <span className="text-xs text-warm-800/30">{selectedIds.size}/{filteredOrders.length}</span>
          </div>
        )}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-brand-100 shadow-sm text-center py-16">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-rose-200" />
            <p className="text-warm-800/40 text-sm mb-3">暂无订单数据</p>
            <button onClick={() => { setEditingOrder(null); setShowForm(true); }}
              className="px-4 py-2 bg-brand-50 text-brand-600 text-sm font-semibold rounded-xl hover:bg-brand-100 transition-colors">
              创建第一个订单
            </button>
          </div>
        ) : (
          pageOrders.map(o => (
            <div key={o.id}
              className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 mb-3 active:scale-[0.99] transition-transform">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} className="w-5 h-5 accent-brand-500 shrink-0" />
                  <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600 shrink-0">{o.customerName?.charAt(0) || '?'}</div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-warm-800 truncate">{o.customerName}</p>
                    <p className="text-sm text-warm-800/40">{o.makeupType}</p></div>
                </div>
                <p className="text-lg font-extrabold text-brand-600 shrink-0 ml-2">¥{o.price}</p>
              </div>
              <div className="flex items-center gap-2 mb-3 text-sm text-warm-800/50">
                <span>{o.date} · {o.time} · {o.duration}h</span></div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span style={{display:'inline-flex',alignItems:'center',fontSize:'14px',padding:'8px 16px',borderRadius:'12px',fontWeight:600,whiteSpace:'nowrap'}} className={`${statusColors[o.status]}`}>{statusLabels[o.status]}</span>
                <span style={{display:'inline-flex',alignItems:'center',fontSize:'14px',padding:'8px 16px',borderRadius:'12px',fontWeight:600,whiteSpace:'nowrap'}} className={`${paymentColors[o.paymentStatus]}`}>{paymentLabels[o.paymentStatus]}</span>
                {o.source && <span className="text-sm text-warm-800/40 ml-1">{o.source}</span>}
              </div>
              {o.notes && (<p className="text-sm text-warm-800/60 mb-3 bg-warm-50 rounded-xl px-4 py-2.5">{o.notes}</p>)}
              {(o.tags || []).length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{o.tags.map(tag => <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[#edf6ef] text-[#537760]"><Tag className="w-3 h-3" />{tag}</span>)}</div>}
              <div className="flex items-center gap-2 mb-3">
                {o.status === 'pending' && (<>
                  <button onClick={() => handleStatusChange(o, 'confirmed')} className="flex-1 py-2.5 text-sm font-bold bg-blue-500 text-white rounded-xl active:bg-blue-600">确认预约</button>
                  <button onClick={() => handleStatusChange(o, 'rejected')} className="flex-1 py-2.5 text-sm font-bold bg-red-500 text-white rounded-xl active:bg-red-600">拒绝</button>
                </>)}
                {o.status === 'confirmed' && (<><button onClick={() => handleStatusChange(o, 'completed')} className="flex-1 py-2.5 text-sm font-bold bg-emerald-500 text-white rounded-xl active:bg-emerald-600">完成化妆</button><button onClick={() => handleStatusChange(o, 'no_show')} className="flex-1 py-2.5 text-sm font-bold bg-amber-500 text-white rounded-xl">标记爽约</button></>)}
                {(o.status === 'confirmed' || o.status === 'rejected') && (<button onClick={() => handleStatusChange(o, 'pending')} className="flex-1 py-2.5 text-sm font-bold bg-gray-400 text-white rounded-xl active:bg-gray-500">撤回</button>)}
                <select value={o.paymentStatus} onChange={e => handlePaymentChange(o, e.target.value)} className="flex-1 py-2.5 text-sm font-bold rounded-xl border border-gray-300 bg-white text-center"><option value="unpaid">未付</option><option value="deposit">定金</option><option value="full">全款</option></select>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-brand-50">
                <button onClick={() => handleEdit(o)} className="flex-1 py-2 text-sm font-semibold text-brand-600 bg-brand-50 rounded-xl active:bg-brand-100">编辑</button>
                <button onClick={() => setViewCardOrder(o)} className="flex-1 py-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-xl active:bg-emerald-100">卡片</button>
                <button onClick={() => setReminderOrder(o)} className="flex-1 py-2 text-sm font-semibold text-[#52775e] bg-[#edf6ef] rounded-xl">提醒</button>
                <button onClick={() => handleDelete(o.id)} className="py-2 px-3 text-sm font-semibold text-red-500 bg-red-50 rounded-xl active:bg-red-100"></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button disabled={page <= 1} onClick={() => setPage(1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-brand-200 disabled:opacity-30 hover:bg-brand-50">首页</button>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-brand-200 disabled:opacity-30 hover:bg-brand-50">‹</button>
          <span className="text-xs text-warm-800/60 px-2">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-brand-200 disabled:opacity-30 hover:bg-brand-50">›</button>
          <button disabled={page >= totalPages} onClick={() => setPage(totalPages)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white border border-brand-200 disabled:opacity-30 hover:bg-brand-50">末页</button>
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
      {viewCardOrder && <OrderConfirmCard order={viewCardOrder} backgrounds={orderBackgrounds} onClose={() => setViewCardOrder(null)} />}
      {reminderOrder && <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <button aria-label="关闭" onClick={() => setReminderOrder(null)} className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
        <div className="relative bg-white rounded-3xl shadow-2xl border border-brand-100 w-full max-w-lg p-5">
          <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-warm-800">客户提醒 · {reminderOrder.customerName}</h3><p className="text-xs text-warm-800/40 mt-1">点击模板即可复制，粘贴到微信发送</p></div><button onClick={() => setReminderOrder(null)} className="p-2"><X className="w-5 h-5" /></button></div>
          <div className="space-y-3">{(state.reminderTemplates || []).map(template => { const text = renderReminder(template, reminderOrder); return <button key={template.id} onClick={async () => { await navigator.clipboard.writeText(text); alert(`“${template.name}”已复制`); }} className="w-full text-left rounded-2xl border border-brand-100 p-4 hover:bg-brand-50/50"><p className="text-sm font-semibold text-[#557762]">{template.name}</p><p className="text-sm text-warm-800/60 mt-2 leading-6">{text}</p></button>; })}</div>
        </div>
      </div>}
    </div>
  );
}

/* ---- Order Confirm Card ---- */
function OrderConfirmCard({ order, backgrounds, onClose }) {
  const { state } = useStore();
  const confirmedServices = state.extraServices.filter(s =>
    (order.extraServices || []).includes(s.id)
  );
  const typeConfig = state.makeupTypes.find(type => type.name === order.makeupType);
  const basePrice = Number(typeConfig?.price ?? typeConfig?.defaultPrice ?? 0);
  const serviceTotal = confirmedServices.reduce((sum, service) => sum + getEffectiveServicePrice(order.makeupType, service), 0);
  const priceAdjustment = getPriceAdjustment(order.date, order.time, state.priceRules);
  const configuredTotal = Math.max(0, basePrice + serviceTotal + priceAdjustment.amount);
  const priceDifference = Number(order.price || 0) - configuredTotal;
  const [copied, setCopied] = useState(false);
  const [background, setBackground] = useState(() => pickOrderBackground(backgrounds));

  useEffect(() => {
    if (!background && backgrounds.length) setBackground(pickOrderBackground(backgrounds));
  }, [background, backgrounds]);

  const cardText = [
    '【妆造订单确认】💄',
    '',
    `👤 客户：${order.customerName}`,
    order.roleName ? `🎭 角色：${order.roleName}` : '',
    order.customerPhone ? `📱 手机：${order.customerPhone}` : '',
    order.customerWechat ? `💬 微信：${order.customerWechat}` : '',
    '',
    `💄 妆造：${order.makeupType}`,
    `日期：${order.date}`,
    `⏰ 时间：${order.time}（约 ${order.duration} 小时）`,
    order.location ? `📍 地点：${order.location}` : '',
    '',
    `💰 妆造费：¥${basePrice}`,
    ...confirmedServices.map(s => `   + ${s.name}：¥${getEffectiveServicePrice(order.makeupType, s)}`),
    priceAdjustment.amount !== 0 ? `   ${priceAdjustment.label}：${priceAdjustment.amount > 0 ? '+' : '-'}¥${Math.abs(priceAdjustment.amount)}` : '',
    `   ──────────────`,
    `   合计：¥${order.price}`,
    priceDifference !== 0 ? `⚠️ 核价异常：当前配置应为 ¥${configuredTotal}，订单保存金额相差 ${priceDifference > 0 ? '+' : ''}¥${priceDifference}` : '',
    order.cardCoveredAmount > 0 ? `💳 优惠卡抵扣：-¥${order.cardCoveredAmount}` : '',
    order.deposit > 0 ? `定金：¥${order.deposit}` : '',
    order.deposit > 0 ? `🧾 尾款：¥${Math.max(0, order.price - order.deposit - (order.cardCoveredAmount || 0))}（妆后面结）` : '',
    '',
    order.notes ? `📝 备注：${order.notes}` : '',
    '',
    '⚠️ 温馨提示：',
    '· 不允许家长及异性亲友陪同',
    '· 约定时间为开始化妆时间，不是到达时间',
    '· 迟到20分钟以上收取迟到费¥10',
    '· 定金放鸽子不退，妆后面结',
  ].filter(l => l !== '').join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(cardText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-gray-100">
          <h3 className="font-bold text-warm-800 flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-500" /> 订单确认卡片
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all active:scale-95 ${
                copied ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}>
              {copied ? <><CheckCircle2 className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制文本</>}
            </button>
            {!!backgrounds.length && <button title="换一个背景" onClick={() => setBackground(pickOrderBackground(backgrounds, background?.url))} className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-50 transition-colors"><Shuffle className="w-4 h-4" /></button>}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Card Preview */}
        <div className="overflow-y-auto p-5 flex-1">
          <div className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-white to-amber-50 rounded-2xl border-2 border-brand-100 p-5 shadow-inner bg-cover bg-center" style={background ? { backgroundImage: `url("${background.url}")` } : undefined}>
            {background && <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px]" />}
            <div className="relative z-10">
            {/* Brand */}
            <div className="text-center mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-brand-600 flex items-center justify-center mx-auto mb-2 shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs text-rose-400 font-semibold tracking-widest uppercase">小荷约妆</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-brand-100" />
              <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center"><Brush className="w-5 h-5" strokeWidth={1.7} /></span>
              <div className="flex-1 h-px bg-brand-100" />
            </div>

            {/* Customer */}
            <div className="text-center mb-4">
              <p className="text-lg font-bold text-warm-800">{order.customerName}</p>
              {order.roleName && <p className="text-sm text-[#b9637b] mt-1">角色：{order.roleName}</p>}
              <p className="text-xs text-warm-800/40">{order.makeupType}</p>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center py-2 px-3 bg-white/70 rounded-xl">
                <span className="text-warm-800/50">日期</span>
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
            <div className="bg-white rounded-xl p-3 mb-3 border border-brand-50">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-warm-800/50">妆造费</span>
                <span className="text-warm-800">¥{basePrice}</span>
              </div>
              {confirmedServices.map(s => (
                <div key={s.id} className="flex justify-between text-sm mb-1">
                  <span className="text-warm-800/40">+ {s.name}</span>
                  <span className="text-warm-800/60">¥{getEffectiveServicePrice(order.makeupType, s)}</span>
                </div>
              ))}
              <div className="border-t border-brand-100 pt-2 mt-1 flex justify-between">
                <span className="font-semibold text-warm-800">合计</span>
                <span className="text-lg font-extrabold text-brand-600">¥{order.price}</span>
              </div>
              {priceDifference !== 0 && <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                核价异常：当前配置应为 ¥{configuredTotal}，订单保存金额相差 {priceDifference > 0 ? '+' : ''}¥{priceDifference}
              </div>}
              {order.cardCoveredAmount > 0 && <div className="flex justify-between text-sm mt-2 text-emerald-700"><span>优惠卡抵扣</span><span>-¥{order.cardCoveredAmount}</span></div>}
            </div>

            {/* Deposit */}
            {order.deposit > 0 && (
              <div className="flex gap-2 text-xs mb-3">
                <div className="flex-1 bg-amber-50 rounded-xl p-2.5 text-center">
                  <p className="text-amber-600 font-bold text-base">¥{order.deposit}</p>
                  <p className="text-amber-500">已付定金</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                  <p className="text-gray-600 font-bold text-base">¥{Math.max(0, order.price - order.deposit - (order.cardCoveredAmount || 0))}</p>
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

            {/* 温馨提示 */}
            <div className="mt-3 pt-3 border-t border-dashed border-brand-100">
              <p className="text-[11px] text-red-400 font-semibold mb-1.5">⚠️ 温馨提示</p>
              <p className="text-[11px] text-warm-800/50 leading-relaxed">
                · 不允许家长及异性亲友陪同<br/>
                · 迟到20分钟以上收取迟到费¥10<br/>
                · 默认可拍妆面图，可以不发不能不拍<br/>
                · 定金放鸽子不退，妆后面结
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

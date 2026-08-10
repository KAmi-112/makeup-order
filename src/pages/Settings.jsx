import { useState } from 'react';
import { useStore, generateId, themePresets } from '../store.jsx';
import { useEffect } from 'react';
import { updateAccountEmail, updateAccountPassword } from '../db.js';
import MfaSettings from '../components/MfaSettings.jsx';
import {
  Plus, Edit3, Trash2, X, Check, Download, Upload,
  Sparkles, AlertCircle, ShieldCheck, Copy, MessageCircle,
  FileText, ShoppingBag, Palette, ExternalLink, Lock, Printer, Clock, Calendar, Megaphone,
  ArrowUp, ArrowDown, Save, Quote, CalendarOff, MessagesSquare
} from 'lucide-react';

/* ---- Theme Picker ---- */
function ThemePicker() {
  const { state, dispatch } = useStore();
  const current = state.theme || 'rose';

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {themePresets.map(t => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            onClick={() => dispatch({ type: 'SET_THEME', payload: t.id })}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${
              active ? 'shadow-md scale-[1.03]' : 'border-transparent hover:border-gray-200'
            }`}
            style={{
              backgroundColor: active ? t.primaryLight : '#f9fafb',
              borderColor: active ? t.primary : 'transparent',
            }}
          >
            <div className="flex gap-1">
              <div className="w-5 h-5 rounded-full shadow-inner" style={{ backgroundColor: t.primary }} />
              <div className="w-5 h-5 rounded-full shadow-inner ring-1 ring-black/5" style={{ backgroundColor: t.primaryDark }} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: active ? t.primary : '#9ca3af' }}>
              {t.icon} {t.name}
            </span>
            {active && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow"
                style={{ backgroundColor: t.primary }}>
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const { state, dispatch } = useStore();

  // ---- Toast ----
  const [msg, setMsg] = useState(null);
  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  };

  // ---- 妆造类型 ----
  const [editingType, setEditingType] = useState(null);
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', defaultPrice: 168, defaultDuration: 1, emoji: '💄', desc: '' });
  const [newDate, setNewDate] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [quoteDrafts, setQuoteDrafts] = useState(state.topQuotes || []);
  const [newTopQuote, setNewTopQuote] = useState('');
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [bookingDraft, setBookingDraft] = useState(state.bookingRules);
  const [reminderDrafts, setReminderDrafts] = useState(state.reminderTemplates || []);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);

  useEffect(() => setQuoteDrafts(state.topQuotes || []), [state.topQuotes]);
  useEffect(() => setBookingDraft(state.bookingRules), [state.bookingRules]);
  useEffect(() => setReminderDrafts(state.reminderTemplates || []), [state.reminderTemplates]);

  const saveTopQuotes = () => {
    const cleaned = quoteDrafts.map(q => q.trim()).filter(Boolean).slice(0, 12);
    if (cleaned.length === 0) { showMsg('请至少保留一句顶部语句', 'error'); return; }
    dispatch({ type: 'UPDATE_TOP_QUOTES', payload: cleaned });
    showMsg('顶部轮播语句已保存');
  };

  const saveBookingRules = () => {
    dispatch({ type: 'UPDATE_BOOKING_RULES', payload: bookingDraft });
    showMsg('接单日期与时间规则已保存');
  };

  const saveReminderTemplates = () => {
    const cleaned = reminderDrafts.filter(t => t.name.trim() && t.content.trim());
    dispatch({ type: 'UPDATE_REMINDER_TEMPLATES', payload: cleaned });
    showMsg('客户提醒模板已保存');
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) return;
    setAccountSaving(true);
    try {
      await updateAccountEmail(newEmail.trim());
      setNewEmail('');
      showMsg('验证邮件已发送，请到新邮箱确认');
    } catch (error) { showMsg(error.message || '邮箱修改失败', 'error'); }
    finally { setAccountSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 10) { showMsg('新密码至少需要 10 位', 'error'); return; }
    setAccountSaving(true);
    try {
      await updateAccountPassword(newPassword);
      setNewPassword('');
      showMsg('管理员密码已更新');
    } catch (error) { showMsg(error.message || '密码修改失败', 'error'); }
    finally { setAccountSaving(false); }
  };

  const handleSaveType = () => {
    if (!typeForm.name.trim()) return;
    if (editingType) {
      dispatch({ type: 'UPDATE_MAKEUP_TYPE', payload: { ...editingType, ...typeForm } });
    } else {
      dispatch({ type: 'ADD_MAKEUP_TYPE', payload: { ...typeForm, id: generateId() } });
    }
    setShowTypeForm(false); setEditingType(null);
    setTypeForm({ name: '', defaultPrice: 168, defaultDuration: 1, emoji: '💄', desc: '' });
    showMsg(editingType ? '妆造类型已更新' : '妆造类型已添加');
  };

  // ---- 额外服务 ----
  const [editingService, setEditingService] = useState(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', price: 0 });

  const handleSaveService = () => {
    if (!serviceForm.name.trim()) return;
    if (editingService) {
      dispatch({ type: 'UPDATE_EXTRA_SERVICE', payload: { ...editingService, ...serviceForm } });
    } else {
      dispatch({ type: 'ADD_EXTRA_SERVICE', payload: { ...serviceForm, id: generateId() } });
    }
    setShowServiceForm(false); setEditingService(null);
    setServiceForm({ name: '', price: 0 });
    showMsg(editingService ? '服务项已更新' : '服务项已添加');
  };

  const handleDeleteService = (id) => {
    dispatch({ type: 'DELETE_EXTRA_SERVICE', payload: id });
    showMsg('服务项已删除');
  };

  // ---- 约妆须知 ----
  const [noticeEdit, setNoticeEdit] = useState(false);
  const [noticeText, setNoticeText] = useState(state.notice);

  const handleSaveNotice = () => {
    dispatch({ type: 'UPDATE_NOTICE', payload: noticeText });
    setNoticeEdit(false);
    showMsg('约妆须知已保存');
  };

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(state.notice).then(
      () => showMsg('已复制到剪贴板，可粘贴发给客妹！'),
      () => showMsg('复制失败，请手动选择复制', 'error')
    );
  };

  // ---- 数据管理 ----
  const handleExport = () => {
    const data = JSON.stringify({
      orders: state.orders,
      makeupTypes: state.makeupTypes,
      extraServices: state.extraServices,
      notice: state.notice,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `小荷订单_备份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMsg('数据已导出！');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.orders || !Array.isArray(data.orders)) throw new Error('格式不正确');
          if (window.confirm(`即将导入 ${data.orders.length} 条订单及相关设置。\n\n⚠️ 当前数据将被覆盖，确定继续吗？`)) {
            dispatch({ type: 'IMPORT_DATA', payload: data });
            setNoticeText(data.notice || state.notice);
            showMsg(`成功导入 ${data.orders.length} 条订单！`);
          }
        } catch (err) { showMsg('导入失败：文件格式不正确', 'error'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearAll = () => {
    if (window.confirm('⚠️ 确定要删除全部数据吗？此操作不可撤销！\n\n建议先导出备份。')) {
      dispatch({ type: 'IMPORT_DATA', payload: { orders: [], makeupTypes: [], extraServices: [], notice: '' } });
      setNoticeText('');
      showMsg('全部数据已清除');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-40">
      <h2 className="text-xl font-bold text-warm-800">⚙️ 设置</h2>

      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-scale-in flex items-center gap-2 ${
          msg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
        }`}>
          {msg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* ========== 外观主题 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Palette className="w-4 h-4 text-rose-400" /> 外观主题
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">选一个你喜欢的配色，全站自动换肤</p>
          </div>
        </div>

        <ThemePicker />
      </div>

      {/* ========== 约妆须知 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-400" /> 约妆须知
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">发给客妹的注意事项，可随时修改（比如涨价、改规则）</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyNotice}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors active:scale-95">
              <Copy className="w-4 h-4" /> 一键复制
            </button>
            {!noticeEdit ? (
              <button onClick={() => { setNoticeText(state.notice); setNoticeEdit(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-warm-100 text-warm-800 rounded-xl hover:bg-warm-200 transition-colors">
                <Edit3 className="w-4 h-4" /> 编辑
              </button>
            ) : (
              <button onClick={handleSaveNotice}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-500 text-white rounded-xl hover:bg-rose-600 transition-colors active:scale-95">
                <Check className="w-4 h-4" /> 保存
              </button>
            )}
          </div>
        </div>

        {noticeEdit ? (
          <div className="space-y-3">
            <textarea
              value={noticeText}
              onChange={e => setNoticeText(e.target.value)}
              style={{ height: '400px', overflowY: 'auto' }}
              className="w-full px-4 py-3 rounded-xl border border-brand-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none font-sans"
              placeholder="在这里编辑你的约妆须知..."
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-warm-800/40">支持换行和 emoji，修改后点「保存」生效</span>
              <button onClick={() => { setNoticeEdit(false); setNoticeText(state.notice); }}
                className="px-3 py-1.5 text-sm text-warm-800/60 hover:bg-warm-100 rounded-lg transition-colors">
                取消
              </button>
            </div>
          </div>
        ) : (
          <pre style={{ height: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', fontSize: '14px', lineHeight: '2', color: '#555', background: '#fafafa', padding: '16px', borderRadius: '12px', margin: 0 }}>
            {state.notice || <span style={{color:'#aaa'}}>暂未设置约妆须知，点击「编辑」添加</span>}
          </pre>
        )}
      </div>

      {/* ========== 额外服务 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-rose-400" /> 额外服务 / 附加产品
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">胶带绷脸、素颜霜、鼻贴、发网等附加收费项</p>
          </div>
          <button onClick={() => { setEditingService(null); setServiceForm({ name: '', price: 0 }); setShowServiceForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors active:scale-95">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>

        {showServiceForm && (
          <div className="mb-4 p-4 rounded-2xl bg-brand-50/50 border border-brand-100 animate-scale-in">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-warm-800/60 mb-1">服务名称</label>
                <input className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：胶带绷脸" />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-warm-800/60 mb-1">价格 ¥</label>
                <input type="number" step="1" min="0" className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={serviceForm.price || ''} onChange={e => setServiceForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <button onClick={handleSaveService}
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-xl hover:bg-rose-600 transition-colors shrink-0">
                {editingService ? '更新' : '添加'}
              </button>
              <button onClick={() => { setShowServiceForm(false); setEditingService(null); }}
                className="px-3 py-2 text-sm text-warm-800/60 hover:bg-white rounded-lg transition-colors">取消</button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {state.extraServices.length === 0 ? (
            <p className="text-sm text-warm-800/30 text-center py-6">暂无额外服务，点击「添加」创建</p>
          ) : (
            state.extraServices.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-brand-50/30 transition-colors group gap-3">
                <span className="text-sm text-warm-800 min-w-0 truncate">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-brand-600">{s.price > 0 ? `¥${s.price}` : '免费'}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingService(s); setServiceForm({ name: s.name, price: s.price }); setShowServiceForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-brand-100 text-warm-800/40 hover:text-brand-600 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteService(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-warm-800/40 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========== 动态价格规则 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-rose-400" /> 动态价格规则
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">根据时段自动加减价格，小程序同步生效</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { key: 'weekday_surcharge', label: '工作日非工作时间加价', desc: '周一至周五 18:00~次日07:00', icon: '🌙', color: 'bg-red-50 border-red-200', textColor: 'text-red-600' },
            { key: 'weekend_discount', label: '周六日非工作时间优惠', desc: '周六日 18:00~次日07:00', icon: '🎉', color: 'bg-green-50 border-green-200', textColor: 'text-green-600' },
            { key: 'special_dates', label: '特殊日期非工作时间优惠', desc: '手动标记的漫展日等', icon: '⭐', color: 'bg-blue-50 border-blue-200', textColor: 'text-blue-600' },
          ].map(rule => {
            const r = state.priceRules?.[rule.key] || { enabled: false, amount: 0, startTime: '18:00', endTime: '07:00' };
            return (
              <div key={rule.key} className={`rounded-xl border p-3 flex items-center gap-3 ${rule.color}`}>
                <span className="text-2xl">{rule.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-warm-800">{rule.label}</span>
                    <button onClick={() => {
                      const pr = { ...state.priceRules };
                      pr[rule.key] = { ...pr[rule.key], enabled: !pr[rule.key].enabled };
                      dispatch({ type: 'UPDATE_PRICE_RULES', payload: pr });
                    }}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${r.enabled ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                      {r.enabled ? '已启用' : '已关闭'}
                    </button>
                  </div>
                  <p className="text-xs text-warm-800/50">{rule.desc}</p>
                  {r.enabled && (
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-xs text-warm-800/60">
                        {r.amount >= 0 ? '加价' : '减价'}
                        <input type="number" min="0" max="200"
                          value={Math.abs(r.amount)}
                          onChange={e => {
                            const pr = { ...state.priceRules };
                            const sign = r.amount >= 0 ? 1 : -1;
                            pr[rule.key] = { ...pr[rule.key], amount: sign * (parseInt(e.target.value) || 0) };
                            dispatch({ type: 'UPDATE_PRICE_RULES', payload: pr });
                          }}
                          className={`w-16 mx-1 px-2 py-0.5 rounded-lg border text-sm text-center ${rule.textColor}`} /> 元
                      </label>
                      {rule.key === 'special_dates' && (
                        <span className={`text-xs ${rule.textColor}`}>
                          ({(state.priceRules?.special_dates?.dates || []).length} 个日期)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========== 接单日期与时间 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2"><CalendarOff className="w-4 h-4 text-brand-500" />接单日期与时间</h3>
            <p className="text-xs text-warm-800/40 mt-1">休息日会在客户预约页直接禁用；订单之间可预留整理时间。</p>
          </div>
          <button onClick={saveBookingRules} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5d8b69] text-white text-sm font-semibold"><Save className="w-4 h-4" />保存规则</button>
        </div>
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <label className="text-xs text-warm-800/55">开始接单时间
            <input type="time" value={bookingDraft?.workingHours?.start || '07:00'} onChange={e => setBookingDraft(r => ({ ...r, workingHours: { ...r.workingHours, start: e.target.value } }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-brand-200 bg-white" />
          </label>
          <label className="text-xs text-warm-800/55">结束接单时间
            <input type="time" value={bookingDraft?.workingHours?.end || '18:00'} onChange={e => setBookingDraft(r => ({ ...r, workingHours: { ...r.workingHours, end: e.target.value } }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-brand-200 bg-white" />
          </label>
          <label className="text-xs text-warm-800/55">订单间隔（分钟）
            <input type="number" min="0" max="180" step="15" value={bookingDraft?.bufferMinutes ?? 30} onChange={e => setBookingDraft(r => ({ ...r, bufferMinutes: Number(e.target.value) }))} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-brand-200 bg-white" />
          </label>
        </div>
        <div className="flex gap-2 mb-3">
          <input type="date" value={newBlockedDate} onChange={e => setNewBlockedDate(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl border border-brand-200" />
          <button onClick={() => { if (!newBlockedDate) return; setBookingDraft(r => ({ ...r, blockedDates: [...new Set([...(r?.blockedDates || []), newBlockedDate])].sort() })); setNewBlockedDate(''); }} className="px-4 py-2.5 rounded-xl bg-brand-50 text-brand-600 text-sm font-semibold">添加休息日</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(bookingDraft?.blockedDates || []).map(date => <span key={date} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fff1f4] text-[#a95469] text-sm">{date}<button onClick={() => setBookingDraft(r => ({ ...r, blockedDates: r.blockedDates.filter(d => d !== date) }))}>×</button></span>)}
          {(bookingDraft?.blockedDates || []).length === 0 && <span className="text-sm text-warm-800/35">还没有设置休息日</span>}
        </div>
      </div>

      {/* ========== 客户提醒模板 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2"><MessagesSquare className="w-4 h-4 text-[#5d8b69]" />客户提醒模板</h3>
            <p className="text-xs text-warm-800/40 mt-1">订单中一键生成微信消息。可使用：{'{date} {time} {makeupType} {location} {price} {deposit} {balance} {customerName}'}</p>
          </div>
          <button onClick={saveReminderTemplates} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#cf7188] text-white text-sm font-semibold"><Save className="w-4 h-4" />保存模板</button>
        </div>
        <div className="space-y-3">
          {reminderDrafts.map((template, index) => <div key={template.id || index} className="rounded-xl border border-brand-100 bg-[#fffdfb] p-3">
            <div className="flex gap-2 mb-2"><input value={template.name} onChange={e => setReminderDrafts(items => items.map((t, i) => i === index ? { ...t, name: e.target.value } : t))} className="flex-1 px-3 py-2 rounded-lg border border-brand-100 text-sm font-semibold" /><button onClick={() => setReminderDrafts(items => items.filter((_, i) => i !== index))} className="p-2 text-red-400"><Trash2 className="w-4 h-4" /></button></div>
            <textarea rows="2" value={template.content} onChange={e => setReminderDrafts(items => items.map((t, i) => i === index ? { ...t, content: e.target.value } : t))} className="w-full px-3 py-2 rounded-lg border border-brand-100 text-sm resize-y" />
          </div>)}
          <button onClick={() => setReminderDrafts(items => [...items, { id: generateId(), name: '新提醒', content: '你好 {customerName}，提醒你 {date} {time} 的 {makeupType} 预约。' }])} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-50 text-brand-600 text-sm"><Plus className="w-4 h-4" />添加模板</button>
        </div>
      </div>

      {/* ========== 特殊日期管理 ========== */}
      {state.priceRules?.special_dates?.enabled && (
        <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-warm-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-400" /> 漫展日 / 特殊日期
              </h3>
              <p className="text-xs text-warm-800/40 mt-0.5">在这天非工作时间预约自动减¥{Math.abs(state.priceRules?.special_dates?.amount || 10)}</p>
            </div>
          </div>
          {(state.priceRules?.special_dates?.dates || []).length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {(state.priceRules?.special_dates?.dates || []).map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                  ⭐ {d}
                  <button onClick={() => {
                    const pr = { ...state.priceRules };
                    pr.special_dates = { ...pr.special_dates, dates: pr.special_dates.dates.filter(x => x !== d) };
                    dispatch({ type: 'UPDATE_PRICE_RULES', payload: pr });
                  }} className="text-blue-400 hover:text-red-500 ml-1">×</button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-warm-800/40 mb-3">还没有标记任何特殊日期</p>
          )}
          <div className="flex gap-2">
            <input type="date"
              value={newDate || ''}
              onChange={e => setNewDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition" />
            <button onClick={() => {
              if (!newDate) return;
              if ((state.priceRules?.special_dates?.dates || []).includes(newDate)) {
                showMsg('该日期已存在', 'error');
                return;
              }
              const pr = { ...state.priceRules };
              pr.special_dates = { ...pr.special_dates, dates: [...(pr.special_dates.dates || []), newDate].sort() };
              dispatch({ type: 'UPDATE_PRICE_RULES', payload: pr });
              setNewDate('');
              showMsg(`已添加 ${newDate}`);
            }}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-xl hover:bg-blue-600 transition-colors shrink-0">
              添加日期
            </button>
          </div>
        </div>
      )}

      {/* ========== 管理端顶部轮播语句 ========== */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <img src={`${import.meta.env.BASE_URL}lotus-watercolor.webp`} alt="" className="absolute right-0 bottom-0 w-72 h-full object-cover object-right-bottom opacity-[.08] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Quote className="w-4 h-4 text-brand-500" /> 工作台顶部轮播语句
            </h3>
            <p className="text-xs text-warm-800/40 mt-1">登录后，电脑端页面最上方每 5 秒轮播一句；可直接修改并调整顺序。</p>
          </div>
          <button onClick={saveTopQuotes} className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#df8298] to-[#70a683] text-white text-sm font-semibold shadow-sm">
            <Save className="w-4 h-4" /> 保存语句
          </button>
        </div>
        <div className="relative space-y-2">
          {quoteDrafts.map((quote, index) => (
            <div key={index} className="flex items-center gap-2 rounded-xl bg-[#fff9fa]/90 border border-brand-100 p-2">
              <span className="w-7 h-7 rounded-lg bg-[#edf7ef] text-[#5d9470] grid place-items-center text-xs font-semibold shrink-0">{index + 1}</span>
              <input value={quote} maxLength={60} onChange={e => setQuoteDrafts(items => items.map((item, i) => i === index ? e.target.value : item))}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              <button aria-label="上移" disabled={index === 0} onClick={() => setQuoteDrafts(items => { const next=[...items]; [next[index-1],next[index]]=[next[index],next[index-1]]; return next; })} className="p-2 rounded-lg text-[#6b9878] hover:bg-[#edf7ef] disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
              <button aria-label="下移" disabled={index === quoteDrafts.length - 1} onClick={() => setQuoteDrafts(items => { const next=[...items]; [next[index],next[index+1]]=[next[index+1],next[index]]; return next; })} className="p-2 rounded-lg text-[#6b9878] hover:bg-[#edf7ef] disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
              <button onClick={() => setQuoteDrafts(items => items.filter((_, i) => i !== index))} className="p-2 rounded-lg text-red-400 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input value={newTopQuote} maxLength={60} onChange={e => setNewTopQuote(e.target.value)} placeholder="添加一句新的顶部语句（最多 60 字）"
              onKeyDown={e => { if (e.key === 'Enter' && newTopQuote.trim()) { setQuoteDrafts(items => [...items, newTopQuote.trim()].slice(0, 12)); setNewTopQuote(''); } }}
              className="flex-1 px-3 py-2.5 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300" />
            <button onClick={() => { if (!newTopQuote.trim()) return; setQuoteDrafts(items => [...items, newTopQuote.trim()].slice(0, 12)); setNewTopQuote(''); }}
              className="px-4 py-2.5 bg-brand-500 text-white text-sm rounded-xl font-semibold">添加</button>
          </div>
        </div>
      </div>

      {/* ========== 滚动公告 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-rose-400" /> 滚动公告
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">在小程序首页滚动播放，用户一打开就能看到</p>
          </div>
        </div>
        {(state.announcements || []).length > 0 ? (
          <div className="space-y-2 mb-3">
            {(state.announcements || []).map((a, i) => (
              <div key={i} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <span className="text-sm flex-1">{i + 1}. {a}</span>
                <button onClick={() => {
                  const arr = [...state.announcements];
                  arr.splice(i, 1);
                  dispatch({ type: 'UPDATE_ANNOUNCEMENTS', payload: arr });
                }} className="text-red-400 hover:text-red-600 text-sm">删除</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-warm-800/40 mb-3">还没有公告，添加一条试试</p>
        )}
        <div className="flex gap-2">
          <textarea className="flex-1 px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition resize-none"
            rows="2" placeholder="输入公告内容..."
            value={newAnnouncement}
            onChange={e => setNewAnnouncement(e.target.value)} />
          <button onClick={() => {
            if (!newAnnouncement.trim()) return;
            const arr = [...(state.announcements || []), newAnnouncement.trim()];
            dispatch({ type: 'UPDATE_ANNOUNCEMENTS', payload: arr });
            setNewAnnouncement('');
            showMsg('公告已添加');
          }}
            className="px-4 py-2 bg-brand-500 text-white text-sm rounded-xl hover:bg-rose-600 transition-colors shrink-0 self-end">
            添加
          </button>
        </div>
      </div>

      {/* ========== 妆造类型 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" /> 妆造类型与价格
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">新建订单时自动填充价格和时长，想涨价直接改</p>
          </div>
          <button onClick={() => { setEditingType(null); setTypeForm({ name: '', defaultPrice: 168, defaultDuration: 1, emoji: '💄', desc: '' }); setShowTypeForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors active:scale-95">
            <Plus className="w-4 h-4" /> 添加
          </button>
          <button onClick={() => {
            const types = state.makeupTypes;
            const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>小荷价格表</title><style>body{font-family:"PingFang SC",sans-serif;max-width:500px;margin:30px auto;color:#333}h1{text-align:center;font-size:20px;color:#ec4899;margin-bottom:4px}.sub{text-align:center;font-size:12px;color:#999;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#fce7f3;color:#be185d;padding:10px 12px;text-align:left;font-size:13px}td{padding:10px 12px;border-bottom:1px solid #fce7f3;font-size:14px}.price{text-align:right;font-weight:700;color:#ec4899}.note{text-align:center;margin-top:20px;font-size:11px;color:#999}.effective{text-align:center;font-size:12px;color:#ec4899;font-weight:600;margin-top:6px}@media print{body{margin:0;padding:10px}}</style></head><body><h1>🪷 小荷约妆</h1><div class="sub">价格表 · '+new Date().toLocaleDateString("zh-CN")+'</div><div class="effective">2026年8月24日起推行</div><table><tr><th>妆造类型</th><th>时长</th><th class="price">价格</th></tr>'+types.map(t=>'<tr><td>'+(t.emoji||"")+' '+t.name+'</td><td>'+(t.defaultDuration||t.duration)+'h</td><td class="price">¥'+(t.defaultPrice||t.price)+'</td></tr>').join("")+'</table><div class="note">📍 地铁5号线凌大塘站D口附近 · 定金¥18 · 妆后面结</div></body></html>';
            const w=window.open("","_blank");w.document.write(html);w.document.close();setTimeout(()=>w.print(),400);
          }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-brand-200 text-brand-600 rounded-xl hover:bg-brand-50 transition-colors ml-2">
            <Printer className="w-4 h-4" /> 打印价格表
          </button>
        </div>

        {showTypeForm && (
          <div className="mb-4 p-4 rounded-2xl bg-brand-50/50 border border-brand-100 animate-scale-in">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">名称</label>
                <input className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如：晚宴妆" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">默认价格 ¥</label>
                <input type="number" step="1" min="0" className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={typeForm.defaultPrice} onChange={e => setTypeForm(f => ({ ...f, defaultPrice: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">时长(h)</label>
                <input type="number" step="0.5" min="0.5" className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={typeForm.defaultDuration} onChange={e => setTypeForm(f => ({ ...f, defaultDuration: parseFloat(e.target.value) || 0.5 }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">图标 Emoji</label>
                <input className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={typeForm.emoji} onChange={e => setTypeForm(f => ({ ...f, emoji: e.target.value }))} placeholder="如：💄" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">时间说明</label>
                <input className="w-full px-3 py-2 rounded-xl border border-brand-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition"
                  value={typeForm.desc} onChange={e => setTypeForm(f => ({ ...f, desc: e.target.value }))} placeholder="如：化妆时长：约1-1.5小时" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setShowTypeForm(false); setEditingType(null); }}
                className="px-3 py-1.5 text-sm text-warm-800/60 hover:bg-white rounded-lg transition-colors">取消</button>
              <button onClick={handleSaveType}
                className="px-4 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
                {editingType ? '保存' : '添加'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {state.makeupTypes.map(mt => (
            <div key={mt.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-brand-50/30 transition-colors group gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                  {mt.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warm-800 truncate">{mt.name}</p>
                  <p className="text-xs text-warm-800/40">默认 ¥{mt.defaultPrice} · {mt.defaultDuration}h</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingType(mt); setTypeForm({ name: mt.name, defaultPrice: mt.defaultPrice, defaultDuration: mt.defaultDuration, emoji: mt.emoji || '💄', desc: mt.desc || '' }); setShowTypeForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-brand-100 text-warm-800/40 hover:text-brand-600 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => {
                  if (state.makeupTypes.length <= 1) { showMsg('至少保留一个妆造类型', 'error'); return; }
                  dispatch({ type: 'DELETE_MAKEUP_TYPE', payload: mt.id });
                  showMsg('妆造类型已删除');
                }}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-warm-800/40 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========== 账号安全 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-400" /> 账号安全
        </h3>
        <p className="text-sm text-warm-800/55 leading-6 mb-4">
          邮箱和密码只由 Supabase 安全处理，不会写进网页代码。修改邮箱后，需要到新邮箱点击确认链接。
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-brand-50/50 border border-brand-100 p-4">
            <label className="block text-xs font-semibold text-warm-800/60 mb-2">新的管理员邮箱</label>
            <div className="flex gap-2">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="建议使用专门的工作邮箱"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <button disabled={accountSaving || !newEmail.trim()} onClick={changeEmail} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#df8298] to-[#70a683] text-white text-sm font-semibold disabled:opacity-40">更改邮箱</button>
            </div>
          </div>
          <div className="rounded-2xl bg-brand-50/50 border border-brand-100 p-4">
            <label className="block text-xs font-semibold text-warm-800/60 mb-2">新的管理员密码</label>
            <div className="flex gap-2">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少 10 位，建议混合字母和数字"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <button disabled={accountSaving || newPassword.length < 10} onClick={changePassword} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#df8298] to-[#70a683] text-white text-sm font-semibold disabled:opacity-40">更改密码</button>
            </div>
          </div>
        </div>
        <MfaSettings onMessage={showMsg} />
      </div>

      {/* ========== 数据管理 ========== */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-rose-400" /> 数据管理
        </h3>
        <p className="text-xs text-warm-800/40 mb-4">
          订单数据保存在 Supabase 云端。仍建议定期导出备份，防止误操作或数据损坏。
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-50 text-brand-600 text-sm font-medium rounded-xl hover:bg-brand-100 transition-colors active:scale-95">
            <Download className="w-4 h-4" /> 导出备份
          </button>
          <button onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors active:scale-95">
            <Upload className="w-4 h-4" /> 导入恢复
          </button>
          <button onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-500 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors active:scale-95">
            <Trash2 className="w-4 h-4" /> 清空数据
          </button>
        </div>
      </div>

      {/* 部署指南 */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-rose-400" /> 微信可打开的部署方案
        </h3>

        <div className="space-y-4">
          {/* 当前可用 */}
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-700 mb-2">✅ 现在就能用的方法</p>
            <p className="text-xs text-emerald-600 leading-relaxed">
              让客妹用<strong>手机自带相机</strong>扫码（不要用微信扫一扫），或者<strong>复制链接到浏览器</strong>打开：
            </p>
            <p className="text-xs font-mono text-emerald-700 mt-1.5 bg-emerald-100 rounded-lg px-3 py-1.5 break-all">
              {window.location.origin}/menu
            </p>
          </div>

          {/* Vercel 部署 */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-700 mb-2">🚀 终极方案：Vercel 免费部署（微信可直接打开）</p>
            <ol className="text-xs text-blue-600 leading-relaxed space-y-1 list-decimal list-inside">
              <li>访问 <strong>vercel.com</strong> 用 GitHub 账号注册（免费）</li>
              <li>安装 Vercel CLI：终端运行 <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">npm i -g vercel</code></li>
              <li>在本项目目录运行 <code className="bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">vercel</code> 按提示操作</li>
              <li>获得 <strong>https://xxx.vercel.app</strong> 地址，微信秒开！</li>
            </ol>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-2">💄 关于小荷订单</h3>
        <p className="text-xs text-warm-800/40 leading-relaxed">
          版本 1.2 · 专为独立化妆师打造的订单管理工具<br />
          支持主题换肤 · 微信分享 · PWA 离线使用<br />
          数据保存在浏览器本地存储中，不会上传到任何服务器。
        </p>
      </div>
    </div>
  );
}

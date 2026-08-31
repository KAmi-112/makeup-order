import { useState, useMemo, useEffect } from 'react';
import { useStore, generateId } from '../store.jsx';
import { fetchWeather } from '../utils/weather.js';
import { getEffectiveServicePrice, getServicePriceLabel, getPriceAdjustment } from '../utils/pricing.js';
import {
  Sparkles, Copy, Check, Share2, QrCode, X,
  ShoppingCart, ArrowLeft, Flower2, Drama, Camera, WandSparkles,
  Crown, Mic2, GraduationCap, Palette, Brush
} from 'lucide-react';
import QRCode from 'qrcode';

// ---- 妆造类型卡片配置（统一线性图标 + 渐变色 + 描述） ----
const typeCardConfig = {
  '日常妆 / lo妆': { icon: Flower2, gradient: 'from-pink-400 to-rose-500', bg: 'from-pink-50 to-rose-50', desc: '约1-1.5小时' },
  'COS展妆':        { icon: Drama, gradient: 'from-violet-400 to-purple-500', bg: 'from-violet-50 to-purple-50', desc: '约1.5小时' },
  'COS正片妆':      { icon: Camera, gradient: 'from-indigo-400 to-blue-500', bg: 'from-indigo-50 to-blue-50', desc: '约1.5-2小时' },
  'COS华改妆':      { icon: WandSparkles, gradient: 'from-amber-400 to-orange-500', bg: 'from-amber-50 to-orange-50', desc: '约2小时' },
  '新娘妆':          { icon: Crown, gradient: 'from-rose-300 to-pink-400', bg: 'from-rose-50 to-pink-50', desc: '约2.5小时' },
  '舞台妆':          { icon: Palette, gradient: 'from-red-400 to-rose-500', bg: 'from-red-50 to-rose-50', desc: '约1.5小时' },
  '写真妆':          { icon: Camera, gradient: 'from-teal-400 to-cyan-500', bg: 'from-teal-50 to-cyan-50', desc: '约1.5小时' },
  '主持妆':          { icon: Mic2, gradient: 'from-sky-400 to-blue-500', bg: 'from-sky-50 to-blue-50', desc: '约1.5小时' },
  '伴娘妆':          { icon: Flower2, gradient: 'from-emerald-400 to-green-500', bg: 'from-emerald-50 to-green-50', desc: '约45分钟' },
  '毕业妆':          { icon: GraduationCap, gradient: 'from-blue-400 to-indigo-500', bg: 'from-blue-50 to-indigo-50', desc: '约1小时' },
};

function getCardConfig(name) {
  for (const [key, cfg] of Object.entries(typeCardConfig)) {
    if (name.includes(key) || key.includes(name)) return cfg;
  }
  return { icon: Brush, gradient: 'from-rose-400 to-brand-600', bg: 'from-rose-50 to-rose-50', desc: '' };
}

/* ---- 生成可选时间段 ---- */
const toMinutes = value => { const [h, m] = (value || '00:00').split(':').map(Number); return h * 60 + (m || 0); };

function generateTimeSlots(date, duration, orders, bookingRules) {
  const range = bookingRules?.availableHours || bookingRules?.workingHours || { start: '07:00', end: '18:00' };
  const rangeStart = toMinutes(range.start);
  const rangeEnd = toMinutes(range.end);
  const buffer = Math.max(0, Number(bookingRules?.bufferMinutes || 0));
  const slots = [];
  const bookedRanges = [];
  if (date) {
    orders.forEach(o => {
      if (o.date === date && o.status !== 'cancelled') {
        const start = toMinutes(o.time);
        bookedRanges.push({ start, end: start + Number(o.duration || 1) * 60 });
      }
    });
  }
  for (let minute = rangeStart; minute + Number(duration || 1) * 60 <= rangeEnd; minute += 30) {
    const end = minute + Number(duration || 1) * 60;
    const booked = bookedRanges.some(r => minute < r.end + buffer && end + buffer > r.start);
    const startText = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    const endText = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
    slots.push({
      value: startText,
      label: `${startText} ~ ${endText}`,
      booked,
    });
  }
  return slots;
}

export default function Menu() {
  const { state, dispatch } = useStore();
  const [step, setStep] = useState('menu');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWechat, setCustomerWechat] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // 客妹访问口令
  const MENU_PASS = state.menuPass || '小荷';
  const [passInput, setPassInput] = useState('');
  const [passOk, setPassOk] = useState(() => sessionStorage.getItem('_menu_pass') === MENU_PASS);
  const [passErr, setPassErr] = useState(false);

  const checkPass = () => {
    if (passInput.trim() === MENU_PASS) {
      sessionStorage.setItem('_menu_pass', MENU_PASS);
      setPassOk(true);
      setPassErr(false);
    } else {
      setPassErr(true);
    }
  };

  const selectedTypeData = useMemo(() =>
    selectedType ? state.makeupTypes.find(t => t.name === selectedType) : null,
  [selectedType, state.makeupTypes]);

  const totalPrice = useMemo(() => {
    let p = selectedTypeData?.defaultPrice || 0;
    selectedServices.forEach(sid => {
      const svc = state.extraServices.find(s => s.id === sid);
      if (svc) p += getEffectiveServicePrice(selectedType, svc);
    });
    return Math.max(0, p + getPriceAdjustment(date, time, state.priceRules).amount);
  }, [selectedTypeData, selectedServices, selectedType, state.extraServices, state.priceRules, date, time]);

  const depositAmount = Number(state.miniappConfig?.depositAmount ?? 18);
  const priceAdjustment = getPriceAdjustment(date, time, state.priceRules);
  const confirmedServices = useMemo(() =>
    state.extraServices.filter(s => selectedServices.includes(s.id)),
  [selectedServices, state.extraServices]);

  const typeConfig = useMemo(() => getCardConfig(selectedType || ''), [selectedType]);

  // ---- QR 二维码 ----
  const shareUrl = useMemo(() => {
    return window.location.origin + '/menu';
  }, []);

  useEffect(() => {
    if (showQR) {
      QRCode.toDataURL(shareUrl, {
        width: 300, margin: 2,
        color: { dark: '#be123c', light: '#ffffff' },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [showQR, shareUrl]);

  // Hooks 必须在每次渲染中按相同顺序执行，口令页面的提前返回放在 Hooks 之后。
  if (!passOk) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-cream">
        <div className="bg-white rounded-2xl border border-brand-100 shadow-xl p-8 max-w-sm w-full text-center animate-scale-in">
          <div className="text-5xl mb-4">🪷</div>
          <h2 className="text-xl font-extrabold text-warm-800 mb-2">小荷约妆</h2>
          <p className="text-sm text-warm-muted mb-6">请输入访问口令</p>
          <input type="text" value={passInput} onChange={e => { setPassInput(e.target.value); setPassErr(false); }}
            placeholder="输入口令" autoFocus
            onKeyDown={e => e.key === 'Enter' && checkPass()}
            className="w-full px-4 py-3 text-center text-lg rounded-xl border border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-300 transition mb-3" />
          {passErr && <p className="text-sm text-red-500 mb-2">口令错误</p>}
          <button onClick={checkPass}
            className="w-full py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-xl shadow-lg shadow-brand-200 active:scale-95 transition">
            进入
          </button>
        </div>
      </div>
    );
  }

  // ---- 操作 ----
  const toggleService = (id) => {
    setSelectedServices(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleCreateOrder = () => {
    if (!customerName.trim()) return;
    if ((state.bookingRules?.blockedDates || []).includes(date)) {
      alert('这一天是休息日，暂不接受预约。');
      return;
    }
    dispatch({
      type: 'ADD_ORDER',
      payload: {
        id: generateId(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerWechat: customerWechat.trim(),
        date: date || new Date().toISOString().slice(0, 10),
        time: time || '09:00',
        duration: selectedTypeData?.defaultDuration || 1,
        location: state.miniappConfig?.location || '',
        makeupType: selectedType,
        price: totalPrice,
        deposit: depositAmount,
        source: '客妹自助下单',
        status: 'pending',
        paymentStatus: 'unpaid',
        notes: notes.trim(),
        extraServices: selectedServices,
        createdAt: new Date().toISOString(),
      },
    });
    setStep('done');
    // 生成带天气的确认文本
    generateConfirmText().then(setConfirmText);
  };

  const generateConfirmText = async () => {
    // 获取预约日天气
    let weatherLine = '';
    if (date) {
      try {
        const w = await fetchWeather();
        if (w) {
          const target = w.forecast.find(f => f.isoDate === date);
          const dayWeather = target || (date === new Date().toISOString().slice(0,10) ? { high: w.current.temp, low: w.current.temp, text: w.current.text } : null);
          if (dayWeather) {
            weatherLine = `天气：${dayWeather.low ?? ''}${dayWeather.low != null && dayWeather.high != null ? '~' : ''}${dayWeather.high ?? ''}°C ${dayWeather.text || ''}`;
          }
        }
      } catch {}
    }
    const lines = [
      '【妆造订单确认】💄',
      '',
      `👤 客户：${customerName}`,
      customerPhone ? `📱 手机：${customerPhone}` : '',
      customerWechat ? `💬 微信：${customerWechat}` : '',
      '',
      `💄 妆造：${selectedType}`,
      `⏱ 预计时长：${selectedTypeData?.defaultDuration || 1} 小时`,
      date ? `📅 日期：${date}` : '',
      time ? `⏰ 时间：${time}` : '',
      '',
      `💰 总价：¥${totalPrice}`,
      `定金：¥${depositAmount}（放鸽子不退）`,
      `🧾 尾款：¥${totalPrice - depositAmount}（妆后面结）`,
    ];
    if (confirmedServices.length > 0) {
      lines.push('', '📎 附加服务：');
      confirmedServices.forEach(s => lines.push(`  · ${s.name} ${getServicePriceLabel(selectedType, s)}`));
    }
    if (notes) lines.push('', `📝 备注：${notes}`);
    lines.push(
      '',
      `📍 ${state.miniappConfig?.location || '请联系化妆师确认'}`
    );
    if (weatherLine) lines.splice(lines.length - 1, 0, weatherLine);
    return lines.filter(l => l !== '').join('\n');
  };

  const handleCopyConfirm = async () => {
    const text = await generateConfirmText();
    setConfirmText(text);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setStep('menu'); setSelectedType(null); setSelectedServices([]);
    setCustomerName(''); setCustomerPhone(''); setCustomerWechat('');
    setDate(''); setTime(''); setNotes('');
  };

  // ==================== RENDER ====================
  return (
    <div className="min-h-[calc(100dvh-160px)] lg:min-h-0 pb-8">
      <div className="max-w-lg mx-auto space-y-5">

        {/* ===== STEP: menu — 选择服务 ===== */}
        {step === 'menu' && (
          <>
            {/* Header — 品牌区 */}
            <div className="text-center pt-3 pb-2">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-rose-400 rounded-full blur-2xl opacity-20 animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 via-pink-400 to-rose-500 flex items-center justify-center mx-auto shadow-xl shadow-rose-300/50 ring-4 ring-white">
                  <Sparkles className="w-7 h-7 text-white drop-shadow-sm" />
                </div>
              </div>
              <h1 className="text-xl font-extrabold text-warm-800 mt-3 tracking-tight">小荷约妆</h1>
              <p className="text-sm text-warm-800/40 mt-0.5">选择服务，一键下单 ✨</p>
            </div>

            {/* 妆造类型选择 */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1 h-4 rounded-full bg-rose-400" />
                <h3 className="text-sm font-bold text-warm-800/80">选择妆造类型</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {state.makeupTypes.map((mt) => {
                  const cfg = getCardConfig(mt.name);
                  const TypeIcon = cfg.icon;
                  const selected = selectedType === mt.name;
                  return (
                    <button
                      key={mt.id}
                      onClick={() => setSelectedType(mt.name)}
                      className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 active:scale-[0.96] ${
                        selected
                          ? `bg-gradient-to-br ${cfg.bg} border-2 border-rose-300 shadow-lg shadow-brand-200/50 scale-[1.01]`
                          : 'bg-white/80 backdrop-blur border-2 border-white hover:border-rose-150 hover:shadow-md'
                      }`}
                    >
                      {/* 选中时的小光斑 */}
                      {selected && (
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-rose-200/30 blur-xl" />
                      )}
                      <div className="relative z-10">
                        <div className={`w-10 h-10 rounded-xl bg-white/70 grid place-items-center mb-2 text-brand-600 ${selected ? 'scale-110' : ''} transition-transform`}>
                          <TypeIcon className="w-5 h-5" strokeWidth={1.7} />
                        </div>
                        <p className="text-sm font-bold text-warm-800 leading-tight">{mt.name}</p>
                        {cfg.desc && (
                          <p className="text-[11px] text-warm-800/35 mt-0.5">{cfg.desc}</p>
                        )}
                        <div className="flex items-baseline gap-1.5 mt-2">
                          <span className={`text-lg font-extrabold ${selected ? 'text-brand-600' : 'text-warm-800'}`}>
                            ¥{mt.defaultPrice}
                          </span>
                          <span className="text-[11px] text-warm-800/40">{mt.defaultDuration}h</span>
                        </div>
                      </div>
                      {selected && (
                        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-brand-600 flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 附加服务 */}
            {selectedType && state.extraServices.length > 0 && (
              <div className="animate-scale-in">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1 h-4 rounded-full bg-amber-400" />
                  <h3 className="text-sm font-bold text-warm-800/80">附加服务 <span className="text-warm-800/30 font-normal text-xs">可多选</span></h3>
                </div>
                <div className="space-y-1.5">
                  {state.extraServices.map(svc => {
                    const checked = selectedServices.includes(svc.id);
                    return (
                      <button
                        key={svc.id}
                        onClick={() => toggleService(svc.id)}
                        className={`w-full flex items-center justify-between p-3.5 lg:p-3 rounded-xl border-2 transition-all duration-200 active:scale-[0.99] ${
                          checked
                            ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-pink-50 shadow-sm'
                            : 'border-white bg-white/70 hover:border-rose-150 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                            checked ? 'border-brand-500 bg-brand-500 scale-105' : 'border-gray-200'
                          }`}>
                            {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-sm text-warm-800">{svc.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${checked ? 'text-brand-600' : 'text-warm-800/35'}`}>
                          {svc.price > 0 ? `+¥${svc.price}` : '免费'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 价格汇总卡片 */}
            {selectedType && (
              <div className="bg-white/90 backdrop-blur rounded-2xl border border-white shadow-xl shadow-rose-100/30 p-4 animate-scale-in">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-warm-800/50">{selectedType}</span>
                    <span className="text-warm-800">¥{selectedTypeData?.defaultPrice}</span>
                  </div>
                  {confirmedServices.map(s => (
                    <div key={s.id} className="flex justify-between">
                      <span className="text-warm-800/40">+ {s.name}</span>
                      <span className="text-warm-800/60">¥{s.price}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-brand-100/80 mt-3 pt-3 flex items-end justify-between">
                  <div>
                    <span className="text-xs text-warm-800/40">定金 ¥{depositAmount} · 尾款 ¥{totalPrice - depositAmount}</span>
                  </div>
                  <div className="text-right">
                    {priceAdjustment.amount !== 0 && <span className="text-[11px] text-emerald-600 block">{priceAdjustment.label} {priceAdjustment.amount > 0 ? '+' : '-'}¥{Math.abs(priceAdjustment.amount)}</span>}
                    <span className="text-xs text-warm-800/40 block">合计</span>
                    <span className="text-2xl font-extrabold text-brand-600">¥{totalPrice}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 下一步按钮 */}
            {selectedType && (
              <button
                onClick={() => setStep('info')}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-500 via-pink-500 to-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-rose-300/40 hover:shadow-2xl hover:shadow-rose-300/50 transition-all active:scale-[0.97] text-base tracking-wide"
              >
                下一步 · 填写信息 <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>
            )}

            {/* 分享按钮 */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button onClick={() => setShowQR(true)}
                className="flex items-center gap-1.5 text-xs text-warm-800/30 hover:text-rose-400 transition-colors py-2 px-3 rounded-xl hover:bg-white/60">
                <Share2 className="w-3.5 h-3.5" /> 分享给客妹
              </button>
            </div>
          </>
        )}

        {/* ===== STEP: info — 填写信息 ===== */}
        {step === 'info' && (
          <>
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('menu')}
                className="p-2 rounded-xl bg-white/80 hover:bg-white transition-colors shadow-sm">
                <ArrowLeft className="w-5 h-5 text-warm-800/60" />
              </button>
              <div>
                <h2 className="text-lg font-bold text-warm-800">填写联系信息</h2>
                <p className="text-xs text-warm-800/40">确认后自动创建订单</p>
              </div>
            </div>

            {/* 已选服务摘要 */}
            <div className={`bg-gradient-to-br ${typeConfig.bg} rounded-2xl border border-white p-4 shadow-sm`}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-white/70 text-brand-600 grid place-items-center"><typeConfig.icon className="w-5 h-5" /></span>
                <div>
                  <p className="font-bold text-warm-800 text-sm">{selectedType}</p>
                  <p className="text-xs text-warm-800/40">
                    {confirmedServices.length > 0
                      ? `含 ${confirmedServices.map(s => s.name).join('、')}`
                      : '无附加服务'}
                  </p>
                </div>
                <span className="ml-auto text-xl font-extrabold text-brand-600">¥{totalPrice}</span>
              </div>
            </div>

            {/* 表单 */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-white shadow-xl shadow-rose-100/30 p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">姓名 / 昵称 *</label>
                <input required className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition placeholder:text-warm-800/25"
                  value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="怎么称呼你？" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">手机号</label>
                  <input type="tel" className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition placeholder:text-warm-800/25"
                    value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="选填" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">微信号</label>
                  <input className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition placeholder:text-warm-800/25"
                    value={customerWechat} onChange={e => setCustomerWechat(e.target.value)} placeholder="选填" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">日期 *</label>
                  <input type="date" required min={new Date().toISOString().slice(0, 10)} className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition"
                    value={date} onChange={e => { setDate(e.target.value); setTime(''); }} />
                  {(state.bookingRules?.blockedDates || []).includes(date) && <p className="text-xs text-red-500 mt-1">休息日，请选择其他日期</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">时间 *</label>
                  <select required className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition"
                    value={time} onChange={e => setTime(e.target.value)}>
                    <option value="">选择时间</option>
                    {generateTimeSlots(date, selectedTypeData?.defaultDuration || 1, state.orders, state.bookingRules).map(t => (
                      <option key={t.value} value={t.value} disabled={t.booked}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-warm-800/50 uppercase tracking-wide mb-1">备注</label>
                <textarea rows={2} className="w-full px-4 py-3 rounded-xl bg-brand-50/30 border border-brand-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent transition resize-none placeholder:text-warm-800/25"
                  value={notes} onChange={e => setNotes(e.target.value)} placeholder="过敏史、特殊需求..." />
              </div>
            </div>

            <button onClick={handleCreateOrder} disabled={!customerName.trim()}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-500 via-pink-500 to-brand-600 text-white font-bold rounded-2xl shadow-xl shadow-rose-300/40 hover:shadow-2xl transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed text-base tracking-wide">
              <ShoppingCart className="w-5 h-5" /> 确认下单
            </button>
          </>
        )}

        {/* ===== STEP: done — 下单成功 ===== */}
        {step === 'done' && (
          <>
            <div className="text-center pt-3 pb-2">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-emerald-400 rounded-full blur-2xl opacity-20" />
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mx-auto ring-4 ring-white shadow-lg">
                  <Check className="w-8 h-8 text-emerald-500" strokeWidth={2.5} />
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-warm-800 mt-3">下单成功！🎉</h2>
              <p className="text-sm text-warm-800/40 mt-1">复制确认信息发给我就搞定啦～</p>
            </div>

            {/* 确认信息卡片 */}
            <div className="bg-white/90 backdrop-blur rounded-2xl border border-white shadow-xl shadow-rose-100/30 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-rose-50 to-transparent">
                <span className="text-sm font-bold text-warm-800">卡片 订单确认</span>
                <button onClick={handleCopyConfirm}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium transition-all active:scale-95 ${
                    copied ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600 hover:bg-rose-200'
                  }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" /> 已复制</> : <><Copy className="w-3.5 h-3.5" /> 复制</>}
                </button>
              </div>
              <pre className="text-[13px] text-warm-800/70 leading-relaxed whitespace-pre-wrap px-5 py-4 font-sans max-h-64 overflow-y-auto">
                {confirmText}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleReset}
                className="py-3.5 text-sm font-semibold text-warm-800/60 bg-white/80 backdrop-blur border border-white rounded-2xl hover:bg-white hover:shadow-md transition-all active:scale-[0.97]">
                再下一单
              </button>
              <button onClick={handleCopyConfirm}
                className={`py-3.5 text-sm font-semibold rounded-2xl transition-all active:scale-[0.97] shadow-lg ${
                  copied ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gradient-to-r from-brand-500 to-pink-500 text-white shadow-brand-200'
                }`}>
                {copied ? '✅ 复制成功！' : '卡片 复制发给化妆师'}
              </button>
            </div>
          </>
        )}

        {/* ===== QR Code 弹窗 → 引导小程序 ===== */}
        {showQR && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowQR(false)} />
            <div className="relative bg-white rounded-3xl p-6 shadow-2xl animate-scale-in max-w-sm w-full text-center border border-brand-50">
              <button onClick={() => setShowQR(false)}
                className="absolute top-3 right-3 p-2 rounded-xl hover:bg-brand-50 transition-colors">
                <X className="w-5 h-5 text-warm-800/40" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                <QrCode className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-lg text-warm-800 mb-1">微信扫码约妆</h3>
              <p className="text-sm text-warm-800/50 mb-4">打开微信扫一扫，进入小程序下单</p>

              {/* 小程序码占位 — 替换为你的真实太阳码 */}
              <div className="bg-brand-50 rounded-2xl p-8 mb-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl mb-2">🪷</div>
                  <p className="text-sm font-bold text-brand-600">小荷约妆</p>
                  <p className="text-[11px] text-rose-400 mt-1">微信搜索小程序</p>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 text-left">
                <p className="text-xs text-amber-700 leading-relaxed">
                  📱 <strong>怎么发给客妹？</strong><br/>
                  ① 截图此页面发给客妹<br/>
                  ② 客妹用<strong>微信扫一扫</strong>打开<br/>
                  ③ 或让客妹在微信搜「<strong>小荷约妆</strong>」
                </p>
              </div>

              {qrDataUrl && (
                <p className="text-[10px] text-warm-800/20 mt-3 break-all font-mono hidden">{shareUrl}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

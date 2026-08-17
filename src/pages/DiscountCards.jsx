import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, RefreshCw, Copy, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { fetchDiscountCards, issueDiscountCard, refundDiscountCard } from '../db.js';

const money = value => `¥${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;
const randomPin = () => String(Math.floor(100000 + Math.random() * 900000));

function IssueModal({ makeupTypes, onClose, onDone }) {
  const first = makeupTypes[0];
  const [form, setForm] = useState({ customerName: '', makeupTypeId: first?.id || '', pin: randomPin(), notes: '' });
  const [price, setPrice] = useState(Math.round(Number(first?.defaultPrice || 0) * 4 * .92));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const type = makeupTypes.find(item => item.id === form.makeupTypeId) || first;
  const originalTotal = Number(type?.defaultPrice || 0) * 4;
  const changeType = id => {
    const next = makeupTypes.find(item => item.id === id);
    setForm(value => ({ ...value, makeupTypeId: id }));
    setPrice(Math.round(Number(next?.defaultPrice || 0) * 4 * .92));
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await issueDiscountCard({ ...form, makeupTypeName: type.name, originalUnitPrice: type.defaultPrice, purchaseAmount: Number(price) });
      onDone({ ...result, pin: form.pin });
    } catch (e) { setError(e.message?.includes('function') ? '云端尚未安装优惠卡数据结构，请先执行优惠卡 SQL。' : (e.message || '创建失败')); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center p-4">
    <button aria-label="关闭" className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
    <form onSubmit={submit} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold text-[#3c5948]">办理四次优惠卡</h2><p className="text-xs text-[#829087] mt-1">长期有效 · 完成订单才扣次</p></div><button type="button" onClick={onClose}><X className="w-5 h-5" /></button></div>
      <label className="block text-sm">客妹称呼<input required maxLength={40} value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})} className="mt-1.5 w-full px-4 py-3 rounded-xl border border-[#dce8df]" placeholder="用于区分卡片" /></label>
      <label className="block text-sm">对应妆造<select value={form.makeupTypeId} onChange={e=>changeType(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl border border-[#dce8df] bg-white">{makeupTypes.map(item=><option key={item.id} value={item.id}>{item.name} · 单次{money(item.defaultPrice)}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">实收办卡金额<input required type="number" min="0" max={originalTotal} step="0.01" value={price} onChange={e=>setPrice(e.target.value)} className="mt-1.5 w-full px-4 py-3 rounded-xl border border-[#dce8df]" /></label>
        <label className="text-sm">6位核验码<input required inputMode="numeric" pattern="\d{6}" value={form.pin} onChange={e=>setForm({...form,pin:e.target.value.replace(/\D/g,'').slice(0,6)})} className="mt-1.5 w-full px-4 py-3 rounded-xl border border-[#dce8df] tracking-[.25em]" /></label>
      </div>
      <div className="rounded-2xl bg-[#f3f8f4] p-4 text-sm text-[#587061]">四次原价 {money(originalTotal)}，本次优惠 {money(originalTotal-Number(price||0))}。每次固定抵扣 {money(type?.defaultPrice)}；未来涨价或升级时补差价。</div>
      <label className="block text-sm">内部备注<textarea maxLength={500} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1.5 w-full px-4 py-3 rounded-xl border border-[#dce8df] min-h-20" /></label>
      {error&&<p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
      <button disabled={busy} className="w-full py-3 rounded-xl bg-[#4f7d5f] text-white font-semibold disabled:opacity-50">{busy?'正在创建…':'确认收款并创建卡片'}</button>
    </form>
  </div>;
}

export default function DiscountCardsPage() {
  const { state } = useStore();
  const [cards,setCards]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [issuing,setIssuing]=useState(false); const [created,setCreated]=useState(null); const [filter,setFilter]=useState('active');
  const load=async()=>{setLoading(true);setError('');try{setCards(await fetchDiscountCards());}catch(e){setError(e.message?.includes('discount_cards')?'云端尚未安装优惠卡数据结构，请执行 supabase_discount_cards.sql。':(e.message||'读取失败'));}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  const visible=useMemo(()=>cards.filter(c=>filter==='all'||c.status===filter),[cards,filter]);
  const copyCreated=()=>{if(!created)return;navigator.clipboard.writeText(`小荷优惠卡\n卡号：${created.card_code}\n核验码：${created.pin}\n卡种：${created.makeup_type_name}\n四次长期有效，请妥善保存。`);};
  const refund=async card=>{
    if(card.reservedUses>0){alert('这张卡还有未完成预约，请先取消或完成预约后再退款。');return;}
    const merchantFault=window.confirm('退款是否因为小荷无法继续提供服务？\n“确定”按优惠单价结算已用次数；“取消”按客妹主动退卡、原价结算。');
    const reason=window.prompt('请输入退款原因（会保存在记录中）：',''); if(reason===null)return;
    const expected=Math.max(0,card.purchaseAmount-(merchantFault?card.purchaseAmount/4:card.originalUnitPrice)*card.usedUses);
    if(!window.confirm(`预计退款 ${money(expected)}，确认将卡片设为已退款？此操作不可直接撤销。`))return;
    try{const result=await refundDiscountCard(card.id,reason,merchantFault);alert(`已登记退款 ${money(result.refundAmount)}`);load();}catch(e){alert(e.message||'退款失败');}
  };
  return <div className="max-w-7xl mx-auto space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-[#355844] flex items-center gap-2"><CreditCard className="w-6 h-6"/>优惠卡</h1><p className="text-sm text-[#7f9185] mt-1">四次长期卡 · 预约预占 · 完妆核销 · 取消释放</p></div><div className="flex gap-2"><button onClick={load} className="p-3 rounded-xl border bg-white"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/></button><button onClick={()=>setIssuing(true)} className="px-4 py-3 rounded-xl bg-[#d97891] text-white flex items-center gap-2"><Plus className="w-4 h-4"/>办理新卡</button></div></div>
    <div className="flex gap-2">{[['active','有效'],['refunded','已退款'],['void','已作废'],['all','全部']].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={`px-4 py-2 rounded-full text-sm ${filter===v?'bg-[#4f7d5f] text-white':'bg-white border text-[#66776b]'}`}>{l}</button>)}</div>
    {error&&<div className="p-4 rounded-2xl bg-red-50 text-red-700">{error}</div>}
    {!loading&&!error&&visible.length===0&&<div className="py-20 text-center bg-white rounded-3xl border border-[#e7eee8] text-[#829087]">还没有符合条件的优惠卡</div>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{visible.map(card=><article key={card.id} className="bg-white rounded-3xl border border-[#e3ece5] p-5 shadow-sm">
      <div className="flex justify-between gap-3"><div><p className="text-xs text-[#87978c]">{card.cardCode}</p><h3 className="text-lg font-semibold text-[#3d5b49] mt-1">{card.customerName}</h3><p className="text-sm text-[#be667e] mt-1">{card.makeupTypeName}</p></div><span className={`h-fit px-3 py-1 rounded-full text-xs ${card.status==='active'?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}`}>{card.status==='active'?'长期有效':card.status==='refunded'?'已退款':'已作废'}</span></div>
      <div className="grid grid-cols-4 gap-2 mt-5">{Array.from({length:4},(_,i)=>{const done=i<card.usedUses,res=i>=card.usedUses&&i<card.usedUses+card.reservedUses;return <div key={i} className={`h-10 rounded-xl grid place-items-center text-sm font-semibold ${done?'bg-[#4f7d5f] text-white':res?'bg-amber-100 text-amber-700':'bg-[#f2f6f3] text-[#8ba092]'}`}>{done?'已用':res?'预占':i+1}</div>})}</div>
      <div className="mt-4 text-sm space-y-1.5 text-[#66776b]"><p>实收 {money(card.purchaseAmount)} · 单次抵扣 {money(card.originalUnitPrice)}</p><p>已完成 {card.usedUses} 次 · 待完成 {card.reservedUses} 次 · 可预约 {card.availableUses} 次</p></div>
      {card.status==='active'&&<button onClick={()=>refund(card)} className="mt-4 w-full py-2.5 rounded-xl border border-red-100 text-red-600 text-sm flex items-center justify-center gap-2"><RotateCcw className="w-4 h-4"/>办理退卡</button>}
    </article>)}</div>
    {issuing&&<IssueModal makeupTypes={state.makeupTypes} onClose={()=>setIssuing(false)} onDone={result=>{setIssuing(false);setCreated(result);load();}}/>}
    {created&&<div className="fixed inset-0 z-50 grid place-items-center p-4"><div className="absolute inset-0 bg-black/35"/><div className="relative bg-white rounded-3xl p-7 max-w-md w-full text-center"><ShieldCheck className="w-12 h-12 mx-auto text-[#4f7d5f]"/><h2 className="text-xl font-semibold mt-3">优惠卡创建成功</h2><p className="mt-5 text-sm">卡号</p><p className="text-xl font-mono font-bold tracking-wider">{created.card_code}</p><p className="mt-3 text-sm">核验码</p><p className="text-2xl font-mono font-bold tracking-[.3em]">{created.pin}</p><p className="text-xs text-red-500 mt-4">核验码不会再次显示，请立即发给客妹。</p><button onClick={copyCreated} className="w-full mt-5 py-3 rounded-xl bg-[#4f7d5f] text-white flex items-center justify-center gap-2"><Copy className="w-4 h-4"/>复制办卡信息</button><button onClick={()=>setCreated(null)} className="mt-3 text-sm text-[#7e8d83]">我已保存</button></div></div>}
  </div>;
}

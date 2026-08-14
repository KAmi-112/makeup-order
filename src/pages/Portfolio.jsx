import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Eye, EyeOff, Image as ImageIcon, Save, ShieldCheck } from 'lucide-react';
import { useStore } from '../store.jsx';

export default function PortfolioPage() {
  const { state, dispatch, syncStatus } = useStore();
  const items = useMemo(() => state.miniappConfig?.portfolioItems || [], [state.miniappConfig]);
  const [drafts, setDrafts] = useState({});
  const [activeTypeId, setActiveTypeId] = useState('');
  const [month, setMonth] = useState('');
  const typeName = id => state.makeupTypes.find(type => String(type.id) === String(id))?.name || '未关联妆容';
  const itemTypeId = item => item.makeupTypeId || state.makeupTypes.find(type => type.name === item.category)?.id || '';

  const groups = state.makeupTypes.map(type => {
    const works = items.filter(item => String(itemTypeId(item)) === String(type.id));
    return { ...type, works, cover: works.find(item => item.published) || works[0] };
  });
  const visibleItems = items.filter(item => (!activeTypeId || String(itemTypeId(item)) === String(activeTypeId)) && (!month || item.shotDate?.startsWith(month)));
  const valueFor = (item, field) => drafts[item.id]?.[field] ?? (field === 'makeupTypeId' ? itemTypeId(item) : item[field]);
  const updateDraft = (id, field, value) => setDrafts(current => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  const saveItem = async item => {
    const next = items.map(entry => entry.id === item.id ? { ...entry, ...(drafts[item.id] || {}), category: undefined } : entry);
    const ok = await dispatch({ type: 'UPDATE_PORTFOLIO_ITEMS', payload: next });
    if (ok) setDrafts(current => { const copy = { ...current }; delete copy[item.id]; return copy; });
  };
  const togglePublished = item => dispatch({ type: 'UPDATE_PORTFOLIO_ITEMS', payload: items.map(entry => entry.id === item.id ? { ...entry, published: !entry.published } : entry) });

  return <div className="max-w-6xl mx-auto pb-24 space-y-7">
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs tracking-[.22em] text-[#73907c] uppercase">Portfolio</p>
        <h2 className="text-2xl font-semibold text-[#355844] mt-1">妆造作品集</h2>
        <p className="text-sm text-[#75837a] mt-2">作品绑定妆容的固定编号，妆容改名后会自动跟随。</p>
      </div>
      <span className={`text-xs rounded-full px-3 py-1.5 ${syncStatus.state === 'error' ? 'bg-red-50 text-red-600' : 'bg-[#edf6ef] text-[#568166]'}`}>{syncStatus.state === 'saving' ? '正在同步…' : syncStatus.state === 'error' ? '同步失败' : `${items.length} 件作品`}</span>
    </div>

    {!activeTypeId && <section>
      <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-[#40594a]">妆造大类总览</h3><span className="text-xs text-[#829087]">点击进入分类</span></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => <button key={group.id} onClick={() => setActiveTypeId(String(group.id))} className="text-left overflow-hidden rounded-2xl bg-white border border-[#e3ece4] hover:-translate-y-0.5 transition shadow-[0_12px_34px_rgba(65,94,75,.07)]">
          <div className="h-40 bg-[#f3eee8]">{group.cover ? <img src={`${import.meta.env.BASE_URL}gallery/${group.cover.imageKey}`} alt="" className="w-full h-full object-cover" /> : <div className="h-full grid place-items-center text-[#aab5ad]"><ImageIcon className="w-7 h-7" /></div>}</div>
          <div className="p-4"><div className="font-semibold text-[#3f5949]">{group.name}</div><div className="text-xs text-[#87938b] mt-1">{group.works.length} 件作品</div></div>
        </button>)}
      </div>
    </section>}

    {activeTypeId && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white border border-[#e3ece4] p-4">
      <button onClick={() => { setActiveTypeId(''); setMonth(''); }} className="inline-flex items-center gap-2 text-sm text-[#567461]"><ArrowLeft className="w-4 h-4" />返回大类总览</button>
      <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#789080]" /><input type="month" value={month} onChange={event => setMonth(event.target.value)} className="rounded-lg border border-[#dfe9e1] px-3 py-2 text-sm text-[#4b6253]" />{month && <button onClick={() => setMonth('')} className="text-xs text-[#d2768b]">清除日期</button>}</div>
    </div>}

    {activeTypeId && <div className="space-y-5">
      <h3 className="text-xl font-semibold text-[#355844]">{typeName(activeTypeId)} <span className="text-sm font-normal text-[#8a958e]">{visibleItems.length} 件</span></h3>
      {visibleItems.map(item => <article key={item.id} className="grid md:grid-cols-[280px_1fr] overflow-hidden rounded-[28px] bg-white border border-[#e5eee6] shadow-[0_18px_50px_rgba(65,94,75,.08)]">
        <div className="relative bg-[#f4eee9] min-h-72"><img src={`${import.meta.env.BASE_URL}gallery/${item.imageKey}`} alt={item.title} className="absolute inset-0 w-full h-full object-cover" /><span className="absolute left-4 top-4 rounded-full bg-white/88 backdrop-blur px-3 py-1.5 text-xs text-[#4c7259]">{typeName(itemTypeId(item))}</span></div>
        <div className="p-6 md:p-8 flex flex-col justify-between gap-6"><div className="space-y-4">
          <label className="block"><span className="text-xs text-[#718176]">内部作品名称</span><input value={valueFor(item, 'title')} onChange={event => updateDraft(item.id, 'title', event.target.value)} maxLength={48} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844] outline-none focus:border-[#d98da0]" /></label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label><span className="text-xs text-[#718176]">绑定妆造类型</span><select value={valueFor(item, 'makeupTypeId')} onChange={event => updateDraft(item.id, 'makeupTypeId', event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844] bg-white">{state.makeupTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
            <label><span className="text-xs text-[#718176]">拍摄日期（可后补）</span><input type="date" value={valueFor(item, 'shotDate') || ''} onChange={event => updateDraft(item.id, 'shotDate', event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844]" /></label>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#568166] bg-[#f1f7f2] rounded-xl px-4 py-3"><ShieldCheck className="w-4 h-4" />已确认公开展示授权；当前未关联客户。</div>
        </div><div className="flex flex-wrap gap-3"><button onClick={() => togglePublished(item)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${item.published ? 'bg-[#edf6ef] text-[#4f765a]' : 'bg-stone-100 text-stone-500'}`}>{item.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}{item.published ? '小程序已展示' : '当前已隐藏'}</button><button disabled={!drafts[item.id]} onClick={() => saveItem(item)} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm bg-[#d97f95] text-white disabled:opacity-35">{drafts[item.id] ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}{drafts[item.id] ? '保存修改' : '已保存'}</button></div></div>
      </article>)}
      {visibleItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#dfe8e0] py-16 text-center text-sm text-[#8c9890]">这个日期范围还没有作品</div>}
    </div>}
  </div>;
}

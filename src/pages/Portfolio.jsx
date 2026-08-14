import { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Image as ImageIcon, Save, ShieldCheck } from 'lucide-react';
import { useStore } from '../store.jsx';

export default function PortfolioPage() {
  const { state, dispatch, syncStatus } = useStore();
  const items = useMemo(() => state.miniappConfig?.portfolioItems || [], [state.miniappConfig]);
  const [drafts, setDrafts] = useState({});

  const valueFor = (item, field) => drafts[item.id]?.[field] ?? item[field];
  const updateDraft = (id, field, value) => {
    setDrafts(current => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  };
  const saveItem = async item => {
    const next = items.map(entry => entry.id === item.id ? { ...entry, ...(drafts[item.id] || {}) } : entry);
    const ok = await dispatch({ type: 'UPDATE_PORTFOLIO_ITEMS', payload: next });
    if (ok) setDrafts(current => { const copy = { ...current }; delete copy[item.id]; return copy; });
  };
  const togglePublished = item => {
    const next = items.map(entry => entry.id === item.id ? { ...entry, published: !entry.published } : entry);
    dispatch({ type: 'UPDATE_PORTFOLIO_ITEMS', payload: next });
  };

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[.22em] text-[#73907c] uppercase">Portfolio</p>
          <h2 className="text-2xl font-semibold text-[#355844] mt-1">妆造作品集</h2>
          <p className="text-sm text-[#75837a] mt-2">管理小程序中公开展示的妆面作品。</p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1.5 ${syncStatus.state === 'error' ? 'bg-red-50 text-red-600' : 'bg-[#edf6ef] text-[#568166]'}`}>
          {syncStatus.state === 'saving' ? '正在同步…' : syncStatus.state === 'error' ? '同步失败' : `${items.length} 件作品`}
        </span>
      </div>

      {items.map(item => (
        <article key={item.id} className="grid md:grid-cols-[280px_1fr] overflow-hidden rounded-[28px] bg-white border border-[#e5eee6] shadow-[0_18px_50px_rgba(65,94,75,.08)]">
          <div className="relative bg-[#f4eee9] min-h-72">
            <img src={`${import.meta.env.BASE_URL}gallery/${item.imageKey}`} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/88 backdrop-blur px-3 py-1.5 text-xs text-[#4c7259]">
              <ImageIcon className="w-3.5 h-3.5" /> {item.category}
            </span>
          </div>
          <div className="p-6 md:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              <label className="block">
                <span className="text-xs text-[#718176]">内部作品名称</span>
                <input value={valueFor(item, 'title')} onChange={event => updateDraft(item.id, 'title', event.target.value)} maxLength={48} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844] outline-none focus:border-[#d98da0]" />
              </label>
              <label className="block">
                <span className="text-xs text-[#718176]">关联妆容</span>
                <select value={valueFor(item, 'category')} onChange={event => updateDraft(item.id, 'category', event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844] bg-white outline-none focus:border-[#d98da0]">
                  {state.makeupTypes.map(type => <option key={type.id} value={type.name}>{type.name}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-2 text-xs text-[#568166] bg-[#f1f7f2] rounded-xl px-4 py-3">
                <ShieldCheck className="w-4 h-4" />
                已确认获得公开展示授权；当前未关联客户。
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => togglePublished(item)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${item.published ? 'bg-[#edf6ef] text-[#4f765a]' : 'bg-stone-100 text-stone-500'}`}>
                {item.published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {item.published ? '小程序已展示' : '当前已隐藏'}
              </button>
              <button disabled={!drafts[item.id]} onClick={() => saveItem(item)} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm bg-[#d97f95] text-white disabled:opacity-35">
                {drafts[item.id] ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {drafts[item.id] ? '保存修改' : '已保存'}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Eye, EyeOff, Image as ImageIcon, Plus, Save, ShieldCheck, Upload, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { deletePortfolioImages, uploadPortfolioImage } from '../db.js';

async function compressForPortfolio(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(`${file.name} 暂不支持，请先转换为 JPG、PNG 或 WebP`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} 超过 15MB，请先缩小`);
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error(`${file.name} 压缩失败`);
  return blob;
}

const portfolioImageSrc = item => item.imageUrl || `${import.meta.env.BASE_URL}gallery/${item.imageKey}`;

export default function PortfolioPage() {
  const { state, dispatch, syncStatus } = useStore();
  const items = useMemo(() => state.miniappConfig?.portfolioItems || [], [state.miniappConfig]);
  const [drafts, setDrafts] = useState({});
  const [activeTypeId, setActiveTypeId] = useState('');
  const [month, setMonth] = useState('');
  const [showImporter, setShowImporter] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importError, setImportError] = useState('');
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ makeupTypeId: String(state.makeupTypes[0]?.id || ''), title: '', shotDate: '', consentConfirmed: false });
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
  const importWorks = async () => {
    if (!files.length) return setImportError('请先选择图片');
    if (!form.makeupTypeId) return setImportError('请选择妆造分类');
    if (!form.consentConfirmed) return setImportError('请确认已获得公开展示授权');
    setUploading(true); setImportError('');
    const uploadedPaths = [];
    try {
      const selectedTypeName = typeName(form.makeupTypeId);
      const existingCount = items.filter(item => String(itemTypeId(item)) === String(form.makeupTypeId)).length;
      const created = [];
      for (let index = 0; index < files.length; index += 1) {
        const blob = await compressForPortfolio(files[index]);
        const uploaded = await uploadPortfolioImage(blob);
        uploadedPaths.push(uploaded.path);
        const number = String(existingCount + index + 1).padStart(3, '0');
        created.push({
          id: `portfolio-${crypto.randomUUID()}`,
          title: files.length === 1 && form.title.trim() ? form.title.trim() : `${form.title.trim() || selectedTypeName}-作品${number}`,
          makeupTypeId: String(form.makeupTypeId), imageUrl: uploaded.publicUrl, storagePath: uploaded.path,
          published: true, consentConfirmed: true, customerId: null,
          sortOrder: existingCount + index + 1, shotDate: form.shotDate || '',
        });
      }
      const ok = await dispatch({ type: 'UPDATE_PORTFOLIO_ITEMS', payload: [...items, ...created] });
      if (!ok) throw new Error('作品信息保存失败');
      setFiles([]); setForm(current => ({ ...current, title: '', shotDate: '', consentConfirmed: false })); setShowImporter(false);
    } catch (error) {
      if (uploadedPaths.length) await deletePortfolioImages(uploadedPaths).catch(() => {});
      setImportError(error.message || '导入失败，请稍后重试');
    } finally { setUploading(false); }
  };

  return <div className="max-w-6xl mx-auto pb-24 space-y-7">
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs tracking-[.22em] text-[#73907c] uppercase">Portfolio</p>
        <h2 className="text-2xl font-semibold text-[#355844] mt-1">妆造作品集</h2>
        <p className="text-sm text-[#75837a] mt-2">作品绑定妆容的固定编号，妆容改名后会自动跟随。</p>
      </div>
      <div className="flex items-center gap-3"><span className={`text-xs rounded-full px-3 py-1.5 ${syncStatus.state === 'error' ? 'bg-red-50 text-red-600' : 'bg-[#edf6ef] text-[#568166]'}`}>{syncStatus.state === 'saving' ? '正在同步…' : syncStatus.state === 'error' ? '同步失败' : `${items.length} 件作品`}</span><button onClick={() => setShowImporter(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#d97f95] px-4 py-2.5 text-sm text-white shadow-[0_8px_22px_rgba(217,127,149,.24)]"><Plus className="w-4 h-4" />新增作品</button></div>
    </div>

    {showImporter && <section className="rounded-[28px] border border-[#eadfe2] bg-white p-6 shadow-[0_18px_55px_rgba(91,70,76,.09)] space-y-5">
      <div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#40594a]">导入作品图片</h3><p className="mt-1 text-xs text-[#89948d]">可一次选择多张；上传前自动压缩为 WebP，长边不超过 1600px。</p></div><button onClick={() => !uploading && setShowImporter(false)} className="rounded-full p-2 text-[#87938b] hover:bg-[#f7f1f3]"><X className="w-5 h-5" /></button></div>
      <div className="grid md:grid-cols-2 gap-4">
        <label><span className="text-xs text-[#718176]">妆造分类</span><select value={form.makeupTypeId} onChange={event => setForm({ ...form, makeupTypeId: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dfe9e1] bg-white px-4 py-3 text-sm text-[#355844]">{state.makeupTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label><span className="text-xs text-[#718176]">拍摄日期（可不填）</span><input type="date" value={form.shotDate} onChange={event => setForm({ ...form, shotDate: event.target.value })} className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844]" /></label>
      </div>
      <label className="block"><span className="text-xs text-[#718176]">作品名称（单张可填写，多张会自动编号）</span><input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={48} placeholder="例如：神乐展妆" className="mt-2 w-full rounded-xl border border-[#dfe9e1] px-4 py-3 text-sm text-[#355844]" /></label>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9e5dc] bg-[#f8fbf8] px-5 text-center"><Upload className="mb-2 h-6 w-6 text-[#6f907a]" /><span className="text-sm text-[#4e6b58]">选择 JPG、PNG 或 WebP 图片</span><span className="mt-1 text-xs text-[#98a29b]">单张原图不超过 15MB，最多 10 张</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => setFiles(Array.from(event.target.files || []).slice(0, 10))} /></label>
      {!!files.length && <div className="rounded-xl bg-[#f6f8f6] px-4 py-3 text-xs text-[#647268]">已选择 {files.length} 张：{files.map(file => file.name).join('、')}</div>}
      <label className="flex items-start gap-3 rounded-xl border border-[#f0e2e5] bg-[#fff8f9] px-4 py-3 text-sm text-[#625157]"><input type="checkbox" checked={form.consentConfirmed} onChange={event => setForm({ ...form, consentConfirmed: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[#d97f95]" /><span>我已确认图片中的人物同意公开展示。</span></label>
      {importError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{importError}</p>}
      <div className="flex justify-end"><button disabled={uploading} onClick={importWorks} className="inline-flex items-center gap-2 rounded-xl bg-[#d97f95] px-6 py-3 text-sm text-white disabled:opacity-50"><Upload className="w-4 h-4" />{uploading ? `正在上传 ${files.length} 张…` : '确认导入并同步'}</button></div>
    </section>}

    {!activeTypeId && <section>
      <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-[#40594a]">妆造大类总览</h3><span className="text-xs text-[#829087]">点击进入分类</span></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map(group => <button key={group.id} onClick={() => setActiveTypeId(String(group.id))} className="text-left overflow-hidden rounded-2xl bg-white border border-[#e3ece4] hover:-translate-y-0.5 transition shadow-[0_12px_34px_rgba(65,94,75,.07)]">
          <div className="relative h-40 bg-[#f3eee8]">{group.cover ? <><img src={portfolioImageSrc(group.cover)} alt="" className="w-full h-full object-cover" /><span className="pointer-events-none absolute bottom-3 right-3 text-[11px] tracking-[.16em] text-white/55 [text-shadow:0_1px_3px_rgba(0,0,0,.45)]">西瓜椰约妆</span></> : <div className="h-full grid place-items-center text-[#aab5ad]"><ImageIcon className="w-7 h-7" /></div>}</div>
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
        <div className="relative bg-[#f4eee9] min-h-72"><img src={portfolioImageSrc(item)} alt={item.title} className="absolute inset-0 w-full h-full object-cover" /><span className="absolute left-4 top-4 rounded-full bg-white/88 backdrop-blur px-3 py-1.5 text-xs text-[#4c7259]">{typeName(itemTypeId(item))}</span><span className="pointer-events-none absolute bottom-4 right-4 text-xs tracking-[.16em] text-white/55 [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">西瓜椰约妆</span></div>
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

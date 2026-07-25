import { useState } from 'react';
import { useStore, generateId, themePresets } from '../store.jsx';
import {
  Plus, Edit3, Trash2, X, Check, Download, Upload,
  Sparkles, AlertCircle, ShieldCheck, Copy, MessageCircle,
  FileText, ShoppingBag, Palette, ExternalLink, Lock
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
  const [typeForm, setTypeForm] = useState({ name: '', defaultPrice: 168, defaultDuration: 1 });

  const handleSaveType = () => {
    if (!typeForm.name.trim()) return;
    if (editingType) {
      dispatch({ type: 'UPDATE_MAKEUP_TYPE', payload: { ...editingType, ...typeForm } });
    } else {
      dispatch({ type: 'ADD_MAKEUP_TYPE', payload: { ...typeForm, id: generateId() } });
    }
    setShowTypeForm(false); setEditingType(null);
    setTypeForm({ name: '', defaultPrice: 168, defaultDuration: 1 });
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

  // ---- 管理密码 ----
  const [newPassword, setNewPassword] = useState('');
  const handleChangePassword = () => {
    if (!newPassword.trim()) { showMsg('密码不能为空', 'error'); return; }
    localStorage.setItem('makeup_admin_password', newPassword.trim());
    setNewPassword('');
    showMsg('管理密码已更新');
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
    a.download = `西瓜椰订单_备份_${new Date().toISOString().slice(0, 10)}.json`;
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
    <div className="max-w-3xl mx-auto space-y-5">
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
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
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
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-400" /> 约妆须知
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">发给客妹的注意事项，可随时修改（比如涨价、改规则）</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyNotice}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors active:scale-95">
              <Copy className="w-4 h-4" /> 一键复制
            </button>
            {!noticeEdit ? (
              <button onClick={() => { setNoticeText(state.notice); setNoticeEdit(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-warm-100 text-warm-800 rounded-xl hover:bg-warm-200 transition-colors">
                <Edit3 className="w-4 h-4" /> 编辑
              </button>
            ) : (
              <button onClick={handleSaveNotice}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors active:scale-95">
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
              rows={14}
              className="w-full px-4 py-3 rounded-xl border border-rose-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition resize-y font-sans"
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
          <div className="bg-warm-50 rounded-xl p-4 text-sm text-warm-800/70 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto text-[13px]">
            {state.notice || <span className="text-warm-800/30">暂未设置约妆须知，点击「编辑」添加</span>}
          </div>
        )}
      </div>

      {/* ========== 额外服务 ========== */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-rose-400" /> 额外服务 / 附加产品
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">胶带绷脸、素颜霜、鼻贴、发网等附加收费项</p>
          </div>
          <button onClick={() => { setEditingService(null); setServiceForm({ name: '', price: 0 }); setShowServiceForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors active:scale-95">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>

        {showServiceForm && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 animate-scale-in">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-warm-800/60 mb-1">服务名称</label>
                <input className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="如：胶带绷脸" />
              </div>
              <div className="w-24">
                <label className="block text-xs font-medium text-warm-800/60 mb-1">价格 ¥</label>
                <input type="number" step="1" min="0" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  value={serviceForm.price || ''} onChange={e => setServiceForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <button onClick={handleSaveService}
                className="px-4 py-2 bg-rose-500 text-white text-sm rounded-xl hover:bg-rose-600 transition-colors shrink-0">
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
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-rose-50/30 transition-colors group">
                <span className="text-sm text-warm-800">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-rose-600">{s.price > 0 ? `¥${s.price}` : '免费'}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingService(s); setServiceForm({ name: s.name, price: s.price }); setShowServiceForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-rose-100 text-warm-800/40 hover:text-rose-600 transition-colors">
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

      {/* ========== 妆造类型 ========== */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-warm-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-400" /> 妆造类型与价格
            </h3>
            <p className="text-xs text-warm-800/40 mt-0.5">新建订单时自动填充价格和时长，想涨价直接改</p>
          </div>
          <button onClick={() => { setEditingType(null); setTypeForm({ name: '', defaultPrice: 168, defaultDuration: 1 }); setShowTypeForm(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors active:scale-95">
            <Plus className="w-4 h-4" /> 添加
          </button>
        </div>

        {showTypeForm && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-50/50 border border-rose-100 animate-scale-in">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">名称</label>
                <input className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder="如：晚宴妆" />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">默认价格 ¥</label>
                <input type="number" step="1" min="0" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  value={typeForm.defaultPrice} onChange={e => setTypeForm(f => ({ ...f, defaultPrice: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-warm-800/60 mb-1">时长(h)</label>
                <input type="number" step="0.5" min="0.5" className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                  value={typeForm.defaultDuration} onChange={e => setTypeForm(f => ({ ...f, defaultDuration: parseFloat(e.target.value) || 0.5 }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setShowTypeForm(false); setEditingType(null); }}
                className="px-3 py-1.5 text-sm text-warm-800/60 hover:bg-white rounded-lg transition-colors">取消</button>
              <button onClick={handleSaveType}
                className="px-4 py-1.5 text-sm bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors">
                {editingType ? '保存' : '添加'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {state.makeupTypes.map(mt => (
            <div key={mt.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-rose-50/30 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-600 shrink-0">
                  {mt.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warm-800 truncate">{mt.name}</p>
                  <p className="text-xs text-warm-800/40">默认 ¥{mt.defaultPrice} · {mt.defaultDuration}h</p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingType(mt); setTypeForm({ name: mt.name, defaultPrice: mt.defaultPrice, defaultDuration: mt.defaultDuration }); setShowTypeForm(true); }}
                  className="p-1.5 rounded-lg hover:bg-rose-100 text-warm-800/40 hover:text-rose-600 transition-colors">
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

      {/* ========== 管理密码 ========== */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-400" /> 管理密码
        </h3>
        <p className="text-xs text-warm-800/40 mb-3">
          设置后，公网访问管理后台需要输入此密码。本地访问无需密码。
        </p>
        <div className="flex gap-2">
          <input type="text" className="flex-1 px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
            value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="输入新密码" />
          <button onClick={handleChangePassword}
            className="px-4 py-2 bg-rose-500 text-white text-sm rounded-xl hover:bg-rose-600 transition-colors active:scale-95">
            保存
          </button>
        </div>
      </div>

      {/* ========== 数据管理 ========== */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-rose-400" /> 数据管理
        </h3>
        <p className="text-xs text-warm-800/40 mb-4">
          数据存储在浏览器本地。更换设备前请导出备份，然后在新设备导入恢复。
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl hover:bg-rose-100 transition-colors active:scale-95">
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
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
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
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <h3 className="font-semibold text-warm-800 mb-2">💄 关于西瓜椰订单</h3>
        <p className="text-xs text-warm-800/40 leading-relaxed">
          版本 1.2 · 专为独立化妆师打造的订单管理工具<br />
          支持主题换肤 · 微信分享 · PWA 离线使用<br />
          数据保存在浏览器本地存储中，不会上传到任何服务器。
        </p>
      </div>
    </div>
  );
}

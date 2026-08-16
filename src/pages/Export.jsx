import { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { useStore, statusLabels, paymentLabels } from '../store.jsx';
import { loadLocalOrderBackgrounds, pickOrderBackground } from '../orderCardBackgrounds.js';
import { Download, FileText, Copy, CheckCircle2, Printer } from 'lucide-react';

export default function Export() {
  const { state } = useStore();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [dateTo, setDateTo] = useState(now.toISOString().slice(0,10));
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [orderBackgrounds, setOrderBackgrounds] = useState([]);

  useEffect(() => { loadLocalOrderBackgrounds().then(setOrderBackgrounds); }, []);

  const filtered = useMemo(() => {
    let list = state.orders;
    if (dateFrom) list = list.filter(o => o.date >= dateFrom);
    if (dateTo) list = list.filter(o => o.date <= dateTo);
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    return list.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }, [state.orders, dateFrom, dateTo, statusFilter]);

  const printCards = () => {
    const sl = statusLabels, pl = paymentLabels;
    const cards = filtered.map(o => {
      const background = pickOrderBackground(orderBackgrounds);
      return `
      <div class="card"${background ? ` style="background-image:url('${background.url}')"` : ''}>
        <div class="brand">小荷约妆</div>
        <div class="title">卡片 订单确认卡</div>
        <div class="row"><span>客户</span><strong>${o.customerName}</strong></div>
        <div class="row"><span>妆造</span><strong>${o.makeupType}</strong></div>
        <div class="row"><span>日期</span><strong>${o.date}</strong></div>
        <div class="row"><span>时间</span><strong>${o.time}（约${o.duration}h）</strong></div>
        <div class="row"><span>总价</span><strong class="price">¥${o.price}</strong></div>
        ${o.deposit > 0 ? '<div class="row"><span>定金</span><strong>¥' + o.deposit + '</strong></div><div class="row"><span>尾款</span><strong>¥' + (o.price - o.deposit) + '（妆后面结）</strong></div>' : ''}
        <div class="row"><span>状态</span><strong>${sl[o.status]}</strong></div>
        <div class="tips">⚠️ 不允许家长及异性亲友陪同 · 约定时间为开始化妆时间 · 迟到20分钟以上收取迟到费¥10 · 定金放鸽子不退</div>
      </div>
    `}).join('<div class="page-break"></div>');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>订单确认卡</title>
<style>body{font-family:'PingFang SC',sans-serif;color:#333;padding:20px}
.card{position:relative;overflow:hidden;border:2px dashed #ec4899;border-radius:16px;padding:20px;margin-bottom:20px;max-width:400px;background-size:cover;background-position:center}
.card:before{content:'';position:absolute;inset:0;background:rgba(255,252,252,.82);backdrop-filter:blur(1px)}
.card>*{position:relative;z-index:1}
.brand{text-align:center;font-size:13px;color:#ec4899;font-weight:700;margin-bottom:4px}
.title{text-align:center;font-size:18px;font-weight:800;margin-bottom:16px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #fce7f3;font-size:14px}
.row span{color:#888}.price{color:#ec4899;font-size:20px}
.tips{margin-top:12px;padding:10px;background:#fef2f2;border-radius:10px;font-size:11px;color:#dc2626;line-height:1.8}
.page-break{page-break-after:always}
@media print{body{padding:0}.card{border:1px dashed #ec4899;margin:10px;page-break-inside:avoid}}
</style></head><body>${cards}</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const exportCSV = () => {
    const headers = ['日期', '时间', '客户', '妆造', '价格', '定金', '状态', '付款', '备注'];
    const rows = filtered.map(o => [o.date, o.time, o.customerName, o.makeupType, o.price, o.deposit, statusLabels[o.status], paymentLabels[o.paymentStatus], o.notes]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `订单导出_${dateFrom || '全部'}_${dateTo || '全部'}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const copyText = () => {
    let text = '🪷 小荷约妆 · 订单导出\n' + '─'.repeat(32) + '\n';
    let totalIncome = 0;
    let groups = {};
    filtered.forEach(o => {
      if (!groups[o.date]) groups[o.date] = [];
      groups[o.date].push(o);
      if (o.status !== 'cancelled' && o.status !== 'rejected') {
        if (o.paymentStatus === 'full') totalIncome += o.price;
        else if (o.paymentStatus === 'deposit') totalIncome += (o.deposit || 0);
        else totalIncome += o.price;
      }
    });
    Object.keys(groups).sort().forEach(date => {
      text += `\n📅 ${date}\n`;
      groups[date].forEach(o => {
        text += `  ${o.time || '--'} · ${o.makeupType} · ${o.customerName} · ¥${o.price} · [${statusLabels[o.status]}]\n`;
      });
    });
    text += `\n${'─'.repeat(32)}\n共 ${filtered.length} 单 · 收入 ¥${totalIncome.toLocaleString()}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-40">
      <h2 className="text-xl font-extrabold text-warm-800 font-heading">导出订单</h2>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-brand-100 p-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-warm-muted block mb-1">开始日期</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <div>
          <label className="text-xs text-warm-muted block mb-1">结束日期</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
        </div>
        <div>
          <label className="text-xs text-warm-muted block mb-1">状态</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
            <option value="all">全部</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); }}
          className="px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-xl">清除</button>
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl border border-brand-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-warm-muted">共 <strong className="text-warm-800">{filtered.length}</strong> 单</span>
          <div className="flex items-center gap-2">
            <button onClick={copyText}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                copied ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}>
              {copied ? <><CheckCircle2 className="w-4 h-4" /> 已复制</> : <><Copy className="w-4 h-4" /> 复制文本</>}
            </button>
            <button onClick={printCards}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-brand-500 text-white rounded-xl hover:bg-brand-600 shadow-sm">
              <Printer className="w-4 h-4" /> 打印卡片
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-violet-500 text-white rounded-xl hover:bg-violet-600 shadow-sm">
              <Download className="w-4 h-4" /> 下载CSV
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center py-12 text-warm-muted text-sm">暂无匹配订单</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-50">
                  <th className="text-left py-2 px-2 text-xs text-warm-muted font-medium">日期</th>
                  <th className="text-left py-2 px-2 text-xs text-warm-muted font-medium">时间</th>
                  <th className="text-left py-2 px-2 text-xs text-warm-muted font-medium">客户</th>
                  <th className="text-left py-2 px-2 text-xs text-warm-muted font-medium">妆造</th>
                  <th className="text-right py-2 px-2 text-xs text-warm-muted font-medium">价格</th>
                  <th className="text-right py-2 px-2 text-xs text-warm-muted font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id} className="border-b border-brand-50/50 hover:bg-brand-50/30">
                    <td className="py-2 px-2 text-warm-800">{o.date}</td>
                    <td className="py-2 px-2 text-warm-muted">{o.time}</td>
                    <td className="py-2 px-2 text-warm-800 font-medium truncate max-w-[120px]">{o.customerName}</td>
                    <td className="py-2 px-2 text-warm-muted">{o.makeupType}</td>
                    <td className="py-2 px-2 text-warm-800 font-semibold text-right">¥{o.price}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`text-sm px-4 py-1.5 rounded-xl font-semibold whitespace-nowrap ${getStatusColor(o.status)}`}>{statusLabels[o.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(s) {
  const m = { pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', completed: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-gray-100 text-gray-500', rejected: 'bg-red-100 text-red-600' };
  return m[s] || '';
}

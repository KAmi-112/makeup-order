import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { beginMfaEnrollment, disableMfa, getMfaState, verifyMfaEnrollment } from '../db.js';

export default function MfaSettings({ onMessage }) {
  const [factors, setFactors] = useState([]);
  const [enrollment, setEnrollment] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setFactors((await getMfaState()).factors || []); } catch { setFactors([]); }
  };
  useEffect(() => { refresh(); }, []);

  const start = async () => {
    setBusy(true);
    try { setEnrollment(await beginMfaEnrollment()); }
    catch (error) { onMessage(error.message || '无法开始双重验证设置', 'error'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) { onMessage('请输入验证器中的 6 位数字', 'error'); return; }
    setBusy(true);
    try {
      await verifyMfaEnrollment(enrollment.id, code);
      setEnrollment(null); setCode(''); await refresh();
      onMessage('双重验证已开启');
    } catch (error) { onMessage(error.message || '验证码不正确', 'error'); }
    finally { setBusy(false); }
  };

  const verified = factors.filter(f => f.status === 'verified');
  return (
    <div className="mt-5 pt-5 border-t border-brand-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold text-warm-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#5b8c69]" />双重验证</h4>
          <p className="text-xs text-warm-800/45 mt-1">登录密码之外，再使用验证器 App 的 6 位动态码保护订单后台。</p>
        </div>
        {verified.length === 0 && !enrollment && <button disabled={busy} onClick={start} className="px-4 py-2 rounded-xl bg-[#edf6ef] text-[#4c7759] text-sm font-semibold disabled:opacity-40">开始设置</button>}
      </div>

      {verified.map(factor => (
        <div key={factor.id} className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
          <span className="text-sm text-emerald-700 inline-flex items-center gap-2"><KeyRound className="w-4 h-4" />已开启：{factor.friendly_name || '验证器'}</span>
          <button onClick={async () => { if (!confirm('确定关闭双重验证？')) return; try { await disableMfa(factor.id); await refresh(); onMessage('双重验证已关闭'); } catch (error) { onMessage(error.message || '关闭失败，请先重新进行双重验证', 'error'); } }} className="text-xs text-red-500 inline-flex items-center gap-1"><ShieldOff className="w-3.5 h-3.5" />关闭</button>
        </div>
      ))}

      {enrollment && (
        <div className="mt-4 rounded-2xl bg-[#fbfcf9] border border-[#dfe9e1] p-4 grid sm:grid-cols-[180px_1fr] gap-5 items-center">
          <img src={enrollment.totp.qr_code} alt="双重验证二维码" className="w-44 h-44 bg-white rounded-xl border p-2" />
          <div>
            <p className="text-sm font-semibold text-warm-800">1. 用验证器 App 扫描二维码</p>
            <p className="text-xs text-warm-800/45 mt-1">可使用 Microsoft Authenticator、Google Authenticator 等。</p>
            <p className="text-sm font-semibold text-warm-800 mt-4">2. 输入显示的 6 位数字</p>
            <div className="flex gap-2 mt-2">
              <input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="w-36 px-3 py-2.5 rounded-xl border border-brand-200 tracking-[.3em] text-center" />
              <button disabled={busy} onClick={verify} className="px-4 py-2.5 rounded-xl bg-[#cf7188] text-white text-sm font-semibold disabled:opacity-40">确认开启</button>
            </div>
            <p className="text-[11px] text-warm-800/35 mt-3 break-all">无法扫码时可手动输入密钥：{enrollment.totp.secret}</p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Lock, Eye, EyeOff, Flower2 } from 'lucide-react';
import { signIn } from '../db.js';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('请输入管理员邮箱和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await signIn(email.trim(), password);
      onLogin(session);
    } catch (err) {
      setError(err?.message === 'Invalid login credentials' ? '邮箱或密码错误' : '登录失败，请稍后重试');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] grid lg:grid-cols-[1.08fr_.92fr] bg-[#f7f6f0]">
      <section className="hidden lg:flex relative overflow-hidden p-16 flex-col justify-between text-white bg-[#193126]">
        <div className="absolute inset-0 opacity-80 bg-[radial-gradient(circle_at_18%_12%,#427657_0,transparent_34%),radial-gradient(circle_at_90%_78%,#874f62_0,transparent_28%)]" />
        <div className="absolute w-[520px] h-[520px] -right-48 -top-48 rounded-full border border-white/10" />
        <div className="absolute w-[360px] h-[360px] -right-28 -top-28 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3 text-sm tracking-[0.22em] uppercase">
          <span className="w-11 h-11 grid place-items-center rounded-2xl bg-[#d9a6ae] text-[#193126] shadow-xl"><Flower2 size={20} /></span>
          Xiaohe Studio
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs text-[#d9a6ae] tracking-[0.28em] mb-6">小荷才露尖尖角</p>
          <h1 className="text-5xl xl:text-6xl leading-[1.14] font-semibold tracking-[-0.035em]">一纸清荷，<br />从容管理每一次美好。</h1>
          <p className="mt-8 text-white/62 leading-8 max-w-lg">档期、客户、订单与营收，归于一处清晰而安静的工作空间。</p>
        </div>
        <p className="relative text-xs text-white/35">小荷·约妆管理系统</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden w-12 h-12 grid place-items-center rounded-2xl bg-[#193126] text-[#e5b9bf] mb-8"><Flower2 size={22} /></div>
          <p className="text-xs font-semibold tracking-[0.22em] text-[#4d7b5c] uppercase">小荷安全管理端</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-[#203027]">欢迎回来</h2>
          <p className="mt-3 text-sm text-[#788078]">使用管理员账号进入今日工作台</p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
            <label className="block">
              <span className="block text-sm font-medium text-[#44383e] mb-2">管理员邮箱</span>
              <input type="email" value={email} autoComplete="username" onChange={e => { setEmail(e.target.value); setError(''); }}
                className="w-full h-12 px-4 rounded-xl border border-[#d8ded8] bg-white focus:outline-none focus:ring-4 focus:ring-[#437f59]/10 focus:border-[#437f59] transition" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-[#44383e] mb-2">密码</span>
              <span className="relative block">
                <input type={show ? 'text' : 'password'} value={password} autoComplete="current-password" onChange={e => { setPassword(e.target.value); setError(''); }}
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-[#d8ded8] bg-white focus:outline-none focus:ring-4 focus:ring-[#437f59]/10 focus:border-[#437f59] transition" />
                <button type="button" aria-label={show ? '隐藏密码' : '显示密码'} onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#8c8086]">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <button disabled={loading} className="w-full h-12 rounded-xl bg-[#2f6846] hover:bg-[#28583c] disabled:opacity-60 text-white font-semibold shadow-[0_12px_32px_rgba(47,104,70,.20)] transition">
              {loading ? '正在安全登录…' : <span className="inline-flex items-center gap-2"><Lock size={16} />进入工作台</span>}
            </button>
          </form>
          <p className="mt-7 text-xs leading-5 text-[#9b9095]">密码由 Supabase Auth 加密验证，不再保存在浏览器中。</p>
        </div>
      </section>
    </main>
  );
}

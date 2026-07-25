import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

const DEFAULT_PASSWORD = '250101';
const AUTH_KEY = 'makeup_admin_auth';
const AUTH_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2小时过期

function getStoredPassword() {
  return localStorage.getItem('makeup_admin_password') || DEFAULT_PASSWORD;
}

export function isAuthenticated() {
  const data = localStorage.getItem(AUTH_KEY);
  if (!data) return false;
  try {
    const { ts } = JSON.parse(data);
    return Date.now() - ts < AUTH_EXPIRY_MS;
  } catch { return false; }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === getStoredPassword()) {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ ts: Date.now() }));
      onLogin();
    } else {
      setError('密码错误');
      setPassword('');
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-rose-200">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-warm-800">西瓜椰 · 订单</h1>
          <p className="text-sm text-warm-800/40 mt-1">管理后台 · 密码登录</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-rose-100 shadow-xl p-6 space-y-4">
          <div>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="输入管理密码"
                autoFocus
                className="w-full px-4 py-3 pr-10 rounded-xl border border-rose-200 text-base focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent transition"
              />
              <button type="button" onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-800/30 hover:text-warm-800/60">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-500 mt-1.5 ml-1">{error}</p>}
          </div>
          <button type="submit"
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold rounded-xl shadow-lg shadow-rose-200 hover:shadow-xl transition-all active:scale-[0.98]">
            登录
          </button>
        </form>

        <p className="text-center text-[11px] text-warm-800/25 mt-4">
          登录有效 2 小时 · 超时需重新输入密码
        </p>
      </div>
    </div>
  );
}

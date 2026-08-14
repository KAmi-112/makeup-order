import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Customers from './pages/Customers.jsx';
import Calendar from './pages/Calendar.jsx';
import Statistics from './pages/Statistics.jsx';
import Settings from './pages/Settings.jsx';
import ExportPage from './pages/Export.jsx';
import TrashPage from './pages/Trash.jsx';
import Conflicts from './pages/Conflicts.jsx';
import ActivityPage from './pages/Activity.jsx';
import PortfolioPage from './pages/Portfolio.jsx';
import ThemeEngine from './ThemeEngine.jsx';
import LoginPage from './pages/LoginPage.jsx';
import WaterRippleBackdrop from './components/WaterRippleBackdrop.jsx';
import { getAuthSession, getMfaState, onAuthStateChange, signOut, verifyMfaCode } from './db.js';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays,
  BarChart3, SettingsIcon, Flower2, Download, ArchiveRestore, AlertTriangle, History, ShieldCheck, Images
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/orders', icon: ClipboardList, label: '订单' },
  { to: '/conflicts', icon: AlertTriangle, label: '冲突中心', mobileHidden: true },
  { to: '/trash', icon: ArchiveRestore, label: '回收站', desktopOnly: true },
  { to: '/customers', icon: Users, label: '客户' },
  { to: '/portfolio', icon: Images, label: '作品集' },
  { to: '/calendar', icon: CalendarDays, label: '日历' },
  { to: '/statistics', icon: BarChart3, label: '统计', mobileHidden: true },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
  { to: '/activity', icon: History, label: '操作记录', mobileHidden: true },
  { to: '/export', icon: Download, label: '导出', mobileHidden: true },
];

/* ======== Desktop Sidebar ======== */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[248px] bg-[#fcfdf9] text-[#355844] shrink-0 border-r border-[#e8eee8] relative overflow-hidden">
      <img src={`${import.meta.env.BASE_URL}lotus-watercolor.webp`} alt="" className="absolute inset-x-0 bottom-0 w-full h-52 object-cover object-left-bottom opacity-[.16] pointer-events-none mix-blend-multiply" />
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-[#f9dbe2]/45" />
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full border border-[#e9b8c4]/40" />
      <div className="px-6 py-7 border-b border-[#e3eee5] relative">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#efadbb] to-[#d97991] text-white shadow-[0_12px_28px_rgba(220,127,149,.24)]">
            <Flower2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#315440] tracking-[.08em]">小荷</h1>
            <p className="text-[9px] text-[#6f967b] tracking-[.24em] uppercase">Xiaohe Studio</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[#edf5ef] text-[#3f7652] shadow-[inset_3px_0_0_#dc7f95]'
                  : 'text-[#738579] hover:bg-[#f3f7f3] hover:text-[#4d7259]'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-5 border-t border-[#e3eee5] text-[11px] text-[#75917d] flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#77b189] shadow-[0_0_10px_#a9d6b4]" />
        安全云端同步
      </div>
    </aside>
  );
}

/* ======== Mobile Bottom Tab Bar ======== */
function MobileBottomBar() {
  return (
    <nav className="lg:hidden bg-white/95 backdrop-blur-md border-t border-brand-100 shrink-0 safe-bottom"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.filter(item => !item.desktopOnly && !item.mobileHidden).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-xl transition-all duration-200 active:scale-90 ${
                isActive ? '' : 'text-warm-800/40'
              }`
            }
            style={({ isActive }) => isActive ? { color: 'var(--tp)' } : {}}
          >
            <item.icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/* ======== Cloud Status ======== */
function CloudStatus() {
  const { state, syncStatus } = useStore();
  if (state.loading) {
    return <span className="text-[11px] text-warm-800/30 animate-pulse">正在读取云端订单…</span>;
  }
  if (syncStatus?.state === 'error') {
    return (
      <button type="button" onClick={() => window.location.reload()} className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
        云端读取失败，点此重试
      </button>
    );
  }
  return (
    <span className={`text-[11px] flex items-center gap-1.5 ${state.cloudReady ? 'text-emerald-500' : 'text-amber-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${state.cloudReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {state.cloudReady ? '☁️ 云端同步' : '💻 本地模式'}
    </span>
  );
}

/* ======== Layout ======== */
function Layout({ children, onLogout }) {
  const { state } = useStore();
  const location = useLocation();
  const [qIdx, setQIdx] = useState(0);
  const topQuotes = state.topQuotes?.length ? state.topQuotes : ['小荷才露尖尖角，今日也要从容发光'];
  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % topQuotes.length), 5000);
    return () => clearInterval(t);
  }, [topQuotes.length]);
  useEffect(() => { if (qIdx >= topQuotes.length) setQIdx(0); }, [qIdx, topQuotes.length]);

  return (
    <div className="app-shell flex h-[100dvh] overflow-hidden">
      <DesktopSidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — hidden on mobile (bottom bar instead) */}
        <header className="hidden lg:flex h-[68px] border-b border-black/5 bg-white/75 backdrop-blur-xl items-center justify-between px-7 shrink-0">
          <span className="text-sm font-medium text-[#5f5359] transition-opacity duration-300">{topQuotes[qIdx]}</span>
          <CloudStatus />
          {onLogout && <button onClick={onLogout} className="text-[11px] text-warm-800/45 hover:text-red-500 ml-3 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">安全退出</button>}
        </header>

        {/* Mobile header */}
        <header className="lg:hidden h-12 bg-white/80 backdrop-blur border-b border-brand-100 flex items-center px-4 shrink-0 safe-top"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--tp-gradient)' }}>
              <Flower2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-warm-800 tracking-wider">小荷·工作台</span>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="workspace-content flex-1 overflow-y-auto p-3 md:p-7 xl:p-9 animate-fade-in"
          key={location.pathname}>
          {children}
        </div>

        <MobileBottomBar />
      </div>
    </div>
  );
}

/* ======== App ======== */
function MfaChallenge({ onSuccess, onCancel }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError('请输入验证器中的 6 位数字'); return; }
    setLoading(true); setError('');
    try { await verifyMfaCode(code); onSuccess(); }
    catch { setError('验证码不正确或已过期，请重新输入'); setCode(''); }
    finally { setLoading(false); }
  };
  return <div className="min-h-[100dvh] grid place-items-center p-5 bg-gradient-to-br from-[#f0f8f2] via-[#fffdfa] to-[#fbe9ed]">
    <form onSubmit={submit} className="relative bg-white rounded-3xl border border-brand-100 shadow-xl w-full max-w-sm p-7 text-center">
      <span className="w-14 h-14 mx-auto rounded-2xl bg-[#edf6ef] text-[#568166] grid place-items-center"><ShieldCheck className="w-7 h-7" /></span>
      <h2 className="text-2xl font-semibold font-heading text-warm-800 mt-4">双重验证</h2>
      <p className="text-sm text-warm-800/45 mt-2">请输入验证器 App 中显示的 6 位动态码</p>
      <input autoFocus inputMode="numeric" maxLength={6} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }} className="w-full mt-6 px-4 py-3 rounded-xl border border-brand-200 text-center text-xl tracking-[.45em] focus:outline-none focus:ring-2 focus:ring-brand-300" />
      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      <button disabled={loading} className="w-full mt-4 py-3 rounded-xl bg-[#cf7188] text-white font-semibold disabled:opacity-40">{loading ? '正在验证…' : '验证并进入'}</button>
      <button type="button" onClick={onCancel} className="mt-3 text-xs text-warm-800/40 hover:text-red-500">退出登录</button>
    </form>
  </div>;
}

function PublicApp() {
  const [session, setSession] = useState(undefined);
  const [mfaRequired, setMfaRequired] = useState(false);

  const inspectSession = async value => {
    if (!value) { setSession(null); setMfaRequired(false); return; }
    try {
      const assurance = await getMfaState();
      const hasVerifiedFactor = assurance.factors?.some(factor => factor.status === 'verified');
      setMfaRequired(Boolean(hasVerifiedFactor && assurance.currentLevel !== 'aal2'));
    } catch {
      // 管理端安全检查失败时不能绕过双重验证。
      setMfaRequired(true);
    }
    setSession(value);
  };

  useEffect(() => {
    let active = true;
    getAuthSession().then(value => { if (active) inspectSession(value); }).catch(() => { if (active) setSession(null); });
    const subscription = onAuthStateChange(value => { if (active) inspectSession(value); });
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  if (session === undefined) {
    return <div className="min-h-[100dvh] grid place-items-center bg-gradient-to-br from-[#f1f9f2] via-[#fffdf9] to-[#fbe8ed] text-sm text-[#728678]">正在建立安全连接…</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage onLogin={inspectSession} />} />
      </Routes>
    );
  }

  if (mfaRequired) return <MfaChallenge onSuccess={async () => inspectSession(await getAuthSession())} onCancel={async () => { await signOut(); setSession(null); }} />;

  return (
    <StoreProvider>
      <ThemeEngine />
      <Layout onLogout={async () => { await signOut(); setSession(null); }}>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/conflicts" element={<Conflicts />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/settings" element={<Settings />} /> 
        <Route path="/export" element={<ExportPage />} />
        <Route path="*" element={<Dashboard />} />
        </Routes>
      </Layout>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <WaterRippleBackdrop />
      <PublicApp />
    </BrowserRouter>
  );
}

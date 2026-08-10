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
import ThemeEngine from './ThemeEngine.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { getAuthSession, onAuthStateChange, signOut } from './db.js';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays,
  BarChart3, SettingsIcon, Flower2, Download, ArchiveRestore
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/orders', icon: ClipboardList, label: '订单' },
  { to: '/trash', icon: ArchiveRestore, label: '回收站', desktopOnly: true },
  { to: '/customers', icon: Users, label: '客户' },
  { to: '/calendar', icon: CalendarDays, label: '日历' },
  { to: '/statistics', icon: BarChart3, label: '统计' },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
  { to: '/export', icon: Download, label: '导出' },
];

/* ======== Desktop Sidebar ======== */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-gradient-to-b from-[#f4fbf5] via-[#fffafb] to-[#fffdf9] text-[#355844] shrink-0 border-r border-[#e7eee8] relative overflow-hidden shadow-[10px_0_35px_rgba(86,128,99,.05)]">
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
                  ? 'bg-[#f9e4e9] text-[#a64e66] shadow-[inset_0_0_0_1px_rgba(222,127,150,.12),0_8px_22px_rgba(222,127,150,.10)]'
                  : 'text-[#66806e] hover:bg-[#edf6ef] hover:text-[#3d6d4d]'
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
        {navItems.filter(item => !item.desktopOnly).map(item => (
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
  const { state } = useStore();
  if (state.loading) {
    return <span className="text-[11px] text-warm-800/30 animate-pulse">⏳ 加载中...</span>;
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
function PublicApp() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    let active = true;
    getAuthSession().then(value => { if (active) setSession(value); }).catch(() => { if (active) setSession(null); });
    const subscription = onAuthStateChange(value => setSession(value));
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
        <Route path="*" element={<LoginPage onLogin={setSession} />} />
      </Routes>
    );
  }

  return (
    <StoreProvider>
      <ThemeEngine />
      <Layout onLogout={async () => { await signOut(); setSession(null); }}>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/trash" element={<TrashPage />} />
        <Route path="/customers" element={<Customers />} />
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
    <BrowserRouter>
      <PublicApp />
    </BrowserRouter>
  );
}

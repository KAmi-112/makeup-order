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
import ThemeEngine from './ThemeEngine.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { getAuthSession, onAuthStateChange, signOut } from './db.js';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays,
  BarChart3, SettingsIcon, Flower2, Download
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/orders', icon: ClipboardList, label: '订单' },
  { to: '/customers', icon: Users, label: '客户' },
  { to: '/calendar', icon: CalendarDays, label: '日历' },
  { to: '/statistics', icon: BarChart3, label: '统计' },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
  { to: '/export', icon: Download, label: '导出' },
];

/* ======== Desktop Sidebar ======== */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-[#193126] text-white shrink-0 border-r border-white/5 relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full border border-white/5" />
      <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full border border-white/5" />
      <div className="px-6 py-7 border-b border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#d9a6ae] text-[#193126] shadow-[0_12px_32px_rgba(0,0,0,.2)]">
            <Flower2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-[.08em]">小荷</h1>
            <p className="text-[9px] text-white/40 tracking-[.24em] uppercase">Xiaohe Studio</p>
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
                  ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.05)]'
                  : 'text-white/55 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-6 py-5 border-t border-white/8 text-[11px] text-white/40 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" />
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
        {navItems.map(item => (
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

const topQuotes = [
  '小荷才露尖尖角，今日也要从容发光',
  '清晰的档期，让每一次创作都有余裕',
  '专注手上的妆面，其余交给小荷',
  '好的服务，从认真对待每一次预约开始',
]

/* ======== Layout ======== */
function Layout({ children, onLogout }) {
  const location = useLocation();
  const [qIdx, setQIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % topQuotes.length), 5000);
    return () => clearInterval(t);
  }, []);

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
    return <div className="min-h-[100dvh] grid place-items-center bg-[#f8f5f2] text-sm text-[#796c73]">正在建立安全连接…</div>;
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

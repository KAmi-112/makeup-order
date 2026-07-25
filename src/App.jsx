import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './store.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Orders from './pages/Orders.jsx';
import Customers from './pages/Customers.jsx';
import Calendar from './pages/Calendar.jsx';
import Statistics from './pages/Statistics.jsx';
import Settings from './pages/Settings.jsx';
import Menu from './pages/Menu.jsx';
import ThemeEngine from './ThemeEngine.jsx';
import LoginPage, { isAuthenticated, logout } from './pages/LoginPage.jsx';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays,
  BarChart3, SettingsIcon, Sparkles, ShoppingCart
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘', end: true },
  { to: '/orders', icon: ClipboardList, label: '订单' },
  { to: '/customers', icon: Users, label: '客户' },
  { to: '/calendar', icon: CalendarDays, label: '日历' },
  { to: '/statistics', icon: BarChart3, label: '统计' },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
  { to: '/menu', icon: ShoppingCart, label: '客妹下单' },
];

/* ======== Desktop Sidebar ======== */
function DesktopSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white border-r shrink-0"
      style={{ borderColor: 'var(--tp-border)' }}>
      <div className="px-5 py-5 border-b border-rose-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--tp-gradient)' }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-warm-800 tracking-tight">西瓜椰·订单</h1>
            <p className="text-[11px] text-rose-400">化妆师工作台</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'shadow-sm'
                  : 'text-warm-800/70 hover:bg-warm-100 hover:text-warm-800'
              }`
            }
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--tp-light)', color: 'var(--tp)' } : {}}
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-rose-100 text-[11px] text-warm-800/40">
        西瓜椰订单 v1.0 · 数据存于本地
      </div>
    </aside>
  );
}

/* ======== Mobile Bottom Tab Bar ======== */
function MobileBottomBar() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-rose-100 safe-bottom"
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
  '💄 闺蜜，我想你了 (◕‿◕✿)',
  '🔥 闺蜜要加油哦！٩(ˊᗜˋ*)و',
  '💰 闺蜜今天又赚米了 ✧٩(ˊωˋ*)و✧',
  '☕ 闺蜜辛苦了 (´•̥ ̯ •̥`)♡',
];

/* ======== Layout ======== */
function Layout({ children }) {
  const location = useLocation();
  const [qIdx, setQIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQIdx(i => (i + 1) % topQuotes.length), 5000);
    return () => clearInterval(t);
  }, []);

  // 自动检测登录过期
  useEffect(() => {
    const check = setInterval(() => {
      if (!isAuthenticated()) { logout(); }
    }, 30000);
    return () => clearInterval(check);
  }, []);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-cream">
      <DesktopSidebar />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar — hidden on mobile (bottom bar instead) */}
        <header className="hidden lg:flex h-14 border-b border-rose-100 bg-white/80 backdrop-blur items-center justify-between px-4 shrink-0">
          <span className="text-sm font-medium text-warm-800/60 transition-opacity duration-300">{topQuotes[qIdx]}</span>
          <CloudStatus />
          <button onClick={logout} className="text-[11px] text-warm-800/30 hover:text-red-400 ml-3 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">退出</button>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden h-12 bg-white/80 backdrop-blur border-b border-rose-100 flex items-center px-4 shrink-0 safe-top"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--tp-gradient)' }}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-warm-800">西瓜椰·订单</span>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-16 lg:pb-0 p-3 md:p-6 animate-fade-in"
          key={location.pathname}>
          {children}
        </div>
      </div>

      <MobileBottomBar />
    </div>
  );
}

/* ======== App ======== */
function PublicApp() {
  const [authed, setAuthed] = useState(isAuthenticated());

  if (!authed) {
    return (
      <Routes>
        <Route path="/menu" element={<Menu />} />
        <Route path="*" element={<LoginPage onLogin={() => setAuthed(true)} />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168') || window.location.hostname.startsWith('127.');

  return (
    <StoreProvider>
      <BrowserRouter>
        <ThemeEngine />
        {isLocal ? (
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/menu" element={<Menu />} />
            </Routes>
          </Layout>
        ) : (
          <PublicApp />
        )}
      </BrowserRouter>
    </StoreProvider>
  );
}

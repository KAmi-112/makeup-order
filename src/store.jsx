import { createContext, useContext, useReducer, useEffect, useState, useRef } from 'react';
import * as db from './db.js';

const StoreContext = createContext(null);

// ---- 默认价格表 ----
const defaultMakeupTypes = [
  { id: '1', name: '日常妆 / lo妆', defaultPrice: 38, defaultDuration: 1.5 },
  { id: '2', name: 'COS展妆', defaultPrice: 42, defaultDuration: 1.5 },
  { id: '3', name: 'COS正片妆', defaultPrice: 48, defaultDuration: 2 },
  { id: '4', name: 'COS华改妆', defaultPrice: 58, defaultDuration: 2 },
];

// ---- 默认额外服务 ----
const defaultExtraServices = [
  { id: 'e1', name: '胶带绷脸', price: 3 },
  { id: 'e2', name: '身体素颜霜（自己涂）', price: 3 },
  { id: 'e3', name: '鼻贴（基础贴法）', price: 3 },
  { id: 'e4', name: '加宽超大发网', price: 5 },
  { id: 'e5', name: '全新粉扑（用完包装好带走）', price: 3 },
];

const defaultTopQuotes = [
  '小荷才露尖尖角，今日也要从容发光',
  '清晰的档期，让每一次创作都有余裕',
  '专注手上的妆面，其余交给小荷',
  '好的服务，从认真对待每一次预约开始',
];

const defaultBookingRules = {
  blockedDates: [],
  workingHours: { start: '07:00', end: '18:00' },
  availableHours: { start: '05:00', end: '23:00' },
  bufferMinutes: 30,
};

const defaultMiniappConfig = {
  brandName: '西瓜椰约妆',
  depositAmount: 18,
  location: '地铁5号线凌大塘站D口附近',
  artistWechat: '',
  workHoursNote: '非工作时间加位需钞能力',
  warningText: '请认真阅读约妆须知并自觉遵守，不要把家长或异性亲友带来后再询问。',
  maxDaysAhead: 365,
};

const defaultReminderTemplates = [
  { id: 'confirm', name: '预约确认', content: '你好呀，已为你确认 {date} {time} 的 {makeupType}，地点：{location}。请提前安排好出行时间。' },
  { id: 'before', name: '出发提醒', content: '温馨提醒：明天 {time} 是你的 {makeupType} 预约，请带好需要搭配的服装、假发或饰品。' },
  { id: 'balance', name: '尾款提醒', content: '本次妆造总价 ¥{price}，已付定金 ¥{deposit}，待付尾款 ¥{balance}，感谢理解。' },
];

function getInitialState() {
  return {
    orders: [],
    trashedOrders: [],
    makeupTypes: defaultMakeupTypes,
    extraServices: defaultExtraServices,
    notice: '',
    theme: 'lotus',
    menuPass: '小荷',
    /* 动态价格规则 */
      priceRules: {
        evening_surcharge: { enabled: true, startTime: '18:00', endTime: '23:00', amount: 10 },
        special_dates: { enabled: true, dates: [], names: {} },
      },
    /* 滚动公告 */
    announcements: [],
    topQuotes: defaultTopQuotes,
    bookingRules: defaultBookingRules,
    miniappConfig: defaultMiniappConfig,
    reminderTemplates: defaultReminderTemplates,
    loading: true,
    cloudReady: db.cloudReady,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_DATA':
      return {
        ...state,
        orders: action.payload.orders,
        trashedOrders: action.payload.trashedOrders || [],
        makeupTypes: action.payload.makeupTypes.length > 0 ? action.payload.makeupTypes : state.makeupTypes,
        extraServices: action.payload.extraServices.length > 0 ? action.payload.extraServices : state.extraServices,
        notice: action.payload.notice || state.notice,
        theme: action.payload.theme || state.theme,
        menuPass: action.payload.menuPass || '小荷',
        priceRules: action.payload.priceRules || state.priceRules,
        announcements: action.payload.announcements || state.announcements,
        topQuotes: action.payload.topQuotes?.length ? action.payload.topQuotes : state.topQuotes,
        bookingRules: action.payload.bookingRules || state.bookingRules,
        miniappConfig: action.payload.miniappConfig || state.miniappConfig,
        reminderTemplates: action.payload.reminderTemplates?.length ? action.payload.reminderTemplates : state.reminderTemplates,
        loading: false,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'ADD_ORDER':
      return { ...state, orders: [...state.orders, action.payload] };
    case 'UPDATE_ORDER':
      return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_ORDER': {
      const order = state.orders.find(o => o.id === action.payload);
      return { ...state, orders: state.orders.filter(o => o.id !== action.payload), trashedOrders: order ? [{ ...order, deletedAt: new Date().toISOString() }, ...state.trashedOrders] : state.trashedOrders };
    }
    case 'RESTORE_ORDER': {
      const order = state.trashedOrders.find(o => o.id === action.payload);
      return { ...state, trashedOrders: state.trashedOrders.filter(o => o.id !== action.payload), orders: order ? [{ ...order, deletedAt: null }, ...state.orders] : state.orders };
    }
    case 'PERMANENT_DELETE_ORDER':
      return { ...state, trashedOrders: state.trashedOrders.filter(o => o.id !== action.payload) };

    case 'ADD_MAKEUP_TYPE':
      return { ...state, makeupTypes: [...state.makeupTypes, action.payload] };
    case 'UPDATE_MAKEUP_TYPE':
      return { ...state, makeupTypes: state.makeupTypes.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_MAKEUP_TYPE':
      return { ...state, makeupTypes: state.makeupTypes.filter(t => t.id !== action.payload) };

    case 'ADD_EXTRA_SERVICE':
      return { ...state, extraServices: [...state.extraServices, action.payload] };
    case 'UPDATE_EXTRA_SERVICE':
      return { ...state, extraServices: state.extraServices.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'DELETE_EXTRA_SERVICE':
      return { ...state, extraServices: state.extraServices.filter(s => s.id !== action.payload) };

    case 'UPDATE_NOTICE':
      return { ...state, notice: action.payload };
    case 'UPDATE_PRICE_RULES':
      return { ...state, priceRules: action.payload };
    case 'UPDATE_ANNOUNCEMENTS':
      return { ...state, announcements: action.payload };
    case 'UPDATE_TOP_QUOTES':
      return { ...state, topQuotes: action.payload };
    case 'UPDATE_BOOKING_RULES':
      return { ...state, bookingRules: action.payload };
    case 'UPDATE_MINIAPP_CONFIG':
      return { ...state, miniappConfig: action.payload };
    case 'UPDATE_REMINDER_TEMPLATES':
      return { ...state, reminderTemplates: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };

    case 'IMPORT_DATA':
      return {
        ...state,
        orders: action.payload.orders ?? state.orders,
        makeupTypes: action.payload.makeupTypes ?? state.makeupTypes,
        extraServices: action.payload.extraServices ?? state.extraServices,
        notice: action.payload.notice ?? state.notice,
        theme: action.payload.theme ?? state.theme,
        menuPass: action.payload.menuPass ?? state.menuPass,
      };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, getInitialState);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', at: null, error: '' });
  const stateRef = useRef(state);
  stateRef.current = state;

  // 初始化加载
  useEffect(() => {
    async function load() {
      try {
        const orders = await db.fetchOrders();
        const trashedOrders = await db.fetchTrashedOrders();
        const settings = await db.fetchSettings();
        dispatch({
          type: 'LOAD_DATA',
          payload: { orders, trashedOrders, ...settings },
        });
      } catch (e) {
        console.error('Failed to load data:', e);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    load();
  }, []);

  // 实时订阅已关闭（避免页面自动刷新，需要时手动F5）
  // useEffect(() => { ... });

  // 包装 dispatch：副作用操作（写数据库）
  const dispatchWithCloud = async (action) => {
    // 先同步计算下一状态，避免 React 尚未完成渲染时把旧设置写回云端。
    const nextState = reducer(stateRef.current, action);
    stateRef.current = nextState;
    dispatch(action);

    // 异步写云端（不阻塞 UI）
    try {
      switch (action.type) {
        case 'ADD_ORDER':
          await db.addOrder(action.payload);
          break;
        case 'UPDATE_ORDER':
          await db.updateOrder(action.payload);
          break;
        case 'DELETE_ORDER':
          await db.deleteOrder(action.payload);
          break;
        case 'RESTORE_ORDER':
          await db.restoreOrder(action.payload);
          break;
        case 'PERMANENT_DELETE_ORDER':
          await db.permanentlyDeleteOrder(action.payload);
          break;
        case 'ADD_MAKEUP_TYPE':
        case 'UPDATE_MAKEUP_TYPE':
        case 'DELETE_MAKEUP_TYPE':
        case 'ADD_EXTRA_SERVICE':
        case 'UPDATE_EXTRA_SERVICE':
        case 'DELETE_EXTRA_SERVICE':
        case 'UPDATE_NOTICE':
        case 'UPDATE_PRICE_RULES':
        case 'UPDATE_ANNOUNCEMENTS':
        case 'UPDATE_TOP_QUOTES':
        case 'UPDATE_BOOKING_RULES':
        case 'UPDATE_MINIAPP_CONFIG':
        case 'UPDATE_REMINDER_TEMPLATES':
        case 'SET_THEME':
        case 'IMPORT_DATA': {
          setSyncStatus({ state: 'saving', at: null, error: '' });
          await saveSettingsToCloud(nextState);
          setSyncStatus({ state: 'saved', at: new Date(), error: '' });
          break;
        }
      }
    } catch (e) {
      console.error('Cloud sync error:', e);
      setSyncStatus({ state: 'error', at: null, error: e.message || '同步失败' });
    }
  };

  // 保存设置到云端（本地模式则存 localStorage）
  const saveSettingsToCloud = async (snapshot = stateRef.current) => {
    const s = snapshot;
    try {
      await db.saveSettings({
        makeupTypes: s.makeupTypes,
        extraServices: s.extraServices,
        notice: s.notice,
        theme: s.theme,
        priceRules: s.priceRules,
        announcements: s.announcements,
        topQuotes: s.topQuotes,
        bookingRules: s.bookingRules,
        miniappConfig: s.miniappConfig,
        reminderTemplates: s.reminderTemplates,
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  // 自动同步已关闭（手动保存即可）


  return (
    <StoreContext.Provider value={{
      state,
        dispatch: dispatchWithCloud,
        saveSettings: saveSettingsToCloud,
        syncStatus,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be inside StoreProvider');
  return ctx;
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const sources = ['闲鱼', '微信', '小红书', '转介绍', '抖音', '其他'];
export const statuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
export const statusLabels = { pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消', rejected: '已拒绝' };
export const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-600',
};
export const paymentStatuses = ['unpaid', 'deposit', 'full', 'refunded'];
export const paymentLabels = { unpaid: '未付款', deposit: '已付定金', full: '已付全款', refunded: '已退款' };
export const paymentColors = {
  unpaid: 'bg-red-100 text-red-700',
  deposit: 'bg-amber-100 text-amber-700',
  full: 'bg-emerald-100 text-emerald-700',
  refunded: 'bg-gray-100 text-gray-500',
};

// 主题预设（保持不变）
export const themePresets = [
  { id: 'lotus', name: '小荷清莲', icon: '🪷', primary: '#dc7f95', primaryLight: '#fff4f7', primaryDark: '#4f8b65', bg: '#fffdf9', cardBg: '#ffffff', border: '#f1dfe4', text: '#34483b', textMuted: '#7d8d82', radius: '20px' },
  { id: 'rose', name: '樱花粉', icon: '🌸', primary: '#f43f5e', primaryLight: '#fff1f2', primaryDark: '#e11d48', bg: '#fef9f0', cardBg: '#ffffff', border: '#ffe4e6', text: '#5c4b3a', textMuted: '#9a8a7a', radius: '16px' },
  { id: 'mauve', name: '莫兰迪紫', icon: '🪻', primary: '#8b5cf6', primaryLight: '#f5f3ff', primaryDark: '#7c3aed', bg: '#faf8f7', cardBg: '#ffffff', border: '#ede9fe', text: '#4a3f52', textMuted: '#8a7f92', radius: '14px' },
  { id: 'matcha', name: '抹茶绿', icon: '🍵', primary: '#059669', primaryLight: '#ecfdf5', primaryDark: '#047857', bg: '#f9faf7', cardBg: '#ffffff', border: '#d1fae5', text: '#3d4a3f', textMuted: '#7a8a7d', radius: '12px' },
  { id: 'caramel', name: '焦糖棕', icon: '🍂', primary: '#d97706', primaryLight: '#fffbeb', primaryDark: '#b45309', bg: '#fefcf7', cardBg: '#ffffff', border: '#fef3c7', text: '#5c4033', textMuted: '#8b7355', radius: '16px' },
  { id: 'ocean', name: '深海蓝', icon: '🌊', primary: '#0ea5e9', primaryLight: '#f0f9ff', primaryDark: '#0284c7', bg: '#f8fafc', cardBg: '#ffffff', border: '#e0f2fe', text: '#334155', textMuted: '#64748b', radius: '18px' },
  { id: 'lavender', name: '薰衣草', icon: '💜', primary: '#a855f7', primaryLight: '#faf5ff', primaryDark: '#9333ea', bg: '#faf8fc', cardBg: '#ffffff', border: '#f3e8ff', text: '#4a3f55', textMuted: '#8a7f95', radius: '20px' },
];

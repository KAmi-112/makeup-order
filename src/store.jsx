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

function getInitialState() {
  return {
    orders: [],
    makeupTypes: defaultMakeupTypes,
    extraServices: defaultExtraServices,
    notice: '',
    theme: 'rose',
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
        makeupTypes: action.payload.makeupTypes.length > 0 ? action.payload.makeupTypes : state.makeupTypes,
        extraServices: action.payload.extraServices.length > 0 ? action.payload.extraServices : state.extraServices,
        notice: action.payload.notice || state.notice,
        theme: action.payload.theme || state.theme,
        loading: false,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'ADD_ORDER':
      return { ...state, orders: [...state.orders, action.payload] };
    case 'UPDATE_ORDER':
      return { ...state, orders: state.orders.map(o => o.id === action.payload.id ? action.payload : o) };
    case 'DELETE_ORDER':
      return { ...state, orders: state.orders.filter(o => o.id !== action.payload) };

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
      };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, getInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 初始化加载
  useEffect(() => {
    async function load() {
      try {
        const orders = await db.fetchOrders();
        const settings = await db.fetchSettings();
        dispatch({
          type: 'LOAD_DATA',
          payload: { orders, ...settings },
        });
      } catch (e) {
        console.error('Failed to load data:', e);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    load();
  }, []);

  // 实时订阅（云端模式）
  useEffect(() => {
    if (!db.cloudReady) return;
    const sub = db.subscribeToOrders((change) => {
      if (change.type === 'ADD') dispatch({ type: 'ADD_ORDER', payload: change.order });
      else if (change.type === 'UPDATE') dispatch({ type: 'UPDATE_ORDER', payload: change.order });
      else if (change.type === 'DELETE') dispatch({ type: 'DELETE_ORDER', payload: change.id });
    });
    return () => sub.unsubscribe();
  }, []);

  // 包装 dispatch：副作用操作（写数据库）
  const dispatchWithCloud = async (action) => {
    // 先更新本地 state
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
        case 'ADD_MAKEUP_TYPE':
        case 'UPDATE_MAKEUP_TYPE':
        case 'DELETE_MAKEUP_TYPE':
        case 'ADD_EXTRA_SERVICE':
        case 'UPDATE_EXTRA_SERVICE':
        case 'DELETE_EXTRA_SERVICE':
        case 'UPDATE_NOTICE':
        case 'SET_THEME':
        case 'IMPORT_DATA': {
          setTimeout(() => saveSettingsToCloud(), 10);
          break;
        }
      }
    } catch (e) {
      console.error('Cloud sync error:', e);
    }
  };

  // 保存设置到云端（本地模式则存 localStorage）
  const saveSettingsToCloud = async () => {
    const s = stateRef.current;
    try {
      await db.saveSettings({
        makeupTypes: s.makeupTypes,
        extraServices: s.extraServices,
        notice: s.notice,
        theme: s.theme,
      });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  // 当设置变化时自动同步
  useEffect(() => {
    if (state.loading) return;
    saveSettingsToCloud();
  }, [state.makeupTypes, state.extraServices, state.notice, state.theme]);

  return (
    <StoreContext.Provider value={{
      state,
      dispatch: dispatchWithCloud,
      saveSettings: saveSettingsToCloud,
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
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-700',
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
  { id: 'rose', name: '樱花粉', icon: '🌸', primary: '#f43f5e', primaryLight: '#fff1f2', primaryDark: '#e11d48', bg: '#fef9f0', cardBg: '#ffffff', border: '#ffe4e6', text: '#5c4b3a', textMuted: '#9a8a7a', radius: '16px' },
  { id: 'mauve', name: '莫兰迪紫', icon: '🪻', primary: '#8b5cf6', primaryLight: '#f5f3ff', primaryDark: '#7c3aed', bg: '#faf8f7', cardBg: '#ffffff', border: '#ede9fe', text: '#4a3f52', textMuted: '#8a7f92', radius: '14px' },
  { id: 'matcha', name: '抹茶绿', icon: '🍵', primary: '#059669', primaryLight: '#ecfdf5', primaryDark: '#047857', bg: '#f9faf7', cardBg: '#ffffff', border: '#d1fae5', text: '#3d4a3f', textMuted: '#7a8a7d', radius: '12px' },
  { id: 'caramel', name: '焦糖棕', icon: '🍂', primary: '#d97706', primaryLight: '#fffbeb', primaryDark: '#b45309', bg: '#fefcf7', cardBg: '#ffffff', border: '#fef3c7', text: '#5c4033', textMuted: '#8b7355', radius: '16px' },
  { id: 'ocean', name: '深海蓝', icon: '🌊', primary: '#0ea5e9', primaryLight: '#f0f9ff', primaryDark: '#0284c7', bg: '#f8fafc', cardBg: '#ffffff', border: '#e0f2fe', text: '#334155', textMuted: '#64748b', radius: '18px' },
  { id: 'lavender', name: '薰衣草', icon: '💜', primary: '#a855f7', primaryLight: '#faf5ff', primaryDark: '#9333ea', bg: '#faf8fc', cardBg: '#ffffff', border: '#f3e8ff', text: '#4a3f55', textMuted: '#8a7f95', radius: '20px' },
];

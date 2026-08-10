import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const LOCAL_KEY = 'makeup_store';

let supabase = null;
let cloudReady = false;

if (supabaseUrl && supabaseKey && supabaseUrl !== 'https://your-project.supabase.co') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    cloudReady = true;
  } catch (e) { console.warn('Supabase init failed:', e.message); }
}

function localGet() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch { return null; } }
function localSet(data) { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }

export async function getAuthSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('云端服务未配置');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

export async function fetchOrders() {
  if (!cloudReady) return localGet()?.orders ?? [];
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) return [];
  const local = localGet() || {}; local.orders = data.map(mapOrderFromDB); localSet(local);
  return data.map(mapOrderFromDB);
}

export async function addOrder(order) {
  if (!cloudReady) { const l=localGet()||{orders:[]}; l.orders.push(order); localSet(l); return order; }
  const { data, error } = await supabase.from('orders').insert(mapOrderToDB(order)).select().single();
  if (error) throw error; return mapOrderFromDB(data);
}

export async function updateOrder(order) {
  if (!cloudReady) { const l=localGet()||{orders:[]}; const i=l.orders.findIndex(o=>o.id===order.id); if(i!==-1)l.orders[i]=order; localSet(l); return order; }
  const { error } = await supabase.from('orders').update(mapOrderToDB(order)).eq('id', order.id);
  if (error) throw error; return order;
}

export async function deleteOrder(id) {
  if (!cloudReady) { const l=localGet()||{orders:[]}; l.orders=l.orders.filter(o=>o.id!==id); localSet(l); return; }
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchSettings() {
  if (!cloudReady) { const l=localGet()||{}; return {makeupTypes:l.makeupTypes??[],extraServices:l.extraServices??[],notice:l.notice??'',theme:l.theme??'lotus'}; }
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[]};
  if(!data) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[]};
  const types = (data.makeup_types||[]).map(t => ({...t, defaultPrice: t.price ?? t.defaultPrice ?? 0, defaultDuration: t.duration ?? t.defaultDuration ?? 1}));
  return {makeupTypes:types,extraServices:data.extra_services??[],notice:data.notice??'',theme:data.theme??'lotus',priceRules:data.price_rules??null,announcements:data.announcements??[]};
}

export async function saveSettings(s) {
  if (!cloudReady) { const l=localGet()||{}; Object.assign(l,s); localSet(l); return; }
  // 标准化字段：确保 price/duration 同步到 Supabase
  const types = (s.makeupTypes || []).map(t => ({...t, price: t.defaultPrice ?? t.price ?? 0, duration: t.defaultDuration ?? t.duration ?? 1}));
  const { error } = await supabase.from('settings').upsert({id:1,makeup_types:types,extra_services:s.extraServices,notice:s.notice,theme:s.theme,price_rules:s.priceRules,announcements:s.announcements,updated_at:new Date().toISOString()});
  if (error) throw error;
}

export function subscribeToOrders(cb) {
  if (!cloudReady) return {unsubscribe:()=>{}};
  try{return supabase.channel('o').on('postgres_changes',{event:'*',schema:'public',table:'orders'},p=>{if(p.eventType==='INSERT')cb({type:'ADD',order:mapOrderFromDB(p.new)});else if(p.eventType==='UPDATE')cb({type:'UPDATE',order:mapOrderFromDB(p.new)});else cb({type:'DELETE',id:p.old.id});}).subscribe()}catch{return{unsubscribe:()=>{}}}
}

function mapOrderToDB(o){return{id:o.id,customer_name:o.customerName,customer_phone:o.customerPhone||'',customer_wechat:o.customerWechat||'',date:o.date,time:o.time,duration:o.duration,location:o.location||'',makeup_type:o.makeupType,price:o.price,deposit:o.deposit||0,source:o.source,status:o.status,payment_status:o.paymentStatus,notes:o.notes||'',extra_services:o.extraServices||[],created_at:o.createdAt}}
function mapOrderFromDB(r){return{id:r.id,customerName:r.customer_name,customerPhone:r.customer_phone||'',customerWechat:r.customer_wechat||'',date:r.date,time:r.time,duration:r.duration,location:r.location||'',makeupType:r.makeup_type,price:r.price,deposit:r.deposit||0,source:r.source,status:r.status,paymentStatus:r.payment_status,notes:r.notes||'',extraServices:r.extra_services||[],createdAt:r.created_at}}
export { cloudReady };

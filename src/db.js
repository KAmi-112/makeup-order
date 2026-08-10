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

export async function getMfaState() {
  if (!supabase) return { currentLevel: 'aal1', nextLevel: 'aal1', factors: [] };
  const [assurance, factorResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance.error) throw assurance.error;
  if (factorResult.error) throw factorResult.error;
  return {
    ...assurance.data,
    factors: [...(factorResult.data?.totp || []), ...(factorResult.data?.phone || [])],
  };
}

export async function verifyMfaCode(code, factorId) {
  if (!supabase) throw new Error('云端服务未配置');
  let selectedFactorId = factorId;
  if (!selectedFactorId) {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    selectedFactorId = data.totp?.find(f => f.status === 'verified')?.id;
  }
  if (!selectedFactorId) throw new Error('没有可用的验证器');
  const challenge = await supabase.auth.mfa.challenge({ factorId: selectedFactorId });
  if (challenge.error) throw challenge.error;
  const verify = await supabase.auth.mfa.verify({ factorId: selectedFactorId, challengeId: challenge.data.id, code });
  if (verify.error) throw verify.error;
  return verify.data;
}

export async function beginMfaEnrollment() {
  if (!supabase) throw new Error('云端服务未配置');
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: '小荷工作台' });
  if (error) throw error;
  return data;
}

export async function verifyMfaEnrollment(factorId, code) {
  return verifyMfaCode(code, factorId);
}

export async function disableMfa(factorId) {
  if (!supabase) throw new Error('云端服务未配置');
  const { data, error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  return data;
}

export async function updateAccountEmail(email) {
  if (!supabase) throw new Error('云端服务未配置');
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
  return data.user;
}

export async function updateAccountPassword(password) {
  if (!supabase) throw new Error('云端服务未配置');
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

export async function fetchOrders() {
  if (!cloudReady) return localGet()?.orders ?? [];
  const { data, error } = await supabase.from('orders').select('*').is('deleted_at', null).order('created_at', { ascending: false });
  if (error) return [];
  const local = localGet() || {}; local.orders = data.map(mapOrderFromDB); localSet(local);
  return data.map(mapOrderFromDB);
}

export async function fetchTrashedOrders() {
  if (!cloudReady) return localGet()?.trashedOrders ?? [];
  const { data, error } = await supabase.from('orders').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
  if (error) throw error;
  return data.map(mapOrderFromDB);
}

export async function fetchAuditLogs(limit = 200) {
  if (!cloudReady) return [];
  const { data, error } = await supabase.from('order_audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data.map(row => ({ id: row.id, orderId: row.order_id, action: row.action, actorId: row.actor_id, createdAt: row.created_at }));
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
  const deletedAt = new Date().toISOString();
  if (!cloudReady) { const l=localGet()||{orders:[],trashedOrders:[]}; const order=l.orders.find(o=>o.id===id); l.orders=l.orders.filter(o=>o.id!==id); if(order)l.trashedOrders=[{...order,deletedAt},...(l.trashedOrders||[])]; localSet(l); return deletedAt; }
  const { data: authData } = await supabase.auth.getUser();
  const { error } = await supabase.from('orders').update({ deleted_at: deletedAt, deleted_by: authData?.user?.id || null }).eq('id', id);
  if (error) throw error;
  return deletedAt;
}

export async function restoreOrder(id) {
  if (!cloudReady) { const l=localGet()||{orders:[],trashedOrders:[]}; const order=(l.trashedOrders||[]).find(o=>o.id===id); l.trashedOrders=(l.trashedOrders||[]).filter(o=>o.id!==id); if(order)l.orders=[{...order,deletedAt:null},...(l.orders||[])]; localSet(l); return; }
  const { error } = await supabase.from('orders').update({ deleted_at: null, deleted_by: null }).eq('id', id);
  if (error) throw error;
}

export async function permanentlyDeleteOrder(id) {
  if (!cloudReady) { const l=localGet()||{trashedOrders:[]}; l.trashedOrders=(l.trashedOrders||[]).filter(o=>o.id!==id); localSet(l); return; }
  const { error } = await supabase.from('orders').delete().eq('id', id).not('deleted_at', 'is', null);
  if (error) throw error;
}

export async function fetchSettings() {
  if (!cloudReady) { const l=localGet()||{}; return {makeupTypes:l.makeupTypes??[],extraServices:l.extraServices??[],notice:l.notice??'',theme:l.theme??'lotus',topQuotes:l.topQuotes??[],bookingRules:l.bookingRules??null,reminderTemplates:l.reminderTemplates??[]}; }
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[],topQuotes:[],bookingRules:null,reminderTemplates:[]};
  if(!data) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[],topQuotes:[],bookingRules:null,reminderTemplates:[]};
  const types = (data.makeup_types||[]).map(t => ({...t, defaultPrice: t.price ?? t.defaultPrice ?? 0, defaultDuration: t.duration ?? t.defaultDuration ?? 1}));
  return {makeupTypes:types,extraServices:data.extra_services??[],notice:data.notice??'',theme:data.theme??'lotus',priceRules:data.price_rules??null,announcements:data.announcements??[],topQuotes:data.top_quotes??[],bookingRules:data.booking_rules??null,reminderTemplates:data.reminder_templates??[]};
}

export async function saveSettings(s) {
  if (!cloudReady) { const l=localGet()||{}; Object.assign(l,s); localSet(l); return; }
  // 标准化字段：确保 price/duration 同步到 Supabase
  const types = (s.makeupTypes || []).map(t => ({...t, price: t.defaultPrice ?? t.price ?? 0, duration: t.defaultDuration ?? t.duration ?? 1}));
  const { error } = await supabase.from('settings').upsert({id:1,makeup_types:types,extra_services:s.extraServices,notice:s.notice,theme:s.theme,price_rules:s.priceRules,announcements:s.announcements,top_quotes:s.topQuotes,booking_rules:s.bookingRules,reminder_templates:s.reminderTemplates,updated_at:new Date().toISOString()});
  if (error) throw error;
}

export function subscribeToOrders(cb) {
  if (!cloudReady) return {unsubscribe:()=>{}};
  try{return supabase.channel('o').on('postgres_changes',{event:'*',schema:'public',table:'orders'},p=>{if(p.eventType==='INSERT')cb({type:'ADD',order:mapOrderFromDB(p.new)});else if(p.eventType==='UPDATE')cb({type:'UPDATE',order:mapOrderFromDB(p.new)});else cb({type:'DELETE',id:p.old.id});}).subscribe()}catch{return{unsubscribe:()=>{}}}
}

function mapOrderToDB(o){return{id:o.id,customer_name:o.customerName,customer_phone:o.customerPhone||'',customer_wechat:o.customerWechat||'',date:o.date,time:o.time,duration:o.duration,location:o.location||'',makeup_type:o.makeupType,price:o.price,deposit:o.deposit||0,source:o.source,status:o.status,payment_status:o.paymentStatus,notes:o.notes||'',extra_services:o.extraServices||[],tags:o.tags||[],created_at:o.createdAt}}
function mapOrderFromDB(r){return{id:r.id,customerName:r.customer_name,customerPhone:r.customer_phone||'',customerWechat:r.customer_wechat||'',date:r.date,time:r.time,duration:r.duration,location:r.location||'',makeupType:r.makeup_type,price:r.price,deposit:r.deposit||0,source:r.source,status:r.status,paymentStatus:r.payment_status,notes:r.notes||'',extraServices:r.extra_services||[],tags:r.tags||[],createdAt:r.created_at,deletedAt:r.deleted_at||null}}
export { cloudReady };

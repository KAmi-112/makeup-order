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

export async function uploadPortfolioImage(blob) {
  if (!supabase) throw new Error('云端服务未配置');
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('请先登录管理员账号');
  const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
  const path = `${authData.user.id}/${fileName}`;
  const { error } = await supabase.storage.from('portfolio').upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('portfolio').getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('图片地址生成失败');
  return { path, publicUrl: data.publicUrl };
}

export async function deletePortfolioImages(paths = []) {
  if (!supabase || !paths.length) return;
  const { error } = await supabase.storage.from('portfolio').remove(paths);
  if (error) throw error;
}

export async function getMfaState() {
  if (!supabase) return { currentLevel: 'aal1', nextLevel: 'aal1', factors: [] };
  const [assurance, factorResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance.error) throw assurance.error;
  if (factorResult.error) throw factorResult.error;
  const listed = [
    ...(factorResult.data?.all || []),
    ...(factorResult.data?.totp || []),
    ...(factorResult.data?.phone || []),
  ];
  const factors = [...new Map(listed.map(factor => [factor.id, factor])).values()];
  return {
    ...assurance.data,
    factors,
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
  // 读取失败不能伪装成“0 个订单”，否则管理员会误以为订单被清空。
  if (error) throw error;
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

export async function fetchDiscountCards() {
  if (!cloudReady) return localGet()?.discountCards ?? [];
  const { data, error } = await supabase
    .from('discount_cards')
    .select('id,card_code,customer_name,makeup_type_id,makeup_type_name,total_uses,original_unit_price,purchase_amount,status,issued_at,refunded_at,refund_amount,refund_reason,notes,outstanding_no_show_fee,discount_card_redemptions(id,order_id,status,covered_amount,reserved_at,redeemed_at,released_at)')
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapDiscountCardFromDB);
}

export async function issueDiscountCard(payload) {
  if (!cloudReady) throw new Error('优惠卡必须连接云端后创建');
  const { data, error } = await supabase.rpc('admin_issue_discount_card', {
    p_customer_name: payload.customerName,
    p_makeup_type_id: payload.makeupTypeId,
    p_makeup_type_name: payload.makeupTypeName,
    p_original_unit_price: payload.originalUnitPrice,
    p_purchase_amount: payload.purchaseAmount,
    p_pin: payload.pin,
    p_notes: payload.notes || '',
  });
  if (error) throw error;
  return data;
}

export async function refundDiscountCard(cardId, reason, merchantFault = false) {
  if (!cloudReady) throw new Error('优惠卡退款必须连接云端处理');
  const { data, error } = await supabase.rpc('admin_refund_discount_card', {
    p_card_id: cardId,
    p_reason: reason || '',
    p_merchant_fault: merchantFault,
  });
  if (error) throw error;
  return data;
}

export async function markCardOrderNoShow(orderId) {
  if (!cloudReady) throw new Error('爽约处理必须连接云端');
  const { data, error } = await supabase.rpc('admin_mark_card_order_no_show', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function settleCardNoShowFee(cardId) {
  if (!cloudReady) throw new Error('爽约费处理必须连接云端');
  const { data, error } = await supabase.rpc('admin_settle_card_no_show_fee', { p_card_id: cardId });
  if (error) throw error;
  return data;
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
  if (!cloudReady) { const l=localGet()||{}; return {makeupTypes:l.makeupTypes??[],extraServices:l.extraServices??[],notice:l.notice??'',theme:l.theme??'lotus',topQuotes:l.topQuotes??[],bookingRules:l.bookingRules??null,miniappConfig:l.miniappConfig??null,reminderTemplates:l.reminderTemplates??[]}; }
  const { data, error } = await supabase.from('settings').select('*').single();
  if (error) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[],topQuotes:[],bookingRules:null,reminderTemplates:[]};
  if(!data) return {makeupTypes:[],extraServices:[],notice:'',theme:'lotus',priceRules:null,announcements:[],topQuotes:[],bookingRules:null,reminderTemplates:[]};
  const types = (data.makeup_types||[]).map(t => ({...t, defaultPrice: t.price ?? t.defaultPrice ?? 0, defaultDuration: t.duration ?? t.defaultDuration ?? 1}));
  return {makeupTypes:types,extraServices:data.extra_services??[],notice:data.notice??'',theme:data.theme??'lotus',priceRules:data.price_rules??null,announcements:data.announcements??[],topQuotes:data.top_quotes??[],bookingRules:data.booking_rules??null,miniappConfig:data.miniapp_config??null,reminderTemplates:data.reminder_templates??[]};
}

export async function saveSettings(s) {
  if (!cloudReady) { const l=localGet()||{}; Object.assign(l,s); localSet(l); return; }
  // 标准化字段：确保 price/duration 同步到 Supabase
  const types = (s.makeupTypes || []).map(t => ({...t, price: t.defaultPrice ?? t.price ?? 0, duration: t.defaultDuration ?? t.duration ?? 1}));
  const { data, error } = await supabase.from('settings').update({makeup_types:types,extra_services:s.extraServices,notice:s.notice,theme:s.theme,price_rules:s.priceRules,announcements:s.announcements,top_quotes:s.topQuotes,booking_rules:s.bookingRules,miniapp_config:s.miniappConfig,reminder_templates:s.reminderTemplates,updated_at:new Date().toISOString()}).eq('id',1).select('updated_at').single();
  if (error) throw error;
  if (!data?.updated_at) throw new Error('云端未确认保存，请重新登录后再试');
}

export async function saveAnnouncements(announcements) {
  if (!cloudReady) throw new Error('云端服务未配置');
  const { data, error } = await supabase.rpc('save_admin_announcements', {
    p_announcements: announcements || [],
  });
  if (error) throw error;
  if (!data) throw new Error('云端未确认公告保存');
  return data;
}

export async function saveSpecialDates(specialDates) {
  if (!cloudReady) throw new Error('云端服务未配置');
  const { data, error } = await supabase.rpc('save_admin_special_dates', {
    p_special_dates: specialDates || { enabled: true, dates: [], names: {} },
  });
  if (error) throw error;
  if (!data) throw new Error('云端未确认漫展日保存');
  return data;
}

export function subscribeToOrders(cb) {
  if (!cloudReady) return {unsubscribe:()=>{}};
  try{return supabase.channel('o').on('postgres_changes',{event:'*',schema:'public',table:'orders'},p=>{if(p.eventType==='INSERT')cb({type:'ADD',order:mapOrderFromDB(p.new)});else if(p.eventType==='UPDATE')cb({type:'UPDATE',order:mapOrderFromDB(p.new)});else cb({type:'DELETE',id:p.old.id});}).subscribe()}catch{return{unsubscribe:()=>{}}}
}

function mapOrderToDB(o){return{id:o.id,customer_name:o.customerName,customer_phone:o.customerPhone||'',customer_wechat:o.customerWechat||'',role_name:o.roleName||'',date:o.date,time:o.time,duration:o.duration,location:o.location||'',makeup_type:o.makeupType,price:o.price,deposit:o.deposit||0,source:o.source,status:o.status,payment_status:o.paymentStatus,notes:o.notes||'',extra_services:o.extraServices||[],tags:o.tags||[],created_at:o.createdAt,no_show_fee:o.noShowFee||0,no_show_fee_paid:Boolean(o.noShowFeePaid)}}
function mapOrderFromDB(r){return{id:r.id,customerName:r.customer_name,customerPhone:r.customer_phone||'',customerWechat:r.customer_wechat||'',roleName:r.role_name||'',date:r.date,time:r.time,duration:r.duration,location:r.location||'',makeupType:r.makeup_type,price:r.price,deposit:r.deposit||0,source:r.source,status:r.status,paymentStatus:r.payment_status,notes:r.notes||'',extraServices:r.extra_services||[],tags:r.tags||[],createdAt:r.created_at,deletedAt:r.deleted_at||null,discountCardId:r.discount_card_id||null,cardCoveredAmount:Number(r.card_covered_amount)||0,noShowFee:Number(r.no_show_fee)||0,noShowFeePaid:Boolean(r.no_show_fee_paid)}}
function mapDiscountCardFromDB(r){const rows=r.discount_card_redemptions||[];const used=rows.filter(x=>x.status==='redeemed').length;const reserved=rows.filter(x=>x.status==='reserved').length;return{id:r.id,cardCode:r.card_code,customerName:r.customer_name,makeupTypeId:r.makeup_type_id,makeupTypeName:r.makeup_type_name,totalUses:r.total_uses,originalUnitPrice:Number(r.original_unit_price)||0,purchaseAmount:Number(r.purchase_amount)||0,status:r.status,issuedAt:r.issued_at,refundedAt:r.refunded_at,refundAmount:r.refund_amount==null?null:Number(r.refund_amount),refundReason:r.refund_reason||'',notes:r.notes||'',outstandingNoShowFee:Number(r.outstanding_no_show_fee)||0,usedUses:used,reservedUses:reserved,availableUses:Math.max(0,r.total_uses-used-reserved),redemptions:rows};}
export { cloudReady };

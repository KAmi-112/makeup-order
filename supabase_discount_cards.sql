-- 小荷优惠卡：四次、长期有效、匿名端仅可通过卡号+核验码使用
-- 请在 Supabase SQL Editor 中整段执行。脚本可重复执行。
begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.orders
  add column if not exists role_name text not null default '',
  add column if not exists discount_card_id uuid,
  add column if not exists card_covered_amount numeric(10,2) not null default 0;

-- 只追加“遮眉”，不覆盖现有妆造价格和其他附加服务。
update public.settings
set extra_services = coalesce(extra_services,'[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','e7','name','遮眉','price',3)),
    updated_at = now()
where id=1 and not exists (
  select 1 from jsonb_array_elements(coalesce(extra_services,'[]'::jsonb)) item where item->>'id'='e7'
);

create table if not exists public.discount_cards (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  customer_name text not null,
  makeup_type_id text not null,
  makeup_type_name text not null,
  total_uses smallint not null default 4 check (total_uses = 4),
  original_unit_price numeric(10,2) not null check (original_unit_price >= 0),
  purchase_amount numeric(10,2) not null check (purchase_amount >= 0),
  pin_hash text not null,
  status text not null default 'active' check (status in ('active','refunded','void')),
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id),
  refunded_at timestamptz,
  refund_amount numeric(10,2),
  refund_reason text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discount_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.discount_cards(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  status text not null default 'reserved' check (status in ('reserved','redeemed','released')),
  covered_amount numeric(10,2) not null check (covered_amount >= 0),
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  unique(order_id)
);

do $$ begin
  if not exists(select 1 from pg_constraint where conname='orders_discount_card_id_fkey') then
    alter table public.orders add constraint orders_discount_card_id_fkey foreign key(discount_card_id) references public.discount_cards(id) on delete restrict;
  end if;
end $$;

create index if not exists discount_cards_customer_idx on public.discount_cards(customer_name, issued_at desc);
create index if not exists discount_cards_status_idx on public.discount_cards(status, issued_at desc);
create index if not exists discount_cards_issued_by_idx on public.discount_cards(issued_by) where issued_by is not null;
create index if not exists discount_card_redemptions_card_active_idx
  on public.discount_card_redemptions(card_id, status) where status in ('reserved','redeemed');
create index if not exists orders_discount_card_idx on public.orders(discount_card_id) where discount_card_id is not null;

alter table public.discount_cards enable row level security;
alter table public.discount_card_redemptions enable row level security;

drop policy if exists "admins manage discount cards" on public.discount_cards;
create policy "admins manage discount cards" on public.discount_cards for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

drop policy if exists "admins manage discount card redemptions" on public.discount_card_redemptions;
create policy "admins manage discount card redemptions" on public.discount_card_redemptions for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

revoke all on table public.discount_cards from anon;
revoke all on table public.discount_card_redemptions from anon;
grant select, insert, update on table public.discount_cards to authenticated;
grant select, insert, update on table public.discount_card_redemptions to authenticated;

create or replace function public.is_discount_card_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.admin_users a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_discount_card_admin() from public, anon;
grant execute on function public.is_discount_card_admin() to authenticated;

create or replace function public.admin_issue_discount_card(
  p_customer_name text, p_makeup_type_id text, p_makeup_type_name text,
  p_original_unit_price numeric, p_purchase_amount numeric, p_pin text, p_notes text default ''
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_card public.discount_cards; v_code text;
begin
  if not public.is_discount_card_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if char_length(btrim(coalesce(p_customer_name,''))) not between 1 and 40 then raise exception 'CUSTOMER_INVALID'; end if;
  if char_length(btrim(coalesce(p_makeup_type_id,''))) not between 1 and 80 or char_length(btrim(coalesce(p_makeup_type_name,''))) not between 1 and 80 then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  if p_original_unit_price < 0 or p_original_unit_price > 10000 or p_purchase_amount < 0 or p_purchase_amount > p_original_unit_price * 4 then raise exception 'CARD_PRICE_INVALID'; end if;
  if coalesce(p_pin,'') !~ '^\d{6}$' then raise exception 'PIN_INVALID'; end if;
  loop
    v_code := 'XH' || upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,10));
    exit when not exists(select 1 from public.discount_cards where card_code=v_code);
  end loop;
  insert into public.discount_cards(card_code,customer_name,makeup_type_id,makeup_type_name,original_unit_price,purchase_amount,pin_hash,issued_by,notes)
  values(v_code,btrim(p_customer_name),btrim(p_makeup_type_id),btrim(p_makeup_type_name),p_original_unit_price,p_purchase_amount,
    encode(extensions.digest(v_code||':'||p_pin,'sha256'),'hex'),(select auth.uid()),left(coalesce(p_notes,''),500)) returning * into v_card;
  return jsonb_build_object('id',v_card.id,'card_code',v_card.card_code,'customer_name',v_card.customer_name,'makeup_type_name',v_card.makeup_type_name,'purchase_amount',v_card.purchase_amount,'total_uses',4);
end; $$;
revoke all on function public.admin_issue_discount_card(text,text,text,numeric,numeric,text,text) from public,anon;
grant execute on function public.admin_issue_discount_card(text,text,text,numeric,numeric,text,text) to authenticated;

create or replace function public.get_customer_discount_card(p_card_code text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_card public.discount_cards; v_redeemed int; v_reserved int;
begin
  select * into v_card from public.discount_cards where card_code=upper(btrim(coalesce(p_card_code,'')));
  if not found or encode(extensions.digest(v_card.card_code||':'||coalesce(p_pin,''),'sha256'),'hex') <> v_card.pin_hash then raise exception 'CARD_NOT_FOUND'; end if;
  select count(*) filter(where status='redeemed'), count(*) filter(where status='reserved') into v_redeemed,v_reserved
  from public.discount_card_redemptions where card_id=v_card.id;
  return jsonb_build_object('cardCode',v_card.card_code,'customerName',v_card.customer_name,'makeupTypeName',v_card.makeup_type_name,
    'originalUnitPrice',v_card.original_unit_price,'purchaseAmount',v_card.purchase_amount,'totalUses',v_card.total_uses,
    'usedUses',v_redeemed,'reservedUses',v_reserved,'availableUses',greatest(0,v_card.total_uses-v_redeemed-v_reserved),'status',v_card.status,'issuedAt',v_card.issued_at);
end; $$;
revoke all on function public.get_customer_discount_card(text,text) from public;
grant execute on function public.get_customer_discount_card(text,text) to anon;
revoke execute on function public.get_customer_discount_card(text,text) from authenticated;

-- 在现有安全下单函数外增加事务包装：下单成功与卡次数预占必须同时成功或同时回滚。
create or replace function public.submit_customer_order_with_card(
  p_order jsonb, p_device_id text, p_honeypot text default '', p_card_code text default '', p_card_pin text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_card public.discount_cards; v_active int; v_order_id text; v_role_name text;
  v_types jsonb; v_type jsonb; v_current_base numeric; v_covered numeric;
begin
  v_role_name := btrim(coalesce(p_order->>'role_name',''));
  if char_length(v_role_name)>80 or v_role_name~'[<>]' then raise exception 'ROLE_NAME_INVALID'; end if;
  v_result := public.submit_customer_order(p_order,p_device_id,p_honeypot);
  v_order_id := v_result->>'id';
  update public.orders set role_name=v_role_name where id=v_order_id;
  if btrim(coalesce(p_card_code,''))='' then return v_result; end if;

  select * into v_card from public.discount_cards where card_code=upper(btrim(p_card_code)) for update;
  if not found or encode(extensions.digest(v_card.card_code||':'||coalesce(p_card_pin,''),'sha256'),'hex')<>v_card.pin_hash then raise exception 'CARD_NOT_FOUND'; end if;
  if v_card.status<>'active' then raise exception 'CARD_INACTIVE'; end if;
  if lower(btrim(coalesce(p_order->>'customer_name','')))<>lower(v_card.customer_name) then raise exception 'CARD_CUSTOMER_MISMATCH'; end if;
  select count(*) into v_active from public.discount_card_redemptions where card_id=v_card.id and status in ('reserved','redeemed');
  if v_active>=v_card.total_uses then raise exception 'CARD_NO_USES'; end if;
  select makeup_types into v_types from public.settings where id=1;
  select item into v_type from jsonb_array_elements(coalesce(v_types,'[]'::jsonb)) item where item->>'name'=p_order->>'makeup_type' limit 1;
  if v_type is null then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  v_current_base:=coalesce((v_type->>'price')::numeric,(v_type->>'defaultPrice')::numeric,0);
  v_covered:=least(v_card.original_unit_price,v_current_base);
  insert into public.discount_card_redemptions(card_id,order_id,covered_amount) values(v_card.id,v_order_id,v_covered);
  update public.orders set discount_card_id=v_card.id,card_covered_amount=v_covered where id=v_order_id;
  return v_result || jsonb_build_object('cardApplied',true,'cardCode',v_card.card_code,'cardCoveredAmount',v_covered,'cardAvailableUses',v_card.total_uses-v_active-1);
end; $$;
revoke all on function public.submit_customer_order_with_card(jsonb,text,text,text,text) from public;
grant execute on function public.submit_customer_order_with_card(jsonb,text,text,text,text) to anon;
revoke execute on function public.submit_customer_order_with_card(jsonb,text,text,text,text) from authenticated;

create or replace function public.sync_discount_card_redemption()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text; v_current text; v_active int;
begin
  if new.discount_card_id is null then return new; end if;
  if new.status='completed' and new.deleted_at is null then v_status:='redeemed';
  elsif new.status in ('cancelled','rejected') or new.deleted_at is not null then v_status:='released';
  else v_status:='reserved'; end if;
  perform 1 from public.discount_cards where id=new.discount_card_id for update;
  select status into v_current from public.discount_card_redemptions where order_id=new.id;
  if v_status='reserved' and coalesce(v_current,'released')='released' then
    select count(*) into v_active from public.discount_card_redemptions where card_id=new.discount_card_id and status in ('reserved','redeemed') and order_id<>new.id;
    if v_active >= 4 then raise exception 'CARD_NO_USES'; end if;
  end if;
  update public.discount_card_redemptions set status=v_status,
    redeemed_at=case when v_status='redeemed' then coalesce(redeemed_at,now()) else null end,
    released_at=case when v_status='released' then coalesce(released_at,now()) else null end
  where order_id=new.id;
  return new;
end; $$;
revoke all on function public.sync_discount_card_redemption() from public,anon,authenticated;
drop trigger if exists sync_discount_card_redemption_trigger on public.orders;
create trigger sync_discount_card_redemption_trigger after update of status,deleted_at on public.orders
for each row when (new.discount_card_id is not null) execute function public.sync_discount_card_redemption();

create or replace function public.admin_refund_discount_card(p_card_id uuid,p_reason text,p_merchant_fault boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_card public.discount_cards; v_used int; v_reserved int; v_consumed numeric; v_refund numeric;
begin
  if not public.is_discount_card_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_card from public.discount_cards where id=p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  if v_card.status<>'active' then raise exception 'CARD_INACTIVE'; end if;
  select count(*) filter(where status='redeemed'),count(*) filter(where status='reserved') into v_used,v_reserved from public.discount_card_redemptions where card_id=v_card.id;
  if v_reserved>0 then raise exception 'CARD_HAS_RESERVATIONS'; end if;
  if p_merchant_fault then v_consumed:=round((v_card.purchase_amount/v_card.total_uses)*v_used,2);
  else v_consumed:=v_card.original_unit_price*v_used; end if;
  v_refund:=greatest(0,v_card.purchase_amount-v_consumed);
  update public.discount_cards set status='refunded',refunded_at=now(),refund_amount=v_refund,
    refund_reason=left(btrim(coalesce(p_reason,'')),500),updated_at=now() where id=v_card.id;
  return jsonb_build_object('cardCode',v_card.card_code,'usedUses',v_used,'refundAmount',v_refund,'merchantFault',p_merchant_fault);
end; $$;
revoke all on function public.admin_refund_discount_card(uuid,text,boolean) from public,anon;
grant execute on function public.admin_refund_discount_card(uuid,text,boolean) to authenticated;

commit;

-- 验证（执行后应返回两张表均启用 RLS）：
-- select relname,relrowsecurity from pg_class where relname in ('discount_cards','discount_card_redemptions');

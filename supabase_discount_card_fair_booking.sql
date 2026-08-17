-- 优惠卡公平预约规则：免重复定金、爽约费不扣次数、欠费期间暂停使用。
begin;

update public.settings
set miniapp_config = coalesce(miniapp_config,'{}'::jsonb) || jsonb_build_object(
  'discountCardRules', jsonb_build_object(
    'depositRequired', false,
    'depositAmount', 0,
    'noShowFee', 18,
    'freezeOnUnpaidNoShow', true,
    'cancelReleasesUse', true
  )
), updated_at=now()
where id=1;

alter table public.discount_cards add column if not exists outstanding_no_show_fee numeric(10,2) not null default 0
  check (outstanding_no_show_fee >= 0);
alter table public.orders add column if not exists no_show_fee numeric(10,2) not null default 0
  check (no_show_fee >= 0);
alter table public.orders add column if not exists no_show_fee_paid boolean not null default false;

create or replace function public.get_customer_discount_card(p_card_code text, p_pin text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_card public.discount_cards; v_redeemed int; v_reserved int; v_rules jsonb; v_freeze boolean;
begin
  select * into v_card from public.discount_cards where card_code=upper(btrim(coalesce(p_card_code,'')));
  if not found or encode(extensions.digest(v_card.card_code||':'||coalesce(p_pin,''),'sha256'),'hex') <> v_card.pin_hash then raise exception 'CARD_NOT_FOUND'; end if;
  select count(*) filter(where status='redeemed'), count(*) filter(where status='reserved') into v_redeemed,v_reserved
  from public.discount_card_redemptions where card_id=v_card.id;
  select coalesce(miniapp_config->'discountCardRules','{}'::jsonb) into v_rules from public.settings where id=1;
  v_freeze:=coalesce((v_rules->>'freezeOnUnpaidNoShow')::boolean,true);
  return jsonb_build_object('cardCode',v_card.card_code,'customerName',v_card.customer_name,'makeupTypeName',v_card.makeup_type_name,
    'originalUnitPrice',v_card.original_unit_price,'purchaseAmount',v_card.purchase_amount,'totalUses',v_card.total_uses,
    'usedUses',v_redeemed,'reservedUses',v_reserved,'availableUses',greatest(0,v_card.total_uses-v_redeemed-v_reserved),
    'status',v_card.status,'issuedAt',v_card.issued_at,'outstandingNoShowFee',v_card.outstanding_no_show_fee,
    'blocked',v_freeze and v_card.outstanding_no_show_fee>0);
end; $$;
revoke all on function public.get_customer_discount_card(text,text) from public,authenticated;
grant execute on function public.get_customer_discount_card(text,text) to anon;

create or replace function public.submit_customer_order_with_card(
  p_order jsonb, p_device_id text, p_honeypot text default '', p_card_code text default '', p_card_pin text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_card public.discount_cards; v_active int; v_order_id text; v_role_name text;
  v_types jsonb; v_type jsonb; v_current_base numeric; v_covered numeric; v_order_payload jsonb;
  v_rules jsonb; v_deposit numeric; v_freeze boolean;
begin
  v_role_name := btrim(coalesce(p_order->>'role_name',''));
  if char_length(v_role_name)>80 or v_role_name~'[<>]' then raise exception 'ROLE_NAME_INVALID'; end if;
  select coalesce(miniapp_config->'discountCardRules','{}'::jsonb) into v_rules from public.settings where id=1;
  v_deposit:=case when coalesce((v_rules->>'depositRequired')::boolean,false)
    then greatest(0,least(1000,coalesce((v_rules->>'depositAmount')::numeric,0))) else 0 end;
  v_freeze:=coalesce((v_rules->>'freezeOnUnpaidNoShow')::boolean,true);
  v_order_payload:=p_order;
  if btrim(coalesce(p_card_code,''))<>'' then
    -- 先验卡，避免错误卡号产生临时订单；插入阶段沿用普通订单校验值，成功关联后再写入优惠卡定金。
    select * into v_card from public.discount_cards where card_code=upper(btrim(p_card_code)) for update;
    if not found or encode(extensions.digest(v_card.card_code||':'||coalesce(p_card_pin,''),'sha256'),'hex')<>v_card.pin_hash then raise exception 'CARD_NOT_FOUND'; end if;
    if v_card.status<>'active' then raise exception 'CARD_INACTIVE'; end if;
    if v_freeze and v_card.outstanding_no_show_fee>0 then raise exception 'CARD_NO_SHOW_FEE_DUE'; end if;
    if lower(btrim(coalesce(p_order->>'customer_name','')))<>lower(v_card.customer_name) then raise exception 'CARD_CUSTOMER_MISMATCH'; end if;
    select count(*) into v_active from public.discount_card_redemptions where card_id=v_card.id and status in ('reserved','redeemed');
    if v_active>=v_card.total_uses then raise exception 'CARD_NO_USES'; end if;
    v_order_payload:=jsonb_set(v_order_payload,'{deposit}',to_jsonb(coalesce((select (miniapp_config->>'depositAmount')::numeric from public.settings where id=1),18)),true);
  end if;
  v_result := public.submit_customer_order(v_order_payload,p_device_id,p_honeypot);
  v_order_id := v_result->>'id';
  update public.orders set role_name=v_role_name where id=v_order_id;
  if btrim(coalesce(p_card_code,''))='' then return v_result || jsonb_build_object('deposit',coalesce((v_order_payload->>'deposit')::numeric,0)); end if;

  select makeup_types into v_types from public.settings where id=1;
  select item into v_type from jsonb_array_elements(coalesce(v_types,'[]'::jsonb)) item where item->>'name'=p_order->>'makeup_type' limit 1;
  if v_type is null then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  v_current_base:=coalesce((v_type->>'price')::numeric,(v_type->>'defaultPrice')::numeric,0);
  v_covered:=least(v_card.original_unit_price,v_current_base);
  insert into public.discount_card_redemptions(card_id,order_id,covered_amount) values(v_card.id,v_order_id,v_covered);
  update public.orders set discount_card_id=v_card.id,card_covered_amount=v_covered,deposit=v_deposit where id=v_order_id;
  return v_result || jsonb_build_object('cardApplied',true,'cardCode',v_card.card_code,'cardCoveredAmount',v_covered,
    'cardAvailableUses',v_card.total_uses-v_active-1,'deposit',v_deposit);
end; $$;
revoke all on function public.submit_customer_order_with_card(jsonb,text,text,text,text) from public,authenticated;
grant execute on function public.submit_customer_order_with_card(jsonb,text,text,text,text) to anon;

create or replace function public.sync_discount_card_redemption()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status text; v_current text; v_active int;
begin
  if new.discount_card_id is null then return new; end if;
  if new.status='completed' and new.deleted_at is null then v_status:='redeemed';
  elsif new.status in ('cancelled','rejected','no_show') or new.deleted_at is not null then v_status:='released';
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

create or replace function public.admin_mark_card_order_no_show(p_order_id text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_order public.orders; v_fee numeric; v_rules jsonb;
begin
  if not public.is_discount_card_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found or v_order.discount_card_id is null then raise exception 'CARD_ORDER_NOT_FOUND'; end if;
  if v_order.status='no_show' then return jsonb_build_object('ok',true,'fee',v_order.no_show_fee); end if;
  if v_order.status not in ('pending','confirmed') then raise exception 'NO_SHOW_NOT_ALLOWED'; end if;
  select coalesce(miniapp_config->'discountCardRules','{}'::jsonb) into v_rules from public.settings where id=1;
  v_fee:=greatest(0,least(1000,coalesce((v_rules->>'noShowFee')::numeric,18)));
  update public.orders set status='no_show',no_show_fee=v_fee,no_show_fee_paid=false where id=p_order_id;
  update public.discount_cards set outstanding_no_show_fee=outstanding_no_show_fee+v_fee,updated_at=now() where id=v_order.discount_card_id;
  return jsonb_build_object('ok',true,'fee',v_fee,'status','no_show');
end; $$;
revoke all on function public.admin_mark_card_order_no_show(text) from public,anon;
grant execute on function public.admin_mark_card_order_no_show(text) to authenticated;

create or replace function public.admin_settle_card_no_show_fee(p_card_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_amount numeric;
begin
  if not public.is_discount_card_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select outstanding_no_show_fee into v_amount from public.discount_cards where id=p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND'; end if;
  update public.discount_cards set outstanding_no_show_fee=0,updated_at=now() where id=p_card_id;
  update public.orders set no_show_fee_paid=true where discount_card_id=p_card_id and status='no_show' and no_show_fee_paid=false;
  return jsonb_build_object('ok',true,'settledAmount',v_amount);
end; $$;
revoke all on function public.admin_settle_card_no_show_fee(uuid) from public,anon;
grant execute on function public.admin_settle_card_no_show_fee(uuid) to authenticated;

commit;

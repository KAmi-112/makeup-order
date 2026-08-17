-- 恢复“带美瞳（5分钟内免费）”，并允许持订单专属凭证的客妹安全修改预约。
-- 修改后订单自动回到待确认；已完成/取消/拒绝/回收站订单不可修改。
begin;

update public.settings
set extra_services = coalesce(extra_services,'[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('id','e6','name','带美瞳（5分钟内免费）','price',0)
    ), updated_at=now()
where id=1 and not exists(
  select 1 from jsonb_array_elements(coalesce(extra_services,'[]'::jsonb)) item where item->>'id'='e6'
);

create table if not exists private.customer_order_modifications (
  id bigint generated always as identity primary key,
  device_hash text not null,
  order_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_order_modifications_device_time_idx
  on private.customer_order_modifications(device_hash,created_at desc);
create index if not exists customer_order_modifications_created_idx
  on private.customer_order_modifications(created_at desc);
revoke all on table private.customer_order_modifications from public,anon,authenticated;

create or replace function public.update_customer_order(
  p_id text, p_token text, p_device_id text, p_changes jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_order public.orders; v_settings public.settings; v_type jsonb;
  v_name text:=btrim(coalesce(p_changes->>'customer_name',''));
  v_role text:=btrim(coalesce(p_changes->>'role_name',''));
  v_date text:=coalesce(p_changes->>'date',''); v_time text:=coalesce(p_changes->>'time','');
  v_makeup text:=btrim(coalesce(p_changes->>'makeup_type',''));
  v_notes text:=btrim(coalesce(p_changes->>'notes',''));
  v_extra jsonb:=coalesce(p_changes->'extra_services','[]'::jsonb);
  v_duration real; v_base real; v_extra_price real:=0; v_adjustment real:=0; v_price real;
  v_start int; v_end int; v_order_min int; v_day int; v_is_special boolean;
  v_device_hash text; v_covered numeric:=0; v_unknown_extras int;
begin
  if p_device_id!~'^[A-Za-z0-9_-]{24,80}$' then raise exception 'DEVICE_INVALID'; end if;
  if p_id!~'^[a-z0-9]{8,32}$' or p_token!~'^[A-Za-z0-9-]{24,80}$' then raise exception 'ORDER_TOKEN_INVALID'; end if;
  select * into v_order from public.orders where id=p_id and client_token=p_token for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.deleted_at is not null or v_order.status not in ('pending','confirmed') then raise exception 'EDIT_NOT_ALLOWED'; end if;
  if (v_order.date||' '||v_order.time)::timestamp <= timezone('Asia/Shanghai',now()) then raise exception 'EDIT_TOO_LATE'; end if;

  if char_length(v_name) not between 1 and 40 or v_name~'[<>]' then raise exception 'NAME_INVALID'; end if;
  if char_length(v_role)>80 or v_role~'[<>]' then raise exception 'ROLE_NAME_INVALID'; end if;
  if char_length(v_notes)>500 or v_notes~'[<>]' then raise exception 'CONTENT_INVALID'; end if;
  if jsonb_typeof(v_extra)<>'array' then raise exception 'CONTENT_INVALID'; end if;
  if v_date!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_date::date<current_date then raise exception 'DATE_INVALID'; end if;
  if v_time!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'TIME_INVALID'; end if;
  if (v_date||' '||v_time)::timestamp<=timezone('Asia/Shanghai',now()) then raise exception 'EDIT_TOO_LATE'; end if;

  select * into v_settings from public.settings where id=1;
  select item into v_type from jsonb_array_elements(coalesce(v_settings.makeup_types,'[]'::jsonb)) item where item->>'name'=v_makeup limit 1;
  if v_type is null then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  v_base:=coalesce((v_type->>'price')::real,(v_type->>'defaultPrice')::real);
  v_duration:=coalesce((v_type->>'duration')::real,(v_type->>'defaultDuration')::real,1);
  if v_date::date>current_date+least(365,greatest(1,coalesce((v_settings.miniapp_config->>'maxDaysAhead')::int,365))) then raise exception 'DATE_TOO_FAR'; end if;
  if coalesce(v_settings.booking_rules->'blockedDates','[]'::jsonb)?v_date then raise exception 'DATE_BLOCKED'; end if;

  v_start:=split_part(coalesce(v_settings.booking_rules->'availableHours'->>'start','05:00'),':',1)::int*60+split_part(coalesce(v_settings.booking_rules->'availableHours'->>'start','05:00'),':',2)::int;
  v_end:=split_part(coalesce(v_settings.booking_rules->'availableHours'->>'end','23:00'),':',1)::int*60+split_part(coalesce(v_settings.booking_rules->'availableHours'->>'end','23:00'),':',2)::int;
  v_order_min:=split_part(v_time,':',1)::int*60+split_part(v_time,':',2)::int;
  if v_order_min<v_start or v_order_min+ceil(v_duration*60)>v_end then raise exception 'OUTSIDE_AVAILABLE_HOURS'; end if;

  select count(*) into v_unknown_extras from jsonb_array_elements_text(v_extra) chosen
  where not exists(select 1 from jsonb_array_elements(coalesce(v_settings.extra_services,'[]'::jsonb)) svc where svc->>'id'=chosen.value);
  if v_unknown_extras>0 then raise exception 'EXTRA_SERVICE_INVALID'; end if;
  select coalesce(sum(case when svc->>'id'='e2' and v_makeup~'COS正片|COS华改' then 0 else coalesce((svc->>'price')::real,0) end),0)
  into v_extra_price from jsonb_array_elements(coalesce(v_settings.extra_services,'[]'::jsonb)) svc
  where svc->>'id' in(select jsonb_array_elements_text(v_extra));

  v_day:=extract(dow from v_date::date);
  v_is_special:=coalesce(v_settings.price_rules->'special_dates'->'dates','[]'::jsonb)?v_date;
  if v_order_min>=1080 and v_order_min<1380 and coalesce((v_settings.price_rules->'evening_surcharge'->>'enabled')::boolean,true) then
    v_adjustment:=abs(coalesce((v_settings.price_rules->'evening_surcharge'->>'amount')::real,10));
  elsif v_order_min>=300 and v_order_min<420 then
    if v_is_special or v_day in(0,6) then
      if coalesce((v_settings.price_rules->'morning_weekend_special_discount'->>'enabled')::boolean,true) then v_adjustment:=-abs(coalesce((v_settings.price_rules->'morning_weekend_special_discount'->>'amount')::real,-10)); end if;
    elsif coalesce((v_settings.price_rules->'morning_weekday_surcharge'->>'enabled')::boolean,true) then
      v_adjustment:=abs(coalesce((v_settings.price_rules->'morning_weekday_surcharge'->>'amount')::real,10));
    end if;
  end if;
  v_price:=greatest(0,v_base+v_extra_price+v_adjustment);

  if exists(select 1 from public.orders o where o.id<>v_order.id and o.deleted_at is null and o.status='confirmed' and o.date=v_date
    and v_order_min < (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+ceil(o.duration*60))
    and v_order_min+ceil(v_duration*60) > (split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int)) then raise exception 'TIME_CONFLICT'; end if;

  if v_order.discount_card_id is not null then
    perform 1 from public.discount_cards c where c.id=v_order.discount_card_id and c.status='active' and lower(c.customer_name)=lower(v_name) for update;
    if not found then raise exception 'CARD_CUSTOMER_MISMATCH'; end if;
    select least(c.original_unit_price,v_base) into v_covered from public.discount_cards c where c.id=v_order.discount_card_id;
  end if;

  v_device_hash:=md5(p_device_id);
  perform pg_advisory_xact_lock(hashtextextended(v_device_hash,0));
  if (select count(*) from private.customer_order_modifications where device_hash=v_device_hash and created_at>=now()-interval '10 minutes')>=2 then raise exception 'EDIT_RATE_LIMIT'; end if;
  if (select count(*) from private.customer_order_modifications where device_hash=v_device_hash and created_at>=now()-interval '24 hours')>=8 then raise exception 'EDIT_RATE_LIMIT_DAY'; end if;

  update public.orders set customer_name=v_name,role_name=v_role,date=v_date,time=v_time,duration=v_duration,makeup_type=v_makeup,
    price=v_price,notes=v_notes,extra_services=v_extra,status='pending',card_covered_amount=v_covered where id=v_order.id;
  insert into private.customer_order_modifications(device_hash,order_id) values(v_device_hash,v_order.id);
  return jsonb_build_object('ok',true,'id',v_order.id,'status','pending','customerName',v_name,'roleName',v_role,'date',v_date,'time',v_time,
    'duration',v_duration,'makeupType',v_makeup,'price',v_price,'notes',v_notes,'extraServices',v_extra,'cardCoveredAmount',v_covered,'updatedAt',now());
end; $$;
revoke all on function public.update_customer_order(text,text,text,jsonb) from public,authenticated;
grant execute on function public.update_customer_order(text,text,text,jsonb) to anon;

commit;

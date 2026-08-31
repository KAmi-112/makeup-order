-- 生产核价：匿名下单必须以 settings 为唯一价格来源。
-- 兼容现有小程序参数；价格或时长不一致时返回 PRICE_MISMATCH，客户端会提示刷新配置。
create or replace function public.submit_customer_order(p_order jsonb, p_device_id text, p_honeypot text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_today date := (clock_timestamp() at time zone 'Asia/Shanghai')::date;
  v_device_hash text; v_slot_key text;
  v_id text := coalesce(p_order->>'id','');
  v_name text := btrim(coalesce(p_order->>'customer_name',''));
  v_date text := coalesce(p_order->>'date','');
  v_time text := coalesce(p_order->>'time','');
  v_type text := btrim(coalesce(p_order->>'makeup_type',''));
  v_token text := coalesce(p_order->>'client_token','');
  v_duration numeric := coalesce((p_order->>'duration')::numeric,1);
  v_client_price numeric := coalesce((p_order->>'price')::numeric,0);
  v_deposit numeric := coalesce((p_order->>'deposit')::numeric,0);
  v_notes text := btrim(coalesce(p_order->>'notes',''));
  v_extra jsonb := coalesce(p_order->'extra_services','[]'::jsonb);
  v_settings public.settings%rowtype;
  v_type_config jsonb;
  v_base numeric := 0;
  v_extra_price numeric := 0;
  v_adjustment numeric := 0;
  v_expected_price numeric := 0;
  v_order_min integer;
  v_is_special boolean := false;
begin
  if coalesce(p_honeypot,'') <> '' then raise exception 'SUBMISSION_REJECTED'; end if;
  if p_device_id !~ '^[A-Za-z0-9_-]{24,80}$' then raise exception 'DEVICE_INVALID'; end if;
  if v_id !~ '^[a-z0-9]{8,32}$' or v_token !~ '^[A-Za-z0-9-]{24,80}$' then raise exception 'ORDER_TOKEN_INVALID'; end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[<>]' then raise exception 'NAME_INVALID'; end if;
  if v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v_date::date < v_today or v_date::date > v_today+365 then raise exception 'DATE_INVALID'; end if;
  if v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'TIME_INVALID'; end if;
  if char_length(v_type) not between 1 and 80 or v_duration not between .5 and 8 or v_client_price not between 0 and 10000 then raise exception 'ORDER_INVALID'; end if;
  if char_length(v_notes)>500 or v_notes~'[<>]' or jsonb_typeof(v_extra)<>'array' then raise exception 'CONTENT_INVALID'; end if;

  select * into v_settings from public.settings where id=1;
  if not found then raise exception 'SETTINGS_UNAVAILABLE'; end if;
  if coalesce(v_settings.booking_rules->'blockedDates','[]'::jsonb)?v_date then raise exception 'DATE_BLOCKED'; end if;

  select item into v_type_config
  from jsonb_array_elements(coalesce(v_settings.makeup_types,'[]'::jsonb)) item
  where item->>'name'=v_type limit 1;
  if v_type_config is null then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  v_base := coalesce((v_type_config->>'price')::numeric,(v_type_config->>'defaultPrice')::numeric,0);
  if abs(v_duration-coalesce((v_type_config->>'duration')::numeric,(v_type_config->>'defaultDuration')::numeric,1)) > .001 then raise exception 'DURATION_MISMATCH'; end if;

  if exists(select 1 from jsonb_array_elements(v_extra) element where jsonb_typeof(element)<>'string') then raise exception 'SERVICE_INVALID'; end if;
  if (select count(*) from jsonb_array_elements_text(v_extra)) <> (select count(distinct value) from jsonb_array_elements_text(v_extra)) then raise exception 'SERVICE_DUPLICATE'; end if;
  if exists(
    select 1 from jsonb_array_elements_text(v_extra) chosen
    where not exists(select 1 from jsonb_array_elements(coalesce(v_settings.extra_services,'[]'::jsonb)) svc where svc->>'id'=chosen.value)
  ) then raise exception 'SERVICE_INVALID'; end if;

  select coalesce(sum(case when svc->>'id'='e2' and v_type ~ 'COS正片|COS华改' then 0 else coalesce((svc->>'price')::numeric,0) end),0)
  into v_extra_price
  from jsonb_array_elements(coalesce(v_settings.extra_services,'[]'::jsonb)) svc
  where svc->>'id' in (select value from jsonb_array_elements_text(v_extra));

  v_order_min := split_part(v_time,':',1)::integer*60 + split_part(v_time,':',2)::integer;
  v_is_special := coalesce(v_settings.price_rules->'special_dates'->'dates','[]'::jsonb)?v_date;
  if v_order_min>=1080 and v_order_min<1380 and coalesce((v_settings.price_rules->'evening_surcharge'->>'enabled')::boolean,true) then
    v_adjustment:=abs(coalesce((v_settings.price_rules->'evening_surcharge'->>'amount')::numeric,10));
  elsif v_order_min>=300 and v_order_min<420 then
    if v_is_special or extract(isodow from v_date::date) in (6,7) then
      if coalesce((v_settings.price_rules->'morning_weekend_special_discount'->>'enabled')::boolean,true) then
        v_adjustment:=-abs(coalesce((v_settings.price_rules->'morning_weekend_special_discount'->>'amount')::numeric,-10));
      end if;
    elsif coalesce((v_settings.price_rules->'morning_weekday_surcharge'->>'enabled')::boolean,true) then
      v_adjustment:=abs(coalesce((v_settings.price_rules->'morning_weekday_surcharge'->>'amount')::numeric,10));
    end if;
  end if;
  v_expected_price:=greatest(0,v_base+v_extra_price+v_adjustment);
  if abs(v_client_price-v_expected_price)>.001 then raise exception 'PRICE_MISMATCH'; end if;
  if v_deposit<0 or v_deposit>v_expected_price then raise exception 'DEPOSIT_INVALID'; end if;

  v_device_hash:=md5(p_device_id);
  v_slot_key:=v_date||'|'||v_time||'|'||lower(v_type);
  perform pg_advisory_xact_lock(hashtextextended(v_device_hash,0));
  if (select count(*) from private.customer_order_submissions where created_at>=v_now-interval '1 hour')>=80 then raise exception 'SERVICE_BUSY'; end if;
  if (select count(*) from private.customer_order_submissions where device_hash=v_device_hash and created_at>=v_now-interval '5 minutes')>=2 then raise exception 'RATE_LIMIT_5M'; end if;
  if (select count(*) from private.customer_order_submissions where device_hash=v_device_hash and created_at>=v_now-interval '24 hours')>=8 then raise exception 'RATE_LIMIT_DAY'; end if;
  if exists(select 1 from private.customer_order_submissions where device_hash=v_device_hash and slot_key=v_slot_key and created_at>=v_now-interval '10 minutes') then raise exception 'DUPLICATE_ORDER'; end if;
  if exists(select 1 from public.orders where id=v_id or client_token=v_token) then raise exception 'DUPLICATE_TOKEN'; end if;

  insert into public.orders(id,customer_name,customer_phone,customer_wechat,date,time,duration,location,makeup_type,price,deposit,source,status,payment_status,notes,extra_services,client_token,created_at,tags)
  values(v_id,v_name,'','',v_date,v_time,v_duration,left(coalesce(p_order->>'location',''),120),v_type,v_expected_price,v_deposit,'小程序自助下单','pending','unpaid',v_notes,v_extra,v_token,v_now::text,'[]'::jsonb);
  insert into private.customer_order_submissions(device_hash,contact_hash,order_id,slot_key,created_at)
  values(v_device_hash,md5('not-collected'),v_id,v_slot_key,v_now);
  return jsonb_build_object('ok',true,'id',v_id,'price',v_expected_price,'created_at',v_now);
end;
$$;

revoke all on function public.submit_customer_order(jsonb,text,text) from public, authenticated;
grant execute on function public.submit_customer_order(jsonb,text,text) to anon;

-- 精确修复单笔错误订单；条件不匹配时不会修改任何其他订单。
update public.orders
set price=51
where id='mt5y0rx7kevset'
  and customer_name='亦'
  and date='2026-08-31'
  and time='08:30'
  and price=54
  and makeup_type='Lo妆/约会妆/生日妆'
  and extra_services='["e2","e6"]'::jsonb;


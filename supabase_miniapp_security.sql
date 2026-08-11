-- 小程序云端配置与防恶意下单保护（已应用到 Supabase，仓库留档）

alter table public.settings add column if not exists miniapp_config jsonb not null default
'{"brandName":"西瓜椰约妆","depositAmount":18,"location":"地铁5号线凌大塘站D口附近","artistWechat":"","workHoursNote":"非工作时间加位需钞能力","warningText":"请认真阅读约妆须知并自觉遵守，不要把家长或异性亲友带来后再询问。","maxDaysAhead":365}'::jsonb;

create schema if not exists private;
create table if not exists private.customer_order_submissions (
  id bigint generated always as identity primary key,
  device_hash text not null,
  contact_hash text not null,
  order_id text not null,
  slot_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_order_submissions_device_time_idx on private.customer_order_submissions(device_hash, created_at desc);
create index if not exists customer_order_submissions_contact_time_idx on private.customer_order_submissions(contact_hash, created_at desc);
create index if not exists customer_order_submissions_created_at_idx on private.customer_order_submissions(created_at desc);
revoke all on schema private from public, anon, authenticated;
revoke all on table private.customer_order_submissions from public, anon, authenticated;

drop policy if exists "customers submit orders" on public.orders;
revoke insert on table public.orders from anon;

-- 匿名客户只能调用这个受校验入口，不能直接写 orders。
create or replace function public.submit_customer_order(p_order jsonb, p_device_id text, p_honeypot text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp(); v_device_hash text; v_contact_hash text; v_slot_key text;
  v_id text := coalesce(p_order->>'id',''); v_name text := btrim(coalesce(p_order->>'customer_name',''));
  v_phone text := btrim(coalesce(p_order->>'customer_phone','')); v_wechat text := btrim(coalesce(p_order->>'customer_wechat',''));
  v_date text := coalesce(p_order->>'date',''); v_time text := coalesce(p_order->>'time','');
  v_type text := btrim(coalesce(p_order->>'makeup_type','')); v_token text := coalesce(p_order->>'client_token','');
  v_duration real := coalesce((p_order->>'duration')::real,1); v_price real := coalesce((p_order->>'price')::real,0);
  v_deposit real := coalesce((p_order->>'deposit')::real,0); v_notes text := btrim(coalesce(p_order->>'notes',''));
  v_extra jsonb := coalesce(p_order->'extra_services','[]'::jsonb);
begin
  if coalesce(p_honeypot,'') <> '' then raise exception 'SUBMISSION_REJECTED'; end if;
  if p_device_id !~ '^[A-Za-z0-9_-]{24,80}$' then raise exception 'DEVICE_INVALID'; end if;
  if v_id !~ '^[a-z0-9]{8,32}$' or v_token !~ '^[A-Za-z0-9-]{24,80}$' then raise exception 'ORDER_TOKEN_INVALID'; end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[<>]' then raise exception 'NAME_INVALID'; end if;
  if v_phone = '' and v_wechat = '' then raise exception 'CONTACT_REQUIRED'; end if;
  if char_length(v_phone)>30 or char_length(v_wechat)>50 or v_phone~'[<>]' or v_wechat~'[<>]' then raise exception 'CONTACT_INVALID'; end if;
  if v_date !~ '^\d{4}-\d{2}-\d{2}$' or v_date::date<current_date or v_date::date>current_date+365 then raise exception 'DATE_INVALID'; end if;
  if v_time !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'TIME_INVALID'; end if;
  if char_length(v_type) not between 1 and 80 or v_duration not between .5 and 8 or v_price not between 0 and 10000 or v_deposit not between 0 and v_price then raise exception 'ORDER_INVALID'; end if;
  if char_length(v_notes)>500 or v_notes~'[<>]' or jsonb_typeof(v_extra)<>'array' then raise exception 'CONTENT_INVALID'; end if;
  if exists(select 1 from public.settings where id=1 and coalesce(booking_rules->'blockedDates','[]'::jsonb)?v_date) then raise exception 'DATE_BLOCKED'; end if;
  v_device_hash:=md5(p_device_id); v_contact_hash:=md5(lower(v_phone||'|'||v_wechat)); v_slot_key:=v_date||'|'||v_time||'|'||lower(v_type);
  perform pg_advisory_xact_lock(hashtextextended(v_device_hash,0));
  if (select count(*) from private.customer_order_submissions where created_at>=v_now-interval '1 hour')>=80 then raise exception 'SERVICE_BUSY'; end if;
  if (select count(*) from private.customer_order_submissions where device_hash=v_device_hash and created_at>=v_now-interval '5 minutes')>=2 then raise exception 'RATE_LIMIT_5M'; end if;
  if (select count(*) from private.customer_order_submissions where device_hash=v_device_hash and created_at>=v_now-interval '24 hours')>=8 then raise exception 'RATE_LIMIT_DAY'; end if;
  if (select count(*) from private.customer_order_submissions where contact_hash=v_contact_hash and created_at>=v_now-interval '24 hours')>=3 then raise exception 'CONTACT_LIMIT'; end if;
  if exists(select 1 from private.customer_order_submissions where device_hash=v_device_hash and slot_key=v_slot_key and created_at>=v_now-interval '10 minutes') then raise exception 'DUPLICATE_ORDER'; end if;
  if exists(select 1 from public.orders where id=v_id or client_token=v_token) then raise exception 'DUPLICATE_TOKEN'; end if;
  insert into public.orders(id,customer_name,customer_phone,customer_wechat,date,time,duration,location,makeup_type,price,deposit,source,status,payment_status,notes,extra_services,client_token,created_at,tags)
  values(v_id,v_name,v_phone,v_wechat,v_date,v_time,v_duration,left(coalesce(p_order->>'location',''),120),v_type,v_price,v_deposit,'小程序自助下单','pending','unpaid',v_notes,v_extra,v_token,v_now::text,'[]'::jsonb);
  insert into private.customer_order_submissions(device_hash,contact_hash,order_id,slot_key,created_at) values(v_device_hash,v_contact_hash,v_id,v_slot_key,v_now);
  return jsonb_build_object('ok',true,'id',v_id,'created_at',v_now);
end; $$;
revoke all on function public.submit_customer_order(jsonb,text,text) from public;
grant execute on function public.submit_customer_order(jsonb,text,text) to anon, authenticated;

create or replace function public.validate_miniapp_order() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_rules jsonb; v_config jsonb; v_types jsonb; v_start int; v_end int; v_order int; v_deposit real;
begin
  if new.source<>'小程序自助下单' then return new; end if;
  select booking_rules,miniapp_config,makeup_types into v_rules,v_config,v_types from public.settings where id=1;
  if not exists(select 1 from jsonb_array_elements(coalesce(v_types,'[]'::jsonb)) item where item->>'name'=new.makeup_type) then raise exception 'MAKEUP_TYPE_INVALID'; end if;
  if coalesce(v_rules->'blockedDates','[]'::jsonb)?new.date then raise exception 'DATE_BLOCKED'; end if;
  if new.date::date>current_date+least(365,greatest(1,coalesce((v_config->>'maxDaysAhead')::int,365))) then raise exception 'DATE_TOO_FAR'; end if;
  v_start:=split_part(coalesce(v_rules->'workingHours'->>'start','07:00'),':',1)::int*60+split_part(coalesce(v_rules->'workingHours'->>'start','07:00'),':',2)::int;
  v_end:=split_part(coalesce(v_rules->'workingHours'->>'end','18:00'),':',1)::int*60+split_part(coalesce(v_rules->'workingHours'->>'end','18:00'),':',2)::int;
  v_order:=split_part(new.time,':',1)::int*60+split_part(new.time,':',2)::int;
  if v_order<v_start or v_order+ceil(new.duration*60)>v_end then raise exception 'OUTSIDE_WORK_HOURS'; end if;
  v_deposit:=coalesce((v_config->>'depositAmount')::real,18);
  if abs(coalesce(new.deposit,0)-v_deposit)>.01 then raise exception 'DEPOSIT_INVALID'; end if;
  return new;
end; $$;
drop trigger if exists validate_miniapp_order_before_insert on public.orders;
create trigger validate_miniapp_order_before_insert before insert on public.orders for each row execute function public.validate_miniapp_order();
revoke all on function public.validate_miniapp_order() from public,anon,authenticated;

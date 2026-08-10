-- 小荷预约系统：安全升级脚本
-- 先在 Supabase Authentication > Users 创建管理员，再在 SQL Editor 执行本文件。

begin;

alter table public.settings add column if not exists price_rules jsonb;
alter table public.settings add column if not exists announcements jsonb default '[]'::jsonb;
alter table public.orders add column if not exists client_token text;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.settings enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "admins see own membership" on public.admin_users;
create policy "admins see own membership"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "public can read orders" on public.orders;
drop policy if exists "public can modify orders" on public.orders;
drop policy if exists "允许所有人读写订单" on public.orders;
drop policy if exists "允许所有人读写设置" on public.settings;
drop policy if exists "customers submit orders" on public.orders;
drop policy if exists "admins manage orders" on public.orders;
drop policy if exists "public reads booking settings" on public.settings;
drop policy if exists "admins manage settings" on public.settings;

create policy "customers submit orders"
on public.orders for insert
to anon, authenticated
with check (
  char_length(customer_name) between 1 and 40
  and date ~ '^\d{4}-\d{2}-\d{2}$'
  and time ~ '^\d{2}:\d{2}$'
  and duration between 0.5 and 8
  and price between 0 and 10000
  and status = 'pending'
  and payment_status = 'unpaid'
  and char_length(coalesce(client_token, '')) >= 20
);

create policy "admins manage orders"
on public.orders for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

create policy "public reads booking settings"
on public.settings for select
to anon, authenticated
using (id = 1);

create policy "admins manage settings"
on public.settings for all
to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- 客户只能看到已占用时间，不会读到姓名、手机号、微信等资料。
create or replace function public.get_booked_slots(p_date text)
returns table("time" text, duration real)
language sql security definer set search_path = public
as $$
  select o.time as "time", o.duration from public.orders o
  where o.date = p_date and o.status = 'confirmed';
$$;

create or replace function public.get_order_status(p_id text, p_token text)
returns table(status text)
language sql security definer set search_path = public
as $$
  select o.status from public.orders o
  where o.id = p_id and o.client_token = p_token
  limit 1;
$$;

create or replace function public.cancel_customer_order(p_id text, p_token text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.orders
  set status = 'cancelled'
  where id = p_id and client_token = p_token and status in ('pending', 'confirmed');
  return found;
end;
$$;

revoke all on function public.get_booked_slots(text) from public;
revoke all on function public.get_order_status(text, text) from public;
revoke all on function public.cancel_customer_order(text, text) from public;
grant execute on function public.get_booked_slots(text) to anon, authenticated;
grant execute on function public.get_order_status(text, text) to anon, authenticated;
grant execute on function public.cancel_customer_order(text, text) to anon, authenticated;

commit;

-- 最后执行下面这句，把邮箱换成你在 Authentication 中创建的管理员邮箱：
-- insert into public.admin_users(user_id)
-- select id from auth.users where email = 'your-admin@example.com'
-- on conflict (user_id) do nothing;

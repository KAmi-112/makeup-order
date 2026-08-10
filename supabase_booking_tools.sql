-- 小荷预约工具：标签、接单规则、提醒模板与隐私友好的操作记录。
-- 已通过 Supabase migration 应用；此文件用于代码仓库留档。

alter table public.orders
  add column if not exists tags jsonb not null default '[]'::jsonb;

alter table public.orders drop constraint if exists orders_tags_is_array;
alter table public.orders
  add constraint orders_tags_is_array check (jsonb_typeof(tags) = 'array');

alter table public.settings
  add column if not exists booking_rules jsonb not null default
    '{"blockedDates":[],"workingHours":{"start":"07:00","end":"18:00"},"bufferMinutes":30}'::jsonb,
  add column if not exists reminder_templates jsonb not null default
    '[{"id":"confirm","name":"预约确认","content":"您好 {name}，您的小荷妆造预约已确认：{date} {time}，项目：{type}，地点：{location}。期待见到您。"},{"id":"before","name":"到店提醒","content":"您好 {name}，温馨提醒：您预约了 {date} {time} 的 {type}，地点：{location}，请提前 10 分钟到达。"},{"id":"balance","name":"尾款提醒","content":"您好 {name}，您的预约总价为 ¥{price}，已付定金 ¥{deposit}，待付尾款 ¥{balance}。感谢您的信任。"}]'::jsonb;

alter table public.order_audit_logs
  drop constraint if exists order_audit_logs_action_check;
alter table public.order_audit_logs
  add constraint order_audit_logs_action_check
  check (action in ('create', 'update', 'trash', 'restore', 'permanent_delete'));

create or replace function public.log_order_recycle_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare audit_action text;
begin
  if tg_op = 'INSERT' then audit_action := 'create';
  elsif tg_op = 'DELETE' then audit_action := 'permanent_delete';
  elsif old.deleted_at is null and new.deleted_at is not null then audit_action := 'trash';
  elsif old.deleted_at is not null and new.deleted_at is null then audit_action := 'restore';
  else audit_action := 'update';
  end if;
  insert into public.order_audit_logs(order_id, action, actor_id)
  values (coalesce(new.id, old.id), audit_action, auth.uid());
  return coalesce(new, old);
end;
$$;

drop trigger if exists orders_recycle_audit on public.orders;
create trigger orders_recycle_audit
after insert or update or delete on public.orders
for each row execute function public.log_order_recycle_action();

revoke all on function public.log_order_recycle_action() from public;


-- 客妹凭订单专属随机凭证读取最新排期；只返回同步所需的最少字段，不暴露姓名、备注或价格。
create or replace function public.get_customer_order_schedule(p_id text, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id',o.id,
    'date',o.date,
    'time',o.time,
    'duration',o.duration,
    'status',case when o.deleted_at is not null then 'cancelled' else o.status end
  )
  from public.orders o
  where o.id=p_id
    and o.client_token=p_token
    and char_length(coalesce(p_token,'')) between 24 and 80
  limit 1;
$$;

revoke all on function public.get_customer_order_schedule(text,text) from public,authenticated;
grant execute on function public.get_customer_order_schedule(text,text) to anon;

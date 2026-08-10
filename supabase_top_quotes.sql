-- Editable management-dashboard top-bar quotes.
alter table public.settings
add column if not exists top_quotes jsonb not null default '[
  "小荷才露尖尖角，今日也要从容发光",
  "清晰的档期，让每一次创作都有余裕",
  "专注手上的妆面，其余交给小荷",
  "好的服务，从认真对待每一次预约开始"
]'::jsonb;

alter table public.settings
add constraint settings_top_quotes_is_array
check (jsonb_typeof(top_quotes) = 'array') not valid;

alter table public.settings validate constraint settings_top_quotes_is_array;

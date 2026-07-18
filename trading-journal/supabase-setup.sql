-- ============================================================
-- ManiacDT Trading Journal — настройка базы данных Supabase
-- Выполните этот скрипт один раз: панель Supabase → SQL Editor
-- ============================================================

-- Таблица с данными журнала: одна строка на пользователя
create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: каждый пользователь видит только свою строку
alter table public.user_data enable row level security;

create policy "select own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

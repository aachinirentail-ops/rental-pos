-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists public.app_data (
  id         int primary key,
  data       jsonb  not null default '{}'::jsonb,
  version    bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- the app talks to Supabase only from the server with the service-role key,
-- so lock the table for everybody else (no policies = no public access)
alter table public.app_data enable row level security;

-- private bucket for item photos and customer ID photos
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

-- IPI database schema for Supabase / Postgres.
-- Run this once in the Supabase SQL editor (or via psql) BEFORE starting the server.
-- Tables use UUID primary keys with gen_random_uuid().

create extension if not exists "pgcrypto";

-- ─── users (application auth, separate from supabase.auth) ──────────────────
create table if not exists public.users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('manager','bidder','interviewer','broker')),
  created_at    timestamptz not null default now()
);

-- ─── developers (candidate pool) ────────────────────────────────────────────
create table if not exists public.developers (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  location         text default '',
  email            text default '',
  password         text default '',
  linkedin         text default '',
  cv_path          text,            -- object key in the storage bucket
  cv_original_name text,
  created_at       timestamptz not null default now()
);

-- ─── events (calendar) ──────────────────────────────────────────────────────
create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  developer_id     uuid references public.developers(id) on delete set null,
  developer_name   text default '',
  interviewer_name text default '',
  recruiter_name   text default '',
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  meeting_link     text default '',
  jd_link          text default '',
  role_title       text default '',
  company_name     text default '',
  color            text default '#3b82f6',
  status           text not null default 'scheduled'
                   check (status in ('scheduled','done','cancelled')),
  process_stage    text not null default 'intro'
                   check (process_stage in ('intro','tech','final','onboard')),
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists events_start_idx        on public.events (start_at);
create index if not exists events_interviewer_idx  on public.events (lower(interviewer_name));

-- ─── processes (pipeline) ───────────────────────────────────────────────────
create table if not exists public.processes (
  id               uuid primary key default gen_random_uuid(),
  company_name     text not null,
  role_title       text not null,
  developer_id     uuid references public.developers(id) on delete set null,
  developer_name   text default '',
  stage            text not null default 'intro'
                   check (stage in ('intro','tech','final','onboard')),
  interviewer_name text default '',
  broker_name      text default '',
  jd_link          text default '',
  notes            text default '',
  updated_at       timestamptz not null default now()
);
create index if not exists processes_broker_idx on public.processes (lower(broker_name));
create index if not exists processes_stage_idx  on public.processes (stage);

-- ─── teammates (directory) ──────────────────────────────────────────────────
create table if not exists public.teammates (
  id        uuid primary key default gen_random_uuid(),
  role      text not null check (role in ('bidder','interviewer','broker')),
  name      text not null,
  email     text default '',
  telegram  text default '',
  discord   text,
  whatsapp  text
);

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- We use the SERVICE ROLE key from the server, which bypasses RLS.
-- RLS stays disabled (default) so a misconfigured anon key cannot read data.
alter table public.users      enable row level security;
alter table public.developers enable row level security;
alter table public.events     enable row level security;
alter table public.processes  enable row level security;
alter table public.teammates  enable row level security;
-- No policies are created intentionally; only service_role can read/write.

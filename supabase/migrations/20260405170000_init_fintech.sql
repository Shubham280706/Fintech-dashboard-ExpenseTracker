create table if not exists public.users (
  user_id text primary key,
  email text not null unique,
  name text not null,
  picture text,
  password_hash text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_sessions (
  session_token text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  transaction_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  type text not null,
  category text not null,
  amount double precision not null,
  description text not null,
  recipient text,
  date timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.budgets (
  budget_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  category text not null,
  "limit" double precision not null,
  spent double precision not null default 0,
  period text not null default 'monthly',
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists budgets_user_category_idx
  on public.budgets (user_id, category);

create table if not exists public.alerts (
  alert_id text primary key,
  user_id text not null references public.users(user_id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

create index if not exists alerts_user_created_idx
  on public.alerts (user_id, created_at desc);

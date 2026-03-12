-- ============================================================
-- TokoAkun — Migration: Policies, Triggers, Indexes, Storage
-- Aman dijalankan meski tabel sudah ada (IF NOT EXISTS/OR REPLACE)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- 2. Enums (skip if already exist)
-- ─────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('buyer', 'seller', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('available', 'sold', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'cancelled');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- 3. Tables (skip if already exist)
-- ─────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null,
  email       text        not null unique,
  role        user_role   not null default 'buyer',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.accounts (
  id               uuid primary key default uuid_generate_v4(),
  seller_id        uuid not null references public.users(id) on delete cascade,
  buyer_id         uuid references public.users(id),
  title            text          not null,
  category         text          not null,
  description      text,
  price            numeric(12,0) not null check (price >= 0),
  thumbnail_url    text,
  email_account    text          not null,
  password_account text          not null,
  status           account_status not null default 'available',
  sold_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.orders (
  id                 uuid primary key default uuid_generate_v4(),
  buyer_id           uuid not null references public.users(id) on delete restrict,
  status             order_status not null default 'pending',
  total_price        numeric(12,0) not null default 0,
  mayar_invoice_id   text,
  mayar_payment_url  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete restrict,
  price       numeric(12,0) not null default 0,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────
create index if not exists idx_accounts_seller_id  on public.accounts(seller_id);
create index if not exists idx_accounts_status     on public.accounts(status);
create index if not exists idx_accounts_category   on public.accounts(category);
create index if not exists idx_orders_buyer_id     on public.orders(buyer_id);
create index if not exists idx_orders_status       on public.orders(status);
create index if not exists idx_order_items_order   on public.order_items(order_id);
create index if not exists idx_order_items_account on public.order_items(account_id);

-- ─────────────────────────────────────────────
-- 5. updated_at trigger function
-- ─────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at    on public.users;
drop trigger if exists trg_accounts_updated_at on public.accounts;
drop trigger if exists trg_orders_updated_at   on public.orders;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────
alter table public.users       enable row level security;
alter table public.accounts    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Helper function
create or replace function public.get_my_role()
returns user_role language sql stable security definer as $$
  select role from public.users where id = auth.uid();
$$;

-- ── Drop existing policies before recreating ──
do $$ declare r record; begin
  for r in (select policyname, tablename from pg_policies where schemaname = 'public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── users policies ──
create policy "users: read own"
  on public.users for select using (id = auth.uid());

create policy "users: update own"
  on public.users for update using (id = auth.uid());

create policy "users: insert on register"
  on public.users for insert with check (id = auth.uid());

create policy "users: admin read all"
  on public.users for select using (public.get_my_role() = 'admin');

create policy "users: admin delete"
  on public.users for delete using (public.get_my_role() = 'admin');

-- ── accounts policies ──
create policy "accounts: public read available"
  on public.accounts for select using (status = 'available');

create policy "accounts: buyer read own sold"
  on public.accounts for select using (buyer_id = auth.uid() and status = 'sold');

create policy "accounts: seller read own"
  on public.accounts for select using (seller_id = auth.uid());

create policy "accounts: seller insert"
  on public.accounts for insert
  with check (seller_id = auth.uid() and public.get_my_role() = 'seller');

create policy "accounts: seller update own"
  on public.accounts for update
  using (seller_id = auth.uid() and status = 'available');

create policy "accounts: seller delete own"
  on public.accounts for delete
  using (seller_id = auth.uid() and status = 'available');

create policy "accounts: admin all"
  on public.accounts for all
  using (public.get_my_role() = 'admin');

-- ── orders policies ──
create policy "orders: buyer read own"
  on public.orders for select using (buyer_id = auth.uid());

create policy "orders: buyer insert"
  on public.orders for insert with check (buyer_id = auth.uid());

create policy "orders: buyer update pending"
  on public.orders for update
  using (buyer_id = auth.uid() and status = 'pending');

create policy "orders: admin all"
  on public.orders for all using (public.get_my_role() = 'admin');

-- ── order_items policies ──
create policy "order_items: buyer read own"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.buyer_id = auth.uid()
    )
  );

create policy "order_items: buyer insert"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.buyer_id = auth.uid()
    )
  );

create policy "order_items: admin all"
  on public.order_items for all using (public.get_my_role() = 'admin');

create policy "order_items: seller read own"
  on public.order_items for select
  using (
    exists (
      select 1 from public.accounts
      where accounts.id = order_items.account_id
        and accounts.seller_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 7. Storage bucket
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "thumbnails: seller upload" on storage.objects;
drop policy if exists "thumbnails: public read"   on storage.objects;

create policy "thumbnails: seller upload"
  on storage.objects for insert
  with check (bucket_id = 'thumbnails' and auth.role() = 'authenticated');

create policy "thumbnails: public read"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

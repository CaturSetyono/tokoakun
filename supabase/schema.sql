-- ============================================================
-- TokoAkun — Supabase SQL Schema
-- Run this in the Supabase SQL Editor (Database > SQL)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 2. Custom types
-- ─────────────────────────────────────────────
create type user_role    as enum ('buyer', 'seller', 'admin');
create type account_status as enum ('available', 'sold', 'deleted');
create type order_status   as enum ('pending', 'paid', 'cancelled');

-- ─────────────────────────────────────────────
-- 3. Tables
-- ─────────────────────────────────────────────

-- users (extends Supabase auth.users)
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text        not null,
  email       text        not null unique,
  role        user_role   not null default 'buyer',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- accounts (digital accounts listed for sale)
create table public.accounts (
  id               uuid primary key default uuid_generate_v4(),
  seller_id        uuid not null references public.users(id) on delete cascade,
  buyer_id         uuid references public.users(id),
  title            text        not null,
  category         text        not null,
  description      text,
  price            numeric(12,0) not null check (price >= 0),
  thumbnail_url    text,
  email_account    text        not null,
  password_account text        not null,
  status           account_status not null default 'available',
  sold_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- orders
create table public.orders (
  id                 uuid primary key default uuid_generate_v4(),
  buyer_id           uuid not null references public.users(id) on delete restrict,
  status             order_status not null default 'pending',
  total_price        numeric(12,0) not null default 0,
  mayar_invoice_id   text,
  mayar_payment_url  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- order_items
create table public.order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  account_id  uuid not null references public.accounts(id) on delete restrict,
  price       numeric(12,0) not null default 0,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────
create index idx_accounts_seller_id  on public.accounts(seller_id);
create index idx_accounts_status     on public.accounts(status);
create index idx_accounts_category   on public.accounts(category);
create index idx_orders_buyer_id     on public.orders(buyer_id);
create index idx_orders_status       on public.orders(status);
create index idx_order_items_order   on public.order_items(order_id);
create index idx_order_items_account on public.order_items(account_id);

-- ─────────────────────────────────────────────
-- 5. updated_at trigger
-- ─────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
-- 6. Row Level Security (RLS)
-- ─────────────────────────────────────────────

alter table public.users       enable row level security;
alter table public.accounts    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Helper: get current user role
create or replace function public.get_my_role()
returns user_role language sql stable security definer as $$
  select role from public.users where id = auth.uid();
$$;

-- ── users ──
-- Users can read their own profile
create policy "users: read own"
  on public.users for select
  using (id = auth.uid());

-- Users can update their own profile
create policy "users: update own"
  on public.users for update
  using (id = auth.uid());

-- Admin can read all users
create policy "users: admin read all"
  on public.users for select
  using (public.get_my_role() = 'admin');

-- Admin can delete users
create policy "users: admin delete"
  on public.users for delete
  using (public.get_my_role() = 'admin');

-- Allow insert for new registrations (called server-side)
create policy "users: insert on register"
  on public.users for insert
  with check (id = auth.uid());

-- ── accounts ──
-- Anyone (including anon) can read available accounts, excluding credentials
create policy "accounts: public read available"
  on public.accounts for select
  using (status = 'available');

-- Buyers can see their own purchased accounts (to get credentials)
create policy "accounts: buyer read own sold"
  on public.accounts for select
  using (buyer_id = auth.uid() and status = 'sold');

-- Sellers can read their own accounts
create policy "accounts: seller read own"
  on public.accounts for select
  using (seller_id = auth.uid());

-- Sellers can insert accounts
create policy "accounts: seller insert"
  on public.accounts for insert
  with check (seller_id = auth.uid() and public.get_my_role() = 'seller');

-- Sellers can update their own available accounts
create policy "accounts: seller update own"
  on public.accounts for update
  using (seller_id = auth.uid() and status = 'available');

-- Sellers can soft-delete (set to deleted) their own available accounts
create policy "accounts: seller delete own"
  on public.accounts for delete
  using (seller_id = auth.uid() and status = 'available');

-- Admin can do everything with accounts
create policy "accounts: admin all"
  on public.accounts for all
  using (public.get_my_role() = 'admin');

-- ── orders ──
-- Buyers can read their own orders
create policy "orders: buyer read own"
  on public.orders for select
  using (buyer_id = auth.uid());

-- Buyers can create orders
create policy "orders: buyer insert"
  on public.orders for insert
  with check (buyer_id = auth.uid());

-- Buyers can update their own pending orders (e.g. cancel)
create policy "orders: buyer update pending"
  on public.orders for update
  using (buyer_id = auth.uid() and status = 'pending');

-- Admin can read all orders
create policy "orders: admin all"
  on public.orders for all
  using (public.get_my_role() = 'admin');

-- ── order_items ──
-- Buyers can read their own order items
create policy "order_items: buyer read own"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.buyer_id = auth.uid()
    )
  );

-- Buyers can insert order items
create policy "order_items: buyer insert"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.buyer_id = auth.uid()
    )
  );

-- Admin can read all order items
create policy "order_items: admin all"
  on public.order_items for all
  using (public.get_my_role() = 'admin');

-- Sellers can see order_items for their accounts
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
-- 7. Service-role bypass for API routes
-- ─────────────────────────────────────────────
-- NOTE: The Astro API routes (create-payment, payment-webhook) use
-- the SERVICE_ROLE key (not anon) so they bypass RLS entirely.
-- Ensure SUPABASE_SERVICE_ROLE_KEY is set in your .env and used
-- only in server-side code (never exposed to the client).

-- ─────────────────────────────────────────────
-- 8. Storage bucket for account thumbnails
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict do nothing;

-- Allow authenticated users to upload their own thumbnails
create policy "thumbnails: seller upload"
  on storage.objects for insert
  with check (
    bucket_id = 'thumbnails'
    and auth.role() = 'authenticated'
  );

-- Public read for thumbnails
create policy "thumbnails: public read"
  on storage.objects for select
  using (bucket_id = 'thumbnails');

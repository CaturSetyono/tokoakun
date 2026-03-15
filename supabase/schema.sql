-- ============================================================
-- TOKOAKUN — CLEAN SCHEMA (CUSTOM AUTH VERSION)
-- Supabase used only as PostgreSQL database
-- ============================================================


-- ─────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────

create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────
-- 2. Custom types
-- ─────────────────────────────────────────────

create type user_role as enum ('buyer','admin');

create type account_status as enum (
  'available',
  'sold',
  'deleted'
);

create type order_status as enum (
  'pending',
  'paid',
  'cancelled'
);


-- ─────────────────────────────────────────────
-- 3. USERS TABLE (CUSTOM AUTH)
-- ─────────────────────────────────────────────

create table public.users (

  id uuid primary key default uuid_generate_v4(),

  name text not null,

  email text not null unique,

  password_hash text not null,

  role user_role not null default 'buyer',

  avatar_url text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ─────────────────────────────────────────────
-- 4. ACCOUNTS (DIGITAL ACCOUNTS SOLD BY SELLERS)
-- ─────────────────────────────────────────────

create table public.accounts (

  id uuid primary key default uuid_generate_v4(),

  seller_id uuid not null references public.users(id) on delete cascade,

  buyer_id uuid references public.users(id),

  title text not null,

  category text not null,

  description text,

  price numeric(12,0) not null check (price >= 0),

  thumbnail_url text,

  email_account text not null,

  password_account text not null,

  status account_status not null default 'available',

  sold_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ─────────────────────────────────────────────
-- 5. ORDERS
-- ─────────────────────────────────────────────

create table public.orders (

  id uuid primary key default uuid_generate_v4(),

  buyer_id uuid not null references public.users(id) on delete restrict,

  status order_status not null default 'pending',

  total_price numeric(12,0) not null default 0,

  mayar_invoice_id text,

  mayar_payment_url text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()

);


-- ─────────────────────────────────────────────
-- 6. ORDER ITEMS
-- ─────────────────────────────────────────────

create table public.order_items (

  id uuid primary key default uuid_generate_v4(),

  order_id uuid not null references public.orders(id) on delete cascade,

  account_id uuid not null references public.accounts(id) on delete restrict,

  price numeric(12,0) not null,

  created_at timestamptz not null default now()

);


-- ─────────────────────────────────────────────
-- 7. INDEXES (PERFORMANCE)
-- ─────────────────────────────────────────────

create index idx_users_email on public.users(email);

create index idx_accounts_seller_id on public.accounts(seller_id);
create index idx_accounts_status on public.accounts(status);
create index idx_accounts_category on public.accounts(category);

create index idx_orders_buyer_id on public.orders(buyer_id);
create index idx_orders_status on public.orders(status);

create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_account on public.order_items(account_id);


-- ─────────────────────────────────────────────
-- 8. UPDATED_AT AUTO TRIGGER
-- ─────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
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
-- 9. STORAGE BUCKET (ACCOUNT THUMBNAILS)
-- ─────────────────────────────────────────────

insert into storage.buckets (id,name,public)
values ('thumbnails','thumbnails',true)
on conflict do nothing;
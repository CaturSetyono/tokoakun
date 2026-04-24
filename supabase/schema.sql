-- ============================================================
-- TOKOAKUN — 4-NICHE CATALOG SCHEMA
-- Custom JWT auth (Supabase used only as PostgreSQL database)
-- ============================================================


-- ─────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────

create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────
-- 2. Enums
-- ─────────────────────────────────────────────

create type user_role as enum ('admin','buyer');

create type product_niche as enum ('social_media','premium_apps','jasa');

create type product_status as enum ('draft','active','archived');

create type variant_status as enum ('active','archived');

create type credential_status as enum ('available','reserved','delivered');

create type order_status as enum ('pending','paid','processing','completed','cancelled');

create type order_item_status as enum ('pending','processing','delivered','cancelled');

create type reseller_app_status as enum ('pending','approved','rejected');


-- ─────────────────────────────────────────────
-- 3. Users (custom auth)
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
-- 4. Products — unified catalog across 4 niches
-- ─────────────────────────────────────────────

create table public.products (
  id uuid primary key default uuid_generate_v4(),
  niche product_niche not null,
  slug text not null unique,
  title text not null,
  description text,
  thumbnail_url text,
  gallery_urls text[] not null default '{}',
  status product_status not null default 'draft',
  featured boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────
-- 5. Product variants — price tiers/packages
-- ─────────────────────────────────────────────
-- Premium Apps → is_unlimited_stock=false, stock tracked via product_credentials
-- Social Media / Jasa → is_unlimited_stock=true (service fulfilled manually)

create table public.product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric(12,0) not null check (price >= 0),
  sort_order int not null default 0,
  is_unlimited_stock boolean not null default false,
  stock_cached int not null default 0,
  status variant_status not null default 'active',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────
-- 6. Product credentials — Premium Apps inventory only
-- ─────────────────────────────────────────────
-- Race condition note: when reserving during checkout, use
--   SELECT ... FOR UPDATE SKIP LOCKED
-- so two concurrent buyers of the same variant never grab the same row.

create table public.product_credentials (
  id uuid primary key default uuid_generate_v4(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  email text not null,
  password text not null,
  extra_notes text,
  status credential_status not null default 'available',
  order_item_id uuid,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────
-- 7. Product requirements — dynamic buyer input schema
-- ─────────────────────────────────────────────
-- Social Media → seed target_url. Jasa → seed brief. Premium Apps → empty.

create table public.product_requirements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type text not null default 'text' check (field_type in ('text','url','textarea')),
  required boolean not null default true,
  placeholder text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, field_key)
);


-- ─────────────────────────────────────────────
-- 8. Cart items — persistent per user
-- ─────────────────────────────────────────────

create table public.cart_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  buyer_input jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, variant_id)
);


-- ─────────────────────────────────────────────
-- 9. Orders + order items
-- ─────────────────────────────────────────────

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references public.users(id) on delete restrict,
  status order_status not null default 'pending',
  total_price numeric(12,0) not null default 0 check (total_price >= 0),
  buyer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_snapshot jsonb not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12,0) not null check (unit_price >= 0),
  line_total numeric(12,0) not null check (line_total >= 0),
  buyer_input jsonb not null default '{}'::jsonb,
  status order_item_status not null default 'pending',
  fulfillment_note text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────
-- 10. Reseller applications — separate funnel, no role change
-- ─────────────────────────────────────────────

create table public.reseller_applications (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  email text not null,
  phone text not null,
  city text,
  experience text,
  motivation text,
  status reseller_app_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ─────────────────────────────────────────────
-- 11. Indexes
-- ─────────────────────────────────────────────

create index idx_users_email on public.users(email);

create index idx_products_niche_status on public.products(niche, status);
create index idx_products_slug on public.products(slug);
create index idx_products_featured on public.products(featured) where featured = true;

create index idx_product_variants_product_status on public.product_variants(product_id, status);

create index idx_product_credentials_variant_status on public.product_credentials(variant_id, status);

create index idx_product_requirements_product on public.product_requirements(product_id, sort_order);

create index idx_cart_items_user on public.cart_items(user_id);

create index idx_orders_buyer on public.orders(buyer_id);
create index idx_orders_status on public.orders(status);

create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_variant on public.order_items(variant_id);
create index idx_order_items_status on public.order_items(status);

create index idx_reseller_applications_status on public.reseller_applications(status, created_at desc);


-- ─────────────────────────────────────────────
-- 12. updated_at auto trigger
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

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.handle_updated_at();

create trigger trg_product_variants_updated_at
before update on public.product_variants
for each row execute function public.handle_updated_at();

create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.handle_updated_at();

create trigger trg_order_items_updated_at
before update on public.order_items
for each row execute function public.handle_updated_at();

create trigger trg_reseller_applications_updated_at
before update on public.reseller_applications
for each row execute function public.handle_updated_at();


-- ─────────────────────────────────────────────
-- 13. reserve_credentials RPC — atomic credential reservation for checkout
-- ─────────────────────────────────────────────
-- Reserves `needed` available credentials for the given variant, returning
-- the reserved credential IDs. Uses FOR UPDATE SKIP LOCKED so concurrent
-- checkouts never grab the same row. Returns fewer rows than requested if
-- stock is insufficient — caller MUST check the length and abort + release.

create or replace function public.reserve_credentials(
  p_variant_id uuid,
  p_needed int
) returns uuid[]
language plpgsql
as $$
declare
  reserved_ids uuid[];
begin
  with picked as (
    select id
    from public.product_credentials
    where variant_id = p_variant_id
      and status = 'available'
    order by created_at asc
    for update skip locked
    limit p_needed
  ),
  updated as (
    update public.product_credentials c
    set status = 'reserved'
    from picked
    where c.id = picked.id
    returning c.id
  )
  select array_agg(id) into reserved_ids from updated;

  return coalesce(reserved_ids, '{}'::uuid[]);
end;
$$;


-- ─────────────────────────────────────────────
-- 14. Storage bucket (thumbnails + gallery)
-- ─────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('thumbnails','thumbnails', true)
on conflict do nothing;

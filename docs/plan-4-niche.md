# Revisi Toko Akun — 4-Niche Catalog Platform

## Context

Toko Akun saat ini adalah marketplace satu-niche (akun digital: streaming, game, premium services) dengan model "satu akun unik = sekali jual". User ingin mengubahnya jadi platform dengan **4 katalog niche**:

1. **Social Media Solution** — jasa boost followers/likes/komen untuk FB, IG, TikTok, dll. (stok tak terbatas, buyer isi target URL)
2. **Premium Apps** — akun premium berlangganan (Netflix, Spotify, dsb.) — model paling dekat dengan `accounts` existing (kredensial unik, sekali jual)
3. **Jasa** — layanan umum (desain, dev, editing) — buyer isi brief, stok tak terbatas
4. **Join Reseller** — bukan katalog produk; landing page + form pendaftaran ke tabel `reseller_applications` untuk di-review admin

Keputusan yang sudah disepakati:
- **Model produk**: varian/paket dengan harga berjenjang (satu produk → banyak variant)
- **Checkout**: pakai keranjang (multi-item cart), bukan single-product buy
- **Migrasi**: overhaul total — skema lama dibuang, buat dari nol
- **Reseller**: landing + form yang simpan ke tabel baru (bukan role baru)

Outcome: satu platform dengan 4 pintu masuk niche, UI per-niche yang sesuai, fulfillment berbeda per niche (Premium Apps kirim kredensial via email, SocMed/Jasa admin mark-done manual), dan funnel reseller terpisah.

---

## A. Skema Database Baru (`supabase/schema.sql` — full rewrite)

Drop semua tabel existing (kecuali `users`, yang tetap dipakai auth JWT custom di `src/lib/auth.ts`). Role enum tetap `('admin','buyer')` — reseller bukan role, hanya aplikasi.

### Enums

- `product_niche`: `'social_media' | 'premium_apps' | 'jasa'`
- `product_status`: `'draft' | 'active' | 'archived'`
- `variant_status`: `'active' | 'archived'`
- `credential_status`: `'available' | 'reserved' | 'delivered'`
- `order_status`: `'pending' | 'paid' | 'processing' | 'completed' | 'cancelled'`
- `order_item_status`: `'pending' | 'processing' | 'delivered' | 'cancelled'`
- `reseller_app_status`: `'pending' | 'approved' | 'rejected'`

### Tabel

1. **`products`** — katalog unified
   - `id uuid PK`, `niche product_niche`, `slug text unique`, `title`, `description` (markdown), `thumbnail_url`, `gallery_urls text[]`, `status product_status default 'draft'`, `featured bool default false`, `meta jsonb` (platform=instagram, app_name=Netflix, dsb.), `created_at`, `updated_at`

2. **`product_variants`** — paket/tier harga
   - `id uuid PK`, `product_id FK`, `name text` (mis. "1000 Followers", "Paket Basic"), `price numeric(12,0)`, `sort_order int`, `is_unlimited_stock bool default false`, `stock_cached int default 0`, `status variant_status default 'active'`, `meta jsonb`
   - Premium Apps → `is_unlimited_stock=false`, stok dari `product_credentials`
   - Social Media / Jasa → `is_unlimited_stock=true`

3. **`product_credentials`** — hanya untuk Premium Apps
   - `id`, `variant_id FK`, `email text`, `password text`, `extra_notes text`, `status credential_status default 'available'`, `order_item_id uuid` (nullable), `delivered_at`
   - Index: `(variant_id, status)`

4. **`product_requirements`** — schema input buyer saat checkout per-produk
   - `id`, `product_id FK`, `field_key text` (mis. `target_url`, `brief`, `username`), `label text`, `field_type text` (`'text'|'url'|'textarea'`), `required bool`, `placeholder`, `sort_order`
   - Social Media → seed `target_url`. Jasa → seed `brief`. Premium Apps → kosong.

5. **`cart_items`** — keranjang persistent per user
   - `id`, `user_id FK`, `variant_id FK`, `quantity int default 1`, `buyer_input jsonb default '{}'`, `created_at`
   - Unique: `(user_id, variant_id)`

6. **`orders`** — `id`, `buyer_id FK`, `status order_status`, `total_price`, `buyer_note text`, timestamps

7. **`order_items`** — `id`, `order_id FK`, `variant_id FK on delete restrict`, `product_snapshot jsonb` (title/niche/variant/price frozen), `quantity`, `unit_price`, `line_total`, `buyer_input jsonb`, `status order_item_status default 'pending'`, `fulfillment_note text`, `delivered_at`

8. **`reseller_applications`** — `id`, `full_name`, `email`, `phone`, `city`, `experience text`, `motivation text`, `status reseller_app_status default 'pending'`, `reviewed_by FK users`, `reviewed_at`, `admin_note text`, `created_at`

### Indexes
`products(niche, status)`, `products(slug)`, `product_variants(product_id, status)`, `product_credentials(variant_id, status)`, `cart_items(user_id)`, `order_items(order_id)`, `order_items(status)`, `reseller_applications(status, created_at desc)`

### Trigger
Reuse pola `handle_updated_at()` untuk `products`, `product_variants`, `orders`, `order_items`, `reseller_applications`.

### Risiko
- **Race condition reservasi kredensial**: dua buyer checkout variant yang sama tidak boleh dapat row yang sama. Gunakan transaksi di `/api/checkout` dengan `FOR UPDATE SKIP LOCKED`. Dokumentasikan via comment di schema.
- Schema harus landing **sebelum** app code pakai tabel baru. Urutan: schema → regen `database.types.ts` → app code.

---

## B. Route & Page Restructure

### Dihapus
- `src/pages/shop/index.astro`, `src/pages/shop/[id].astro` (diganti per-niche)
- Semua `src/pages/dashboard/seller/**` dan `src/pages/api/seller/**` (seller dihapus dari dashboard; admin yang kelola produk)
- `src/pages/dashboard/admin/sellers.astro`
- `src/pages/api/create-manual-order.ts`

### Ditambah
- `src/pages/index.astro` — rewrite hero + 4 niche entry cards
- `src/pages/shop/social-media/index.astro` + `[slug].astro`
- `src/pages/shop/premium-apps/index.astro` + `[slug].astro`
- `src/pages/shop/jasa/index.astro` + `[slug].astro`
- `src/pages/reseller/index.astro` — landing + form POST ke `/api/reseller/apply`
- `src/pages/cart.astro` — list item dari `cart_items` grouped by niche, edit qty + buyer_input
- `src/pages/checkout.astro` — konfirmasi + instruksi pembayaran manual + "Place Order"
- `src/pages/order/[id].astro` — status order buyer (per-item)

### Komponen baru
- `src/components/ProductDetail.astro` — render variant picker + dynamic input dari `product_requirements` (satu komponen untuk semua niche)
- `src/components/ProductCard.astro` (rename dari `AccountCard.astro`) — harga = `min(variant.price)`, badge = label niche
- `src/components/Navbar.astro` — ubah jadi dropdown "Shop" (Social Media / Premium Apps / Jasa / divider / Join Reseller) + cart icon dengan badge count

---

## C. API Changes (`src/pages/api/**`)

### Baru
- `POST /api/cart/add` — `{ variantId, quantity, buyerInput }`; validasi `buyerInput` terhadap `product_requirements`; upsert ke `cart_items`
- `PATCH /api/cart/[id]` — update qty / buyer input
- `DELETE /api/cart/[id]`
- `POST /api/checkout` — transaksional:
  1. Load cart + variants + products + requirements
  2. Re-validate buyer input & stock
  3. Premium Apps items → reserve kredensial via `FOR UPDATE SKIP LOCKED`; batal semua jika kurang
  4. Insert `orders` (pending) + `order_items` dengan `product_snapshot` frozen
  5. Set `product_credentials.order_item_id` + status `'reserved'`
  6. Kosongkan cart rows
  7. Return `orderId`
- `POST /api/admin/orders/[id]/mark-paid` — flip order jadi `'paid'`; Premium Apps items → flip credential `'delivered'` + item `'delivered'` + trigger email webhook; SocMed/Jasa items → status `'processing'`
- `POST /api/admin/order-items/[id]/complete` — untuk SocMed/Jasa: set `'delivered'` + `fulfillment_note`; kalau semua items delivered → order `'completed'`
- `POST /api/admin/order-items/[id]/cancel` — release credential yang di-reserve
- `POST /api/reseller/apply` — publik, rate-limited by IP/email
- `POST /api/admin/reseller-applications/[id]/review` — `{ status, admin_note }`

### Refactor
- `src/lib/order-email.ts` → `sendPremiumAppsEmail(orderItemId)` — hanya select Premium Apps items + credentials-nya; payload ke `APPSCRIPT_WEBHOOK_URL` (env var tetap). SocMed/Jasa skip.
- Auth: reuse `requireAuth` / `requireAdmin` dari `src/lib/auth.ts`. Cart & checkout = `requireAuth`. Admin endpoints = `requireAdmin`. Reseller apply = publik.

---

## D. Admin Dashboard Restructure

Reuse `src/layouts/DashboardLayout.astro` + `src/components/DashboardSidebar.astro`. Rewrite menu jadi: Overview, Products, Orders, Reseller Applications, Users.

- `dashboard/admin/index.astro` — stat per niche + pending orders + pending applications
- `dashboard/admin/products/index.astro` — tabel dengan filter niche
- `dashboard/admin/products/new.astro` — niche picker dulu (radio); form swap per niche; simpan product + variant awal + requirements default
- `dashboard/admin/products/[id]/edit.astro` — edit meta produk
- `dashboard/admin/products/[id]/variants.astro` — CRUD variant
- `dashboard/admin/products/[id]/credentials.astro` — **hanya Premium Apps**; bulk paste email:password per line
- `dashboard/admin/orders.astro` — expand row → per-item niche badge + tombol aksi sesuai niche ("Send credentials" | "Mark done + note")
- `dashboard/admin/reseller-applications.astro` — queue review approve/reject + note
- `dashboard/admin/users.astro` — tetap sebagian besar

---

## E. Seeding

Perluas `scripts/setup-db.mjs` (atau buat `scripts/seed-demo.mjs` baru) untuk insert setelah schema load:
- 2 Social Media products (Instagram Followers, TikTok Views) × 3 variants + requirement `target_url`
- 2 Premium Apps (Netflix, Spotify) × 1–2 variants + ~5 kredensial per variant
- 2 Jasa (Landing Page, Logo Design) × 2 variants + requirement `brief`
- 1 admin user (reuse pola seeding existing)

---

## F. Migration Strategy

1. Rename `supabase/schema.sql` → `supabase/schema.old.sql.bak` (referensi historis)
2. Tulis `supabase/schema.sql` baru per section A
3. Jalankan `scripts/run-migration.mjs` ke Supabase dev (drop + recreate)
4. Regenerate types: `pnpm exec supabase gen types typescript` → `src/lib/database.types.ts`
5. Hapus file-file obsolete di section B & C
6. Implement niche per niche; setiap milestone `pnpm astro check`

### Sequencing (kritis)
Schema → types → `src/lib/` helpers (cart/checkout/fulfillment) → admin product CRUD → public shop pages → cart + checkout → admin orders UI → reseller pages. **Jangan** build UI shop dulu — tidak ada data untuk dirender.

---

## G. Verification Plan

Via `pnpm dev` untuk setiap niche:

1. Login admin → buat produk + variants (+ credentials untuk Premium Apps)
2. Verifikasi muncul di `/shop/<niche>` yang benar dan tidak di niche lain
3. Login buyer → buka detail produk → add to cart (isi buyer_input jika perlu) → cek row `cart_items` tersimpan
4. Checkout → cek `orders` + `order_items` tercipta; Premium Apps → cek 1 credential flip ke `'reserved'`
5. Admin mark paid:
   - Premium Apps → webhook Apps Script fire (cek console), credential `'delivered'`
   - SocMed/Jasa → item `'processing'` → admin klik "Mark done" + note → `'delivered'` → order `'completed'`
6. Submit form reseller tanpa login → row di `reseller_applications` → approve sebagai admin

Checklist akhir: `pnpm astro check` bersih, smoke test cart persist lintas logout/login, semua 4 niche E2E hijau.

---

## Critical Files

- `supabase/schema.sql` — rewrite total
- `src/lib/database.types.ts` — regenerate dari schema baru
- `src/lib/order-email.ts` — refactor jadi per-item Premium Apps only
- `src/lib/auth.ts`, `src/lib/supabaseAdmin.ts` — reuse as-is
- `src/middleware.ts` — sentuh minimal (tambah cart count ke `Astro.locals` jika perlu)
- `src/components/Navbar.astro` — dropdown Shop + cart icon
- `src/layouts/DashboardLayout.astro` — tetap
- `src/layouts/PublicLayout.astro` — tetap

## Risiko Ringkasan

- Race reservasi kredensial → wajib transactional + row lock
- `order_items.variant_id on delete restrict` + `product_snapshot` untuk integritas historis saat variant di-archive
- `cart_items.buyer_input` bisa "basi" kalau `product_requirements` berubah setelah add → re-validate di checkout, bukan hanya di add
- Total rewrite = site sempat broken mid-migration; kerjakan di branch terpisah

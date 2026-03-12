# PRD — Toko Akun (Mini E-Commerce Akun Digital)

> Versi: 1.1 | Tanggal: 12 Maret 2026 | Status: Draft MVP

---

## 1. Overview

### 1.1 Ringkasan Produk

**Toko Akun** adalah platform mini e-commerce yang memungkinkan pengguna menjual dan membeli akun digital seperti akun streaming, game, atau layanan premium.
Platform menyediakan sistem untuk mengelola stok akun, memproses transaksi, dan mengirimkan kredensial akun kepada pembeli secara otomatis setelah pembelian berhasil.

Produk ini berfokus pada **transaksi akun digital secara sederhana, cepat, dan otomatis** dengan tiga peran pengguna utama: **admin**, **seller**, dan **buyer**.

---

### 1.2 Problem Statement

Banyak penjual akun digital masih melakukan transaksi secara manual melalui chat atau marketplace yang tidak dirancang khusus untuk menjual akun digital.

Permasalahan utama:

- Proses transaksi lambat karena dilakukan manual
- Risiko kesalahan pengiriman akun
- Tidak ada sistem pengelolaan stok akun
- Sulit melakukan tracking transaksi
- Tidak ada otomatisasi pengiriman akun setelah pembayaran

---

### 1.3 Tujuan Produk

Tujuan dari produk ini adalah:

1. Menyediakan platform sederhana untuk menjual akun digital.
2. Mengotomatisasi proses pembelian dan pengiriman akun.
3. Memudahkan seller mengelola stok akun digital.
4. Memberikan pengalaman pembelian yang cepat bagi buyer.
5. Menyediakan dashboard untuk monitoring transaksi.

---

## 2. Scope

### 2.1 In Scope (MVP)

Fitur yang termasuk dalam MVP:

- Registrasi dan login pengguna
- Role management (admin, seller, buyer)
- Seller dapat menambahkan akun yang dijual
- Buyer dapat melihat daftar akun
- Buyer dapat melakukan pembelian akun
- Integrasi payment gateway
- Sistem otomatis memberikan akun setelah pembayaran berhasil
- Dashboard seller untuk mengelola akun
- Dashboard admin untuk monitoring transaksi
- Riwayat transaksi buyer

---

### 2.2 Out of Scope (v1)

Fitur yang belum termasuk dalam versi awal:

- Sistem refund otomatis
- Multi-payment gateway
- Sistem rating seller
- Chat antara buyer dan seller
- Promo / voucher diskon
- Sistem wallet / saldo internal
- Sistem escrow

---

## 3. User Roles & Personas

| Role       | Deskripsi            | Akses Utama                                            |
| ---------- | -------------------- | ------------------------------------------------------ |
| **Admin**  | Pengelola sistem     | Melihat seluruh user, akun, dan transaksi              |
| **Seller** | Penjual akun digital | Menambah akun, mengelola stok akun, melihat penjualan  |
| **Buyer**  | Pembeli akun digital | Melihat produk, membeli akun, melihat akun yang dibeli |

---

## 4. User Stories

### Admin

- Sebagai admin, saya ingin melihat seluruh user agar bisa memonitor aktivitas platform.
- Sebagai admin, saya ingin melihat semua transaksi agar dapat memastikan sistem berjalan dengan baik.

---

### Seller

- Sebagai seller, saya ingin menambahkan akun yang akan dijual agar bisa dijual kepada buyer.
- Sebagai seller, saya ingin melihat stok akun yang tersedia.
- Sebagai seller, saya ingin melihat akun mana saja yang sudah terjual.

---

### Buyer

- Sebagai buyer, saya ingin melihat daftar akun yang tersedia agar dapat memilih akun yang ingin dibeli.
- Sebagai buyer, saya ingin membeli akun dengan mudah menggunakan metode pembayaran online.
- Sebagai buyer, saya ingin langsung mendapatkan akun setelah pembayaran berhasil.

---

## 5. Functional Requirements

### 5.1 Modul Authentication

Fitur:

- Registrasi akun
- Login pengguna
- Logout
- Role-based access control

---

### 5.2 Modul Manajemen Akun (Seller)

Seller dapat:

- Menambahkan akun baru
- Mengatur harga akun
- Mengatur kategori akun
- Melihat daftar akun yang tersedia
- Melihat akun yang sudah terjual

---

### 5.3 Modul Marketplace

Fitur untuk buyer:

- Melihat daftar akun yang tersedia
- Melihat detail akun
- Melakukan pembelian akun

---

### 5.4 Modul Pembayaran

Sistem menggunakan **payment gateway Mayar.id**.

Fitur:

- Generate payment link
- Redirect buyer ke halaman pembayaran
- Webhook untuk konfirmasi pembayaran
- Update status order otomatis

---

### 5.5 Modul Notifikasi

Notifikasi sistem:

- Seller mendapat notifikasi ketika akun terjual
- Buyer mendapat notifikasi setelah akun berhasil dibeli
- Admin dapat melihat aktivitas transaksi

---

### 5.6 Dashboard

Dashboard berbeda untuk setiap role:

**Admin Dashboard**

- Statistik transaksi
- Daftar user
- Monitoring aktivitas platform

**Seller Dashboard**

- Total akun tersedia
- Total akun terjual
- Daftar akun yang dijual

**Buyer Dashboard**

- Riwayat pembelian
- Akun yang sudah dibeli

---

## 6. Non-Functional Requirements

| Aspek              | Requirement                              |
| ------------------ | ---------------------------------------- |
| **Performance**    | Halaman marketplace harus load < 2 detik |
| **Availability**   | Sistem tersedia 99% uptime               |
| **Security**       | Password di-hash dan akses berbasis role |
| **Scalability**    | Database dapat menangani ribuan akun     |
| **Data Retention** | Data transaksi disimpan minimal 1 tahun  |

---

## 7. Tech Stack

| Layer        | Pilihan                                    |
| ------------ | ------------------------------------------ |
| **Frontend** | Astro (TypeScript) + Tailwind CSS          |
| **Backend**  | Supabase (Serverless API + Edge Functions) |
| **Database** | PostgreSQL                                 |
| **Payment**  | Mayar.id                                   |
| **Storage**  | Supabase Storage                           |
| **Auth**     | Supabase Authentication                    |
| **Deploy**   | Vercel                                     |

---

## 8. Data Model (ERD Summary)

```
users
-----
id
name
email
password
role
created_at


accounts
--------
id
seller_id
title
category
email_account
password_account
price
status
buyer_id
sold_at
created_at


orders
------
id
buyer_id
total_price
status
created_at


order_items
-----------
id
order_id
account_id
price
```

---

## 9. Payment Flow

```
Buyer memilih akun
        ↓
Klik tombol beli
        ↓
Sistem membuat order
        ↓
Sistem membuat payment link dari Mayar.id
        ↓
Buyer diarahkan ke halaman pembayaran
        ↓
Buyer menyelesaikan pembayaran
        ↓
Mayar mengirim webhook ke server
        ↓
Status order berubah menjadi "paid"
        ↓
Sistem mengirim akun ke buyer
        ↓
Status akun berubah menjadi "sold"
```

---

## 10. API Contracts (Ringkasan)

| Method | Endpoint          | Auth       | Deskripsi                     |
| ------ | ----------------- | ---------- | ----------------------------- |
| GET    | /accounts         | Public     | Melihat daftar akun tersedia  |
| GET    | /accounts/{id}    | Public     | Melihat detail akun           |
| POST   | /accounts         | Seller     | Menambahkan akun              |
| POST   | /orders           | Buyer      | Membuat order                 |
| POST   | /payments/create  | Buyer      | Membuat pembayaran Mayar      |
| POST   | /payments/webhook | System     | Webhook konfirmasi pembayaran |
| GET    | /orders           | Buyer      | Melihat riwayat order         |
| GET    | /dashboard        | Role-based | Data dashboard                |

---

## 11. Acceptance Criteria (MVP)

- [ ] User dapat registrasi dan login
- [ ] Seller dapat menambahkan akun untuk dijual
- [ ] Buyer dapat melihat daftar akun
- [ ] Buyer dapat membeli akun
- [ ] Sistem terintegrasi dengan Mayar.id
- [ ] Sistem otomatis memberikan akun setelah pembayaran
- [ ] Dashboard tersedia untuk admin, seller, dan buyer

---

## 12. Milestones

| Fase    | Scope                             | Target   |
| ------- | --------------------------------- | -------- |
| Phase 1 | Desain database & ERD             | 1 minggu |
| Phase 2 | Implementasi authentication       | 1 minggu |
| Phase 3 | Marketplace & manajemen akun      | 2 minggu |
| Phase 4 | Integrasi Mayar.id & sistem order | 1 minggu |
| Phase 5 | Dashboard & testing               | 1 minggu |

---

## 13. Open Questions

- [ ] Apakah pembayaran hanya menggunakan metode yang tersedia di Mayar atau perlu metode tambahan? hanya yang disediakan platform mayar
- [ ] Apakah seller dapat menjual lebih dari satu kategori akun? ya boleh saja

---

Mantap — requirement kamu sebenarnya sudah **cukup jelas untuk dijadikan spesifikasi UI/UX untuk AI agent** 👍
Supaya rapi dan bisa langsung dipakai oleh AI coding agent (misalnya Copilot / Cursor / Devin style agent), aku buatkan **spesifikasi tambahan yang bisa kamu tambahkan ke PRD kamu**.

Kamu bisa **tambahkan section berikut di bawah dokumen PRD kamu**.

---

# 14. UI / UX Architecture

## Design Direction

Desain UI **terinspirasi dari NFT marketplace modern** seperti gambar referensi.

Karakter visual:

- Modern
- Card-based marketplace
- Clean layout
- Soft shadow
- Rounded component
- Neon accent color

Namun dibuat **Light Mode First Design**.

---

# 15. Design System

## Typography

Font utama:

**Poppins**

Import:

```css
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap");
```

Typography scale:

| Element       | Weight | Size |
| ------------- | ------ | ---- |
| Hero Title    | 700    | 56px |
| Hero Subtitle | 400    | 20px |
| Section Title | 600    | 32px |
| Card Title    | 600    | 18px |
| Body          | 400    | 16px |
| Small         | 400    | 14px |
| Button        | 500    | 14px |

---

# 16. Color Palette (Light Mode)

### Background

```
#FFFFFF
#F7F8FA
```

### Primary Accent

```
#A6FF00
```

### Gradient Accent

```
linear-gradient(90deg,#B4FF2B,#8DFF00)
```

### Text

```
#111111
#555555
```

### Card

```
background: #FFFFFF
border-radius: 16px
shadow: 0 10px 30px rgba(0,0,0,0.05)
```

---

# 17. Theme System

Website harus memiliki **Dark Mode Toggle**

Di Navbar kanan.

Icon:

```
☀ Light Mode
🌙 Dark Mode
```

Theme disimpan di:

```
localStorage.theme
```

---

# 18. Global Layout

## Public Layout

Digunakan untuk:

- Public user
- Buyer user

Structure:

```
Navbar
Main Content
Footer
```

---

# 19. Navbar Design

Layout navbar:

```
[LOGO TOKOAKUN]     [Home | About | Shop | Contact]      [Theme Toggle] [Login]
```

Keterangan:

Left

Logo:
**TOKOAKUN**

Center

Navigation

```
Home
About Us
Shop
Contact
```

Right

```
Theme Toggle
Login Button
```

Login Button style:

```
background: linear-gradient(90deg,#B4FF2B,#8DFF00)
border-radius: 12px
```

---

# 20. Landing Page

Route:

```
/
```

Sections:

```
Hero
Featured Accounts
Top Sellers
About Us
Contact
Footer
```

---

# 21. Hero Section

Layout:

```
2 Column
```

Left Side

```
Headline
Description
CTA Button
```

Example headline:

```
UNLEASH THE FUTURE OF DIGITAL ACCOUNT MARKETPLACE
```

Description:

```
Buy and sell premium digital accounts easily and securely.
```

CTA Button:

```
Get Started
```

Route:

```
/register
```

Right Side

3D Illustration / Character (seperti gambar referensi)

Background:

```
light gradient
```

---

# 22. Featured Accounts Section

Menampilkan **akun terbaru yang dijual**.

Layout:

```
4 card per row
```

Card Content:

```
thumbnail
account title
seller name
price
BUY button
```

---

# 23. Top Sellers Section

Menampilkan seller terbaik.

Card:

```
avatar
seller name
total sales
ranking badge
```

Data berasal dari:

```
seller analytics
```

---

# 24. Shop Page

Route:

```
/shop
```

Layout:

```
Marketplace grid
```

Grid:

```
4 column
2 row
8 item per page
```

Card:

```
thumbnail
title
category
price
seller
BUY button
```

Jika belum login:

```
BUY → redirect /login
```

Pagination:

```
bottom pagination
```

---

# 25. Footer

Style modern marketplace.

Elemen:

Large branding:

```
TOKOAKUN
```

Style:

```
gradient text
```

Links:

```
Home
Shop
About
Contact
```

---

# 26. Authentication Pages

## Register

User memilih role:

```
Buyer
Seller
```

Form:

```
Name
Email
Password
Role
```

---

## Login

Form:

```
Email
Password
```

---

# 27. Seller Dashboard

Layout:

```
Sidebar (Left)
Main Content (Right)
```

Sidebar Menu:

```
Dashboard
My Accounts
Sold Accounts
Marketplace
Revenue
Settings
```

Bottom Sidebar:

```
Logout
```

---

# 28. Seller Pages

## Dashboard

Menampilkan statistik:

```
total akun dijual
akun terjual
total revenue
```

---

## My Accounts

Table:

```
Title
Category
Price
Status
Action
```

Action:

```
Edit
Delete
```

---

## Sold Accounts

Menampilkan akun yang sudah terjual.

---

## Revenue

Menampilkan grafik penjualan.

Chart:

```
sales per day
monthly revenue
balance
```

---

## Settings

User dapat:

```
ganti password
update profile
```

---

# 29. Buyer Experience

Buyer menggunakan **public layout**.

Tambahan fitur:

```
purchase history
owned accounts
```

---

# 30. Admin Dashboard

Layout sama seperti seller.

Sidebar Menu:

```
Dashboard
User Management
Seller Analytics
Orders
Platform Stats
```

---

# 31. User Management

Admin dapat:

```
create user
edit user
delete user
```

Table:

```
Name
Email
Role
Status
Created
```

---

# 32. Seller Analytics

Menampilkan ranking seller.

Data:

```
seller name
total accounts sold
revenue
rating
```

Digunakan juga oleh:

```
landing page → top sellers
```

---

# 33. Super Admin Features (Recommended)

Untuk membantu admin:

### Fraud Detection

Mendeteksi aktivitas transaksi mencurigakan.

---

### Manual Order Override

Admin dapat:

```
force change order status
```

---

### Seller Verification

Admin dapat memberikan:

```
verified seller badge
```

---

### Global Announcement

Admin bisa menampilkan banner global di website.

---

# 34. Astro Project Structure (Recommended)

```
src
 ├ pages
 │   ├ index.astro
 │   ├ shop.astro
 │   ├ about.astro
 │   ├ contact.astro
 │   ├ login.astro
 │   ├ register.astro
 │
 ├ layouts
 │   ├ PublicLayout.astro
 │   ├ DashboardLayout.astro
 │
 ├ components
 │   ├ Navbar.astro
 │   ├ Footer.astro
 │   ├ Hero.astro
 │   ├ AccountCard.astro
 │   ├ SellerCard.astro
 │
 ├ styles
 │   ├ global.css
 │   ├ theme.css
```

---

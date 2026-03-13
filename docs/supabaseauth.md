# Authentication & User Management Flow

### Astro + Supabase Architecture (Toko Akun)

Dokumen ini menjelaskan bagaimana sistem **authentication, registrasi user, dan manajemen user oleh admin** bekerja pada aplikasi **Toko Akun** yang menggunakan **Astro sebagai frontend/server API** dan **Supabase sebagai backend (Auth + Database)**.

Tujuan dari arsitektur ini adalah memastikan bahwa:

* Sistem **aman**
* Role user **terkontrol**
* Admin dapat melakukan **CRUD user dari dashboard**
* Seller dan Buyer dapat **mendaftar sendiri melalui halaman register**
* Role 'admin' **diproteksi** dan tidak bisa didapatkan melalui registrasi publik.


---

# 1. Konsep Dasar Supabase Auth

Supabase memiliki sistem authentication bawaan yang menyimpan user pada tabel internal:

```
auth.users
```

Tabel ini **tidak boleh diubah langsung dari frontend** karena alasan keamanan.

Frontend hanya diperbolehkan untuk:

* login
* logout
* register user biasa

Namun operasi seperti:

* create user oleh admin
* delete user
* update user
* reset password

harus dilakukan melalui **server-side API menggunakan Supabase Admin API**.

Oleh karena itu aplikasi ini menggunakan **Astro Server API sebagai perantara antara frontend dan Supabase**.

---

# 2. Struktur User Database

Sistem user terdiri dari dua bagian:

### Supabase Auth Table

```
auth.users
```

Digunakan untuk menyimpan:

* email
* password
* authentication data

---

### Users Table (Public Table)

Aplikasi juga memiliki tabel tambahan untuk menyimpan data profil:

```
public.users
```


Struktur contoh:

```
public.users
---------
id (uuid)
name
email
role
created_at
updated_at
```


Penjelasan:

* `id` = sama dengan `auth.users.id`
* `role` menentukan jenis user

Role yang tersedia:

```
admin
seller
buyer
```

Dengan cara ini kita dapat menyimpan informasi tambahan user tanpa mengubah tabel auth bawaan Supabase.

---

# 3. Arsitektur Sistem

Alur komunikasi sistem adalah:

```
Frontend (Astro UI)
        │
        │ request
        ▼
Astro Server API
        │
        │ Supabase Admin Client
        ▼
Supabase Auth + Database
```

Frontend **tidak pernah langsung mengakses Supabase Auth untuk operasi sensitif**.

Semua operasi admin dilakukan melalui **API server Astro**.

---

# 4. Registrasi User (Seller / Buyer)

User biasa dapat membuat akun melalui halaman register.

Halaman:

```
/register
```

User memilih role:

```
Buyer
Seller
```

Form register berisi:

```
name
email
password
role
```

Ketika form disubmit, frontend memanggil API:

```
POST /api/auth/register
```

---

### Flow Registrasi

Alur lengkap:

```
User membuka halaman register
        │
        ▼
User mengisi form
        │
        ▼
Frontend mengirim request ke API
        │
        ▼
API membuat user di Supabase Auth
        │
        ▼
User berhasil dibuat di auth.users
        │
        ▼
Trigger database otomatis membuat data di tabel public.users
        │
        ▼
User account siap digunakan

```

---

### Proses Teknis

API akan melakukan dua langkah:

1️⃣ Create user di Supabase Auth

```
supabase.auth.signUp()
```

2️⃣ Insert data user ke tabel profiles

```
insert into profiles
```

Contoh data:

```
id: user.id
name: form.name
role: buyer atau seller
```

Dengan cara ini sistem mengetahui role setiap user.

---

# 5. Login User

User login melalui halaman:

```
/login
```

Form:

```
email
password
```

Frontend menggunakan Supabase client:

```
supabase.auth.signInWithPassword()
```

Setelah login berhasil, aplikasi akan membaca data dari tabel:

```
public.users
```

untuk mengetahui role user.


Redirect berdasarkan role:

```
admin → /admin/dashboard
seller → /seller/dashboard
buyer → homepage marketplace
```

---

# 6. Admin User Management

Admin memiliki dashboard khusus.

Halaman:

```
/admin/users
```

Di halaman ini admin dapat:

```
Create User
Edit User
Delete User
```

Namun operasi ini **tidak boleh langsung dari frontend ke Supabase Auth**.

Semua dilakukan melalui **Astro API**.

---

# 7. Create User Oleh Admin

Admin dapat membuat akun baru untuk seller atau buyer.

Flow:

```
Admin membuka halaman user management
        │
        ▼
Admin klik "Create User"
        │
        ▼
Admin mengisi form
        │
        ▼
Frontend mengirim request ke API
        │
        ▼
Astro API menggunakan Supabase Admin API
        │
        ▼
User dibuat di auth.users
        │
        ▼
Data profile otomatis dibuat di tabel public.users via trigger
        │
        ▼
Admin dapat mengubah role di public.users jika diperlukan

```

API yang digunakan:

```
supabase.auth.admin.createUser()
```

Admin juga bisa menentukan role saat membuat user.

---

# 8. Update User

Admin dapat mengubah:

```
name
role
```

Perubahan ini hanya dilakukan di tabel:

```
public.users
```

Karena informasi role tidak disimpan di auth.users.


---

# 9. Delete User

Ketika admin menghapus user:

Langkahnya:

1️⃣ Delete dari Supabase Auth

```
supabase.auth.admin.deleteUser()
```

2️⃣ Delete dari tabel public.users

```
delete from public.users
```


Ini memastikan tidak ada data orphan.

---

# 10. Security Rules

Untuk menjaga keamanan sistem:

Frontend **tidak boleh memiliki akses ke**:

```
SUPABASE_SERVICE_ROLE_KEY
```

Key ini hanya digunakan di server API.

---

# 11. File Structure (Astro)

Struktur folder API yang direkomendasikan:

```
src
 ├ pages
 │   ├ api
 │   │   ├ auth
 │   │   │   ├ register.ts
 │   │   │   ├ login.ts
 │   │   │
 │   │   ├ admin
 │   │   │   ├ create-user.ts
 │   │   │   ├ update-user.ts
 │   │   │   ├ delete-user.ts
 │
 ├ lib
 │   ├ supabaseClient.ts
 │   ├ supabaseAdmin.ts
```

---

# 12. Summary

Sistem user pada aplikasi Toko Akun bekerja dengan konsep berikut:

1. Supabase Auth menyimpan data login user.
2. Tabel `public.users` menyimpan informasi tambahan seperti role.
3. Registrasi user dilakukan melalui API yang memicu trigger database.

4. Login menggunakan Supabase Auth client.
5. Admin mengelola user melalui API server menggunakan Supabase Admin API.
6. Frontend tidak memiliki akses langsung ke operasi sensitif.

Dengan arsitektur ini sistem akan:

* aman
* scalable
* mudah dikembangkan
* mendukung role admin, seller, dan buyer dengan baik.

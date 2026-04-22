# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Toko Akun** — mini e-commerce for digital accounts (streaming, games, premium services). Astro SSR app deployed to Vercel, using Supabase as Postgres (not Supabase Auth — see note below), manual admin-verified payments, and Google Apps Script as a webhook target for post-payment email delivery.

Package manager: both `package-lock.json` and `pnpm-lock.yaml` are present; `pnpm` is preferred in practice. Node >= 22.12.0.

## Commands

```sh
pnpm dev        # astro dev — local server at http://localhost:4321
pnpm build      # astro build — SSR output for Vercel adapter
pnpm preview    # preview built output
pnpm astro ...  # astro CLI (e.g. `pnpm astro check` for typecheck)
```

There is no test runner wired up. `scripts/run-migration.mjs` runs `supabase/auth_migration.sql` against a **local** Supabase Postgres (`127.0.0.1:54322`) — it is not used against production. The canonical schema lives in `supabase/schema.sql` and is applied manually to the Supabase project.

`push.sh "message"` is a helper that creates **one commit per changed file** with a conventional-commit type inferred from the filename, then pushes. Use only when intentionally wanting per-file commits.

## Environment

Required vars (see `.env.example`):

- `SUPABASE_URL`, `SUPABASE_KEY` (anon), `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` — HS256 signing key for session tokens
- `PUBLIC_APP_URL` — public base URL of the app
- `APPSCRIPT_WEBHOOK_URL` — Google Apps Script endpoint that emails account credentials to buyers

Vars are accessed via `import.meta.env` (Astro), not `process.env`.

## Architecture

### Custom auth, not Supabase Auth

Despite the `docs/supabaseauth.md` write-up (which describes an earlier Supabase-Auth-based design), the **current implementation does NOT use `auth.users` or Supabase Auth**. Supabase is used purely as a Postgres database. `docs/supabaseauth.md` is stale — trust the code.

Authentication lives in `src/lib/auth.ts`:
- Passwords: `bcryptjs` hashes stored on `public.users.password_hash`.
- Sessions: `jose` signs a JWT (`id`, `email`, `role`, `name`, 24h expiry) stored in the `session` cookie.
- `getCurrentUser(request)` parses the cookie; `requireAuth` / `requireAdmin` throw on failure.

### Middleware and role routing

`src/middleware.ts` runs on every request:
1. Verifies the `session` cookie and populates `context.locals` (`userId`, `userRole`, `userEmail`, `userName`) — see `src/env.d.ts` for the `App.Locals` shape.
2. Redirects unauthenticated users away from `/dashboard/**`.
3. Redirects logged-in users away from `/login` and `/register`.
4. Enforces that `/dashboard/admin/**` and `/dashboard/seller/**` are **admin-only**. The codebase has collapsed "seller" into "admin" — the `user_role` enum is only `('buyer','admin')` (see `supabase/schema.sql`), and there is no separate buyer dashboard. `/dashboard/buyer*` is hard-redirected to `/shop`.

When touching role logic, note this mismatch with `docs/prd.md` (which still talks about three roles): the PRD is aspirational, the schema and middleware are authoritative.

### Supabase clients

Two clients, pick deliberately:
- `src/lib/supabase.ts` — anon-key client. Used on the server in routes where RLS is acceptable.
- `src/lib/supabaseAdmin.ts` — service-role client. Required for any insert/update the user isn't entitled to do directly (creating orders on a buyer's behalf, marking accounts sold, admin CRUD). **Never import this into `.astro` pages rendered with user data flowing through.**

`src/lib/database.types.ts` is the generated types source for both clients.

### Payment flow (manual, admin-verified)

There is no payment-gateway integration. The flow spans two endpoints:

1. `POST /api/create-manual-order` (`src/pages/api/create-manual-order.ts`): auth'd buyer submits `accountId`. Validates the account is `available`, creates a pending `orders` row and matching `order_items` row. Returns `{ success, orderId }`. The buyer is expected to pay out-of-band (bank transfer, e-wallet, QRIS) using instructions communicated outside the app.
2. `POST /api/admin/orders/verify` (`src/pages/api/admin/orders/verify.ts`): admin-only. Marks the order `paid`, flips each `accounts` row to `sold` (guarded by `.eq('status', 'available')` for idempotency), and calls `sendOrderEmail` to dispatch credentials.

`src/lib/order-email.ts` (`sendOrderEmail`) fetches the full order + buyer + accounts (including `email_account` / `password_account` credentials), POSTs the payload to `APPSCRIPT_WEBHOOK_URL`. The Apps Script is responsible for the actual email send. Failures are logged but never block the verify response.

### Data model

`supabase/schema.sql` is canonical. Key facts:
- `accounts.status`: `available | sold | deleted`; `available` is the guard for purchase and the idempotency key when transitioning to `sold`.
- `orders.status`: `pending | paid | cancelled`.
- Each `accounts` row carries the plaintext `email_account` / `password_account` that gets emailed to the buyer. Treat these as secrets in any new code path.
- `sold_at` and `buyer_id` on `accounts` are set at the same moment `status` flips to `sold`.

### Frontend

- Astro SSR pages under `src/pages/`. Layouts: `PublicLayout` (marketing + shop) and `DashboardLayout` (admin/seller areas).
- Tailwind v4 via `@tailwindcss/vite` (see `astro.config.mjs`). Styles in `src/styles/`.
- UI spec (design system, colors, fonts) is in `docs/prd.md` sections 14–34 — use it as the reference for new UI work rather than inventing conventions.

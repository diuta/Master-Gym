# Login, Sessions and Roles

[Back to overview](./CODEBASE_OVERVIEW.md)

## 1. Accounts and roles

There are two roles, defined once in `lib/db/schema.ts` as the Postgres enum `role`:

| Role | Who | Can open |
|---|---|---|
| `kasir` | The front-desk cashier. **One shared account.** | Dashboard, Membership (Absen, Riwayat Absen, Data Member, Pembayaran), Inventori, Tambah/Riwayat Penjualan, Tambah/Riwayat Pembelian, Pengeluaran |
| `superadmin` | The owner/manager. One account. | Home, Laporan, Pengaturan Harga, Riwayat Penjualan, Riwayat Pembelian, Pengeluaran, Pengaturan Akun |

The roles mostly don't overlap: the superadmin does **not** get the cashier's daily-operation pages (the spec says the admin doesn't check members in), and the cashier can't see reports. The exceptions are the history pages Riwayat Penjualan, Riwayat Pembelian and Pengeluaran, which both roles open. On them, **cancelling a sale or purchase, deleting an expense, and managing expense categories are superadmin-only** (the actions call `requireRole("superadmin")`; the kasir doesn't see the buttons). Everything else on those pages (adding sales, purchases and expenses) is kasir-only. Both share `/dashboard`, which will show different content per role.

The TypeScript type `Role = "superadmin" | "kasir"` lives in `lib/auth/session.ts`. If a role is ever added, change the enum in `schema.ts`, the `Role` type, `navForRole` in `lib/nav.ts`, and run `npm run db:push`.

### Creating accounts

- **Development:** `npm run db:seed` → `superadmin@mastergym.test` and `kasir@mastergym.test`, password `password123`.
- **Real server:** never run the seed (its password is public). Use:
  ```bash
  npm run db:create-user -- --name="Kasir" --email=kasir@contoh.id --password=... --role=kasir
  ```
- **Changing a password:** there is no screen for it yet (planned under Pengaturan Akun). For now, update the row with a new bcrypt hash, or delete the user and create it again.

## 2. Logging in, step by step

Files: `features/authentication/login-page.tsx`, `actions.ts`, `validation.ts`.

1. The form posts `email` and `password` to `loginAction` (a Server Action) via `useActionState`.
2. `LoginSchema` (Zod) checks the email format and that the password isn't empty. Errors are returned per field and shown under the inputs.
3. The user is looked up by email.
4. **Email not found:** the action still runs `bcrypt.compare` against a fixed dummy hash, so the response takes as long as a real password check. Otherwise an attacker could time the responses to learn which emails exist.
5. **Wrong password** and **unknown email** both return the same message: "Email atau password salah."
6. **Correct password:** `createSession({ id, role })` sets the cookie, then `redirect("/dashboard")`.

### No lockout (deliberate)

Sembako locks an account for 15 minutes after 5 wrong passwords. Master Gym **removed** that: with one shared cashier account, one person mistyping 5 times would lock out the whole front desk. The trade-off is that passwords can be guessed without limit. It's marked in the code:

```ts
// shortcut: no lockout (...), so passwords can be guessed without limit; add rate limiting by IP before going online
```

**Before the app goes online**, add per-IP rate limiting (e.g. at the reverse proxy) or a similar control.

## 3. The session cookie

File: `lib/auth/session.ts` (server-only).

| Property | Value |
|---|---|
| Cookie name | `session` |
| Content | A JWT signed with HS256 using `SESSION_SECRET`. Payload: `{ userId, role }` plus `iat`/`exp` |
| Lifetime | 7 days (`setExpirationTime("7d")` and the cookie's `expires`) |
| Flags | `httpOnly` (JavaScript can't read it), `sameSite: "lax"`, `secure` in production (HTTPS only), `path: "/"` |

Functions:

- `encrypt(payload)` / `decrypt(token)`: sign and verify. `decrypt` returns `null` for a missing, expired, tampered or wrongly-signed token, and never throws.
- `createSession(user)`: signs `{ userId, role }` and sets the cookie.
- `getSession()`: reads and verifies the cookie of the current request.
- `deleteSession()`: removes the cookie (logout).

**Startup check:** if `SESSION_SECRET` is missing or shorter than 32 characters, the module throws immediately, so the app can't run with a weak or empty key. `.env.example` leaves it blank on purpose.

The JWT is **signed, not encrypted**: anyone holding the cookie can read `userId` and `role`, but can't change them without the secret.

## 4. Guards: who can see what

There are three layers, from fastest to strongest:

| Layer | File | Checks | On failure |
|---|---|---|---|
| 1. Proxy | `proxy.ts` | Is there a valid session cookie? | Redirect to `/login`. Also redirects logged-in users away from `/login` |
| 2. App layout | `app/(app)/layout.tsx` | `verifySession()`, then the user **still exists** in the DB | Redirect to `/login` |
| 3. Page / action | each `page.tsx`, each Server Action | `requireRole("kasir")` or `requireRole("superadmin")` | Redirect to `/dashboard` |

From `lib/auth/dal.ts`:

```ts
verifySession()        // session or redirect("/login"); cached once per request with React cache()
requireRole(...roles)  // verifySession() + role check, or redirect("/dashboard")
```

Rules for new code:

- **Every page** under `app/(app)/` that belongs to one role calls `requireRole(...)` first.
- **Every Server Action** that reads or writes data calls `requireRole(...)` itself. Server Actions are reachable without going through the page, so the page's check doesn't protect them.
- Hiding a menu item in `lib/nav.ts` is only convenience, never security.

## 5. Logout

The "Keluar" button in the sidebar submits `logoutAction`, which deletes the cookie and redirects to `/login`.

## 6. Known limits

| Limit | Effect | Upgrade path |
|---|---|---|
| No lockout or rate limit | Unlimited password guessing | Rate limiting before going online |
| Stateless JWT | Logout only deletes the cookie in *this* browser; a copied cookie stays valid until it expires. Changing a password doesn't log out other devices | Store sessions in the database and check them per request |
| Role inside the token | If a user's role changes in the DB, their existing cookie keeps the old role until they log in again (the sidebar reads the DB role, the page guards read the token) | Re-login after role changes, or DB-stored sessions |
| Shared kasir account | Actions can't be traced to a specific cashier | Separate accounts per cashier if that's ever needed |

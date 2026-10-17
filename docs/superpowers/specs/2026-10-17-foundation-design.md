# Master Gym — Foundation Design

Date: 2026-10-17 · Status: approved and implemented

## Goal

A fullstack Next.js + PostgreSQL app for a gym admin to record member
check-ins. This spec covers the **foundation only**: login, layout, sidebar
menu, light/dark mode and Docker. Every menu page is an empty placeholder.

Reference: `Uta/sembako`, branch `development` (identical to `staging` for
the foundation files). Same UI kit, same auth logic, same file layout.

## Decisions

| Topic | Decision |
|---|---|
| Accounts | One account. No roles, no toko (branch) scoping. |
| UI language | Indonesian, like sembako |
| Name | "Master Gym", "M" badge in the sidebar |
| Account creation | Both `npm run db:seed` (dev account `admin@mastergym.test` / `password123`) and `npm run db:create-user` |
| Extras from sembako | Docker only. No vitest, activity log, uploads, DB reset or docs pages. |
| Next.js | 16.4.2 / React 19.3.0, `cacheComponents` **off** (previous caching model, same as sembako). Tailwind via PostCSS. |
| Theme | `next-themes`, toggle with Terang / Gelap / Sistem, default Sistem |

## Menu

| Group | Entry | Route |
|---|---|---|
| DASHBOARD | Home | `/dashboard` |
| CHECK-IN | Check-in | `/check-in` |
| CHECK-IN | Riwayat Check-in | `/check-in/history` |
| MEMBER | Daftar Member | `/member` |
| MEMBER | Paket Membership | `/member/packages` |
| ADMINISTRASI | Pengaturan Akun | `/administration/account-settings` |

## Architecture

- `proxy.ts`: an optimistic cookie check that redirects to `/login` (copied unchanged).
- `lib/auth/session.ts`: an HS256 JWT in an httpOnly cookie, 7 days. The payload is `{ userId }`.
- `lib/auth/dal.ts`: `verifySession()`, cached per request.
- `app/(app)/layout.tsx`: verifies the session and looks up the user in the DB
  (a deleted user is sent to `/login`), then renders the sidebar and top bar.
- `features/authentication/`: the login action with a generic error message,
  timing-safe dummy bcrypt, and a lockout of 15 minutes after 5 failures
  (copied unchanged).
- `lib/db/schema.ts`: the `users` table only.
- `components/ui/*`: sembako's full kit, plus `dropdown-menu` from the same
  shadcn `base-nova` registry.

## Security notes (trailofbits sharp-edges review)

Fixed compared with sembako:
- The `.env*.example` secrets are blank. Sembako's placeholder was 34 characters,
  so it passed the ≥32 check and the app could run on a publicly known secret.
- The dev `docker-compose.yml` publishes Postgres on `127.0.0.1` only (the dev
  password is public).

Kept as in sembako (known limits):
- Lockout DoS: with one account, anyone can lock the admin out for 15 minutes.
- Stateless JWT: logout doesn't revoke a copied cookie, and a password change
  doesn't end other sessions. The upgrade path is DB-stored sessions.
- `db:seed` creates a known password. Never run it against a reachable DB.
- The layout check doesn't protect Server Actions. Every future action must
  call `verifySession()` itself.

## Verification (2026-10-17)

`npm run lint` is clean and `npm run build` passes. These were checked against a stand-in
Postgres (PGlite) because Docker couldn't be reached from the agent sandbox:
`db:push`, `db:seed` (a second run fails on the duplicate email and doesn't wipe),
redirects to `/login`, the lockout after 5 wrong passwords, login → `/dashboard`,
all 6 pages returning 200 with the placeholder, `/login` redirecting when already
logged in, and a blank `SESSION_SECRET` refusing to start.
Not verified: `docker compose` itself, and a visual check of the theme toggle.

## Conventions

- All code is English: file and folder names, routes, identifiers, the DB
  column (`users.name`) and CLI output. Only user-facing UI text is Indonesian.
- No code comments.

# Master Gym — Codebase Overview

[Back to README](../README.md) · Related docs: [AUTH](./AUTH.md) · [DATABASE](./DATABASE.md) · [UI](./UI.md) · [DOCKER](./DOCKER.md) · [HANDOFF](./HANDOFF.md)

This document explains **what every part of the code does, where it lives, and how a request flows through it**. It describes the code as of the end of day 1 (2026-10-28): login, roles, layout and empty placeholder pages. Update it when a feature lands.

---

## 1. Tech stack

| Tool | Version | Used for |
|---|---|---|
| **Next.js** (App Router) | 16.4.2 | Routing, server rendering, Server Actions, the `proxy.ts` request guard |
| **React** | 19.3.0 | UI components |
| **TypeScript** | 5, `strict` | The whole codebase |
| **PostgreSQL** | 16 | The database (same major version as Sembako) |
| **Drizzle ORM** + `drizzle-kit` | 0.45 / 0.31 | Typed queries (`lib/db`) and pushing the schema to the DB |
| **pg** | 8 | The Postgres driver Drizzle uses |
| **Tailwind CSS** | 4, via PostCSS | Styling with class names; theme colours are CSS variables |
| **shadcn/ui** (`base-nova` style) on **Base UI** | — | The UI kit. Component source lives in `components/ui/` and is ours to edit |
| **lucide-react** | 1.45 | Icons |
| **Zod** | 4 | Validating form input on the server |
| **jose** | 6 | Signing and verifying the session cookie (JWT, HS256) |
| **bcryptjs** | 3 | Hashing and checking passwords |
| **tsx** | 4 | Running the CLI scripts in `lib/db/` (`db:seed`, `db:create-user`) |
| **Docker** + compose | — | Running app + Postgres as containers (see [DOCKER.md](./DOCKER.md)) |

Not used on purpose: no REST API layer, no state library, no test runner yet, no `next-themes` (the app is dark only).

> **Next.js 16 note.** `AGENTS.md` warns that this Next.js version differs from older ones. The most visible difference here is that the middleware file is called **`proxy.ts`**, with an exported function `proxy`, instead of `middleware.ts`.

---

## 2. Folder map

```
master-gym/
├── app/                      Routes (URL = folder path). Kept thin.
│   ├── layout.tsx            Root HTML shell: fonts, dark class, TooltipProvider
│   ├── globals.css           Tailwind + the colour theme (CSS variables)
│   ├── page.tsx              "/"  → redirects to /dashboard
│   ├── favicon.ico
│   ├── login/page.tsx        "/login" → re-exports features/authentication/login-page
│   └── (app)/                Route group for logged-in pages (the "(app)" part is NOT in the URL)
│       ├── layout.tsx        Checks the session, loads the user, renders sidebar + header
│       ├── dashboard/        "/dashboard"   (both roles; title differs)
│       ├── membership/       check-in, attendance, members, payment   (kasir)
│       ├── inventory/        (kasir)
│       ├── sales/            new, history   (kasir)
│       ├── purchases/        new, history   (kasir)
│       ├── expenses/         (kasir)
│       ├── reports/          (superadmin)
│       └── administration/account-settings/   (superadmin)
├── features/                 Business code, grouped by domain
│   └── authentication/       login page, login/logout Server Actions, Zod schema
├── components/
│   ├── app-sidebar.tsx       The logged-in sidebar (menu per role, user box, logout)
│   ├── placeholder-page.tsx  "Halaman ini belum tersedia" page used by every unbuilt menu
│   └── ui/                   shadcn/Base UI kit + a few house components (see UI.md)
├── hooks/
│   ├── use-mobile.ts         true below 768px wide (drives the mobile sidebar)
│   └── use-sort.ts           Click-to-sort helper for tables
├── lib/
│   ├── auth/session.ts       Create/read/delete the signed session cookie
│   ├── auth/dal.ts           verifySession() and requireRole() guards
│   ├── db/schema.ts          Every table and enum (the single source of truth for the DB)
│   ├── db/index.ts           The shared DB connection (`db`) for the app
│   ├── db/seed.ts            CLI: creates the two dev accounts
│   ├── db/create-user.ts     CLI: creates one account with a hashed password
│   ├── nav.ts                Sidebar menu definition per role
│   └── utils.ts              cn() — merges Tailwind class names
├── proxy.ts                  Runs before every page: redirects to /login if not logged in
├── docs/                     This documentation
├── Dockerfile, docker-compose.yml, docker-compose.prod.yml, .dockerignore
├── drizzle.config.ts         Tells drizzle-kit where the schema is and which DB to use
├── next.config.ts            `output: "standalone"` (needed by the Docker image)
├── components.json           shadcn CLI settings (style, aliases, icon library)
├── postcss.config.mjs        Loads the Tailwind v4 PostCSS plugin
├── eslint.config.mjs         Next.js core-web-vitals + TypeScript lint rules
├── tsconfig.json             Strict TS; `@/*` alias = project root
├── .env.example              Template for local env vars (see section 6)
└── .env.production.example   Template for the production compose file
```

**Rule of thumb:** files in `app/` only decide *which URL shows what* and *who may see it*. Anything with real logic (forms, actions, validation, tables) goes in `features/<domain>/` and is re-exported or imported from the route file. Sembako uses the same split.

---

## 3. Every route

| URL | File | Who | What it shows now |
|---|---|---|---|
| `/` | `app/page.tsx` | anyone | Redirects to `/dashboard` (which redirects to `/login` if logged out) |
| `/login` | `app/login/page.tsx` → `features/authentication/login-page.tsx` | logged out | Email + password form |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | both | Placeholder titled "Dashboard" (kasir) or "Home" (superadmin) |
| `/membership/check-in` | `app/(app)/membership/check-in/page.tsx` | kasir | Placeholder "Absen" |
| `/membership/attendance` | `.../membership/attendance/page.tsx` | kasir | Placeholder "Riwayat Absen" |
| `/membership/members` | `.../membership/members/page.tsx` | kasir | Placeholder "Data Member" |
| `/membership/payment` | `.../membership/payment/page.tsx` | kasir | Placeholder "Pembayaran" |
| `/inventory` | `app/(app)/inventory/page.tsx` | kasir | Placeholder "Inventori" |
| `/sales/new` | `app/(app)/sales/new/page.tsx` | kasir | Placeholder "Tambah Penjualan" |
| `/sales/history` | `app/(app)/sales/history/page.tsx` | kasir | Placeholder "Riwayat Penjualan" |
| `/purchases/new` | `app/(app)/purchases/new/page.tsx` | kasir | Placeholder "Tambah Pembelian" |
| `/purchases/history` | `app/(app)/purchases/history/page.tsx` | kasir | Placeholder "Riwayat Pembelian" |
| `/expenses` | `app/(app)/expenses/page.tsx` | kasir | Placeholder "Pengeluaran" |
| `/reports` | `app/(app)/reports/page.tsx` | superadmin | Placeholder "Laporan" |
| `/administration/account-settings` | `.../administration/account-settings/page.tsx` | superadmin | Placeholder "Pengaturan Akun" |

Every role-restricted page looks like this:

```tsx
export default async function Page() {
  await requireRole("kasir");            // wrong role → redirect("/dashboard")
  return <PlaceholderPage title="Absen" />;
}
```

When a feature is built, the placeholder line is replaced by the real page, for example `return <CheckInPage />` imported from `features/membership/...`. The `requireRole` line stays.

---

## 4. How a request flows

Example: the cashier opens `/membership/check-in`.

```
Browser GET /membership/check-in
  │
  ├─1─ proxy.ts  (runs first, for every path except /api, /_next/static, /_next/image, favicon.ico)
  │      reads the "session" cookie → decrypt() (lib/auth/session.ts)
  │      • no valid session and path ≠ /login → redirect /login
  │      • valid session and path = /login   → redirect /dashboard
  │      • otherwise continue
  │
  ├─2─ app/layout.tsx          html/body, fonts, class="dark", TooltipProvider
  │
  ├─3─ app/(app)/layout.tsx    (Server Component)
  │      verifySession()  → session { userId, role }  (redirects to /login if missing)
  │      SELECT name, email, role FROM users WHERE id = userId
  │      • user deleted → redirect /login
  │      reads the "sidebar_state" cookie (sidebar open or collapsed)
  │      renders <SidebarProvider> + <AppSidebar role=…> + header + <main>{page}</main>
  │
  └─4─ app/(app)/membership/check-in/page.tsx   (Server Component)
         requireRole("kasir")   → superadmin would be redirected to /dashboard
         renders the page content
```

Why are there **two** checks (proxy and page)? `proxy.ts` is a fast, *optimistic* check that only asks "is there a valid cookie?". The real security check is `verifySession()` / `requireRole()` on the server, close to the data. **Every Server Action must call `requireRole()` itself too**, because actions can be called directly and don't go through the page.

### Saving data (pattern for upcoming features)

There is no `/api/...` endpoint for internal features. Forms call **Server Actions**: async functions in a file starting with `"use server"`. The login form is the current example:

```
login-page.tsx (client)  ──form action──▶  loginAction (server, features/authentication/actions.ts)
   useActionState(loginAction)               1. Zod validates the FormData
   shows errors / pending state              2. query DB, check password with bcrypt
                                             3. createSession() sets the cookie
                                             4. redirect("/dashboard")
```

Future feature actions follow the same steps, in Sembako's order: `requireRole(...)` → Zod `safeParse` → DB write (inside `db.transaction` when several tables change) → `revalidatePath(...)` → return `{ success }` or `{ message }`.

---

## 5. File-by-file reference

### Root files

| File | What it does |
|---|---|
| `proxy.ts` | The request guard described in section 4. `publicRoutes = ["/login"]`. The `matcher` excludes `/api`, static assets and the favicon. |
| `next.config.ts` | Only `output: "standalone"`, so `next build` produces a self-contained server in `.next/standalone` that the Docker image runs. |
| `drizzle.config.ts` | Schema `./lib/db/schema.ts`, migrations folder `./lib/db/migrations` (unused: we use `db:push`), dialect postgresql. Throws if `DATABASE_URL` is missing. drizzle-kit loads `.env` itself. |
| `components.json` | Settings for the shadcn CLI (`npx shadcn add <component>`): style `base-nova`, CSS file `app/globals.css`, lucide icons, `@/` aliases. |
| `postcss.config.mjs` | Enables `@tailwindcss/postcss`. Tailwind has no JS config; all theme config is in `globals.css`. |
| `eslint.config.mjs` | `eslint-config-next` (core web vitals + TypeScript). Run with `npm run lint`. |
| `tsconfig.json` | Strict mode; `@/*` maps to the project root (so `@/lib/db` = `./lib/db`). |
| `AGENTS.md` | Auto-written by `next dev`: tells AI agents to read the bundled Next.js docs. Leave it. |

### `app/`

| File | What it does |
|---|---|
| `app/layout.tsx` | Root layout. Loads the Geist and Geist Mono fonts as CSS variables, puts `class="dark"` on `<html>` (so shadcn's `dark:` variants always apply), sets `lang="id"`, page title "Master Gym", and wraps everything in `TooltipProvider` (needed by sidebar tooltips). |
| `app/globals.css` | Imports Tailwind, `tw-animate-css` and shadcn's base CSS; maps CSS variables to Tailwind colours (`@theme inline`); defines **the colour theme** in `:root`; base styles; print rules (from Sembako, for printing invoice dialogs later). See [UI.md](./UI.md). |
| `app/page.tsx` | `redirect("/dashboard")`. |
| `app/login/page.tsx` | One line: re-exports the login page from `features/authentication`. |
| `app/(app)/layout.tsx` | The logged-in shell: session check, user lookup, sidebar, header bar (sidebar toggle + "Master Gym"), and `<main>` with padding. |
| `app/(app)/**/page.tsx` | The 13 pages listed in section 3. |

### `features/authentication/`

| File | What it does |
|---|---|
| `login-page.tsx` | Client component. A shadcn `Card` with email and password fields. `useActionState(loginAction)` gives `state` (field errors or a message), the bound `action`, and `pending` (button shows "Memproses..."). Errors appear under each field or in a red `Alert`. |
| `actions.ts` | `"use server"`. **`loginAction`**: validates with `LoginSchema`; looks up the user by email; if not found, still runs `bcrypt.compare` against a dummy hash so the response time doesn't reveal which emails exist; compares the password; on success calls `createSession({ id, role })` and redirects to `/dashboard`. Always answers "Email atau password salah." for both wrong email and wrong password. **`logoutAction`**: deletes the cookie, redirects to `/login`. Details in [AUTH.md](./AUTH.md). |
| `validation.ts` | `LoginSchema` (email must be valid, password not empty, Indonesian messages) and the `LoginState` type returned to the form. |

### `components/`

| File | What it does |
|---|---|
| `app-sidebar.tsx` | Client component. Props: `name`, `email`, `role`. Header: orange "M" badge, "Master Gym", and the role label ("Kasir" / "Super Admin"). Body: `navForRole(role)` rendered as labelled groups of links; the link whose `href` equals the current path is highlighted. Footer: user initials, name, email, and a "Keluar" button that submits `logoutAction`. `collapsible="icon"` lets desktop users shrink it to icons. |
| `placeholder-page.tsx` | Shows a page title and an `EmptyState` ("Halaman ini belum tersedia"). Delete it once every page is built. |
| `ui/*` | The UI kit. See [UI.md](./UI.md) for the full list. |

### `hooks/`

| File | What it does |
|---|---|
| `use-mobile.ts` | `useIsMobile()` returns `true` when the window is narrower than 768px. Built on React's `useSyncExternalStore`: the server and the first browser render both say `false`, then React switches to the real value. This avoids the hydration-mismatch error the original version had (Sembako still has that bug). Used by `components/ui/sidebar.tsx`. |
| `use-sort.ts` | `useSort(rows, getValue)` → `{ sortedRows, sort, toggleSort }`. Clicking a column cycles ascending → descending → off. Numbers compare as numbers, everything else with Indonesian locale ordering. Pairs with `components/ui/sortable-th.tsx`. Not used yet; it's for the upcoming tables. |

### `lib/`

| File | What it does |
|---|---|
| `lib/auth/session.ts` | Server-only. `encrypt` / `decrypt` the JWT, `createSession`, `getSession`, `deleteSession`. Exports the `Role` and `SessionPayload` types. Crashes at startup if `SESSION_SECRET` is missing or shorter than 32 characters. See [AUTH.md](./AUTH.md). |
| `lib/auth/dal.ts` | Server-only "data access layer" for auth. `verifySession()` (cached per request) and `requireRole(...roles)`. |
| `lib/db/schema.ts` | The `role` enum and the `users` table. See [DATABASE.md](./DATABASE.md). |
| `lib/db/index.ts` | Server-only. Creates one `pg` connection pool and exports `db` (Drizzle). If `DATABASE_URL` contains `sslmode=require`, it strips that and connects with SSL that accepts self-signed certificates (needed by some hosted databases). |
| `lib/db/seed.ts` | CLI (`npm run db:seed`). Creates `superadmin@mastergym.test` and `kasir@mastergym.test`, both with password `password123`. Running it twice fails on the duplicate email and changes nothing. **Dev only.** |
| `lib/db/create-user.ts` | CLI (`npm run db:create-user -- --name=… --email=… --password=… --role=kasir|superadmin`). Validates the role against the enum, hashes the password, inserts the user. Use this on a real server instead of the seed. |
| `lib/nav.ts` | The sidebar menu: `kasirSections` and `superadminSections`, each a list of `{ label, entries: [{ label, href, icon }] }`. `navForRole(role)` picks one. **To add a menu item, edit this file.** The page itself must still call `requireRole`; hiding a link is not security. |
| `lib/utils.ts` | `cn(...classes)`: joins class names and resolves Tailwind conflicts (`clsx` + `tailwind-merge`). Used everywhere. |

---

## 6. Environment variables

Defined in `.env` (local, gitignored; copy from `.env.example`).

| Variable | Used by | Meaning |
|---|---|---|
| `DATABASE_URL` | app, drizzle-kit, CLI scripts | Postgres connection string. Native Postgres: port 5432. Docker Postgres: port 5434. |
| `SESSION_SECRET` | `lib/auth/session.ts` | Key that signs the login cookie. ≥ 32 characters. Generate with `openssl rand -base64 32`. Changing it logs everyone out. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Next.js | Keeps Server Action IDs stable across builds and containers. 32-byte base64. |
| `DB_HOST_PORT` | `docker-compose.yml` | Host port for the Docker Postgres (5434). |
| `APP_HOST_PORT` | `docker-compose.yml` | Host port for the Docker app (3002). |
| `APP_IMAGE` | `docker-compose.yml` | Image tag for the built app (`master-gym:dev`). |
| `COMPOSE_PROJECT_NAME` | docker compose | Project name (`master-gym-dev`). |

`.env.production.example` adds `DB_USER`, `DB_PASSWORD`, `DB_NAME` for `docker-compose.prod.yml`.

---

## 7. npm scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 with hot reload. |
| `npm run build` | Production build (also type-checks). |
| `npm run start` | Runs the production build. |
| `npm run lint` | ESLint. |
| `npm run db:push` | Makes the database match `lib/db/schema.ts` (creates/changes tables). |
| `npm run db:generate` | Writes SQL migration files into `lib/db/migrations` (not used so far). |
| `npm run db:studio` | Opens Drizzle Studio, a browser UI to look at the data. |
| `npm run db:seed` | Creates the two dev accounts. |
| `npm run db:create-user -- …` | Creates one account (see above). |

---

## 8. "I want to change X" cheat-sheet

| I want to… | Edit |
|---|---|
| Change colours | `app/globals.css` (`:root` block) |
| Change the logo badge / app name in the sidebar | `components/app-sidebar.tsx` |
| Add, rename or reorder a menu item | `lib/nav.ts`, then create the page under `app/(app)/…` with `requireRole` |
| Build a placeholder page for real | Create `features/<domain>/<name>-page.tsx`, render it from the route file |
| Add a table or column | `lib/db/schema.ts`, then `npm run db:push` |
| Change login behaviour | `features/authentication/actions.ts` |
| Change who can open a page | The `requireRole(...)` call in that page |
| Change how long a login lasts | `SESSION_DURATION_MS` and `setExpirationTime("7d")` in `lib/auth/session.ts` |
| Add a shadcn component | `npx shadcn add <name>` (writes into `components/ui/`) |
| Change Docker ports | `.env` (`APP_HOST_PORT`, `DB_HOST_PORT`) |

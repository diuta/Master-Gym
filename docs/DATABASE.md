# Database

[Back to overview](./CODEBASE_OVERVIEW.md)

## 1. Overview

- **PostgreSQL 16**, the same major version as Sembako.
- **Drizzle ORM** for queries, **drizzle-kit** to apply the schema.
- The whole structure is defined in **one file: `lib/db/schema.ts`**. The database is made to match it with `npm run db:push`. There are no hand-written SQL migrations so far.

## 2. Tables

### Enum `role`

| Value | Meaning |
|---|---|
| `superadmin` | Owner/manager: reports and master data |
| `kasir` | Front-desk cashier: daily operations |

### Table `users`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | Auto-increment. Drizzle returns it as a JS `number` (`mode: "number"`) |
| `name` | `varchar(100)` not null | Shown in the sidebar |
| `email` | `varchar(100)` not null, **unique** | Login identifier |
| `password` | `varchar(255)` not null | **bcrypt hash** (cost 10), never plain text |
| `role` | `role` enum not null | See above |
| `created_at` | `timestamp` not null, default now | |
| `updated_at` | `timestamp` not null, default now | Not auto-updated on change; set it in update queries |

Changed on day 1: added `role`; removed `failed_login_attempts` and `locked_until` (the login lockout was removed). An older database needs `npm run db:push` to catch up.

### Planned tables (not built yet)

From the spec and the decisions in [HANDOFF.md](./HANDOFF.md): `paket` (packages with a price per category), `member`, `membership` (each purchase/renewal period), `visit`, `trainer`, `program_pt`, `member_pt` (remaining PT sessions), `absensi` (check-ins), a transaction table with **1..n payment rows** (method + amount) for split payments, and the inventory/sales/purchases/expenses tables copied from Sembako. Money columns should be `decimal`, as in Sembako, to avoid rounding errors.

## 3. Connecting

| Who connects | How |
|---|---|
| The running app | `lib/db/index.ts`: one shared `pg.Pool`, wrapped as `db` (Drizzle, with the schema attached). Imports `server-only`, so it can't end up in browser code |
| drizzle-kit (`db:push`, `db:studio`) | `drizzle.config.ts`, which reads `DATABASE_URL` |
| CLI scripts (`seed.ts`, `create-user.ts`) | Each opens its **own** pool. They can't import `lib/db/index.ts` because `server-only` throws outside Next.js |

**SSL:** if `DATABASE_URL` contains `sslmode=require`, `lib/db/index.ts` removes it from the string and connects with `ssl: { rejectUnauthorized: false }`. Some hosted Postgres services use self-signed certificates that `pg` would otherwise reject. Without `sslmode=require`, the connection is plain (fine for localhost and Docker).

## 4. Where the database runs

| Setup | Port | `DATABASE_URL` |
|---|---|---|
| Native PostgreSQL 16 on Windows (service `postgresql-x64-16`) | 5432 | `postgres://mastergym:mastergym@localhost:5432/mastergym` |
| Docker (`docker compose up -d postgres`) | 5434 on `127.0.0.1` only | `postgres://mastergym:mastergym@localhost:5434/mastergym` |
| Inside the Docker network (app container → db container) | 5432 | `postgres://mastergym:mastergym@postgres:5432/mastergym` (set in `docker-compose.yml`) |

The native database and the Docker database are **separate**: data in one doesn't appear in the other.

Creating the native database once (as the `postgres` superuser):

```sql
CREATE ROLE mastergym LOGIN PASSWORD 'mastergym';
CREATE DATABASE mastergym OWNER mastergym;
```

The `mastergym/mastergym` password is a public dev default. Use a real password anywhere reachable from outside.

## 5. Day-to-day commands

| Task | Command |
|---|---|
| Apply schema changes | `npm run db:push` |
| Create dev accounts | `npm run db:seed` |
| Create one account | `npm run db:create-user -- --name=… --email=… --password=… --role=kasir` |
| Browse data in the browser | `npm run db:studio` |
| Target the Docker DB instead of `.env`'s | Prefix with `DATABASE_URL=postgres://mastergym:mastergym@localhost:5434/mastergym` |
| Run SQL in the Docker DB | `docker compose exec postgres psql -U mastergym -d mastergym` |

## 6. Rules for schema changes

1. Edit `lib/db/schema.ts`.
2. Run `npm run db:push` and **read what it says** before confirming. Dropping or renaming a column deletes that column's data.
3. Multi-table writes (e.g. "save member + membership + payments") go inside `db.transaction(async (tx) => { ... })`, so a failure undoes all of it.
4. Store money as `decimal`, dates without time as `date` (`"YYYY-MM-DD"`), and moments as `timestamp`.
5. Mention the change in this file.

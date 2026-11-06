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

### Enums (day 2)

| Enum | Values |
|---|---|
| `gender` | `male`, `female` |
| `member_category` | `pelajar`, `mahasiswa`, `umum` (decides which package price column applies) |
| `payment_method` | `cash`, `qris`, `transfer` (`debit` was removed on 2026-11-04, see "Removing an enum value" below) |

Sequence `member_no_seq`: source of member numbers (`MG-0001`, formatted in code with `nextval`).

All money columns are `decimal(14,2)` (whole Rupiah as `number` in TypeScript). Plain dates are `date` read as `"YYYY-MM-DD"` strings.

### Table `packages`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `name` | `varchar(100)` not null | |
| `months` | `integer` not null | Duration |
| `price_pelajar` | `decimal(14,2)` not null | Price for the Pelajar category (added 2026-11-04) |
| `price_mahasiswa` | `decimal(14,2)` not null | Price for the Mahasiswa category |
| `price_umum` | `decimal(14,2)` not null | Price for the Umum category |
| `is_active` | `boolean` not null, default true | Inactive packages can't be sold but old memberships keep working |
| `created_at`, `updated_at` | `timestamp` not null, default now | |

Since 2026-11-04 (spec alignment piece 2) each package stores its own price per category and is managed by both the kasir and the superadmin. The table `category_prices` (monthly base price per category, price = base × months) was removed. `memberships.price`, `visits.price` and `pt_purchases.price` still store the price actually charged, which the kasir may edit on the form; `pt_purchases.sessions` stores the sessions actually sold. `visit_price` stays as the standard Harga Visit that pre-fills the Visit form.

#### Upgrading a database that has data

`db:push` cannot add `not null` columns to a non-empty `packages`. Add them with a default of 0, fill them from the old base price × months, then drop the defaults and drop `category_prices` (the SQL below does this). The dev DB was empty, so this was not run there. Run it before `npm run db:push`; afterwards `db:push` should report no changes.

```sql
begin;
alter table packages add column price_pelajar numeric(14,2) not null default 0;
alter table packages add column price_mahasiswa numeric(14,2) not null default 0;
alter table packages add column price_umum numeric(14,2) not null default 0;
update packages p set
  price_pelajar = coalesce((select c.price_per_month * p.months from category_prices c where c.category = 'pelajar'), 0),
  price_mahasiswa = coalesce((select c.price_per_month * p.months from category_prices c where c.category = 'mahasiswa'), 0),
  price_umum = coalesce((select c.price_per_month * p.months from category_prices c where c.category = 'umum'), 0);
alter table packages alter column price_pelajar drop default;
alter table packages alter column price_mahasiswa drop default;
alter table packages alter column price_umum drop default;
drop table category_prices;
commit;
```

A package whose category had no base price ends up with 0; set it in Kelola Paket before selling it.

### Table `members`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `member_no` | `varchar(20)` not null, **unique** | `MG-0001` |
| `name` | `varchar(100)` not null | |
| `phone` | `varchar(20)` not null, **unique** | Normalised to `08...` |
| `birth_date` | `date` nullable | |
| `gender` | `gender` not null | |
| `category` | `member_category` not null | |
| `photo_path` | `varchar(255)` not null | File under the uploads dir, never `public/` |
| `qr_token` | `varchar(64)` not null, **unique** | The only QR content |
| `created_at`, `updated_at` | `timestamp` not null, default now | |

### Table `memberships`

One row per purchase/renewal period.

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `member_id` | FK `members.id` not null | |
| `package_id` | FK `packages.id` not null | |
| `package_name`, `months`, `category`, `price` | not null | Copied at purchase time, so later price changes don't rewrite history |
| `start_date`, `end_date` | `date` not null | `end_date` is inclusive |
| `created_at` | `timestamp` not null, default now | |

### Table `payments`

1..n rows per purchase (split payment).

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `membership_id` | FK `memberships.id`, nullable | Link to a registration/renewal |
| `visit_id` | FK `visits.id`, nullable | Link to a visit (day 3) |
| `pt_purchase_id` | FK `pt_purchases.id`, nullable | Link to a PT purchase (day 3) |
| `sale_id` | FK `sales.id`, nullable | Link to a sale (day 4): money in |
| `purchase_id` | FK `purchases.id`, nullable | Link to a stock purchase (day 4): money out |
| `corporate_purchase_id` | FK `corporate_purchases.id`, nullable | Link to a corporate purchase (piece 3) |
| `method` | `payment_method` not null | |
| `amount` | `decimal(14,2)` not null | Rows of one purchase sum to its price |
| `paid_at` | `timestamp` not null, default now | |

Check `payments_one_link_v3`: `num_nonnulls(membership_id, visit_id, pt_purchase_id, sale_id, purchase_id, corporate_purchase_id) = 1`, so every payment row belongs to exactly one document. The check is renamed each time it gains a column (`payments_one_link` → `payments_exactly_one_link` → `payments_one_link_v3`) because drizzle-kit push does not update a check whose name is unchanged; `npm run db:push` replaces the check itself, and existing rows (exactly one link each) satisfy the new 6-column check. If you upgrade by hand, use `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_exactly_one_link;`.

### Day 3 tables

| Table | Columns | Notes |
|---|---|---|
| `visit_price` | `id` PK default 1, `price` decimal, `updated_at` | **Single row**: check `visit_price_single_row` (`id = 1`). Set by the superadmin. No row = Visit can't be sold |
| `trainers` | `id`, `name`, `phone`, `is_active`, `created_at`, `updated_at` | Managed by the superadmin; deleting a trainer used in a check-in only deactivates it (same for a PT program with purchases) |
| `pt_programs` | `id`, `name`, `sessions`, `price`, `is_active`, `created_at`, `updated_at` | "Per visit" = 1 session |
| `pt_purchases` | `id`, `member_id` FK, `pt_program_id` FK, `program_name`, `sessions`, `price`, `created_at` | Name, sessions and price are **copied** from the program at purchase time |
| `visits` | `id`, `name`, `phone`, `price`, `locker_no` nullable, `created_at` | A walk-in without membership. The row **is** the visitor check-in (`created_at` = check-in time). Has `checked_out_at` (nullable, day 5). Index on `created_at` |
| `check_ins` | `id`, `member_id` FK, `locker_no` nullable, `trainer_id` FK **nullable**, `checked_in_at`, `checked_out_at` nullable | One row per member check-in. `trainer_id` set = a PT session was used. Indexes on `checked_in_at` and `member_id` |

**PT balance is computed, not stored:** sum of `pt_purchases.sessions` for the member minus the count of that member's `check_ins` with `trainer_id` not null. PT sessions never expire. Check-in locks the member row so the balance can't go below zero.

**Check-out (day 5):** `check_ins.checked_out_at` and `visits.checked_out_at` are nullable timestamps (UTC wall-clock, like the others). `checkOutAction` sets one only if it is still null and the row is from today WIB.

### Corporate tables (piece 3)

| Table | Columns | Notes |
|---|---|---|
| `corporate_packages` | `id`, `company_name` varchar(100), `employee_count` int (≥ 50, recorded only), `visit_quota` int, `months` int, `price` decimal(14,2), `is_active`, `created_at`, `updated_at` | The definition, managed by kasir and superadmin. Company names are not unique. Deleting one that has purchases only deactivates it |
| `corporate_purchases` | `id`, `corporate_package_id` FK, `company_name`, `employee_count`, `visit_quota`, `price` (copies as sold), `start_date`, `end_date`, `created_at` | One sale. `start_date` is the WIB payment day; `end_date` = `membershipEndDate(start_date, months)`. Payments link through `payments.corporate_purchase_id` |
| `corporate_check_ins` | `id`, `corporate_purchase_id` FK, `employee_name` varchar(100), `phone` nullable, `locker_no` nullable, `checked_in_at`, `checked_out_at` nullable | One employee visit. Indexes on `checked_in_at` and `corporate_purchase_id` |

**Remaining visits** of a purchase = `visit_quota` − count of its `corporate_check_ins`. Computed, never stored (like the PT balance). A check-in locks the candidate purchases (`FOR UPDATE`), picks the valid one (`start_date ≤ today ≤ end_date`) that ends soonest and still has visits left, and inserts, so two simultaneous check-ins can't overdraw the quota.

### Table `opening_balance` (day 5)

Entered once by the superadmin in Home → Edit Keuangan.

| Column | Type | Notes |
|---|---|---|
| `id` | `integer` PK default 1 | **Single row**: check `opening_balance_single_row` (`id = 1`); the save uses `ON CONFLICT DO NOTHING`, so it can only be saved once |
| `cash`, `bank` | `decimal(14,2)` not null | Money on hand as of `as_of`. Bank covers QRIS and Transfer |
| `as_of` | `date` not null | Only movements dated on or after this day count toward the running balances (Uang Tunai / Uang di Bank) |
| `created_at` | `timestamp` not null, default now | |

There is no in-app way to change it after saving; fix a wrong value with SQL in `db:studio` or `psql`.

### Day 4 tables (shop)

Enums `stock_movement_type` (`initial`, `purchase`, `sale`, `purchase_cancel`, `sale_cancel`) and `transaction_status` (`success`, `cancelled`); sequences `sale_no_seq` and `purchase_no_seq` (invoice `PJ-0001` / `PB-0001`, formatted in code).

| Table | Columns | Notes |
|---|---|---|
| `product_categories` | `id`, `name` unique, `is_active`, timestamps | Managed by the kasir (Kelola Kategori) |
| `products` | `id`, `name`, `category_id` FK, `unit`, `sale_price`, `min_stock` (default 5), `avg_cost` decimal(14,4), `is_active`, timestamps | One unit per product. **There is no stock column** |
| `suppliers` | `id`, `name` unique, `phone` nullable, `is_active`, timestamps | Managed by the kasir (Kelola Supplier) |
| `stock_movements` | `id`, `product_id` FK, `qty_delta` int, `type`, `sale_item_id` / `purchase_item_id` nullable FKs, `created_at` | The stock ledger, see below |
| `sales` | `id`, `invoice_no` unique, `buyer_name` nullable, `date`, `notes`, `total`, `status`, `cancelled_at`, `created_by` FK `users.id` nullable, timestamps | `created_by` is the cashier who saved the sale (shown as Kasir in Riwayat Penjualan); null for sales saved before 2026-11-04 |
| `sale_items` | `id`, `sale_id` FK, `product_id` FK, `product_name`, `unit`, `qty`, `unit_price`, `unit_cost`, `line_total` | Name, unit, price and avg cost are **copied** at sale time (`unit_cost` feeds day 5 profit) |
| `purchases` | `id`, `invoice_no` unique, `supplier_id` FK, `supplier_name`, `supplier_invoice_no` varchar(50) nullable, `date`, `notes`, `total`, `status`, `cancelled_at`, timestamps | `supplier_invoice_no` is the supplier's own invoice number, optional, stored as null when left empty |
| `purchase_items` | `id`, `purchase_id` FK, `product_id` FK, `product_name`, `unit`, `qty`, `unit_cost`, `line_total` | `unit_cost` is typed by the kasir |
| `expense_categories` | `id`, `name` unique, `is_active`, timestamps | Managed by the superadmin; seeded with Listrik, Air, Gaji, Perawatan Alat, Kebersihan, Lainnya |
| `expenses` | `id`, `date`, `category_id` FK, `category_name`, `description`, `amount`, `method`, `created_at` | One method, no split, no payments rows |

**Ledger rule:** stock = `SUM(stock_movements.qty_delta)` per product. It is never stored anywhere else, and `stock_movements` is **insert-only**. Every stock change happens inside one transaction in `features/shop/actions.ts`: lock the product row with `lockProducts` (`SELECT … FOR UPDATE`, in `features/shop/stock.ts`, which also has the `stockSubquery` ledger sum), check, then insert the movement rows. A sale is blocked if stock < qty. Cancelling a sale or purchase sets `status = cancelled` and inserts reversing rows (`sale_cancel`, `purchase_cancel`); the original rows and their payments are kept. Cancelling a purchase is blocked when the product's current stock is less than the quantity bought.

**`avg_cost` (moving average):** on a purchase, new avg = (old stock × old avg + qty × unit cost) ÷ (old stock + qty); if old stock ≤ 0, avg = unit cost. A sale copies the current avg into `sale_items.unit_cost` and leaves it unchanged; so does cancelling a sale. Cancelling a purchase reverses the average best-effort (exact only when no other stock change happened since); if the cancel empties stock, the average is kept (not reset to 0).

**Which date reports use (built on day 5, `features/reports/queries.ts`):** each document's own date, not when it was saved. Sales, purchases and expenses use their `date` column (editable, no future dates); membership, visit and PT income use `payments.paid_at` converted to WIB. Rows with `status = cancelled` are excluded. Payments are money in when `sale_id` / `membership_id` / `visit_id` / `pt_purchase_id` is set and money out when `purchase_id` is set. Expenses have no `payments` rows: money out is purchases (via `payments.purchase_id`) plus the `expenses` table.

**Deactivate, not delete:** deleting a product, product category, supplier or expense category that is referenced only sets `is_active = false`; unused ones are really deleted. A product with stock > 0 can't be deleted. Creating a name that matches an inactive row reactivates that row. Old documents keep the copied names.

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
4. Store money as `decimal`, dates without time as `date` (`"YYYY-MM-DD"`), and moments as `timestamp`. `timestamp` columns (e.g. `payments.paid_at`) are without time zone and hold UTC wall-clock time (`now()` with the server time zone UTC), so day-5 "today" totals must convert to WIB first, e.g. `(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = <todayWib()>`.
5. Mention the change in this file.

### Removing an enum value

`db:push` cannot drop a value from a Postgres enum, so the enum has to be rebuilt by hand. This is what was run on 2026-11-04 to remove `debit` from `payment_method` (in the Docker dev DB: `docker compose exec -T postgres psql -U mastergym -d mastergym -v ON_ERROR_STOP=1`, SQL on stdin). Anyone upgrading an existing database must run it before `npm run db:push`. It aborts if any `debit` row exists, so convert those rows first.

```sql
begin;
do $$ begin
  if exists (select 1 from payments where method = 'debit') or exists (select 1 from expenses where method = 'debit')
  then raise exception 'debit rows exist; convert them first'; end if;
end $$;
alter type payment_method rename to payment_method_old;
create type payment_method as enum ('cash', 'qris', 'transfer');
alter table payments alter column method type payment_method using method::text::payment_method;
alter table expenses alter column method type payment_method using method::text::payment_method;
drop type payment_method_old;
commit;
```

After it, `npm run db:push` should report no changes. A fresh database needs none of this.

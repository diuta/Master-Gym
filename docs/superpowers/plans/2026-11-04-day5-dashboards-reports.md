# Day 5 — Dashboards, Laporan, Pengaturan Akun, Check-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-skills:superpowers-subagent-driven-development (recommended) or dev-skills:superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The kasir sees today's transactions, omzet and low stock; the superadmin sees profit, running Cash/Bank balances (from a one-time opening balance), a Laporan with period + Cash/Bank filters, and can change passwords; the kasir can check members and visitors out on Absen.

**Architecture:** New `features/reports/` holds one server query that returns every money movement as flat rows (payments joined to their document, plus expenses) and pure functions in `logic.ts` that turn rows into every number, so Dashboard, Home and Laporan can't disagree. Movements are loaded all-time once per request and filtered by period in JS. Opening balances are a single-row table. Password change lives in `features/administration/`; check-out extends `features/membership/`.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions, async `searchParams`), React 19, Drizzle 0.45 + drizzle-kit (`db:push`), Postgres 16, Zod 4, vitest 4, bcryptjs, shadcn base-nova in `components/ui/`. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-11-04-day5-dashboards-reports-design.md](../specs/2026-11-04-day5-dashboards-reports-design.md). Sections 3, 4, 5 and 7 are binding; read it before any task. Sembako reference: the repo at `/Users/diuta/Uta's Works/freelance/Sembako` is on `main`; read `staging` files with `git -C "/Users/diuta/Uta's Works/freelance/Sembako" show origin/staging:features/dashboard/<file>` (`dashboard-page.tsx`, `laporan-page.tsx`, `kpi-section.tsx`, `dashboard-card.tsx`). Copy **layout and components only**, never `laporan-calculations.ts` (its rules differ).

## Global Constraints

- **Never `git commit` or `git push`.** The user commits manually. (The commit steps of the plan template are replaced by "Stop and report".)
- Before writing Next.js code, check `node_modules/next/dist/docs/` for the API you use (AGENTS.md). Page `searchParams` is a Promise.
- **Never run Prettier.** Style: ~100 columns, double quotes, semicolons, as in surrounding files.
- Code, files, routes, DB in English; every UI string Indonesian.
- Pages in `app/` stay thin: `requireRole(...)` (or `verifySession()` on `/dashboard`), load data, render a component from `features/`.
- Every Server Action starts with `requireRole(...)`: `"superadmin"` for opening balance and password change; `"kasir"` for check-out.
- Money rules (spec section 3): sales/purchases/expenses count on their own `date`; membership/visit/PT on `payments.paid_at` in WIB; cancelled sales/purchases and their payments excluded everywhere; Bank = `qris` + `transfer` + `debit`, Cash = `cash`; money in = payments with `sale_id`/`membership_id`/`visit_id`/`pt_purchase_id`; money out = payments with `purchase_id` + `expenses`.
- **Cash + Bank = Semua exactly** for every amount (omzet, cost, expenses, profit, balances, per-product omzet/modal). Only `transactionCount` and the scaled per-product qty may not add up.
- Whole Rupiah everywhere in `features/reports/logic.ts` output; sale cost of goods is `Math.round` of Σ `qty × unit_cost` per sale, then split with `splitWhole`.
- Reuse, don't copy: `PeriodFilter`, `parsePeriod`, `periodRange`, `PERIOD_OPTIONS` (`lib/period.ts`), `todayWib`, `wibDayRange` (`features/membership/logic.ts`), `listProducts` (`features/shop/queries.ts`, gives `stockValue` and `status`), `listMembers`, `listAttendance`, `AttendanceTable`, `StatusBadge`, `CurrencyInput`, `EmptyState`, `rupiah`, `formatDateId`, `formatTimeWib`, `ActionResult` (`features/membership/validation.ts`).
- Comments only explain *why*. Known limits: `// shortcut: <limit>, <when to upgrade>`; the all-time in-memory load gets `// shortcut: aggregates in memory, fine for a few hundred thousand rows; move sums into SQL past that`.
- UI (UI.md): numbers big and in full Rupiah, text ≥ 16px for things read quickly, 44px targets (`h-11`), icon + text, AlertDialog before anything permanent. Colour tokens from `app/globals.css` only.
- After adding server exports, restart `npm run dev` before browser checks (HANDOFF section 5).

## Review Focus

1. **A sale paid Cash + Bank whose cost doesn't divide evenly.** Laporan Cash + Bank must equal Semua to the rupiah for Total Modal, Untung Bersih and Laba per Produk. Pinned in Task 1 (`splitWhole`, `saleCostShares`, `productProfit` tests) and the Task 5 browser check.
2. **A cancelled sale or purchase.** It disappears from every number, table and balance, including its payment rows. Pinned in Task 2 Step 3 (SQL check) and the Task 5 browser check.
3. **A transaction backdated before the opening balance date.** It counts in period numbers but not in Uang di Bank / Uang Tunai. Pinned in Task 1 (`balances` test).
4. **Opening balance saved twice** (double click, second tab). The second save returns "Saldo awal sudah diisi." and changes nothing. Pinned in Task 4 Step 5.
5. **A period with no income** (e.g. Hari Ini at opening time). Persentase Untung shows "–", tables show empty states, no `NaN` or `Infinity` anywhere. Pinned in Task 1 (`profitPercent` test) and Task 3/5 browser checks.

---

## File Structure

| File | Responsibility |
|---|---|
| `features/reports/logic.ts` (+ test) | Movement types, `methodOf`, `splitWhole`, `saleCostShares`, `inRange`, every aggregate, `recentTransactions`, `productProfit`, `parseMethodFilter` |
| `features/reports/validation.ts` (+ test) | `OpeningBalanceSchema` |
| `features/reports/queries.ts` | `listMovements()`, `listSaleLines()`, `getOpeningBalance()` (server-only) |
| `features/reports/actions.ts` | `saveOpeningBalanceAction` |
| `features/reports/stat-tile.tsx`, `dashboard-card.tsx` | Number tile and table panel shell (ported from Sembako) |
| `features/reports/low-stock-table.tsx`, `recent-transactions-table.tsx` | Tables shared by Dashboard and Home |
| `features/reports/kasir-dashboard-page.tsx` | Kasir Dashboard |
| `features/reports/home-page.tsx`, `opening-balance-dialog.tsx`, `expiring-members-table.tsx` | Superadmin Home + Edit Keuangan |
| `features/reports/reports-page.tsx`, `method-filter.tsx`, `product-profit-table.tsx`, `sales-detail-table.tsx` | Laporan |
| `features/administration/validation.ts` (+ test), `actions.ts`, `account-settings-page.tsx` | Pengaturan Akun |
| `features/membership/*` (attendance table, queries, actions, validation, check-in page) | Check-out |
| `lib/db/schema.ts` | `opening_balance` table; `checked_out_at` on `check_ins` and `visits` |
| `app/(app)/dashboard`, `reports`, `administration/account-settings` `/page.tsx` | Thin pages (replace placeholders) |
| `components/placeholder-page.tsx` | Deleted when unused (Task 8) |

---

### Task 1: Report rules (pure functions)

**Files:**
- Create: `features/reports/logic.ts`, `features/reports/logic.test.ts`

**Interfaces:**
- Consumes: nothing (no server imports; client components may import this file).
- Produces:
  - `type Method = "cash" | "bank"`; `type MethodFilter = "all" | Method`; `type IncomeKind = "sale" | "membership" | "visit" | "pt"`; `type Kind = IncomeKind | "purchase" | "expense"`.
  - `type Movement = { date: string /* YYYY-MM-DD WIB */; at: Date; direction: "in" | "out"; kind: Kind; docId: number; label: string /* invoice no. or name */; method: Method; amount: number; cost: number /* 0 unless kind = "sale" */ }`.
  - `type Opening = { cash: number; bank: number; asOf: string } | null`.
  - `methodOf(m: "cash" | "qris" | "transfer" | "debit"): Method`.
  - `parseMethodFilter(v: string | undefined): MethodFilter` — unknown → `"all"`.
  - `splitWhole(total: number, weights: number[]): number[]` — `floor(total × w ÷ Σw)` each, leftover rupiah all to the index of the largest weight (first on a tie); Σw = 0 → everything to index 0; result always sums to `total`.
  - `saleCostShares(cost: number, paymentAmounts: number[]): number[]` = `splitWhole(Math.round(cost), paymentAmounts)`.
  - `inRange(rows: Movement[], range: { from?: string; to?: string }): Movement[]` — inclusive, missing end unbounded.
  - `byMethod(rows: Movement[], f: MethodFilter): Movement[]`.
  - `omzet(rows, f): number`; `omzetByKind(rows, f): Record<IncomeKind, number>`; `costOfGoods(rows, f): number`; `expensesTotal(rows, f): number` (kind `expense` only); `netProfit(rows, f): number` = omzet − costOfGoods − expensesTotal; `goodsProfit(rows, f): number` = Σ `sale` amounts − costOfGoods; `profitPercent(rows, f): number | null` (omzet 0 → `null`, else rounded to 1 decimal); `transactionCount(rows, f): number` (distinct `kind:docId` among `in` rows).
  - `balances(opening: Opening, rows: Movement[]): { cash: number; bank: number }` — opening + Σ in − Σ out per method, only rows with `date >= opening.asOf`; `null` opening → 0 and every row counts.
  - `type RecentTx = { kind: IncomeKind; docId: number; at: Date; date: string; label: string; methods: Method[]; total: number }`; `recentTransactions(rows: Movement[], limit = 10): RecentTx[]` — `in` rows grouped by `kind:docId`, newest `at` first, `methods` unique in order cash, bank.
  - `type SaleLine = { saleId: number; date: string; productId: number; productName: string; qty: number; lineTotal: number; rawCost: number /* qty × unit_cost, unrounded */ }`; `type ProductProfitRow = { productId: number; productName: string; qty: number; omzet: number; cost: number; profit: number }`; `productProfit(lines: SaleLine[], sales: Movement[], f: MethodFilter): ProductProfitRow[]` — sorted by profit desc.

- [ ] **Step 1: Write the failing tests** in `logic.test.ts` (build `Movement` rows with a small `mv({...})` helper defaulting `at`, `label`, `cost: 0`):
  - `splitWhole(5001, [3333, 6667])` → `[1666, 3335]`; `splitWhole(10, [1, 1, 1])` → `[4, 3, 3]`; `splitWhole(7, [0, 0])` → `[7, 0]`; sum always equals total for `splitWhole(99999, [1, 2, 3, 4])`.
  - `saleCostShares(5000.5, [3333, 6667])` → `[1666, 3335]`.
  - Split sale fixture: sale docId 1 total 10 000 paid cash 3 333 (cost 1 666) + bank 6 667 (cost 3 335); membership 300 000 cash; expense 50 000 bank; purchase 20 000 cash. Assert `omzet(all)` 310 000, `omzet(cash)` 303 333, `omzet(bank)` 6 667; `costOfGoods(cash) + costOfGoods(bank) === costOfGoods(all) === 5 001`; `netProfit(all)` 254 999 and `netProfit(cash) + netProfit(bank) === netProfit(all)`; `goodsProfit(all)` 4 999; `transactionCount(all)` 2, `(cash)` 2, `(bank)` 1; `omzetByKind(all)` `{ sale: 10000, membership: 300000, visit: 0, pt: 0 }`.
  - `profitPercent([], "all")` → `null`; a cash membership of 200 000 plus a cash expense of 150 000 → `25`; the split-sale fixture → `82.3` (254 999 ÷ 310 000, 1 decimal).
  - `balances({ cash: 1000000, bank: 500000, asOf: "2026-11-10" }, rows)` where a cash sale of 10 000 is dated `2026-11-09` and a bank expense of 50 000 is dated `2026-11-10` → `{ cash: 1000000, bank: 450000 }`; `balances(null, sameRows)` → `{ cash: 10000, bank: -50000 }`.
  - `inRange` keeps both ends; `{}` keeps all.
  - `recentTransactions`: the split sale appears once with `methods: ["cash", "bank"]` and `total: 10000`; purchases and expenses never appear; limit respected.
  - `productProfit`: two lines on the split sale (A: lineTotal 6 000, rawCost 3 000.25; B: lineTotal 4 000, rawCost 2 000.25) → under `"all"` A+B omzet = 10 000 and cost = 5 001; under `"cash"` Σ omzet = 3 333 and Σ cost = 1 666; per product `cash + bank === all` for omzet and cost; `qty` under `"cash"` = qty × 3 333 ÷ 10 000 (not rounded).
  - `methodOf("qris")` → `"bank"`; `parseMethodFilter("x")` → `"all"`.
  - A comment in the test file: cancelled documents never reach these functions; `listMovements` filters them (Task 2).
- [ ] **Step 2:** `npx vitest run features/reports/logic.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement `logic.ts`.** `productProfit` algorithm (the tests don't fully pin it):
  ```
  for each sale (group lines by saleId; its payment rows = sales.filter(kind "sale", docId)):
    saleCost   = Σ shares in its rows (already whole, = round(Σ rawCost))
    methodAmt  = f === "all" ? sale total : Σ amount of rows with that method
    methodCost = f === "all" ? saleCost   : Σ cost of rows with that method
    lineOmzet  = splitWhole(methodAmt,  lines.map(l => l.lineTotal))
    lineCost   = splitWhole(methodCost, lines.map(l => l.rawCost))
    lineQty    = l.qty × methodAmt ÷ sale total
  then sum by productId; skip sales with methodAmt = 0
  ```
- [ ] **Step 4:** `npx vitest run features/reports/logic.test.ts` → PASS; `npm test`, `npx tsc --noEmit`, `npm run lint` clean. Stop and report.

### Task 2: Schema and money queries

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `features/reports/queries.ts`

**Interfaces:**
- Consumes: Task 1 `Movement`, `SaleLine`, `Opening`, `methodOf`, `saleCostShares`.
- Produces:
  - Drizzle `openingBalance` table `opening_balance { id integer pk default 1, cash decimal(14,2) not null, bank decimal(14,2) not null, asOf date (string mode) not null, createdAt timestamp default now }` with check `opening_balance_single_row` (`id = 1`).
  - `checkIns.checkedOutAt` and `visits.checkedOutAt`: nullable `timestamp("checked_out_at")` (used by Task 7; added here so there is one `db:push`).
  - `listMovements(): Promise<Movement[]>` (`import "server-only"`) — all time.
  - `listSaleLines(): Promise<SaleLine[]>` — lines of non-cancelled sales, all time.
  - `getOpeningBalance(): Promise<Opening>`.

- [ ] **Step 1:** Add the table and columns. `npm run db:push` (dev data; never accept a drop). Confirm with `docker compose exec postgres psql -U mastergym -d mastergym -c "\d opening_balance"`.
- [ ] **Step 2:** Write `listMovements()`: one select over `payments` left-joining `sales`, `purchases`, `memberships` (+ `members` for the name), `visits`, `ptPurchases` (+ `members`), keeping rows whose linked sale/purchase is not `cancelled`; `date` = `sales.date` / `purchases.date`, else `(paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date` as text; `at` = `paid_at`; `label` = invoice no. for sales/purchases, member or visitor name otherwise. Union in `expenses` (`direction "out"`, `kind "expense"`, `label` = description, `at` = `createdAt`). Then in JS, for each sale, compute its raw cost (Σ `sale_items.qty × unit_cost` from one grouped query) and assign `cost` to its payment rows with `saleCostShares` (rows ordered by payment id). Add the in-memory `// shortcut:` comment from Global Constraints.
- [ ] **Step 3: SQL cross-check** (the repo has no DB tests, and `queries.ts` is `server-only`, so it can't run from a script). Done during Task 3 Step 4, once a page calls `listMovements()`: with dev data containing one cancelled sale and one split-payment sale, a temporary `console.log` of the Σ `kind = "sale"` amounts and the Σ `kind = "purchase"` amounts must equal, in psql, `select sum(p.amount) from payments p join sales s on s.id = p.sale_id where s.status = 'success'` and the same for `purchases`. Record both pairs in the report and remove the log.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, `npm test` clean. Stop and report.

### Task 3: Shared pieces + Kasir Dashboard

**Files:**
- Create: `features/reports/stat-tile.tsx`, `dashboard-card.tsx`, `low-stock-table.tsx`, `recent-transactions-table.tsx`, `kasir-dashboard-page.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: Task 1 `inRange`, `transactionCount`, `omzet`, `recentTransactions`, `RecentTx`; Task 2 `listMovements`; `listProducts`, `ProductRow`, `PeriodFilter`, `parsePeriod`, `periodRange`.
- Produces:
  - `StatTile({ label: string; value: string; hint?: string; icon: LucideIcon })` — value in `text-2xl`+ full Rupiah or count.
  - `DashboardCard({ title: string; description?: string; icon: LucideIcon; children: ReactNode })` — port of Sembako `dashboard-card.tsx`.
  - `LowStockTable({ products: ProductRow[] })` — rows with `status !== "in_stock"`, columns Nama, Kategori, Stok (+ unit), Min, Status (`StatusBadge`); none → EmptyState "Semua stok aman".
  - `RecentTransactionsTable({ rows: RecentTx[] })` — Waktu (`formatDateId(date)` + `formatTimeWib(at)`), Jenis (`Penjualan` / `Membership` / `Visit` / `PT`), Keterangan (`label`), Metode (`Cash`, `Bank` or `Cash + Bank`), Total; none → EmptyState "Belum ada transaksi di periode ini."
  - `KasirDashboardPage({ period: Period; from?: string; to?: string; count: number; omzet: number; products: ProductRow[]; recent: RecentTx[] })`.

- [ ] **Step 1:** Read Sembako's `dashboard-page.tsx`, `dashboard-card.tsx`, `kpi-section.tsx` via `git show origin/staging:…` and port the tile/panel layout (no `KpiSection` collapse needed unless the page gets crowded; builder's call).
- [ ] **Step 2:** Build the components and `KasirDashboardPage`: `PeriodFilter`, tiles **Jumlah Transaksi** and **Total Omzet**, then `DashboardCard` "Stok Menipis / Habis" and "Transaksi Terbaru".
- [ ] **Step 3:** `/dashboard` page: `const session = await verifySession()`; `const period = parsePeriod(sp.period ?? "today")` (page default Hari Ini); kasir → load `listMovements()` + `listProducts()`, compute `inRange(rows, periodRange(period, todayWib(), sp))`, render `KasirDashboardPage`; superadmin → keep the placeholder until Task 4.
- [ ] **Step 4: Browser (controller)** as kasir: Hari Ini with no transactions → 0, Rp0, empty states; sell one item, register a visit → count 2, omzet = their sum, both in Transaksi Terbaru newest first; a split sale shows "Cash + Bank"; a cancelled sale is absent; a product at or below min shows in Stok Menipis. Do the Task 2 Step 3 cross-check here, then remove the log. `tsc`, lint, tests. Stop and report.

### Task 4: Opening balance + Superadmin Home

**Files:**
- Create: `features/reports/validation.ts`, `validation.test.ts`, `actions.ts`, `opening-balance-dialog.tsx`, `expiring-members-table.tsx`, `home-page.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: Tasks 1–3 (incl. Task 2 `getOpeningBalance`); `listMembers`, `MemberRow`, `listAttendance`, `AttendanceRow`, `AttendanceTable`, `todayWib`.
- Produces:
  - `OpeningBalanceSchema` = `{ asOf: YYYY-MM-DD not after todayWib() ("Tanggal tidak boleh di masa depan."); cash: int ≥ 0; bank: int ≥ 0 }`; `type OpeningBalanceInput`.
  - `saveOpeningBalanceAction(input: OpeningBalanceInput): Promise<ActionResult>` (`requireRole("superadmin")`) — insert `id = 1` with `onConflictDoNothing().returning()`; nothing returned → `{ message: "Saldo awal sudah diisi." }`; `revalidatePath("/dashboard")`.
  - `OpeningBalanceDialog()` — trigger button "Edit Keuangan"; fields Saldo per Tanggal (date, default `todayWib()`), Saldo Awal Tunai, Saldo Awal Bank (`CurrencyInput`); help text "Uang yang ada di laci dan rekening pada awal tanggal ini. Transaksi sejak tanggal ini dihitung otomatis."; warning "Hanya bisa diisi sekali."; AlertDialog confirm before calling the action.
  - `ExpiringMembersTable({ members: MemberRow[] })` — `status === "expiring"`, sorted by `daysRemaining` asc; columns Nama, No. HP, Paket, Berakhir (`formatDateId(endDate)`), Sisa Hari; none → EmptyState "Tidak ada member yang segera habis".
  - `HomePage({ period; from?; to?; opening: Opening; balances: { cash: number; bank: number }; netProfit; expenses; goodsProfit; count; totalProducts; stockValue; activeMembers; totalMembers; products: ProductRow[]; recent: RecentTx[]; attendance: AttendanceRow[]; members: MemberRow[] })`.

- [ ] **Step 1: Failing tests** in `features/reports/validation.test.ts`: negative cash → error; future `asOf` → "Tanggal tidak boleh di masa depan."; `asOf` today with cash 0, bank 0 → success; malformed date → error.
- [ ] **Step 2:** `npx vitest run features/reports/validation.test.ts` → FAIL; implement the schema; → PASS.
- [ ] **Step 3:** Action, dialog, `ExpiringMembersTable`, `HomePage` per spec 5.4: Keuangan row (Total Laba, Uang di Bank "saldo saat ini", Uang Tunai "saldo saat ini", Total Pengeluaran) with `OpeningBalanceDialog` shown only when `opening === null`, plus the note "Saldo awal belum diisi" in that case; Rekap row (Total Produk, Nilai Stok Saat Ini = Σ `stockValue`, Untung Barang Terjual, Member Aktif as "N dari M member" where N = members with status `active` or `expiring`, Jumlah Transaksi); tables Stok Menipis/Habis, Transaksi Terbaru, Absensi Hari Ini (`listAttendance(todayWib())`, no check-out button), Reminder Member.
- [ ] **Step 4:** `/dashboard` superadmin branch: period default Hari Ini; period numbers from `inRange(allRows, range)` with filter `"all"`; balances from `balances(opening, allRows)`.
- [ ] **Step 5: Browser (controller)** as superadmin: before saving, balances = net of all money and the note shows; save opening Cash Rp1.000.000 / Bank Rp500.000 as of today → button gone, balances = opening + today's movements; save again from a second tab opened before → "Saldo awal sudah diisi." and values unchanged; calling the action as kasir fails at `requireRole`; check Total Laba by hand against the day's test transactions. `tsc`, lint, tests. Stop and report.

### Task 5: Laporan

**Files:**
- Create: `features/reports/method-filter.tsx`, `product-profit-table.tsx`, `sales-detail-table.tsx`, `reports-page.tsx`
- Modify: `features/reports/queries.ts` (only if `listSaleLines` needs a tweak), `app/(app)/reports/page.tsx`

**Interfaces:**
- Consumes: Task 1 everything incl. `productProfit`, `parseMethodFilter`; Task 2 `listMovements`, `listSaleLines`; Task 3 `StatTile`, `DashboardCard`.
- Produces:
  - `MethodFilter({ value: MethodFilter })` — select Semua / Cash / Bank, writes `?method=` keeping other params (same `router.push` pattern as `PeriodFilter`); `h-11`.
  - `ProductProfitTable({ rows: ProductProfitRow[] })` — Produk, Terjual (integer under Semua, up to 2 decimals otherwise), Omzet, Modal, Laba; a total row; none → EmptyState.
  - `SalesDetailTable({ rows: { date: string; label: string; total: number }[] })` — Tanggal, No. Invoice, Total; total row.
  - `ReportsPage({ period: Period; from?: string; to?: string; method: MethodFilter; tiles: { count: number; omzet: number; byKind: Record<IncomeKind, number>; cost: number; net: number; percent: number | null; periodExpenses: number; allExpenses: number }; products: ProductProfitRow[]; sales: { date: string; label: string; total: number }[] })`.

- [ ] **Step 1:** Port the Sembako `laporan-page.tsx` layout (filter bar, tile grid, two tables); replace every calculation with Task 1 functions.
- [ ] **Step 2:** Page: `requireRole("superadmin")`; `period = parsePeriod(sp.period)` (default Bulan Ini); `method = parseMethodFilter(sp.method)`; `rows = inRange(all, range)`; tiles from `transactionCount`, `omzet`, `omzetByKind`, `costOfGoods`, `netProfit`, `profitPercent`, `expensesTotal(rows)`, `expensesTotal(all)` (Semua Waktu, follows `method`); products = `productProfit(linesInRange, rows.filter(kind sale), method)`; sales detail = `byMethod(rows, method)` sale rows grouped by `docId` (Σ amount), newest date first. Persentase Untung `null` → "–".
- [ ] **Step 3: Browser (controller)** with a split sale whose cost doesn't divide evenly (e.g. an item with Harga Modal Rp3.333 sold ×1 at Rp10.000, paid Cash Rp3.333 + QRIS Rp6.667): Semua vs Cash vs Bank → every amount tile and both tables' totals satisfy Cash + Bank = Semua; Untung Bersih with Semua equals Home's Total Laba for the same period; cancel a sale → it leaves every number; an empty period → "–" and empty states. `tsc`, lint, tests. Stop and report.

### Task 6: Pengaturan Akun

**Files:**
- Create: `features/administration/validation.ts`, `validation.test.ts`, `actions.ts`, `account-settings-page.tsx`
- Modify: `app/(app)/administration/account-settings/page.tsx`

**Interfaces:**
- Consumes: `users`, `db`, `requireRole`, bcryptjs, `ActionResult`.
- Produces:
  - `ChangePasswordSchema` = `{ target: "kasir" | "self"; currentPassword: non-empty ("Password saat ini wajib diisi."); newPassword: ≥ 8 chars ("Password minimal 8 karakter."); confirmPassword }` refined `newPassword === confirmPassword` ("Password tidak sama.", on `confirmPassword`).
  - `changePasswordAction(input: ChangePasswordInput): Promise<ActionResult>` (`requireRole("superadmin")`) — load the session user; `bcrypt.compare(currentPassword, user.password)` false → `{ errors: { currentPassword: ["Password saat ini salah."] } }`; target `kasir` → the users with role `kasir`, exactly one or `{ message: "Akun kasir tidak ditemukan." }` / `"Akun kasir lebih dari satu."`; update `password = await bcrypt.hash(newPassword, 10)`, `updatedAt = new Date()`.
  - `AccountSettingsPage()` — two cards, **Password Kasir** and **Password Saya**, each with Password Anda Saat Ini, Password Baru, Ulangi Password Baru, button Simpan; success message "Password berhasil diganti."; a line "Perangkat yang sudah login tetap login sampai keluar." 

- [ ] **Step 1: Failing tests**: short password → "Password minimal 8 karakter."; mismatch → "Password tidak sama."; empty current → error; valid input with each target → success.
- [ ] **Step 2:** `npx vitest run features/administration/validation.test.ts` → FAIL; implement; → PASS.
- [ ] **Step 3:** Action + page.
- [ ] **Step 4: Browser (controller)**: change the kasir password with a wrong current password → field error, nothing changed; with the right one → log out, kasir logs in with the new password, the old one fails; change own password the same way. Reset both to `password123` afterwards (dev seed). `tsc`, lint, tests. Stop and report.

### Task 7: Check-out

**Files:**
- Modify: `features/membership/validation.ts` (+ test), `queries.ts`, `actions.ts`, `attendance-table.tsx`, `check-in-page.tsx`, `attendance-page.tsx` (if props change)

**Interfaces:**
- Consumes: Task 2 `checkIns.checkedOutAt`, `visits.checkedOutAt`; `wibDayRange`, `todayWib`.
- Produces:
  - `AttendanceRow` gains `id: number` (check-in id or visit id) and `checkedOutAt: Date | null`; `listAttendance` selects both.
  - `CheckOutSchema` = `{ kind: "member" | "visitor"; id: positive int }`.
  - `checkOutAction(input: CheckOutInput): Promise<ActionResult>` (`requireRole("kasir")`) — `UPDATE … SET checked_out_at = now() WHERE id = ? AND checked_out_at IS NULL AND <checked-in time> >= wibDayRange(todayWib()).start` on `check_ins` or `visits`; zero rows → still `{ success: true }`; `revalidatePath` `/membership/check-in`, `/membership/attendance`, `/dashboard`.
  - `AttendanceTable({ rows; showDate?; onCheckOut?: (row: AttendanceRow) => void; pendingId?: string })` — new column **Jam Keluar** (`formatTimeWib(checkedOutAt)` or "-"); when `onCheckOut` is given and `checkedOutAt` is null, a **Logout** button (`h-11`, icon + text) in that cell, disabled while that row is pending.

- [ ] **Step 1: Failing tests** in `features/membership/validation.test.ts`: `CheckOutSchema` rejects `id: 0`, `kind: "x"`; accepts `{ kind: "visitor", id: 3 }`.
- [ ] **Step 2:** Run → FAIL; implement schema → PASS.
- [ ] **Step 3:** Query, action, table, and `check-in-page.tsx` passing `onCheckOut` (calls the action, then `router.refresh()` and `inputRef.current?.focus()` so the next scan works with no click). Riwayat Absen and Home show Jam Keluar without the button.
- [ ] **Step 4: Browser (controller)** as kasir: check in a member and register a visit → both show Logout; click Logout on each → time appears, button gone, the scan input has focus (type a token + Enter works immediately); double-click Logout → one time stored; Riwayat Absen shows Jam Keluar; yesterday's rows (via `?date=`) have no button. `tsc`, lint, tests. Stop and report.

### Task 8: Docs and full verification

**Files:** `docs/HANDOFF.md`, `docs/DATABASE.md`, `docs/CODEBASE_OVERVIEW.md`, `docs/AUTH.md`, `docs/UI.md` (new components), the spec's Status line; delete `components/placeholder-page.tsx` if `grep -r PlaceholderPage app features` finds nothing.

- [ ] **Step 1:** HANDOFF: section 4 rows for the day 5 decisions (spec section 4); section 5 current state "end of day 5" with known gaps (opening balance has no in-app fix; in-memory aggregation shortcut; sessions not revoked on password change; check-out only for today); section 10 marked done except the real-world test. DATABASE: `opening_balance`, `checked_out_at` on both tables, and the "which date reports use" paragraph changed from plan to built. CODEBASE_OVERVIEW: `features/reports/`, `features/administration/`, routes no longer placeholders, test list. AUTH: Pengaturan Akun exists (password change, current password required). UI: `StatTile`, `DashboardCard`. Spec status → implemented.
- [ ] **Step 2:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` all clean.
- [ ] **Step 3:** Stop and report, listing anything for the real-world front-desk test (scanner, webcam, phone view of Home and Laporan).

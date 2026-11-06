# Day 5 — Dashboards, Laporan, Pengaturan Akun, Check-out: Design

Date: 2026-11-04 · Status: implemented (2026-11-04); plan: [2026-11-04-day5-dashboards-reports.md](../plans/2026-11-04-day5-dashboards-reports.md)

Read with [HANDOFF.md](../../HANDOFF.md) (section 3 spec summary, section 10 day 5), [DATABASE.md](../../DATABASE.md) (tables, "which date reports use") and the day 4 design ([2026-10-30-day4-shop-design.md](./2026-10-30-day4-shop-design.md)). The original client spec is "INFORMASI GENERAL APLIKASI GYM" (8 Oct 2026), kept outside the repo; the parts that matter here are quoted below. Day 2–4 conventions carry over unchanged: money `decimal(14,2)`, WIB "today", Server Action shape (`requireRole` → Zod → transaction → `revalidatePath`), UI rules in UI.md, never commit.

## 1. Why

Days 2–4 record every rupiah that moves (memberships, visits, PT, sales, purchases, expenses) but nobody can see the totals. The owner (superadmin) has no daily operations and only looks at numbers, so without day 5 the superadmin login is almost empty. The kasir needs a quick "how is today going" view and to see low stock. Day 5 also fills two leftovers: changing passwords (today only possible in the DB) and the check-out button the original spec asked for on Absen.

**Done when:** every number on Dashboard, Home and Laporan can be checked by hand against a few test transactions; the Laporan Cash/Bank filter changes them correctly; the superadmin can set opening balances once and change both passwords; the kasir can log a member or visitor out on Absen.

## 2. Goals, non-goals, anti-goals

**Goals**
1. **Kasir Dashboard** (`/dashboard` as kasir).
2. **Superadmin Home** (`/dashboard` as superadmin), including **Edit Keuangan** (opening balances).
3. **Laporan** (`/reports`, superadmin).
4. **Pengaturan Akun** (`/administration/account-settings`, superadmin).
5. **Check-out** on Absen (kasir) and a Jam Keluar column in Riwayat Absen.

**Non-goals**
- A "Kasir" column in Riwayat Penjualan (user, 2026-11-04: one shared kasir account, the column would always say "Kasir").
- Changing names or emails in Pengaturan Akun (password only).
- Charts. The spec lists numbers and tables only.
- Export to PDF/Excel, printing.
- Refunds or cancels for memberships, visits or PT (still a known gap).
- Corporate package (on hold).
- Per-cashier accounts, session revocation on password change (AUTH.md known limits stay).

**Anti-goals (a failure even if it works)**
- Two pages showing different values for the same number and period (e.g. Omzet on Home ≠ Omzet on Laporan with filter "Semua").
- A cancelled sale or purchase counted anywhere.
- A number that changes with the Cash/Bank filter on Laporan in a way that can't be explained by hand (Cash + Bank must add up to Semua for every additive number).
- Opening balances that the superadmin can silently change after launch.
- The kasir reaching Home, Laporan, opening balances or password changes (pages *and* actions guarded).

## 3. Constraints

- Same as day 4 section 3. **No new libraries.**
- Every page and Server Action calls `requireRole(...)` itself.
- Reuse what exists: `components/period-filter.tsx` and `lib/period.ts` (`parsePeriod`, `periodRange`), `todayWib` / `wibDayRange` (`features/membership/logic.ts`), `stockStatus` (`features/shop/logic.ts`), `listProducts`, `listMembers`, `listAttendance`, `AttendanceTable`, `StatusBadge`, `rupiah`, `formatDateId`, `formatTimeWib`.
- Rules for money (from DATABASE.md, unchanged):
  - **Dates:** sales, purchases and expenses count on their own `date`; membership, visit and PT income counts on `payments.paid_at` converted to WIB.
  - **Cancelled** sales and purchases are excluded everywhere, including their payment rows (no refund row exists; the money is treated as returned).
  - **Bank** = `qris` + `transfer` + `debit`. **Cash** = `cash`.
  - **Money in:** payments linked to `sale_id`, `membership_id`, `visit_id`, `pt_purchase_id`. **Money out:** payments linked to `purchase_id`, plus the `expenses` table (one method each).
- `docs/HANDOFF.md` section 4 decisions stay valid.
- **Sembako reference (HANDOFF rule 1):** port the page layout and components of Sembako `staging` `features/dashboard/dashboard-page.tsx` and `laporan-page.tsx` (tiles, filter bar, tables), but **not its calculations**. Sembako uses different rules (Total Modal = purchases in the period, Modal per product = all-time purchases); every number here comes from section 5.1.

## 4. What the user decided (2026-11-04)

| Topic | Decision |
|---|---|
| Edit Keuangan | **Opening balances**: the superadmin enters starting Cash and Bank (money that existed before the app) **once** at launch. After saving, it is locked |
| Opening balance date | **Balance as of a date** (user, after the builder check): the superadmin enters the balances **and the date they are valid for** (default today). Only movements dated on or after that date count toward the running balances, so backdated entries and leftover test data before it don't double-count |
| Total Laba (Home) | **All income − all costs**: (sales + membership + visit + PT) − cost of goods sold − expenses. Same number as Untung Bersih on Laporan |
| Uang di Bank / Uang Tunai (Home) | **Running balance**: opening balance + all money in − all money out since launch. **Ignores the period filter** |
| Total Modal (Laporan) | **Cost of goods sold** in the period: Σ `sale_items.qty × unit_cost` of non-cancelled sales. Not money spent on stock |
| Timezone | **WIB** (as already built) |
| Check-out | **Yes**: a Logout button per row of today's Absen list records the time out; Jam Keluar shown in Absen and Riwayat Absen |
| Kasir column in Riwayat Penjualan | **Skip** |
| Pengaturan Akun | **Password only**: superadmin changes the kasir's password and their own |
| Approach | **One shared money list + tested pure functions** (section 5.1) |

Proposals the user accepted in the playback (2026-11-04):
- **Jumlah Transaksi** counts every paid document: sales, memberships (new and renewal), visits and PT purchases. Not purchases or expenses. Cancelled sales don't count.
- **Transaksi Terbaru** is one combined list of those documents, newest first.
- **Split payments under the Cash/Bank filter:** a document paid partly Cash, partly Bank counts toward each method by its own payment amount; a sale's cost of goods is split in the same ratio.
- **Check-out works for visitors too.** Logging out a row that is already logged out does nothing.
- **Purchases and expenses are money out** for the running balances.
- **Changing a password needs the superadmin's own current password.**

## 5. How it works

### 5.1 Approach

Considered:

1. **Shared money list + pure functions (chosen).** One server query (`features/reports/queries.ts`) returns every money movement as flat rows, plus the opening balances. Pure functions in `features/reports/logic.ts` (no server imports, like `features/shop/logic.ts`) turn rows into every number. Each rule lives once, so the three pages can't disagree, and the functions get vitest tests. Cost: "Semua Waktu" loads every movement into memory; fine at gym scale (tens of thousands of rows a year). Mark with `// shortcut: aggregates in memory, fine for a few hundred thousand rows; move sums into SQL past that`.
2. **One SQL `SUM` per number.** Fastest at any size, but ~12 queries each repeat the date/cancelled/Bank rules and none can be unit-tested (the project only unit-tests pure code). Rejected for the anti-goal "two pages disagree".
3. **A Postgres view.** Adds a DB object outside the current `db:push` habit and is as untestable as 2. Dropped.

**Movement row** (shape is the builder's call; this is the content):

| Field | Meaning |
|---|---|
| `date` | WIB calendar date it counts on (document `date`, or `paid_at` in WIB) |
| `at` | Timestamp for sorting "newest" (document `created_at` / `paid_at`) |
| `direction` | `in` / `out` |
| `kind` | `sale`, `membership`, `visit`, `pt`, `purchase`, `expense` |
| `docId` | The document's id (to group split payments back into one document) |
| `method` | `cash` / `bank` (already grouped) |
| `amount` | Rupiah, > 0 |
| `cost` | Only for `sale`: this payment row's share of the sale's cost of goods = sale COGS × (amount ÷ sale total) |

Cancelled sales/purchases are filtered out in the query, not in JS. The query takes an optional `{from, to}`; omitted = all time. The running balances use an all-time load (they ignore the filter), so a page may need two loads (period + all time). Reusing the all-time list for the period numbers by filtering in JS is fine and the builder's call.

**Pure functions** (names are a suggestion), all taking movement rows and an optional method filter (`all` / `cash` / `bank`):

- `omzet` = Σ `in` amounts.
- `costOfGoods` = Σ `cost` of `sale` rows.
- `expensesTotal` = Σ amounts of `expense` rows.
- `netProfit` = omzet − costOfGoods − expensesTotal.
- `profitPercent` = netProfit ÷ omzet × 100, `null` when omzet is 0 (shown as "–").
- `transactionCount` = number of distinct (`kind`, `docId`) among `in` rows. A split sale paid Cash + Bank counts **once** under "Semua" and once under each of Cash and Bank (so Cash + Bank may exceed Semua for the count only; amounts always add up).
- `balances(opening, rows)` = opening + Σ in − Σ out, per method, counting only rows with `date` ≥ `opening.asOf`. No opening row = opening 0 and every row counts.
- `goodsProfit` (Home "Untung Barang Terjual") = Σ `sale` amounts − costOfGoods.

Rounding (resolved after the builder check, my call): amounts are whole rupiah. A sale's cost of goods (Σ qty × `unit_cost`, `decimal(14,4)`) is first rounded to whole rupiah, then split across its payment rows in **whole rupiah**: each row gets `floor(cost × amount ÷ total)` and the leftover rupiah go to the largest payment row. So the shares of one sale always sum exactly to its rounded cost, and every Cash + Bank amount adds up exactly to Semua. The same split applies per product line in Laba per Produk. "Semua" cost of goods is the sum of the rounded per-sale costs, so it matches the shares. Test this with a split sale whose cost doesn't divide evenly.

### 5.2 Opening balances (Edit Keuangan)

- New single-row table `opening_balance` (same pattern as `visit_price`, check `id = 1`): `cash` decimal, `bank` decimal, `as_of` date, `created_at`. No row = not set.
- Home shows an **Edit Keuangan** button only while no row exists. It opens a dialog: **Saldo per Tanggal** (date input, default today WIB, no future dates), Saldo Awal Tunai, Saldo Awal Bank (both `CurrencyInput`, ≥ 0), help text "Uang yang ada di laci dan rekening pada awal tanggal ini. Transaksi sejak tanggal ini dihitung otomatis.", a warning "Hanya bisa diisi sekali", and an AlertDialog confirm before saving.
- `saveOpeningBalanceAction` (superadmin): inserts the row; if it already exists, returns "Saldo awal sudah diisi." (insert with `ON CONFLICT DO NOTHING`, check the result). No update path in the app. *(Fixing a typo needs a DB edit; see section 7.)*
- Not set yet: Home balances show opening = 0 and a small note "Saldo awal belum diisi".

### 5.3 Kasir Dashboard (`/dashboard`, kasir)

Original spec: *Filter Periode; Jumlah Transaksi, Total Omzet; Tabel Stok Menipis/Habis, Tabel Transaksi Terbaru.*

- `PeriodFilter`, **default Hari Ini** on this page *(my call: the spec's example; `parsePeriod` defaults to month elsewhere, so pass a page default)*.
- Two stat tiles: **Jumlah Transaksi**, **Total Omzet** (period, method = all).
- **Stok Menipis / Habis**: active products with `stockStatus` ≠ `in_stock`, columns Nama, Kategori, Stok, Min, Status badge. Empty → EmptyState "Semua stok aman". Not filtered by period.
- **Transaksi Terbaru**: last 10 documents in the period, newest first. Columns: Waktu (date + time WIB), Jenis (Penjualan / Membership / Visit / PT), Keterangan (invoice no. for sales; member or visitor name otherwise), Metode (Cash, Bank, or "Cash + Bank"), Total.

### 5.4 Superadmin Home (`/dashboard`, superadmin)

Original spec: *Filter Periode; Total Laba, Uang di Bank (QR/Transfer), Uang Tunai (Cash), Total Pengeluaran; Edit Keuangan (hanya aktif di awal rilis); Total Produk, Nilai Stok Saat Ini, Untung Barang Terjual, Total / Sisa Member Aktif, Jumlah Transaksi; tabel Stok Menipis/Habis, Transaksi Terbaru, Absensi Harian, Reminder Member (Habis ≤ 7 Hari).*

- `PeriodFilter`, **default Hari Ini**.
- **Keuangan** row: Total Laba (period), Uang di Bank (running, labelled "saldo saat ini"), Uang Tunai (running, "saldo saat ini"), Total Pengeluaran (period, `expenses` table only; stock purchases are covered by cost of goods). Edit Keuangan button next to the balances while unset.
- **Rekap** row: Total Produk (active products, now), Nilai Stok Saat Ini (Σ stock × avg cost, same as Inventori), Untung Barang Terjual (period), Member Aktif (members whose latest membership is `active` or `expiring` today) shown as "N dari M member" where M = all members *(my reading of "Total / Sisa Member Aktif")*, Jumlah Transaksi (period).
- Tables: **Stok Menipis/Habis** and **Transaksi Terbaru** (same as 5.3), **Absensi Hari Ini** (today WIB, reuse `AttendanceTable`, read-only, no Logout button; always today regardless of the period filter), **Reminder Member** (status `expiring`: Nama, No. HP, Paket, Berakhir, Sisa Hari, sorted by fewest days left).
- The superadmin has no photo access (`/api/uploads` is kasir-only); none of these tables show photos.

### 5.5 Laporan (`/reports`, superadmin)

Original spec: *Filter Periode (Semua Waktu, Hari Ini, dll); Filter Metode (Semua, Cash, Bank), seluruh nilai berubah; Jumlah Transaksi Penjualan, Total Omzet (Penjualan + Membership/Visit/Add-On), Total Modal, Untung Bersih (Kas), Persentase Untung, Pengeluaran Periode Ini, Total Pengeluaran (Semua Waktu); Tabel Laba per Produk (Produk, Terjual, Omzet, Modal); Tabel Detail Penjualan Periode Ini (Tanggal, No. Invoice, Total).*

- `PeriodFilter` (default Bulan Ini, as `parsePeriod`) plus a **Metode** select (Semua / Cash / Bank) as URL param `?method=`. Every number and table below follows both filters.
- Tiles: Jumlah Transaksi, Total Omzet, Total Modal, Untung Bersih, Persentase Untung, Pengeluaran Periode Ini, Total Pengeluaran (Semua Waktu; follows the method filter, ignores the period). Show a small Omzet breakdown under Total Omzet: Penjualan / Membership / Visit / PT.
- **Laba per Produk**: per product sold in the period: Produk, Terjual (qty), Omzet, Modal, Laba. Under a method filter, each sale's lines are scaled by that method's share of the sale's payments (same ratio as `cost`), so the table's totals match the tiles. Qty is scaled too and may show decimals under a method filter *(my call; see section 7)*.
- **Detail Penjualan**: product sales in the period: Tanggal, No. Invoice, Total (under a method filter, the amount paid by that method; sales with no payment in that method are hidden).
- The spec's "Untung Bersih (Kas)" is the same number as Home's Total Laba for the same period with method Semua.

### 5.6 Pengaturan Akun (`/administration/account-settings`, superadmin)

- Two cards: **Password Kasir** and **Password Saya**. Each: Password Baru, Ulangi Password Baru; plus **Password Anda Saat Ini** (the superadmin's own current password) on both.
- `changePasswordAction({ target: "kasir" | "self", currentPassword, newPassword })` (superadmin): verify the superadmin's current password with bcrypt, require new password ≥ 8 characters and matching confirmation (Zod), hash with bcrypt cost 10 (as `create-user.ts`), update `users.password` and `updated_at`. The kasir target is the user with role `kasir` (exactly one; if none or several, return an error message).
- Success message; existing sessions stay logged in (AUTH.md known limit; note it on the page in one line).

### 5.7 Check-out (Absen + Riwayat Absen, kasir)

- Add nullable `checked_out_at` timestamp to `check_ins` and to `visits`.
- Absen's today list gains **Jam Keluar** and a **Logout** button per row without one. After check-out the cell shows the time and the button disappears.
- `checkOutAction({ kind: "member" | "visit", id })` (kasir): `UPDATE … SET checked_out_at = now() WHERE id = ? AND checked_out_at IS NULL`; zero rows updated = already logged out, return success quietly. Only rows whose check-in is today WIB can be checked out *(my call: the button only exists on today's list)*.
- Riwayat Absen shows Jam Keluar (empty if never logged out). Focus returns to the scan input after a Logout click, so the scanner flow is unchanged.
- No confirm dialog (it's reversible in effect and one click is the point) *(my call)*.

### 5.8 Tests (vitest)

Pure functions in `features/reports/logic.ts`:
- omzet, costOfGoods, netProfit, profitPercent (incl. omzet 0)
- method filter: Cash + Bank = Semua for every amount, with a split sale
- transactionCount: split document counted once under Semua
- balances with opening balances, money in and out, and rows dated before `asOf` ignored
- cost split of a split sale in whole rupiah (shares sum exactly, leftover to the largest payment)
- cost share of a split sale
- cancelled rows are not passed in (covered by the query; note it in the test file)

Zod: password schema (too short, mismatch), opening balance schema (negative, missing).

## 6. Left to the builder

File names and split inside `features/reports/` (and where the account/opening-balance actions live); the movement row type's exact shape; whether period and all-time numbers come from one load or two; tile/table layout within UI.md rules (big full Rupiah amounts, icon + text); loading and empty states; exact Indonesian messages; whether the Home and Dashboard share components. When done: update HANDOFF (sections 4, 5, 10), DATABASE.md (`opening_balance`, `checked_out_at`), CODEBASE_OVERVIEW (new files, routes no longer placeholders), AUTH.md (password change screen exists); delete `components/placeholder-page.tsx` if nothing uses it; run `npm run lint`, `npm test`, `npm run build`; test in the browser as kasir and superadmin and check every Home/Laporan number by hand against a few test transactions.

## 7. Calls I made (not discussed with the user)

- Dashboard and Home default to **Hari Ini**; Laporan to **Bulan Ini**.
- **Total Pengeluaran** means the `expenses` table only; stock purchases show up through cost of goods, not as expenses.
- **Member Aktif** = latest membership active or expiring today, shown as "N dari M member".
- Opening balances have **no in-app fix**: a typo after saving needs a DB edit.
- Laba per Produk under a method filter shows **scaled quantities** (may be fractional) so its totals match the tiles.
- Check-out only for **today's** rows, no confirm.
- Absensi Hari Ini on Home ignores the period filter.
- Recent transactions show the last **10**.
- The password change also requires the current password when changing the kasir's password.
- In-memory aggregation is marked as a `// shortcut:`.
- Cost of goods is split across a sale's payments in whole rupiah (leftover to the largest payment), so Cash + Bank = Semua exactly.
- Layout and components follow Sembako's dashboard and laporan pages; calculations don't.

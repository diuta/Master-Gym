# Master Gym — Handoff Context

Last updated: 2026-10-28. Read this first when continuing on another PC or in a new AI session.

## 1. What this project is

A web app for the front desk of **Master Gym**: member check-in with a USB 2D barcode scanner, membership payments, a small shop (inventory, sales, purchases, expenses) and reports.

- **Spec source:** "INFORMASI GENERAL APLIKASI GYM" (final discussion, 8 Oct 2026), summarized in section 3. The original file was in `Downloads` on the old PC and is **not** in the repo.
- **Deadline:** end of October 2026.
- **Reference project:** `Sembako` (same author), branch **`staging`**. Copy its patterns: folder layout, auth, the shadcn UI kit, the inventory/sales/purchase/expense logic.

## 2. Working rules (from the user, always apply)

1. Use Sembako `staging` as the reference for coding style and infrastructure.
2. Follow the **Ponytail** skill (smallest complete change) and the **Trail of Bits** skills: `sharp-edges`, `differential-review`, `supply-chain-risk-auditor`, `spec-to-code-compliance`.
   - Sources: https://github.com/dietrichgebert/ponytail and https://github.com/trailofbits/skills
   - Install at user level (`~/.claude/skills`), relevant skills only: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt` plus the 4 above.
3. **If anything is unclear, ASK. Do not assume.**
4. Keep code as simple and maintainable as possible. No over-engineering.
5. **Never commit or push.** The user commits manually.
6. The UI kit is **shadcn** (`components/ui`, `base-nova` style, Base UI). Before adding any new library, tell the user what it is and why it's needed.

Code conventions (from the foundation): code, files, routes and DB columns are in English, and UI text is in Indonesian. Pages in `app/` stay thin, and business code lives in `features/<domain>/`. Comments only explain *why*. Shortcuts with a known limit are marked `// shortcut: <limit>, <when to upgrade>`.

## 3. Spec summary

**General:** a web app, dark mode, navy + orange (Master Gym logo). Access by barcode (hardware scanner), or by phone number for elderly members or anyone without their phone. Roles: **kasir** (cashier) and **superadmin**.

> The spec said "navbar on top". The user later changed this to a **sidebar like Sembako**. The sidebar is final.

### Kasir (cashier)
1. **Dashboard:** period filter; number of transactions and revenue; low/empty stock table; recent transactions table.
2. **Membership**
   - **Absen (check-in):** scan the barcode or type it manually → pop-up with photo, name, days remaining → locker key number input → "Check-In" or "Close". Today's attendance table below (No, time, name, status, locker key).
   - **Riwayat Absen:** combined history of members and visitors, with a day/date filter.
   - **Data Member:** search; status filter (Semua, Aktif, Habis ≤ 7 Hari, Sudah Habis, Visitor); columns: ID, name, phone, status/package, days remaining, total visits, "Detail" button (attendance history).
   - **Pembayaran:** a dropdown picks one of these forms:
     - **Daftar Member Baru:** a "Kelola Paket" pop-up (add/edit/delete packages). Form: member number (auto), name, phone, birth date, gender, status (Pelajar/Mahasiswa/Umum), package, start date, price, payment method (**split allowed**), camera photo. Button "Daftarkan & Buat QR".
     - **Visit (Harian):** name, phone, visit price, payment method (split).
     - **Perpanjang Member (renewal):** search or scan a member; old data fills in (photo, number, name, birth date, gender, phone); cashier updates status, package, price, payment (split).
     - **Add-On:** a "Kelola Trainer & Paket Tambahan" pop-up for Trainer data (name, phone) and PT programs (6/12/24/36 sessions or per visit, with a price). Form: search or scan a member, PT package, sessions, price, payment (split). *(Corporate package: ON HOLD, don't build.)*
3. **Inventori:** summary panel (total products, stock value, low/empty stock); search, category filter, "Kelola Kategori"; table: name, category, stock, min, sale price, cost price, stock value, status, edit. A 3-step add-product wizard.
4. **Penjualan:** a 4-step wizard: info (auto invoice number, buyer optional, date, notes) → items → payment Cash/Bank (split, **no credit/piutang**) → review.
5. **Riwayat Penjualan:** period and product filters; table: date, invoice, items, total, buyer, cashier, method, status, detail.
6. **Pembelian (stock purchases):** a 4-step wizard: info (invoice, supplier, date, notes) → items with cost price → payment Cash/Bank → review.
7. **Riwayat Pembelian:** period filter; table: date, product, category, qty, unit price, total, supplier, method, status, detail.
8. **Pengeluaran (expenses):** date, description, amount, Cash/Bank; history table.

### Superadmin (no daily operations, no check-in form)
1. **Home:** period filter; profit, money in the bank, cash, expenses; "Edit Keuangan" (only at launch); total products, stock value, profit on goods sold, active/remaining members, number of transactions; tables: low stock, recent transactions, daily attendance, members expiring in ≤ 7 days.
2. **Laporan:** filters for period and payment method (all / cash / bank), which recalculate everything; transaction count, revenue (sales + membership/visit/add-on), total cost, net profit, profit %, expenses this period, total expenses ever; profit per product; sales detail table.
3. **Pengaturan Akun:** added by the user (for example to change the cashier's password).

### Member output
A one-page **PDF** with QR code, name, member ID, phone, expiry date and photo. It's **downloaded and sent over WhatsApp** by staff.

## 4. Decisions already made

| Topic | Decision |
|---|---|
| Accounts | One shared `kasir` account and one `superadmin` |
| Login | Email + password. **No lockout** (it would lock out the whole desk); marked as a shortcut, so add rate limiting before going online |
| Layout | Sidebar like Sembako; on phones it becomes a slide-out menu (desktop + phone supported) |
| Theme | **Dark only**, navy + orange. The colours are **placeholders** until the user sends the logo |
| Corporate package | On hold |
| PT sessions | At check-in, a checkbox "use PT this session" takes one session off the member's remaining PT sessions |
| Renewal | The new period starts the day after the current one ends (or today if it has already expired) |
| Package prices | Differ by category (Pelajar/Mahasiswa/Umum); the cashier manages them via Kelola Paket |
| QR content | A **random token**, not the member number or personal data (QR codes can be read by any phone) |
| Hosting | Will be online later. Not a concern yet |
| Payments | Planned: each transaction has 1..n payment rows (method + amount), so split payments and Cash/Bank reports work everywhere |

## 5. Current state (end of day 1)

Branch: **`dev/scaffolding`** (based on the `foundation` commit). Day 1 changes are ready for the user to commit with:
`Add kasir/superadmin roles, spec menus, dark navy theme and remove login lockout`

**Done**
- `users.role` enum (`superadmin`, `kasir`); the session carries the role; `requireRole()` in `lib/auth/dal.ts` guards every page on the server.
- Sidebar menus per role in `lib/nav.ts`; 13 placeholder pages under `app/(app)/` (`membership/*`, `inventory`, `sales/*`, `purchases/*`, `expenses`, `reports`, `administration/account-settings`, `dashboard`).
- Dark navy/orange theme in `app/globals.css`; `next-themes` removed.
- Fixed a hydration mismatch at phone width in `hooks/use-mobile.ts` (`useSyncExternalStore`). **Sembako still has this bug.**
- Seed accounts: `superadmin@mastergym.test` and `kasir@mastergym.test`, password `password123` (dev only).
- Docker tested: compose project `master-gym-dev` with the `app` container (port 3002) and `postgres:16-alpine` (127.0.0.1:5434).
- Verified: lint, type check and build pass; both logins, the menus and the role redirects were tested in a browser.

**Not done / known gaps**
- The real logo and colours are pending (send the logo → update `app/globals.css` and the "M" badge in `components/app-sidebar.tsx`).
- `docs/superpowers/specs/2026-10-17-foundation-design.md` is outdated (it describes the old single-account version).
- No tests yet.

## 6. Set up on a new PC

1. Install **Node 20+**, **PostgreSQL 16** (same major version as Sembako) and optionally **Docker Desktop**.
   - Docker Desktop on Windows needs WSL2. If it hangs on "Starting the Docker Engine", quit it fully, run `wsl --shutdown`, and start it again.
   - Docker Desktop doesn't start with Windows; open it before running `docker compose`.
2. Get the code, check out `dev/scaffolding`, then run `npm ci`.
3. `cp .env.example .env`, then fill `SESSION_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32` each).
4. Database. Choose one:
   - **Native Postgres:** create a user and database, e.g. `CREATE ROLE mastergym LOGIN PASSWORD 'mastergym'; CREATE DATABASE mastergym OWNER mastergym;`, and set `DATABASE_URL=postgres://mastergym:mastergym@localhost:5432/mastergym` in `.env`.
   - **Docker:** `docker compose up -d postgres` (port 5434, which is what `.env.example` already uses).
5. `npm run db:push`, then `npm run db:seed`, then `npm run dev` → http://localhost:3000.
6. Install the skills listed in section 2.

## 7. Next: day 2 (member registration)

Build order for the remaining days: **day 2** members → **day 3** check-in, attendance, renewal, visit, PT add-on → **day 4** inventory, sales, purchases, expenses (copied from Sembako) → **day 5** dashboards and reports, then testing with the real scanner. Each day has its own section below (scope, questions to ask first, and when it counts as done). The deadline is end of October, so scope may need cutting. Ask the user.

**How to work each day:** ask that day's open questions first (rule 3) → build in `features/<domain>/` following Sembako → run `npm run lint` and `npm run build` → test in the browser as the right role → update this file's "Current state" and the other docs → tell the user it's ready to commit (never commit yourself).

**Day 2 scope**
1. Kelola Paket pop-up (CRUD packages, a price per category).
2. Daftar Member Baru form (auto member number, details, camera photo, package and price, split payment) → saves the member and the payment.
3. Member PDF (QR + details + photo) to download.
4. Data Member list with search and status filters.

**New libraries proposed (the user must approve):** `qrcode` (QR image) and `jspdf` (PDF; Sembako already uses it). Photo upload should reuse Sembako's `lib/uploads.ts` + `app/api/uploads` + a Docker `uploads` volume.

**Open questions to ask the user before starting day 2**
1. Member number format, e.g. `MG-0001`?
2. Package duration in days, months, or both?
3. Price auto-filled from package + category and editable, or always typed by hand?
4. Payment methods: only Cash/Bank, or Bank split into QRIS/Transfer/Debit like Sembako?
5. Must the phone number be unique per member? (It's the check-in fallback.)
6. Is the photo required or optional?

Earlier assumptions waiting for confirmation: visitors are checked in automatically when their visit is paid; the locker number is optional; expired members can't check in (the pop-up shows "Expired" and the button is disabled).

**Day 2 is done when:** the cashier can create packages, register a member with a photo and a split payment, download that member's PDF, and find the member in Data Member with the right status.

## 8. Day 3: check-in and the other membership payments

Pages: `/membership/check-in`, `/membership/attendance`, and the remaining forms in `/membership/payment`. The detail is in section 3 (Kasir → Membership).

**Scope**
1. **Absen (check-in)** at `/membership/check-in`:
   - One input that keeps focus. The USB scanner types the QR token and presses Enter (it acts as a keyboard). The cashier can also type a **phone number** for members without their phone.
   - Lookup → pop-up with photo, name, package, days remaining and status. Locker number input. A **"pakai PT sesi ini" checkbox** shown only when the member has PT sessions left (checking it takes 1 session off). "Check-In" / "Close".
   - Today's attendance table below: No, time, name, status, locker number.
   - After check-in or close, focus goes back to the input so the next scan works with no clicks.
2. **Riwayat Absen** at `/membership/attendance`: members and visitors together, with a day/date filter.
3. **Data Member "Detail" button** (from day 2): that member's attendance history.
4. **Pembayaran → Visit (Harian):** name, phone, price, split payment. Saves a visitor check-in for today.
5. **Pembayaran → Perpanjang Member (renewal):** search or scan a member; old data shown read-only; the cashier picks category, package, price, split payment. The new period starts the day after the current end date, or today if already expired.
6. **Pembayaran → Add-On (Personal Trainer):** a "Kelola Trainer & Paket Tambahan" pop-up with Trainer data (name, phone) and PT programs (6/12/24/36 sessions or per visit, with price). Form: search or scan a member, PT program, sessions, price, split payment. Adds sessions to the member's PT balance. **Corporate package is on hold, so don't build it.**

**Ask before starting day 3**
1. Can a member check in more than once per day? If not, block it or just warn?
2. Is a trainer chosen when PT is bought, or when it's used at check-in?
3. Do "per visit" PT programs count as 1 session each?
4. Do visitors need anything printed or shown (e.g. a receipt), or only a record?
5. Confirm the assumptions at the end of section 7 (auto check-in for visitors, optional locker, expired members blocked).

**Day 3 is done when:** scanning a member's PDF QR with the real scanner opens their pop-up and checks them in; the phone-number fallback works; visits, renewals and PT add-ons save with split payments; Riwayat Absen shows members and visitors.

## 9. Day 4: shop (inventory, sales, purchases, expenses)

Pages: `/inventory`, `/sales/new`, `/sales/history`, `/purchases/new`, `/purchases/history`, `/expenses`. Detail in section 3 (Kasir → items 3–8).

**Approach:** copy from Sembako `staging` and simplify, don't rewrite. Relevant Sembako folders: `features/inventori`, `features/penjualan`, `features/pembelian`, `features/keuangan/pengeluaran`, `features/invoice`, plus `components/shared` (filters, KPI grid, pagination) and `lib/format.ts`, `lib/date.ts`.

Remove while copying:
- **Toko (branch) scoping:** one gym, so no `tokoId` columns or filters.
- **Utang/piutang (credit):** the spec says no credit; payment is always Cash/Bank, split allowed.
- **Multi-unit products** (`produkUom`), unless the user says products are sold in more than one unit.
- Activity log, documentation pages and DB reset, unless the user asks for them.

Keep:
- Sembako's **stock ledger** (`stockMovements`, stock = sum of movements; cancelling writes a reversing row) and its moving-average cost logic. It's money and stock, so copy it carefully and copy its tests too.
- The wizards: 3 steps for adding a product, 4 steps for sales and purchases (as in the spec).
- Sales and purchases use the **same payment rows** (method + amount) as the membership payments, so reports can add them up.

**Ask before starting day 4**
1. Are products sold in one unit only (pcs/bottle), or also by box?
2. Should sales print or download an invoice like Sembako's?
3. Can the cashier cancel a sale or purchase? (Sembako has "batal" with stock reversal.)
4. Expense categories needed, or free text only?

**Day 4 is done when:** a product can be added, bought in (stock up), sold (stock down) and cancelled (stock restored), with split payments recorded; low/empty stock shows; expenses can be added.

## 10. Day 5: dashboards, reports, account settings, real-world test

Pages: `/dashboard` (different content per role), `/reports`, `/administration/account-settings`. Detail in section 3 (Kasir → Dashboard, Superadmin → Home, Laporan).

**Scope**
1. **Kasir dashboard:** period filter; transaction count and revenue; low/empty stock table; recent transactions.
2. **Superadmin Home:** period filter; profit, money in the bank, cash, expenses; total products, stock value, profit on goods sold, active/remaining members, transaction count; tables: low stock, recent transactions, today's attendance, members expiring in ≤ 7 days. **"Edit Keuangan"**: only active at launch; meaning still to be confirmed (see questions).
3. **Laporan:** period filter + payment-method filter (all / cash / bank) that recalculates **everything**; revenue = sales + membership + visit + add-on; total cost, net profit, profit %, expenses (this period and all time); profit per product table; sales detail table.
4. **Pengaturan Akun:** superadmin changes the kasir's and their own password.
5. **Real-world test** at the front desk: the actual scanner, the actual PC screen, a phone for the superadmin.

Reuse Sembako's `features/dashboard/dashboard-page.tsx` and `laporan-page.tsx` and its period filter (`lib/date.ts` `computeDateRange`, `PERIODE_OPTIONS`).

**Ask before starting day 5**
1. What exactly is "Edit Keuangan"? (Probably entering opening cash/bank balances once at launch.) When is it switched off?
2. Does "Total Laba" on Home include membership income, or only product profit?
3. Is "Uang di Bank" cumulative since launch, or for the selected period?
4. Which timezone? Presumably WIB (Asia/Jakarta) for "today" and periods.

**Day 5 is done when:** every number on Home and Laporan can be checked by hand against a few test transactions, and the cash/bank filter changes them correctly.

## 11. After day 5 (not scheduled)

Go online (hosting, HTTPS, rate limiting for login, real passwords, backups), the corporate package (on hold), tests for the money logic, and a `/ponytail-audit` + Trail of Bits `sharp-edges` review before launch.

## 12. Other docs

- [CODEBASE_OVERVIEW.md](./CODEBASE_OVERVIEW.md): what every file does, routes, request flow, env vars, scripts
- [AUTH.md](./AUTH.md): login, session cookie, roles, guards, known limits
- [DATABASE.md](./DATABASE.md): schema, connections, commands, rules for changes
- [UI.md](./UI.md): layout, theme colours, component kit, design rules
- [DOCKER.md](./DOCKER.md): containers, build, dev/prod commands, troubleshooting

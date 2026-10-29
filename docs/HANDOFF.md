# Master Gym — Handoff Context

Last updated: 2026-10-29. Read this first when continuing on another PC or in a new AI session.

## 1. What this project is

A web app for the front desk of **Master Gym**: member check-in with a USB 2D barcode scanner, membership payments, a small shop (inventory, sales, purchases, expenses) and reports.

- **Spec source:** "INFORMASI GENERAL APLIKASI GYM" (final discussion, 8 Oct 2026), summarized in section 3. The original file was in `Downloads` on the old PC and is **not** in the repo.
- **Deadline:** originally end of October 2026; **pushed back** (2026-10-28) so the full day 2–5 plan is kept, not cut.
- **Reference project:** `Sembako` (same author), branch **`staging`**, checked out at `~/Uta/sembako-staging` on the Mac. Copy its patterns: folder layout, auth, the shadcn UI kit, the inventory/sales/purchase/expense logic.
- **Branches:** work starts from `development`; the user creates a branch per feature and commits manually.
- **Dev machine:** macOS now (the docs' Windows notes are from the old PC). Postgres runs in **Docker** (`docker compose up -d postgres`, port 5434).

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
     - **Add-On:** a "Kelola Trainer & Paket Tambahan" pop-up for Trainer data (name, phone) and PT programs (6/12/24/36 sessions or per visit, with a price) *(originally requested in Add-On; built in Pengaturan Harga (superadmin) as two pop-ups, Kelola Trainer and Kelola Program PT)*. Form: search or scan a member, PT package, sessions, price, payment (split). *(Corporate package: ON HOLD, don't build.)*
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
| Renewal | The new period starts at max(latest end date + 1 day, today WIB). No start-date picker. The price is read-only (package + chosen category) |
| Package prices | Each category (Pelajar/Mahasiswa/Umum) has a monthly base price; price = base × package months. The **superadmin** sets base prices and manages packages in Membership → Pengaturan Harga; the cashier can't change either |
| QR content | A **random token**, not the member number or personal data (QR codes can be read by any phone) |
| Hosting | Will be online later. Not a concern yet |
| Payments | Planned: each transaction has 1..n payment rows (method + amount), so split payments and Cash/Bank reports work everywhere |
| Payment methods | **Cash, QRIS, Transfer, Debit** (like Sembako). Reports group QRIS/Transfer/Debit as "Bank" |
| Member number | `MG-0001` (prefix + 4-digit sequence) |
| Package duration | In **months** (calendar months) |
| Package price on forms | Computed from package + category, **read-only** for the cashier (changed 2026-10-28, was editable) |
| Member phone | **Unique** per member |
| Member photo | **Required** at registration |
| PDF/QR libraries | `qrcode` + `jspdf` approved |
| Member check-in | Scan → pop-up with photo + name; the admin compares the person to the photo, then clicks **Check-In** (never automatic) |
| Visitor check-in | **Automatic** when the Visit payment is saved (a visitor has no photo to compare); the visit row is the check-in |
| Locker number | Optional |
| Repeat check-in same day | A second scan the same day **warns** ("Sudah check-in hari ini jam …") but is allowed |
| Trainer | Chosen **at check-in** when "Pakai PT" is ticked, not at purchase |
| PT sessions | At check-in, a checkbox "use PT this session" takes one session off the member's remaining PT sessions. Sessions never expire. A "per visit" program = 1 session. The balance is computed (purchased − check-ins with a trainer), not stored |
| Visit, PT prices, trainers | Visit price, PT program prices and trainers are managed by the **superadmin** (Pengaturan Harga); the kasir never types a price |
| Expired members | Blocked from check-in: the pop-up shows "Expired", Check-In is disabled (also refused on the server), and **Perpanjang** opens the renewal form with that member selected |

## 5. Current state (end of day 3)

Days 2 and 3 are built and verified. Day 3 (check-in, visit, renewal, PT) was run in a browser as kasir and superadmin with a simulated scanner (typing the token + Enter). The dev DB was wiped and reseeded on 2026-10-28 because it predated day 1; day 3 added tables with `npm run db:push`.

**Done**
- Day 1 (foundation): roles, `requireRole()`, sidebar menus per role, 13 pages, dark navy/orange theme, seed accounts `superadmin@mastergym.test` / `kasir@mastergym.test` (password `password123`, dev only).
- Day 2 (member registration): `features/membership/` with unit tests (`npm test`); Daftar Member Baru wizard, Pengaturan Harga (category base prices, Kelola Paket), member PDF card, Data Member with Edit, photo uploads (`lib/uploads.ts`, `/api/uploads/[...path]`, Docker `uploads_data` volume). Docker image builds and runs on :3002.
- **Absen** (`/membership/check-in`): one input that keeps focus; scan a token or type a phone (`+62 …` works) → pop-up with photo, status, days left, locker, "Pakai PT" + trainer when PT balance > 0 → Check-In. Today's list below. Expired members are blocked. Same-day repeat warns.
- **Riwayat Absen** (`/membership/attendance`): members and visitors for one date, with PT trainer shown.
- **Pembayaran** has four forms via `?form=new|visit|renew|addon&member=`: Visit (automatic check-in, split payment), Perpanjang Member, Add-On PT. All prices are recomputed on the server; a stale price returns "Harga sudah berubah, muat ulang halaman."
- **Pengaturan Harga** (superadmin): Harga Visit, Kelola Trainer, Kelola Program PT.
- **Data Member:** Total Kehadiran column, Detail dialog (PT balance + check-in history), Visitor filter.
- 6 new tables and `payments` links, see [DATABASE.md](./DATABASE.md).

**Not done / known gaps**
- Test with the real USB scanner and the real webcam on the front-desk PC.
- The webcam needs HTTPS if the app is opened over the LAN (`localhost` is fine).
- No cancel/refund for visits, renewals or PT purchases.
- Riwayat Absen shows one date at a time.
- Impossible dates such as `2026-02-31` in the URL roll over to the next month.
- No pagination in Data Member, Visitor list or attendance (shortcut; add it if lists get long).
- Orphan photo files are kept when a member's photo is replaced (shortcut).
- The real logo and colours are pending (send the logo → update `app/globals.css` and the "M" badge in `components/app-sidebar.tsx`).
- `docs/superpowers/specs/2026-10-17-foundation-design.md` is outdated (it describes the old single-account version).
- `package-lock.json` must be regenerated with npm 10 (the Docker image's npm): a lock written by npm 11 made `npm ci` fail in Docker (missing optional `esbuild` entries). If it happens again: `docker run --rm -v "$PWD":/w -w /w node:20-alpine npm install --package-lock-only --ignore-scripts`.
- Dev note: `next dev` (Turbopack) sometimes keeps a stale module after new server exports/actions are added. Symptom: `… is not a function` or `Cannot read properties of undefined (reading 'apply')`. Restart `npm run dev`.

## 6. Set up on a new PC

1. Install **Node 20+**, **PostgreSQL 16** (same major version as Sembako) and optionally **Docker Desktop**.
   - Docker Desktop on Windows needs WSL2. If it hangs on "Starting the Docker Engine", quit it fully, run `wsl --shutdown`, and start it again.
   - Docker Desktop doesn't start with Windows; open it before running `docker compose`.
2. Get the code, check out the working branch, then run `npm ci`.
3. `cp .env.example .env`, then fill `SESSION_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (`openssl rand -base64 32` each).
4. Database. Choose one:
   - **Native Postgres:** create a user and database, e.g. `CREATE ROLE mastergym LOGIN PASSWORD 'mastergym'; CREATE DATABASE mastergym OWNER mastergym;`, and set `DATABASE_URL=postgres://mastergym:mastergym@localhost:5432/mastergym` in `.env`.
   - **Docker:** `docker compose up -d postgres` (port 5434, which is what `.env.example` already uses).
5. `npm run db:push`, then `npm run db:seed`, then `npm run dev` → http://localhost:3000.
6. Install the skills listed in section 2.

## 7. Day 2: member registration (done, kept for reference)

Build order for the remaining days: **day 2** members → **day 3** check-in, attendance, renewal, visit, PT add-on → **day 4** inventory, sales, purchases, expenses (copied from Sembako) → **day 5** dashboards and reports, then testing with the real scanner. Each day has its own section below (scope, questions to ask first, and when it counts as done). The deadline is end of October, so scope may need cutting. Ask the user.

**How to work each day:** ask that day's open questions first (rule 3) → build in `features/<domain>/` following Sembako → run `npm run lint` and `npm run build` → test in the browser as the right role → update this file's "Current state" and the other docs → tell the user it's ready to commit (never commit yourself).

**Day 2 scope**
1. Kelola Paket pop-up (CRUD packages, a price per category).
2. Daftar Member Baru form (auto member number, details, camera photo, package and price, split payment) → saves the member and the payment.
3. Member PDF (QR + details + photo) to download.
4. Data Member list with search and status filters.

**New libraries (approved):** `qrcode` (QR image) and `jspdf` (PDF; Sembako already uses it). Photo upload should reuse Sembako's `lib/uploads.ts` + `app/api/uploads` + a Docker `uploads` volume.

**Day 2 questions:** all answered on 2026-10-28, see the table in section 4.

**Day 2 is done when:** the cashier can create packages, register a member with a photo and a split payment, download that member's PDF, and find the member in Data Member with the right status.

## 8. Day 3: check-in and the other membership payments (done, kept for reference)

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
6. **Pembayaran → Add-On (Personal Trainer):** Trainer data (name, phone) and PT programs (6/12/24/36 sessions or per visit, with price) are managed by the superadmin in Pengaturan Harga, as two pop-ups: Kelola Trainer and Kelola Program PT (not in the Add-On form). Form: search or scan a member, PT program, sessions, price, split payment. Adds sessions to the member's PT balance. **Corporate package is on hold, so don't build it.**

**Day 3 questions:** all answered on 2026-10-29, see the table in section 4 (repeat check-in warns, trainer at check-in, per visit = 1 session; visitors only need a record, no receipt).

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

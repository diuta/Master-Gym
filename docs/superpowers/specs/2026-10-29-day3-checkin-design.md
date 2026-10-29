# Day 3 — Check-in, Visit, Renewal, PT: Design

Date: 2026-10-29 · Status: implemented

Read with [HANDOFF.md](../../HANDOFF.md) (section 4 decisions, section 8 day 3), [CODEBASE_OVERVIEW.md](../../CODEBASE_OVERVIEW.md) and the day 2 design ([2026-10-28-day2-members-design.md](./2026-10-28-day2-members-design.md)). Day 2 conventions (data, money, WIB, payments, Server Action shape, UI rules) carry over unchanged.

## 1. Why

Members can be registered and get a QR card, but nothing reads that card yet. Day 3 makes the front desk work for a full day: scan members in, sell day visits, renew memberships, sell Personal Trainer sessions, and see who came.

**Done when:** scanning a member's PDF QR with the real USB scanner opens their pop-up and checks them in; the phone-number fallback works; visits, renewals and PT add-ons save with split payments; Riwayat Absen shows members and visitors; Data Member shows attendance and visitors.

## 2. Goals, non-goals, anti-goals

**Goals**
1. **Absen** (`/membership/check-in`): scan or type, confirm against the photo, check in, with today's list below.
2. **Pembayaran** gets three more forms: **Visit (Harian)**, **Perpanjang Member**, **Add-On (PT)**.
3. **Pengaturan Harga** (superadmin) gets the Visit price, **Kelola Trainer** and **Kelola Program PT**.
4. **Riwayat Absen** (`/membership/attendance`): members and visitors, filtered by date.
5. **Data Member**: Total Kehadiran column, Detail button, Visitor filter.

**Non-goals**
- Corporate package (on hold).
- Discounts or any cashier-entered price.
- Cancelling/refunding a visit, renewal or PT purchase; un-doing a check-in.
- Receipts or PDFs for visits.
- Dashboards and reports (day 5).

**Anti-goals (a failure even if it works)**
- A member checked in without the cashier clicking **Check-In** (always a human photo check).
- An expired member checked in.
- A PT balance that goes below zero, or a PT session used without a trainer recorded.
- Any price the kasir can type or change, or a price taken from the browser instead of the server.
- A scan flow that needs the mouse between members: after every pop-up closes, the next scan must just work.

## 3. Constraints

Same as day 2 section 3 (conventions, Sembako reference, Ponytail, UI.md rules, decimal money, WIB "today", never commit). **No new libraries.** Every Server Action starts with `requireRole(...)`: `"kasir"` for desk work, `"superadmin"` for prices, trainers and programs.

## 4. What the user decided (2026-10-29)

| Topic | Decision |
|---|---|
| Second check-in on the same day | **Warn, still allowed** ("Sudah check-in hari ini jam 07:12") |
| Trainer for a PT session | Chosen **at check-in**, when "Pakai PT sesi ini" is ticked |
| "Per visit" PT program | Adds **1 session** to the balance, like any program |
| PT session expiry | **Never expire** |
| Visit proof | **Record only**, nothing printed |
| Visitor check-in | **Automatic when the Visit is paid** (replaces the old "not automatic" decision) |
| Visitor locker | Optional **No. Loker** field on the Visit form |
| Visit price, PT program prices | Set by the **superadmin**, read-only for the kasir |
| Trainers and PT programs | Managed by the **superadmin** in Pengaturan Harga |
| Renewal price | **Automatic, read-only** (base price of the chosen status × package months) |
| Visitors in Data Member | **Yes**, a Visitor filter |
| Expired member scanned | **Blocked**, plus a **Perpanjang** button that opens the renewal form for that member |

Earlier decisions still apply: locker optional, expired blocked, renewal starts the day after the current end (or today if expired), PT checkbox only when sessions are left.

## 5. How it works

### 5.1 Data

New tables (names are a suggestion):

- **`visit_price`** (or one settings row): the single Visit price, set by the superadmin. No row = not set → Visit form shows "Harga belum diatur, hubungi superadmin." like memberships.
- **`trainers`**: name, phone (normalised like members, **not** unique), `is_active`, timestamps.
- **`pt_programs`**: name (e.g. "12 Sesi", "Per Visit"), `sessions` (int ≥ 1), `price` (decimal), `is_active`, timestamps.
- **`pt_purchases`**: `member_id`, `pt_program_id`, plus copies of program name, sessions and price at the time of sale, `created_at`.
- **`visits`**: name, phone (normalised, not unique), price (copy), `locker_no` (nullable), `created_at`. A visit **is** the visitor's check-in; `created_at` is its time.
- **`check_ins`**: `member_id`, `locker_no` (nullable), `trainer_id` (nullable: set means this check-in used one PT session), `checked_in_at`.
- **`payments`**: add nullable `visit_id` and `pt_purchase_id` next to `membership_id`, with a DB check that **exactly one** link is set.

Renewal adds a normal `memberships` row (same copy-at-sale rule as day 2) and updates `members.category` to the status chosen.

Rules:
- **PT balance** = sum of `pt_purchases.sessions` − count of `check_ins` with a trainer. Computed, not stored. The check-in that uses PT locks the member row (`SELECT … FOR UPDATE`) inside its transaction and re-checks balance > 0, so two fast clicks can't overdraw.
- **Renewal start date** = `max(latest end_date + 1 day, today WIB)`. No backdating and no choosing the date on renewal *(my call: removes a way to give free days)*. End date uses the day 2 `membershipEndDate`.
- **"Today"** for check-ins and lists is the WIB calendar day. Timestamps are stored as UTC (DATABASE.md), so "today" queries use the WIB day's start and end converted to UTC. Put that conversion in `logic.ts` and test it.
- **Inactive trainers/programs**: deleting one that is used only deactivates it (same as packages); history keeps the copies/links.

### 5.2 Absen (`/membership/check-in`, kasir)

- A large input at the top that **keeps focus**: auto-focus on load and after every pop-up closes. The USB scanner types the token and presses Enter. The cashier can also type a phone number and press Enter.
- Lookup on the server: exact `qr_token` match first; otherwise `normalizePhone` the text and match `members.phone`. Not found → inline "Member tidak ditemukan." and the input clears and keeps focus.
- **Pop-up** (dialog): large photo, name, member number, package, status badge, "Sisa N hari".
  - If already checked in today: a warning line with the time of the first check-in today. Check-In still enabled.
  - **Expired:** status "Sudah Habis", Check-In disabled, a **Perpanjang** button → `/membership/payment?form=renew&member=<id>`.
  - Locker number input (optional, short text).
  - If PT balance > 0: "Pakai PT sesi ini (sisa N sesi)" checkbox; when ticked, a required **Trainer** select (active trainers).
  - Buttons: **Check-In** (Enter submits) and **Close** (Esc). Check-In is never automatic.
- **Today's list** below: No, Jam Masuk, Nama, Status (Member / Visitor, plus "PT" when a session was used), Loker. Members and visitors together, newest first.
- The server re-checks everything on Check-In: member exists, not expired today, PT balance, trainer active.

### 5.3 Pembayaran (`/membership/payment`, kasir)

The form picker gets three more entries. The chosen form follows `?form=` (`new`, `visit`, `renew`, `addon`) so Absen can deep-link to renewal. All three reuse `payment-rows.tsx` and the day 2 rule that payments must equal the price exactly, and the server recomputes every price and rejects a stale one ("Harga sudah berubah, muat ulang halaman.").

**Member search** (used by Perpanjang and Add-On): one input that accepts a scan (token), a phone number, a member number or part of a name, and shows matching members to pick. `?member=<id>` pre-selects one.

- **Visit (Harian):** Nama, No. HP (required, normalised), No. Loker (optional), Harga (read-only), payments. Saving inserts the visit + payments in one transaction; the visitor appears in today's Absen list immediately. Success message, then the form resets.
- **Perpanjang Member:** member search → the member's photo, number, name, birth date, gender and phone shown read-only, plus current package and end date. The cashier picks **Status** (pre-filled with the current one) and **Paket**; shows the new period ("1 Januari 2027 s/d 31 Maret 2027") and read-only Harga; payments. Saves the membership + payments and updates the member's category. Success shows the new end date and an **Unduh PDF** button (the card's expiry date changed).
- **Add-On (PT):** member search → name, number, current PT balance. Pick **Program PT**; read-only Harga and "+N sesi"; payments. Saves the purchase + payments. Allowed for expired members *(my call: sessions don't expire, and the member may be about to renew)*.

### 5.4 Pengaturan Harga (superadmin)

Added to the existing page:
- **Harga Visit** field with its own save, next to the monthly base prices.
- **Kelola Trainer** pop-up: list + add/edit/delete (name, phone).
- **Kelola Program PT** pop-up: list + add/edit/delete (name, sessions, price).
Same patterns as Kelola Paket.

### 5.5 Riwayat Absen (`/membership/attendance`, kasir)

A date picker (default today WIB) and a table of that day: No, Tanggal, Jam Masuk, Nama, Status (Member / Visitor, "PT" + trainer name when used), Loker. Members and visitors together.

### 5.6 Data Member (kasir)

- New column **Total Kehadiran** (count of the member's check-ins).
- New **Detail** button: a dialog with PT balance and the member's check-in history (date, time, locker, trainer if PT).
- Filter gains **Visitor**: switches the table to visitors grouped by phone: latest name, phone, number of visits, last visit. Search works on name and phone. *(Grouping by phone is my call: visitors have no ID.)*

### 5.7 Tests (vitest)

Pure functions only:
- renewal start date (still active, expired, ends today)
- WIB day → UTC range (including just after midnight WIB)
- PT balance arithmetic if it lives in `logic.ts`
- Zod schemas for the three new forms (price/payment mismatch, missing member, bad phone, trainer required when PT ticked)

## 6. Left to the builder

Table and file names; how the member search shows results (dropdown list or small result list); exact messages; dialog layout within the rules above; whether the trainer/program pop-ups share a component with Kelola Paket; loading and empty states. When done: update HANDOFF section 5 (and section 4: visitor check-in is now automatic), DATABASE.md, CODEBASE_OVERVIEW, AUTH.md if menus change; run `npm run lint`, `npm test`, `npm run build`; test in the browser as kasir and superadmin, with a simulated scanner (typing the token + Enter).

## 7. Calls I made (not discussed with the user)

- Renewal has no start-date picker: `max(latest end + 1, today)`.
- Expired members can buy PT.
- Visitors in Data Member are grouped by phone.
- PT balance is computed from purchases and check-ins, not stored.
- The Pembayaran form is chosen by `?form=`, so Absen can link to renewal.
- Riwayat Absen filters one date at a time.
- Visitors aren't looked up at Absen: paying for the visit checks them in.
- A Visit phone number may belong to a member; it's saved as a visit anyway (no warning).
- Total Kehadiran counts the member's check-ins only, not visits.
- The Check-In button is disabled while saving, so a double click makes one row.
- Schema changes go through `npm run db:push`, as on day 2.

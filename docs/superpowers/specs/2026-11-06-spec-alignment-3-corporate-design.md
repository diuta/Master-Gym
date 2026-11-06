# Spec Alignment, Piece 3 — Corporate Package: Design

Date: 2026-11-06 · Status: implemented (2026-11-06)

Part 3 of re-aligning the app with the original client spec "INFORMASI GENERAL APLIKASI GYM" (8 Oct 2026; `/Users/diuta/Downloads/INFORMASI GENERAL APLIKASI GYM.md`). Done: piece 1 (small fixes), piece 2 (prices back to the kasir). Next: piece 4 (navbar on top). The planned piece 5 (remove extras) was cancelled: the user keeps all extras.

## 1. Why

The spec's Add-On pop-up has a **Dropdown 1 (Paket Corporate)**: *Form Tambah/Edit (Nama Perusahaan, Jumlah Karyawan min. 50, Kuota Visit, Masa Berlaku, Harga) dan Tabel List Paket Corporate Aktif dan button Edit/Hapus*, and the Add-On form offers *Pilihan paket tambahan (Personal Trainer / Corporate), Sesi, Harga, Metode Pembayaran (Bisa Split)*. It was on hold because the spec never says how a corporate package is used. The user decided that on 2026-11-06.

**Done when:** the kasir can set up a company's corporate package, sell it with split payments, and check employees in on Absen against the company's visit quota; corporate check-ins show in every attendance list and corporate income shows in Dashboard, Home and Laporan.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Manage corporate packages (Paket Corporate) from the Add-On pop-up and from Pengaturan Harga.
2. Sell a corporate package on Add-On (Personal Trainer / Corporate switch).
3. Check corporate employees in on Absen, using the company's quota.
4. Corporate check-ins in Absen, Riwayat Absen and Home (with Logout); corporate income in the reports.

**Non-goals**
- Employee lists, employee cards or QR codes (employees are not registered).
- Enforcing Jumlah Karyawan (recorded only).
- Refunds/cancelling a corporate purchase; editing a purchase after saving.
- Invoices or reports per company.
- Navbar (piece 4).

**Anti-goals (a failure even if it works)**
- A check-in that takes the quota below zero (two kasir clicks at once must not overdraw).
- A check-in against an expired purchase.
- Any change to member check-ins, PT balance, Total Kehadiran or visitor behaviour.
- Corporate payments missing from, or double-counted in, the reports; Cash + Bank ≠ Semua.
- A purchase whose payments don't add up to its price.

## 3. Constraints

- Same as earlier pieces: no new libraries; `requireRole` first in every action; Indonesian UI; money `decimal(14,2)`, whole Rupiah in TS; dates `date` (`YYYY-MM-DD`), "today" in WIB; never commit; reuse the existing patterns (Kelola pop-ups via the `use…Manager` hooks from piece 2, `PaymentRows`, `CurrencyInput`, `membershipEndDate`, `wibDayRange`, `AttendanceTable`, `checkOutAction`).
- `drizzle-kit push` doesn't update a CHECK whose name is unchanged (HANDOFF section 5). The payments one-link check gets a **new name** when it gains the corporate column.
- The dev database is empty (cleaned 2026-11-06).

## 4. What the user decided (2026-11-06)

| Topic | Decision |
|---|---|
| How it's used | **Shared visit quota**: the company pays once for N visits; each employee check-in uses 1 visit. Employees are not members and have no card |
| Masa Berlaku | **Months from payment** (like member packages) |
| Where employees check in | **On Absen** ("Check-In Corporate") |
| Employees | **Not registered**: the kasir types the employee's name each visit |
| Storage | **Separate `corporate_check_ins` table** (approaches in section 6) |

Proposals the user accepted in the playback (2026-11-06):
- The Add-On pop-up's dropdown gets **Paket Corporate** as its third option; kasir and superadmin both manage corporate packages; Pengaturan Harga gets a **Kelola Paket Corporate** button.
- Add-On gets a **Personal Trainer / Corporate** switch. Corporate skips the member search (the buyer is a company). Picking a corporate package fills **Kuota** and **Harga**, both editable; payment can be split.
- A company may buy more than once; each purchase keeps its own quota and end date. A check-in uses the purchase that **ends soonest and still has visits left**.
- Absen's **Check-In Corporate** dialog: company (only those with a valid purchase and visits left, shown with remaining visits and end date), employee name (required), phone (optional), locker (optional). The row shows in today's list as "Corporate · <company>"; Logout and Riwayat Absen work like for anyone else. No quota or expired → the company isn't selectable.
- Corporate sales count as income everywhere; Laporan's omzet breakdown gains a **Corporate** line.

## 5. How it works

### 5.1 Data

- **`corporate_packages`** (the definition, managed in the pop-up): `id`, `company_name` varchar(100), `employee_count` int (≥ 50), `visit_quota` int (≥ 1), `months` int (1–60), `price` decimal(14,2), `is_active`, timestamps. Deleting one that has purchases only deactivates it (same rule as packages/programs). Creating a name that matches an inactive row is allowed (company names aren't unique) *(my call: two packages for one company, e.g. different quotas, are legitimate)*.
- **`corporate_purchases`** (a sale): `id`, `corporate_package_id` FK, copies of `company_name` and `employee_count`, `visit_quota` (as sold, may differ from the package), `price` (as sold), `start_date` (WIB day of payment), `end_date` (= `membershipEndDate(start_date, months)`), `created_at`.
- **`corporate_check_ins`**: `id`, `corporate_purchase_id` FK, `employee_name` varchar(100), `phone` varchar(20) nullable (normalised like members when given), `locker_no` nullable, `checked_in_at`, `checked_out_at` nullable. Indexes on `checked_in_at` and `corporate_purchase_id`.
- **`payments.corporate_purchase_id`** nullable FK; the one-link check covers six columns and is renamed (e.g. `payments_one_link_v3`).
- **Remaining visits** of a purchase = `visit_quota` − count of its `corporate_check_ins`. Computed, not stored (same as the PT balance).

### 5.2 Managing corporate packages

- Actions `create/update/deleteCorporatePackageAction`, `requireRole("kasir", "superadmin")`, Zod `CorporatePackageSchema` (company name 1–100 chars, employee count int ≥ 50 "Jumlah karyawan minimal 50.", quota int 1–100 000, months 1–60, price via the shared `price()` helper).
- A `useCorporatePackageManager` hook + `KelolaPaketCorporateDialog`, following the piece-2 pattern. The Add-On wrapper's select gains "Paket Corporate" (first, as in the spec). Pengaturan Harga gets a "Kelola Paket Corporate" button.
- Table: Nama Perusahaan, Karyawan, Kuota Visit, Masa Berlaku (bulan), Harga, Edit/Hapus.

### 5.3 Selling (Add-On)

- A two-option switch at the top of the Add-On form: **Personal Trainer** (today's form, unchanged) / **Corporate**.
- Corporate form: Paket Corporate select (active packages) → fills **Kuota Visit** (int 1–100 000) and **Harga** (both editable; same rules as piece 2: refill on new choice, pop-up edits don't touch current values, vanished selection clears, one payment row follows Harga) → shows "Berlaku s/d <end date>" (from today WIB + months) → `PaymentRows` → **Simpan Corporate**.
- `buyCorporateAction` (`requireRole("kasir")`): package must be active; stores the purchase (copies, submitted quota and price, dates computed on the server from today WIB) and its payments in one transaction; payments must equal the price exactly.
- Success message: "Paket corporate <company> tersimpan: <quota> visit s/d <end date>."

### 5.4 Check-in (Absen)

- A **Check-In Corporate** button (h-11) next to the scan input. It must not steal the scan input's focus on load, and focus returns to the scan input when the dialog closes.
- Dialog per the sketch: the select lists **corporate packages** (by `corporate_package_id`) that have at least one purchase where `start_date ≤ today ≤ end_date` and remaining > 0; each option shows the company name, the total remaining across that package's valid purchases, and the soonest end date. Empty list → "Belum ada paket corporate yang aktif." *(My call, after the builder check: keying on the package id, not the company name, because names aren't unique; a company with two packages appears twice, labelled by company name + quota so the kasir can tell them apart.)*
- `corporateCheckInAction` (`requireRole("kasir")`), input `{ corporatePackageId, employeeName, phone?, lockerNo? }`. In one transaction: lock that package's purchase rows (`FOR UPDATE`, ascending id), pick the valid one with visits left that ends soonest (tie: lowest id), insert the check-in. None left → "Kuota corporate habis atau sudah berakhir."
- **Deactivated packages:** purchases already paid for stay usable until their end date or quota runs out, even if the kasir "deletes" (deactivates) the package; the check-in does not require `is_active` *(my call: the company paid for those visits)*.
- **Phone:** optional; when given it must pass `normalizePhone`, otherwise the field error "Nomor HP tidak valid." (same message as Visit) *(my call)*.
- Same-day repeat of the same employee name for the same company is allowed, no warning *(my call: names aren't unique identities)*.

### 5.5 Attendance lists and check-out

- `AttendanceRow.kind` gains `"corporate"`; `listAttendance` merges the third source; the row's name is the employee name and the status badge shows "Corporate" plus the company name (like "PT · trainer"). `StatusBadge` gets a `corporate` kind (icon + text).
- `checkOutAction` / `CheckOutSchema` accept `kind: "corporate"`, same today-only and `checked_out_at IS NULL` rules.
- Riwayat Absen's summary counts corporate rows ("N orang (a member, b visitor, c corporate)").
- Nothing else counts attendance: Home's "Absensi Hari Ini" uses `listAttendance` and picks corporate rows up automatically; Member Aktif, Total Kehadiran and the PT balance stay member-only *(checked in the builder check)*.

### 5.6 Reports

- `listMovements` maps `payments.corporate_purchase_id` to kind **`corporate`** (income, dated by `paid_at` in WIB, label = company name). `IncomeKind` gains `corporate`; `omzetByKind` returns it; Laporan's breakdown and Transaksi Terbaru ("Corporate") show it. Dashboard/Home "Jumlah Transaksi" counts it (all paid documents); Laporan's "Jumlah Transaksi Penjualan" does not (product sales only).

### 5.7 Tests (vitest)

- `CorporatePackageSchema` and the purchase / check-in schemas: bounds and messages.
- A pure helper `pickCorporatePurchase(purchases, today)` returning the purchase to use (valid, remaining > 0, soonest end, lowest id) or null — expired, not-yet-started, zero-remaining and tie cases.
- `logic.ts` reports: corporate counted in omzet / omzetByKind / transactionCount, excluded from saleCount; Cash + Bank = Semua with a split corporate payment.

## 6. Approaches

1. **Separate `corporate_check_ins` table (chosen).** Member and visitor logic untouched; attendance merges three sources; one more branch in check-out.
2. **Reuse `check_ins` with an optional member.** No new table, but loosens "a check-in has a member", which PT balance, Total Kehadiran, member history and the same-day warning rely on; each needs a guard. Rejected.
3. *(Dropped)* Reuse `visits`: visits carry their own payments; mixing quota check-ins in would corrupt visit income.

## 7. Left to the builder

File split (e.g. `features/corporate/` vs inside `features/membership/`), exact layout of the switch and dialog, empty states and messages not fixed above, indexes beyond the ones listed. When done: update HANDOFF (sections 3 Corporate no longer on hold, 4, 5), DATABASE.md (three tables, payments column + renamed check), CODEBASE_OVERVIEW, AUTH.md (who manages corporate packages); lint, tests, build; browser-check as kasir and superadmin.

## 8. Calls I made (not discussed with the user)

- Company names are not unique; two packages for one company are allowed.
- Quota cap 100 000 visits; months 1–60.
- Same-day repeat check-ins of one name are allowed without a warning.
- The check-in dialog shows total remaining across a company's valid purchases and the soonest end date.
- Corporate rows don't appear in Data Member (employees aren't members).
- Corporate income is dated by `paid_at` in WIB, like memberships, visits and PT.
- Check-in picks by corporate package id (a company with two packages shows twice).
- Deactivating a package doesn't stop its paid purchases.
- An invalid optional phone is a field error, not silently dropped.

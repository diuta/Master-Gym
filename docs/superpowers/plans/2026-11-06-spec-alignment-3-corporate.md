# Spec Alignment, Piece 3 — Corporate Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-skills:superpowers-subagent-driven-development (recommended) or dev-skills:superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Companies buy a corporate visit quota on Add-On; employees check in on Absen against it; corporate check-ins show in attendance and corporate income shows in reports.

**Architecture:** A new `features/corporate/` folder holds three new tables' logic, schemas, queries, actions and UI. Payments gain a sixth link column. The attendance list merges a third source. The reports' movement query maps corporate payments to a new income kind. Member, visitor and PT logic stay untouched.

**Tech Stack:** Next.js 16.4, React 19, Drizzle 0.45 + drizzle-kit, Postgres 16, Zod 4, vitest. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-11-06-spec-alignment-3-corporate-design.md](../specs/2026-11-06-spec-alignment-3-corporate-design.md). Sections 4, 5 and 8 are binding.

## Global Constraints

- **Never `git commit`, `git add`, `git stash` or `git push`.** Never run Prettier. Style: ~100 columns, double quotes, semicolons, 2-space indentation. Comments only explain *why*. UI text Indonesian. 44px targets (`h-11`).
- Every Server Action starts with `requireRole(...)`:
  - Corporate package create/update/delete use `"kasir", "superadmin"`.
  - `buyCorporateAction` and `corporateCheckInAction` use `"kasir"`.
  - `checkOutAction` stays `"kasir"`.
- Money is `decimal(14,2)`, whole Rupiah in TS, using the shared `price()` helper (≥ 1, ≤ 999 999 999 999) and `CurrencyInput`. Payments must equal the price exactly.
- Limits:
  - Employee count is an integer ≥ 50.
  - Visit quota is an integer from 1 to 100 000.
  - Months is an integer from 1 to 60.
  - Company name and employee name are 1 to 100 characters.
  - Phone is optional; when given it must pass `normalizePhone`, else "Nomor HP tidak valid.".
- A purchase runs from `start_date` (the WIB day of payment) to `end_date = membershipEndDate(start_date, months)`. It is valid when `start_date ≤ today ≤ end_date`.
- Remaining visits = `visit_quota` − the count of its `corporate_check_ins`. Remaining is computed, never stored.
- A check-in picks the purchase that is valid, has visits left and ends soonest (tie: lowest id). It runs under `FOR UPDATE` row locks in ascending id order. A deactivated package's purchases stay usable.
- The check-in dialog lists corporate packages by `corporate_package_id`.
- Member check-ins, the PT balance, Total Kehadiran, Member Aktif and visitor behaviour must not change.
- **Cash + Bank = Semua exactly** in Laporan.
- The payments check is renamed to `payments_one_link_v3`, because drizzle-kit doesn't update a check whose name is unchanged.

## Review Focus

1. **Two kasirs check in the last visit at the same moment.** Only one succeeds; the other gets "Kuota corporate habis atau sudah berakhir.". Pinned in Task 4 Step 3 (lock + re-count inside the transaction) and checked by the Task 4 reviewer.
2. **A purchase bought today, and one ending today.** Both are usable today; one that ended yesterday is not. Pinned in Task 1 Step 1 (`pickCorporatePurchase` tests).
3. **A corporate payment split Cash + QRIS.** It appears once in Transaksi Terbaru as "Cash + Bank", and Laporan Cash + Bank = Semua. Pinned in Task 5 Step 1.
4. **The kasir "deletes" a package with an active purchase.** Employees can still check in until the quota or date runs out. Pinned in the Task 4 browser check.
5. **A corporate row is logged out on Absen.** Jam Keluar is set once, and member and visitor logout are unchanged. Pinned in Task 4 Step 1 (schema test) and the Task 4 browser check.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/schema.ts` | `corporatePackages`, `corporatePurchases`, `corporateCheckIns`; `payments.corporatePurchaseId`; check renamed |
| `features/corporate/logic.ts` (+ test) | `pickCorporatePurchase` |
| `features/corporate/validation.ts` (+ test) | `CorporatePackageSchema`, `CorporatePurchaseSchema`, `CorporateCheckInSchema` |
| `features/corporate/queries.ts` | `listActiveCorporatePackages`, `listCorporateCheckInOptions` |
| `features/corporate/actions.ts` | Package CRUD, `buyCorporateAction`, `corporateCheckInAction` |
| `features/corporate/kelola-paket-corporate-dialog.tsx` | `useCorporatePackageManager` + `KelolaPaketCorporateDialog` |
| `features/corporate/corporate-sale-form.tsx` | The Corporate half of Add-On |
| `features/corporate/corporate-check-in-dialog.tsx` | Absen's Check-In Corporate |
| `features/membership/*` | Add-On switch, wrapper option, Pengaturan Harga button, attendance merge, check-out kind, Riwayat summary |
| `components/ui/status-badge.tsx` | `corporate` kind |
| `features/reports/queries.ts`, `logic.ts` (+ test), `reports-page.tsx`, `recent-transactions-table.tsx` | Corporate income kind |
| `docs/*` | Docs |

---

### Task 1: Tables, schemas, purchase picker

**Files:** `lib/db/schema.ts`; create `features/corporate/logic.ts` (+ `logic.test.ts`) and `features/corporate/validation.ts` (+ `validation.test.ts`). In `features/membership/validation.ts`, export the existing `phone` and `lockerNo` field schemas and the `checkPayments` refine if they aren't exported yet (don't copy them).

**Interfaces:**
- Produces:
  - Tables:
    - `corporatePackages { id, companyName varchar(100), employeeCount int, visitQuota int, months int, price decimal(14,2), isActive default true, createdAt, updatedAt }`.
    - `corporatePurchases { id, corporatePackageId FK, companyName, employeeCount, visitQuota, price, startDate date(string), endDate date(string), createdAt }`.
    - `corporateCheckIns { id, corporatePurchaseId FK, employeeName varchar(100), phone varchar(20) null, lockerNo varchar(20) null, checkedInAt timestamp default now, checkedOutAt timestamp null }`, with indexes on `checkedInAt` and `corporatePurchaseId`.
    - `payments.corporatePurchaseId` nullable FK.
    - The check is renamed `payments_one_link_v3` and covers six columns.
  - `CorporatePackageSchema = { companyName, employeeCount, visitQuota, months, price }`. Messages:
    - "Nama perusahaan wajib diisi." / "Nama perusahaan maksimal 100 karakter.";
    - "Jumlah karyawan minimal 50.";
    - "Kuota visit minimal 1." / "Kuota visit maksimal 100.000.";
    - "Masa berlaku minimal 1 bulan." / "Masa berlaku maksimal 60 bulan.";
    - the price uses `price("Harga")`.
  - `CorporatePurchaseSchema = { corporatePackageId: int, visitQuota (same rules), price, payments }`, plus `checkPayments`.
  - `CorporateCheckInSchema = { corporatePackageId: int, employeeName ("Nama karyawan wajib diisi." / "Nama karyawan maksimal 100 karakter."), phone (optional, normalised), lockerNo (optional) }`.
  - `type PurchaseState = { id: number; startDate: string; endDate: string; visitQuota: number; used: number }`.
  - `pickCorporatePurchase(purchases: PurchaseState[], today: string): PurchaseState | null`.

- [ ] **Step 1: Failing tests.**
  - `pickCorporatePurchase`:
    - with A (`2026-11-01`..`2026-11-30`, quota 10, used 10) and B (`2026-11-01`..`2026-12-31`, quota 5, used 0) on `2026-11-06` → B;
    - with B and C (`2026-11-01`..`2026-11-20`, quota 5, used 2) → C (soonest end);
    - two with the same end date → the lowest id;
    - only one starting `2026-11-07` → `null`;
    - one ending `2026-11-05` → `null`;
    - one ending `2026-11-06` with visits left → it.
  - The schemas:
    - `employeeCount: 49` → "Jumlah karyawan minimal 50.";
    - `visitQuota: 100001` → "Kuota visit maksimal 100.000.";
    - `months: 0` and `61` → the months messages;
    - a valid package passes;
    - the purchase with payments ≠ price fails;
    - the check-in with `phone: "123"` → "Nomor HP tidak valid.";
    - `phone: ""` → passes with no phone;
    - an empty `employeeName` → "Nama karyawan wajib diisi.".
- [ ] **Step 2:** `npx vitest run features/corporate` → FAIL. Implement → PASS.
- [ ] **Step 3:** Run `npm run db:push`. It should create 3 tables, add 1 column and replace the check. Accept only that; anything else → BLOCKED. Then `npm test`, `npx tsc --noEmit` and `npm run lint` must be clean. Stop and report.

### Task 2: Manage corporate packages

**Files:** create `features/corporate/queries.ts`, `actions.ts` (package CRUD) and `kelola-paket-corporate-dialog.tsx`. Modify `features/membership/kelola-trainer-paket-tambahan-dialog.tsx`, `pricing-page.tsx`, `app/(app)/membership/pricing/page.tsx`, `app/(app)/membership/payment/page.tsx` and `payment-page.tsx`.

**Interfaces:**
- Consumes: Task 1's `CorporatePackageSchema` and tables.
- Produces:
  - `type CorporatePackageOption = { id; companyName; employeeCount; visitQuota; months; price: number }`.
  - `listActiveCorporatePackages(): Promise<CorporatePackageOption[]>`, ordered by company name then id.
  - `create/update/deleteCorporatePackageAction`. Delete deactivates a package that has purchases and hard-deletes otherwise. Not found → "Paket corporate tidak ditemukan.". They revalidate `/membership/payment` and `/membership/pricing`.
  - `useCorporatePackageManager(packages)` → `{ list, confirmDialog, … }`, following `useProgramPtManager`, with a one-line why-comment.
  - `KelolaPaketCorporateDialog({ packages })`, with trigger text `Kelola Paket Corporate`.

- [ ] **Step 1:** Write the queries, actions, hook and dialog.
  - Table columns: Nama Perusahaan, Karyawan, Kuota Visit, Masa Berlaku (`N bulan`), Harga, Edit/Hapus.
  - Form fields: the five fields, with `CurrencyInput` for Harga and number inputs for the rest.
- [ ] **Step 2:**
  - The wrapper dialog's select gains `Paket Corporate` as the first option and receives `corporatePackages`.
  - Pengaturan Harga gets a `Kelola Paket Corporate` button.
  - Both pages load `listActiveCorporatePackages()`.
- [ ] **Step 3:** `npm test`, `tsc`, lint and build must be clean. Stop and report. The controller checks in the browser: create, edit and delete from both places.

### Task 3: Sell on Add-On

**Files:** `features/corporate/actions.ts` (`buyCorporateAction`), create `features/corporate/corporate-sale-form.tsx`, modify `features/membership/pt-addon-form.tsx` or `payment-page.tsx` (where the switch goes is the builder's call).

**Interfaces:**
- Consumes: Task 1's `CorporatePurchaseSchema`, `membershipEndDate`, `todayWib`; Task 2's `CorporatePackageOption`.
- Produces: `buyCorporateAction(input): Promise<ActionResult<{ companyName: string; visitQuota: number; endDate: string }>>`.

- [ ] **Step 1:** `buyCorporateAction`:
  - The package must exist and be active; otherwise `{ errors: { corporatePackageId: ["Paket corporate tidak tersedia, pilih paket lain."] } }`.
  - One transaction inserts the purchase (copies; `startDate = todayWib()`; `endDate = membershipEndDate(startDate, pkg.months)`; the submitted `visitQuota` and `price`) and its payments with `corporatePurchaseId`.
  - Revalidate `/membership/payment`, `/membership/check-in`, `/dashboard` and `/reports`.
- [ ] **Step 2:** The Add-On form gets a two-option switch at the top: `Personal Trainer` (the existing form, unchanged) / `Corporate` (h-11, default Personal Trainer). The Corporate form:
  - Paket Corporate select (`<company> — <quota> visit / <months> bulan`);
  - Kuota Visit (number, 1–100 000, filled and editable);
  - Harga (`CurrencyInput`, filled and editable);
  - "Berlaku s/d <formatDateId(end)>";
  - `PaymentRows`, then a `Simpan Corporate` button.

  The piece-2 rules apply: refill on a new choice, pop-up edits don't touch values, a vanished selection clears, and one payment row follows Harga. No member search. Success message: `Paket corporate <company> tersimpan: <quota> visit s/d <date>.`; then the form resets.
- [ ] **Step 3:** `npm test`, `tsc`, lint and build must be clean. Stop and report. The controller checks in the browser: sell with a split payment and a custom quota.

### Task 4: Check-in, attendance, check-out

**Files:** `features/corporate/queries.ts` (`listCorporateCheckInOptions`), `actions.ts` (`corporateCheckInAction`), create `corporate-check-in-dialog.tsx`; modify `features/membership/check-in-page.tsx`, `queries.ts` (`listAttendance`), `validation.ts` (+ test: `AttendanceRow`, `CheckOutSchema`), `actions.ts` (`checkOutAction`), `attendance-table.tsx`, `attendance-page.tsx`, `components/ui/status-badge.tsx`, and `app/(app)/membership/check-in/page.tsx`.

**Interfaces:**
- Consumes: Task 1's tables, schema and `pickCorporatePurchase`.
- Produces:
  - `type CorporateCheckInOption = { corporatePackageId; companyName; visitQuota; remaining: number; soonestEnd: string }`.
  - `listCorporateCheckInOptions(today: string): Promise<CorporateCheckInOption[]>`. It covers packages (active or not) with ≥ 1 valid purchase with remaining > 0. `remaining` is the sum over valid purchases.
  - `corporateCheckInAction(input): Promise<ActionResult<{ employeeName: string }>>`.
  - `AttendanceRow.kind: "member" | "visitor" | "corporate"`, plus `companyName: string | null`.
  - `CheckOutSchema.kind` accepts `"corporate"`.
  - A `StatusBadge` kind `corporate`, with the label `Corporate` and an icon (e.g. `Building2`).

- [ ] **Step 1: Failing test.** `CheckOutSchema` accepts `{ kind: "corporate", id: 1 }` and still rejects `kind: "x"`.
- [ ] **Step 2:** Run → FAIL. Implement the schema → PASS.
- [ ] **Step 3:** `corporateCheckInAction`:
  - Parse.
  - In one transaction, lock that package's purchases `FOR UPDATE` (ascending id).
  - Count used check-ins per purchase inside the transaction and call `pickCorporatePurchase(…, todayWib())`.
  - None → `{ message: "Kuota corporate habis atau sudah berakhir." }`.
  - Otherwise insert the check-in (normalised phone or null).
  - Revalidate `/membership/check-in`, `/membership/attendance` and `/dashboard`.
- [ ] **Step 4:**
  - `listAttendance` merges `corporate_check_ins`, joined to purchases for the company name, with `kind "corporate"`.
  - `checkOutAction` handles `corporate`, with the same today-only and `IS NULL` rules.
  - The table shows the corporate badge plus the company name.
  - The Riwayat Absen summary reads `N orang (a member, b visitor, c corporate)`.
  - Absen gets a `Check-In Corporate` button that opens the dialog. Focus stays on the scan input on load and returns to it when the dialog closes. The empty state is `Belum ada paket corporate yang aktif.`.
- [ ] **Step 5:** `npm test`, `tsc`, lint and build must be clean. Stop and report. The controller checks in the browser:
  - Check in two employees; remaining drops by 2.
  - Log one out.
  - Riwayat Absen and Home show the rows.
  - Deactivate the package; check-in still works.
  - Use up the quota; the company disappears.
  - Member check-in and visitor visit are unchanged.

### Task 5: Reports

**Files:** `features/reports/queries.ts`, `logic.ts` (+ test), `reports-page.tsx`, `recent-transactions-table.tsx`.

**Interfaces:**
- Produces: `IncomeKind = "sale" | "membership" | "visit" | "pt" | "corporate"`; `omzetByKind` includes `corporate`.

- [ ] **Step 1: Failing tests** in `features/reports/logic.test.ts`. A corporate payment split cash 300 000 + qris 200 000:
  - `omzet(all)` includes 500 000 and `omzetByKind(all).corporate === 500000`;
  - `omzet(cash) + omzet(bank) === omzet(all)`;
  - `transactionCount` counts it once;
  - `saleCount` ignores it;
  - `recentTransactions` shows it once, with `methods ["cash", "bank"]`.
- [ ] **Step 2:** Run → FAIL. Implement → PASS.
  - `listMovements` maps `payments.corporatePurchaseId` to kind `corporate`, income, dated `paid_at` WIB, labelled with the company name. Add the branch **before** the final PT `else`.
  - Laporan's omzet breakdown gains a `Corporate` line.
  - Transaksi Terbaru labels it `Corporate`.
- [ ] **Step 3:** `npm test`, `tsc`, lint and build must be clean. Stop and report. The controller checks in the browser: after a corporate sale, Dashboard, Home and Laporan include it, and Laporan's Cash/Bank still add up to Semua.

### Task 6: Docs and full verification

**Files:** `docs/HANDOFF.md`, `docs/DATABASE.md`, `docs/CODEBASE_OVERVIEW.md`, `docs/AUTH.md`, `docs/UI.md` (the status badge kind), the spec's Status line.

- [ ] **Step 1:** Changes:
  - HANDOFF section 3: Corporate is no longer on hold.
  - Section 4: rows for spec section 4.
  - Section 5: piece 3 done, piece 4 next, the test count.
  - DATABASE: the three tables, `payments.corporate_purchase_id`, the `payments_one_link_v3` rename and the remaining-visits rule.
  - CODEBASE_OVERVIEW: `features/corporate/`.
  - AUTH: who manages corporate packages.
  - UI: the `corporate` badge.
- [ ] **Step 2:** Spec status → `implemented (YYYY-MM-DD)`. Then `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` must all be clean. Stop and report.

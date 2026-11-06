# Spec Alignment, Piece 2 — Prices Back to the Kasir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-skills:superpowers-subagent-driven-development (recommended) or dev-skills:superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Packages carry a price per status; the kasir manages packages, trainers and PT programs from the Pembayaran forms; every form price (and Add-On sessions) is filled from the chosen item but editable.

**Architecture:** Three price columns on `packages` replace `category_prices`. The existing `kelola-*-dialog.tsx` components are reused by both roles, and the management actions allow `kasir` and `superadmin`. The four payment actions stop comparing against list prices and only require payments = submitted price.

**Tech Stack:** Next.js 16.4, React 19, Drizzle 0.45 + drizzle-kit, Postgres 16, Zod 4, vitest. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-11-04-spec-alignment-2-prices-to-kasir-design.md](../specs/2026-11-04-spec-alignment-2-prices-to-kasir-design.md). Sections 4, 5 and 8 are binding.

## Global Constraints

- **Never `git commit`, `git add`, `git stash` or `git push`.** Never run Prettier. Style: ~100 columns, double quotes, semicolons. Comments only explain *why*. UI text Indonesian.
- Every Server Action starts with `requireRole(...)`:
  - Package, trainer and PT program create/update/delete use `"kasir", "superadmin"`.
  - `saveVisitPriceAction` stays `"superadmin"`.
  - The payment actions stay `"kasir"`.
- Page gates are unchanged: `/membership/pricing` is superadmin, `/membership/payment` is kasir.
- Prices are whole Rupiah, ≥ 1 and ≤ 999 999 999 999, using `CurrencyInput`.
- Sessions sold are an integer from 1 to 200.
- **Payments must equal the price exactly** (`checkPayments` / `paymentsMatchPrice`), on the client and on the server.
- Remove these messages from the four payment flows (register, renew, visit, PT): "Harga sudah berubah, muat ulang halaman." and "Harga belum diatur, hubungi superadmin.". Shop sales keep theirs.
- Choosing a different Paket, Status or Program refills Harga (and Sesi) from the list, overwriting a manual edit.
- Editing items in a pop-up never changes the form's current Harga or Sesi.
- If the selected package or program disappears from the list, the form clears that selection and its Harga (and Sesi).
- With exactly one payment row, its amount follows Harga. With several rows, they stay as typed.
- Stored documents keep the charged price. Old rows are never repriced.

## Review Focus

1. **The kasir types a Harga different from the list.** It is saved as typed, and the payments must match it. Pinned in Task 2 Step 1 (schema test) and the Task 2 browser check.
2. **A price above 999 999 999 999, or Rp0.** Rejected with the field message, with no database error. Pinned in Task 1 Step 1.
3. **The selected package is deleted from Kelola Paket while the form is open.** The selection and Harga clear, and saving can't use a stale package id. The server also rejects an inactive package. Pinned in the Task 2 browser check and Task 2 Step 3.
4. **Sesi edited to 0 or 201.** Rejected with "Sesi minimal 1." / "Sesi maksimal 200.". Pinned in Task 4 Step 1.
5. **No standard visit price is set.** The Visit form opens with an empty Harga that the kasir can fill and save. Pinned in the Task 3 browser check.

---

## File Structure

| File | Change |
|---|---|
| `lib/db/schema.ts` | `packages.price_pelajar/mahasiswa/umum`; drop `categoryPrices` |
| `features/membership/validation.ts` (+ test) | `price` helper max; `PackageSchema` prices; `PtPurchaseSchema.sessions`; drop `CategoryPricesSchema` / `CategoryPrices` |
| `features/membership/logic.ts` (+ test) | `packagePrice` replaces `membershipPrice` |
| `features/membership/queries.ts` | `PackageOption` with prices; drop `getCategoryPrices` |
| `features/membership/actions.ts` | Role gates; drop `saveCategoryPricesAction`; payment actions accept the submitted price |
| `features/membership/kelola-paket-dialog.tsx` | Three price inputs + columns |
| `features/membership/kelola-trainer-dialog.tsx`, `kelola-program-pt-dialog.tsx` | Unchanged UI; reused inside the new wrapper |
| `features/membership/kelola-trainer-paket-tambahan-dialog.tsx` | **New** wrapper: "Data Trainer" / "Program Trainer" select |
| `features/membership/pricing-page.tsx`, `app/(app)/membership/pricing/page.tsx` | Drop the base-price card |
| `features/membership/register-member-wizard.tsx`, `renew-member-form.tsx`, `visit-form.tsx`, `pt-addon-form.tsx`, `payment-page.tsx`, `app/(app)/membership/payment/page.tsx` | Editable Harga/Sesi; Kelola buttons |
| `docs/HANDOFF.md`, `DATABASE.md`, `CODEBASE_OVERVIEW.md`, `AUTH.md` | Docs |

---

### Task 1: Package prices, shared management, Pengaturan Harga

**Files:** schema, validation (+ test), logic (+ test), queries, actions (management actions, `registerMemberAction` and `renewMemberAction` price source), `kelola-paket-dialog.tsx`, `pricing-page.tsx`, `app/(app)/membership/pricing/page.tsx`, `app/(app)/membership/payment/page.tsx`, `payment-page.tsx`, `register-member-wizard.tsx`, `renew-member-form.tsx` (price source only)

**Interfaces:**
- Produces:
  - `packages.pricePelajar`, `priceMahasiswa`, `priceUmum`: `decimal(14,2)` not null.
  - `PackageSchema` = `{ name, months, pricePelajar, priceMahasiswa, priceUmum }`, with labels `Harga pelajar`, `Harga mahasiswa`, `Harga umum`.
  - The shared `price(label)` helper gains `.max(999_999_999_999, { error: `${label} maksimal Rp999.999.999.999.` })`.
  - `type PackageOption = { id: number; name: string; months: number; prices: Record<MemberCategory, number> }`.
  - `packagePrice(pkg: Pick<PackageOption, "prices">, category: MemberCategory): number` in `logic.ts`.
  - `PaymentPage` and the forms no longer take `prices`.

- [ ] **Step 1: Failing tests:**
  - `PackageSchema` rejects a missing `pricePelajar` ("Harga pelajar wajib diisi.").
  - It rejects `priceUmum: 0` ("Harga umum minimal Rp1.").
  - It rejects `priceMahasiswa: 1_000_000_000_000` ("Harga mahasiswa maksimal Rp999.999.999.999.").
  - It accepts a full valid package.
  - `packagePrice({ prices: { pelajar: 150000, mahasiswa: 175000, umum: 200000 } }, "mahasiswa")` → `175000`.
  - Delete the `membershipPrice` tests.
- [ ] **Step 2:** `npx vitest run features/membership` → FAIL. Implement the schema, the helper and the type changes → PASS.
- [ ] **Step 3:** Changes:
  - Schema columns are in, and `categoryPrices` is removed. Run `npm run db:push` against the empty dev DB. It adds the 3 columns and drops `category_prices`. Accept only that; if it proposes anything else, stop and report BLOCKED.
  - `listActivePackages` returns `prices`.
  - Package, trainer and PT program actions get `requireRole("kasir", "superadmin")`, and also `revalidatePath("/membership/payment")`.
  - Remove `saveCategoryPricesAction`, `getCategoryPrices` and every reference.
  - `registerMemberAction` and `renewMemberAction` compute the list price with `packagePrice`. They still compare it to the submitted price in this task; Task 2 removes that.
  - The Kelola Paket dialog gets columns Nama, Bulan, Pelajar, Mahasiswa, Umum, and the form gets three `CurrencyInput`s.
  - Pengaturan Harga loses the base-price card.
  - The register wizard and renew form take their (still read-only) price from `packagePrice`.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` must be clean. Stop and report.

### Task 2: Editable Harga on Daftar Member Baru and Perpanjang; Kelola Paket button

**Files:** `register-member-wizard.tsx`, `renew-member-form.tsx`, `actions.ts` (`registerMemberAction`, `renewMemberAction`), `validation.test.ts`

**Interfaces:**
- Consumes: Task 1's `PackageOption.prices`, `packagePrice`, `KelolaPaketDialog({ packages })`.

- [ ] **Step 1: Failing tests.** `RegisterMemberSchema` and `RenewMemberSchema`:
  - accept `price: 123456` with one payment of `123456`;
  - reject `price: 123456` with a payment of `100000` (the existing payments message).
- [ ] **Step 2:** Run them. If they already pass because the schema never checked list prices, keep them as regression tests and note that in the report. Then:
  - Remove the list-price comparison and the "Harga belum diatur" path from both actions.
  - Keep: the package must exist and be active ("Paket tidak tersedia, pilih paket lain." or the existing message), and payments must equal the price.
- [ ] **Step 3:** In both forms:
  - Harga becomes a `CurrencyInput`, filled by `packagePrice` whenever Paket or Status changes.
  - Apply the one-payment-row rule from Global Constraints.
  - Use an effect: if the selected package id is no longer in `packages`, clear the package and Harga.
  - Daftar Member Baru gets a `Kelola Paket` button (`h-11`) that opens `KelolaPaketDialog` with the current packages.
  - Remove the `PRICE_UNSET` text.
- [ ] **Step 4: Browser check (controller).** Steps:
  - Create a package in the pop-up from Daftar Member Baru; it appears in the dropdown.
  - Pick it and a Status; Harga fills.
  - Change Harga to a custom value; one payment row follows. Save; the membership stores the custom price.
  - Delete the selected package in the pop-up; the selection and Harga clear.
  - Renew a member with a custom Harga.

  Then `npm test`, `tsc` and lint must be clean. Stop and report.

### Task 3: Editable Harga Visit

**Files:** `visit-form.tsx`, `actions.ts` (`createVisitAction`), `validation.test.ts`

- [ ] **Step 1: Failing test.** `VisitSchema` accepts `price: 30000` with payments `30000`, and rejects a mismatch. If it already passes, keep it as a regression test.
- [ ] **Step 2:** `createVisitAction` drops the visit-price comparison and the "Harga belum diatur" path.
- [ ] **Step 3:** The Visit form's Harga Visit becomes a `CurrencyInput`, pre-filled from the `price` prop. When `price` is null it starts empty. The one-row rule applies. Remove the `PRICE_UNSET` text.
- [ ] **Step 4: Browser check (controller).**
  - With no standard visit price, the field is empty; type 25 000 and save.
  - Set a standard price in Pengaturan Harga (superadmin); it pre-fills; edit it and save.

  Then tests, `tsc` and lint. Stop and report.

### Task 4: Add-On — editable Sesi and Harga, Kelola Trainer & Paket Tambahan

**Files:** `pt-addon-form.tsx`, `actions.ts` (`buyPtAction`), `validation.ts` (+ test), new `kelola-trainer-paket-tambahan-dialog.tsx`, `payment-page.tsx`, `app/(app)/membership/payment/page.tsx`

**Interfaces:**
- Produces:
  - `PtPurchaseSchema.sessions`: `z.number({ error: "Sesi wajib diisi." }).int().min(1, { error: "Sesi minimal 1." }).max(200, { error: "Sesi maksimal 200." })`.
  - `KelolaTrainerPaketTambahanDialog({ trainers: TrainerOption[]; programs: PtProgramOption[] })`. A trigger button labelled `Kelola Trainer & Paket Tambahan`. Inside, a select with `Data Trainer` / `Program Trainer` shows the trainer management or the PT program management, reusing the existing dialogs' content. Extract their inner content into components if needed; don't duplicate it.

- [ ] **Step 1: Failing tests.** `PtPurchaseSchema`:
  - missing `sessions` → "Sesi wajib diisi.";
  - `0` → "Sesi minimal 1.";
  - `201` → "Sesi maksimal 200.";
  - `12` with a matching payment → success.
- [ ] **Step 2:** Run → FAIL. Implement → PASS.
- [ ] **Step 3:**
  - `buyPtAction` drops the price comparison. It keeps the program must be active, stores the submitted `sessions` and `price`, and still copies the program name.
  - The form gets Sesi (number input, `h-11`) and Harga (`CurrencyInput`), both filled when a program is picked.
  - Apply the clear-on-missing effect and the one-row rule.
  - The `Kelola Trainer & Paket Tambahan` button opens the new dialog.
  - The payment page loads `listActiveTrainers()` for it.
- [ ] **Step 4: Browser check (controller).**
  - Add a trainer and a "12 Sesi" program from the Add-On pop-up.
  - Pick the program: Sesi = 12 and Harga fill. Change Sesi to 10 and Harga to a custom value, then save.
  - The member's PT balance goes up by 10.

  Then tests, `tsc` and lint. Stop and report.

### Task 5: Docs and full verification

**Files:** `docs/HANDOFF.md`, `docs/DATABASE.md`, `docs/CODEBASE_OVERVIEW.md`, `docs/AUTH.md`, the spec's Status line.

- [ ] **Step 1:** HANDOFF section 4:
  - Replace the rows that say the kasir never types a price, the package price per category / Pengaturan Harga ownership rows, and the visit/PT price rows. Use spec section 4.
  - In section 5, state piece 2 as done and pieces 3–4 as next.
- [ ] **Step 2:** DATABASE: the `packages` price columns, `category_prices` removed, and the upgrade note from spec 5.1, in prose plus a SQL block with no `#` comments. AUTH: who manages packages, trainers and programs. CODEBASE_OVERVIEW: the new dialog, removed functions, changed props.
- [ ] **Step 3:** Spec status → `implemented (YYYY-MM-DD)`. Then `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` must all be clean. Stop and report.

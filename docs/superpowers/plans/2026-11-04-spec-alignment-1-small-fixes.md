# Spec Alignment, Piece 1 — Small Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-skills:superpowers-subagent-driven-development (recommended) or dev-skills:superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five small changes that make the app match the original client spec: no Debit, Metode shown as Cash/Bank, a Laporan sales-only count, a supplier invoice number on purchases, and a Kasir column on Riwayat Penjualan.

**Architecture:** Edits in place. The enum change needs one hand-written SQL step because Postgres can't drop an enum value. Pure helpers go in `features/reports/logic.ts` with vitest tests, everything else in the existing shop files.

**Tech Stack:** Next.js 16.4, React 19, Drizzle 0.45 + drizzle-kit, Postgres 16, Zod 4, vitest. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-11-04-spec-alignment-1-small-fixes-design.md](../specs/2026-11-04-spec-alignment-1-small-fixes-design.md)

## Global Constraints

- **Never `git commit`, `git add`, `git stash` or `git push`.** The user commits manually.
- Never run Prettier. Style: ~100 columns, double quotes, semicolons. Comments only explain *why*. UI text Indonesian.
- Every Server Action keeps its `requireRole(...)` first.
- Payment methods are exactly `cash`, `qris`, `transfer` (labels `Cash`, `QRIS`, `Transfer`). Bank = `qris` + `transfer`.
- History tables show `Cash`, `Bank` or `Cash + Bank` (cash first). Detail pop-ups keep the exact method label.
- **Cash + Bank = Semua exactly** in Laporan must keep holding. No money total may change.
- Laporan tile label: `Jumlah Transaksi Penjualan`. Dashboard and Home keep `Jumlah Transaksi` (all documents).
- The supplier invoice number is optional, max 50 characters, label `No. Faktur Supplier`.
- The Riwayat Penjualan column header is `Kasir`; a sale without an author shows `-`.

## Review Focus

1. **The enum migration runs against a database that has Debit rows** (e.g. production later). It must stop instead of corrupting data. Pinned in Task 1 Step 4: the SQL aborts if any `debit` row exists.
2. **A purchase saved with the supplier invoice field left empty** stores `null`, not `""`, and Detail hides the line. Pinned in Task 3 Step 1 (schema test) and the Step 4 browser check.
3. **Sales saved before this change** have no `created_by` and still list, showing `-`. Pinned in Task 4 Step 4.
4. **A split Cash + QRIS sale under the Laporan Bank filter** still counts once in Jumlah Transaksi Penjualan. Pinned in Task 2 Step 1.
5. **An old browser tab still offering Debit** posts `debit`. The server must reject it with "Metode pembayaran tidak valid.". Pinned in Task 1 Step 1.

---

## File Structure

| File | Change |
|---|---|
| `lib/db/schema.ts` | `payment_method` without `debit`; `purchases.supplier_invoice_no`; `sales.created_by` |
| `features/membership/validation.ts` (+ test) | `PaymentMethod`, labels, `PaymentsSchema` without debit |
| `features/expenses/validation.ts` (+ test) | Method enum without debit |
| `features/reports/logic.ts` (+ test) | `methodOf` without debit; new `cashBankLabel`, `saleCount` |
| `features/reports/recent-transactions-table.tsx` | Use `cashBankLabel` |
| `app/(app)/reports/page.tsx`, `features/reports/reports-page.tsx` | Laporan count and label |
| `features/shop/sales-history-page.tsx`, `purchases-history-page.tsx` | Metode via `cashBankLabel`; Kasir column |
| `features/shop/validation.ts` (+ test), `actions.ts`, `queries.ts`, `purchase-wizard.tsx`, `transaction-detail-dialog.tsx` | Supplier invoice; `created_by` |
| `docs/HANDOFF.md`, `docs/DATABASE.md` | Decisions, schema, the enum SQL for deploy |

---

### Task 1: Remove Debit, add `cashBankLabel`, Cash/Bank in histories

**Files:** `lib/db/schema.ts`, `features/membership/validation.ts`, `features/membership/validation.test.ts`, `features/expenses/validation.ts`, `features/expenses/validation.test.ts`, `features/reports/logic.ts`, `features/reports/logic.test.ts`, `features/reports/recent-transactions-table.tsx`, `features/shop/sales-history-page.tsx`, `features/shop/purchases-history-page.tsx`

**Interfaces:**
- Produces:
  - `type PaymentMethod = "cash" | "qris" | "transfer"`.
  - `methodOf(m: PaymentMethod): Method`.
  - `cashBankLabel(methods: (PaymentMethod | Method)[]): string` in `features/reports/logic.ts`. It returns `"Cash"`, `"Bank"`, `"Cash + Bank"`, or `"-"` for an empty list. `qris`, `transfer` and `bank` all count as Bank.

- [ ] **Step 1: Failing tests.**
  - `cashBankLabel(["cash"])` → `"Cash"`.
  - `cashBankLabel(["qris", "transfer"])` → `"Bank"`.
  - `cashBankLabel(["transfer", "cash"])` → `"Cash + Bank"`.
  - `cashBankLabel(["bank"])` → `"Bank"`.
  - `cashBankLabel([])` → `"-"`.
  - In the membership `PaymentsSchema` and in the expenses schema, method `"debit"` fails with "Metode pembayaran tidak valid.". Change any existing test that uses `debit` to `transfer`, and delete the `methodOf("debit")` assertion.
- [ ] **Step 2:** `npx vitest run features/reports features/membership features/expenses` → FAIL.
- [ ] **Step 3:** Remove `debit` from the enum, the types, `PAYMENT_METHOD_LABELS` and both Zod enums. Implement `cashBankLabel`. Use it in the Metode cells of both history tables and in `RecentTransactionsTable`, replacing its local label join.
- [ ] **Step 4: Database.** Run this in the Docker dev DB: `docker compose exec -T postgres psql -U mastergym -d mastergym -v ON_ERROR_STOP=1`, with the SQL below on stdin. Then run `npm run db:push`, which must report no changes.
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
- [ ] **Step 5:** Re-run the Step 2 tests → PASS. Then `npm test`, `npx tsc --noEmit` and `npm run lint` must be clean. Stop and report.

### Task 2: Laporan "Jumlah Transaksi Penjualan"

**Files:** `features/reports/logic.ts`, `features/reports/logic.test.ts`, `app/(app)/reports/page.tsx`, `features/reports/reports-page.tsx`

**Interfaces:**
- Consumes: `byMethod`, `Movement`, `MethodFilter`.
- Produces: `saleCount(rows: Movement[], f: MethodFilter): number`. It counts distinct `docId` among `kind === "sale"` rows after `byMethod`.

- [ ] **Step 1: Failing test** on the existing split-sale fixture (sale docId 1 paid cash + bank, plus a cash membership):
  - `saleCount(rows, "all")` → `1`.
  - `saleCount(rows, "cash")` → `1`.
  - `saleCount(rows, "bank")` → `1`.
  - A fixture with only a membership → `0`.
- [ ] **Step 2:** `npx vitest run features/reports/logic.test.ts` → FAIL. Implement `saleCount` → PASS.
- [ ] **Step 3:** In the Laporan page, replace `transactionCount(rows, method)` with `saleCount(rows, method)`. Change the tile label to `Jumlah Transaksi Penjualan`. Leave Dashboard and Home untouched.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit` and `npm run lint` must be clean. Stop and report.

### Task 3: Supplier invoice number

**Files:** `lib/db/schema.ts`, `features/shop/validation.ts`, `features/shop/validation.test.ts`, `features/shop/actions.ts` (`createPurchaseAction`), `features/shop/queries.ts` (`TransactionDetail`, `getPurchaseDetail`, `getSaleDetail`), `features/shop/purchase-wizard.tsx`, `features/shop/transaction-detail-dialog.tsx`

**Interfaces:**
- Produces:
  - `purchases.supplierInvoiceNo`: `varchar("supplier_invoice_no", { length: 50 })`, nullable.
  - `PurchaseFields.supplierInvoiceNo = optionalText(50, "No. faktur supplier").optional()`. The existing helper trims and turns `""` into `null`; `.optional()` lets older callers omit the field.
  - `TransactionDetail.supplierInvoiceNo: string | null`. It is always `null` for sales.

- [ ] **Step 1: Failing tests:**
  - `PurchaseSchema` accepts a missing `supplierInvoiceNo`.
  - It accepts `" INV/123 "` and trims it to `"INV/123"`.
  - It turns `""` into `null`.
  - It rejects 51 characters with "No. faktur supplier maksimal 50 karakter.".
- [ ] **Step 2:** `npx vitest run features/shop/validation.test.ts` → FAIL. Implement the schema → PASS.
- [ ] **Step 3:** Add the column and run `npm run db:push`, which only adds the column. Changes:
  - The action stores the value, or `null`.
  - The wizard Info step gets an input labelled `No. Faktur Supplier`, placed after the `Invoice` "Otomatis" field, `h-11`, optional.
  - The Cek Lagi step shows it when filled.
  - The Detail dialog shows a `No. Faktur Supplier` row for purchases when the value is not null.
- [ ] **Step 4: Browser check (controller).** Save one purchase with `INV/123` and one with the field empty. Detail shows the number only for the first, and the DB has `null` for the second. Then `npm test`, `tsc` and lint must be clean. Stop and report.

### Task 4: Kasir column on Riwayat Penjualan

**Files:** `lib/db/schema.ts`, `features/shop/actions.ts` (`createSaleAction`), `features/shop/queries.ts` (`SaleRow`, `listSales`), `features/shop/sales-history-page.tsx`

**Interfaces:**
- Produces:
  - `sales.createdBy`: `bigint("created_by", { mode: "number" }).references(() => users.id)`, nullable.
  - `SaleRow.cashierName: string | null`.

- [ ] **Step 1:** Add the column and run `npm run db:push`, which only adds the column.
- [ ] **Step 2:** `createSaleAction` stores `createdBy` from the session that `requireRole("kasir")` returns. `listSales` left-joins `users` on `sales.created_by` and returns `cashierName = users.name`.
- [ ] **Step 3:** Riwayat Penjualan gets a `Kasir` column after `Pembeli` (spec order: Tanggal, No. Invoice, Jumlah Item, Total, Nama Pembeli, Kasir, Metode, Status, Detail). Null shows `-`.
- [ ] **Step 4: Browser check (controller).** A sale saved as kasir shows `Kasir` (the seed account's name). A row inserted with `created_by` null shows `-`. Then `tsc`, lint and tests must be clean. Stop and report.

### Task 5: Docs and full verification

**Files:** `docs/HANDOFF.md`, `docs/DATABASE.md`, `docs/CODEBASE_OVERVIEW.md` (if listed helpers change), the spec's Status line.

- [ ] **Step 1:** HANDOFF section 4:
  - Update the rows for payment methods (Cash, QRIS, Transfer; Bank = QRIS + Transfer), the purchase invoice, the Kasir column and the Laporan count.
  - Replace the "Kasir column … Skip" row and the "Metode" mentions.
  - Fix the test count in section 5.
- [ ] **Step 2:** DATABASE:
  - Update the enum.
  - Add `purchases.supplier_invoice_no` and `sales.created_by`.
  - Add a "Removing an enum value" note with the Task 1 SQL, for anyone upgrading an existing database.
- [ ] **Step 3:** Spec status → `implemented (YYYY-MM-DD)`. Then `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` must all be clean. Stop and report.

# Spec Alignment, Piece 1 — Small Fixes: Design

Date: 2026-11-04 · Status: implemented (2026-11-04)

Short design (small change). Part 1 of 5 of re-aligning the app with the original client spec "INFORMASI GENERAL APLIKASI GYM" (8 Oct 2026, outside the repo; summarised in [HANDOFF.md](../../HANDOFF.md) section 3). Order agreed with the user: (1) small fixes, (2) prices back to the kasir, (3) Corporate package, (4) navbar on top.

## Why

The user wants the app to follow the client's spec exactly ("make sure it follows the instructions based on the docs"). These five differences were never decided by the user; they came from builder calls on days 4–5.

## Goals

1. **Supplier invoice number** (spec, Pembelian step 1: "Nomor Faktur/Invoice"): Tambah Pembelian step Info gets a typed, **optional** field **No. Faktur Supplier** (max 50 chars). Stored in a new nullable `purchases.supplier_invoice_no`. Shown in Cek Lagi and in the purchase Detail pop-up. `PB-0001` stays as the internal number. The Riwayat Pembelian table keeps exactly the spec's columns.
2. **Metode as Cash/Bank** (spec, Riwayat Penjualan and Riwayat Pembelian: "Metode (Cash/Bank)"): the history tables show `Cash`, `Bank`, or `Cash + Bank`. The Detail pop-up keeps the exact method (QRIS / Transfer).
3. **Remove Debit** (spec: "Uang di Bank (QR/Transfer)"): payment methods are **Cash, QRIS, Transfer** everywhere (all payment forms, Pengeluaran, the `payment_method` enum). Bank = QRIS + Transfer.
4. **Laporan count** (spec: "Jumlah Transaksi Penjualan"): the Laporan tile is labelled **Jumlah Transaksi Penjualan** and counts non-cancelled product sales in the period; under Cash or Bank, sales with at least one payment in that method. Dashboard and Home keep "Jumlah Transaksi" (all paid documents), as their spec lines say.
5. **Kasir column** (spec, Riwayat Penjualan: "Kasir"): new sales store the saving account (`sales.created_by`, nullable FK to `users`); Riwayat Penjualan gets a **Kasir** column with that account's name; older sales show "-".

## Non-goals

Prices/packages (piece 2), Corporate (piece 3), navbar (piece 4). No change to Dashboard/Home counts. No Kasir column on purchases (spec doesn't ask).

## Anti-goals

- Any money total changing because of the Cash/Bank display change.
- Cash + Bank ≠ Semua anywhere in Laporan.
- A purchase that can't be saved without a supplier invoice number.

## Constraints

Same as day 5 (spec `2026-11-04-day5-dashboards-reports-design.md` section 3): no new libraries, `requireRole` in every action, Indonesian UI text, never commit. `drizzle-kit push` must not drop data; the dev DB has no `debit` rows (checked 2026-11-04 after the fixture cleanup), so removing the enum value is safe there.

## Approaches

Only one sensible way: small edits in place (schema column + enum value, validation, the two wizards/history pages, `features/reports/logic.ts` for the sales-only count). Rejected: keeping Debit but relabelling it as Bank (the spec names only QR/Transfer; user chose removal).

## Calls I made

- The supplier invoice number is optional.
- The Detail pop-up keeps exact methods.
- `created_by` is nullable so existing sales stay valid.
- The sales-only count lives in `logic.ts` next to `transactionCount` (e.g. `saleCount(rows, f)`), with tests.

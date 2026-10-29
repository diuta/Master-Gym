# Day 4 — Shop (Inventori, Penjualan, Pembelian, Pengeluaran): Design

Date: 2026-10-30 · Status: implemented

Read with [HANDOFF.md](../../HANDOFF.md) (section 3 Kasir items 3–8, section 9 day 4), [DATABASE.md](../../DATABASE.md) and the day 3 design ([2026-10-29-day3-checkin-design.md](./2026-10-29-day3-checkin-design.md)). Day 2–3 conventions (money as `decimal(14,2)`, WIB "today", 1..n payment rows, Server Action shape, UI rules, never commit) carry over unchanged.

## 1. Why

The gym sells drinks and small items at the desk. Day 4 lets the cashier keep a product list, bring stock in from suppliers, sell it with split payments, and record expenses, so day 5 reports can show product profit, cash and bank.

**Done when:** a product can be added, bought in (stock up), sold (stock down) and cancelled by the superadmin (stock restored), with split payments recorded; low/empty stock shows on Inventori; expenses with a category can be added, and the superadmin can delete one and manage the categories.

## 2. Goals, non-goals, anti-goals

**Goals**
1. **Inventori** (`/inventory`, kasir): summary, product table, Kelola Kategori, 3-step Tambah Produk, Edit.
2. **Tambah Penjualan** (`/sales/new`, kasir): 4-step wizard.
3. **Riwayat Penjualan** (`/sales/history`): kasir and superadmin; only the superadmin can cancel.
4. **Tambah Pembelian** (`/purchases/new`, kasir): 4-step wizard with a supplier list (Kelola Supplier).
5. **Riwayat Pembelian** (`/purchases/history`): kasir and superadmin; only the superadmin can cancel.
6. **Pengeluaran** (`/expenses`): kasir adds; superadmin deletes and manages categories.

**Non-goals**
- Multi-unit products (box vs piece): one unit per product.
- Invoices or receipts (print/PDF): record only.
- Stock correction (stok opname): only purchases, sales and cancels change stock.
- Product barcodes: products are picked by name.
- Ongkir, pajak and a receipt photo on purchases.
- Credit (utang/piutang), Toko scoping, activity log (all in Sembako, all removed).
- Dashboards and reports (day 5).

**Anti-goals (a failure even if it works)**
- Stock below zero, from a sale or from cancelling a purchase whose items were already sold.
- A stock number stored anywhere except as the sum of the ledger.
- A sale price taken from the browser instead of the server.
- The kasir cancelling a sale or purchase, or deleting an expense.
- A cancel that deletes or edits the original rows (history must stay).

## 3. Constraints

Same as day 3 section 3. **No new libraries.** Every Server Action starts with `requireRole(...)`. Copy from Sembako `staging` (`features/inventori`, `penjualan`, `pembelian`, `keuangan/pengeluaran`, `components/shared/riwayat-filter.tsx`, `lib/date.ts`) and simplify; don't rewrite.

## 4. What the user decided (2026-10-30)

| Topic | Decision |
|---|---|
| Units | **One unit per product** (no `produkUom`) |
| Invoice/receipt | **None**, record only |
| Cancel sale/purchase | **Superadmin only**; the superadmin gets **Riwayat Penjualan** and **Riwayat Pembelian** menus with a Batalkan button; the kasir sees the same pages without it |
| Expense categories | **Required**, managed by the **superadmin** in a **Kelola Kategori pop-up on Pengeluaran** (the superadmin gets the Pengeluaran menu) |
| Delete an expense | **Superadmin only** |
| Products and sale price | **Kasir** adds/edits products and sets the sale price |
| Sale with too little stock | **Blocked** ("Stok tidak cukup") |
| Supplier | **Picked from a list**; the **kasir** manages it (Kelola Supplier pop-up on Tambah Pembelian) |
| Purchase extras | **None**: no ongkir, pajak or receipt photo |
| Stock correction | **Not now** |
| Product barcode | **No**, pick by name |
| Dates on sale/purchase/expense | **Editable, default today WIB, no future dates** |

## 5. How it works

### 5.1 Data

New tables (names are a suggestion):

- **`product_categories`**: name (unique, case-insensitive), timestamps.
- **`products`**: name, `category_id`, `unit` (short text, e.g. "botol"), `sale_price` decimal, `min_stock` int (default 5), `avg_cost` decimal(14,4) (moving average cost per unit), `is_active`, timestamps.
- **`stock_movements`**: `product_id`, `qty_delta` int (+ in, − out), `type` (`initial`, `purchase`, `sale`, `purchase_cancel`, `sale_cancel`), `sale_item_id` / `purchase_item_id` (nullable), `created_at`. **Stock = sum of `qty_delta`.** Insert-only.
- **`suppliers`**: name (unique), phone (optional, normalised), `is_active`, timestamps.
- **`sales`**: `invoice_no` (`PJ-0001`, from the id), `buyer_name` (optional), `date`, `notes`, `total`, `status` (`success` / `cancelled`), `cancelled_at`, timestamps.
- **`sale_items`**: `sale_id`, `product_id`, copies of product name and unit, `qty`, `unit_price` (sale price at the time), `unit_cost` (avg cost at the time, for day 5 profit), `line_total`.
- **`purchases`**: `invoice_no` (`PB-0001`), `supplier_id`, copy of supplier name, `date`, `notes`, `total`, `status`, `cancelled_at`, timestamps.
- **`purchase_items`**: `purchase_id`, `product_id`, copies of name and unit, `qty`, `unit_cost` (typed by the kasir), `line_total`.
- **`expense_categories`**: name (unique), `is_active`, timestamps.
- **`expenses`**: `date`, `category_id`, copy of category name, `description`, `amount`, `method` (payment method enum, one method, no split), `created_at`.
- **`payments`**: add nullable `sale_id` and `purchase_id`; the exactly-one-link check now covers five columns.

Rules (from Sembako `stock-service.ts`, simplified to one unit and one shop):
- Every stock change goes through one small service that **locks the product row** (`SELECT … FOR UPDATE`), sums the ledger, checks, then inserts the movement, all in the caller's transaction.
- **Purchase:** new avg cost = (old stock × old avg + qty × unit cost) ÷ (old stock + qty). If old stock ≤ 0, avg = unit cost.
- **Sale:** blocked if stock < qty ("Stok tidak cukup: tersedia N"). Records `unit_cost` = current avg.
- **Cancel sale:** status `cancelled`, `+qty` movements per item. Avg cost unchanged.
- **Cancel purchase:** blocked if any item's current stock < its qty ("Stok tidak cukup untuk dibatalkan, sebagian sudah terjual."). Otherwise `−qty` movements and the avg cost is reversed best-effort (Sembako's formula; exact only if it was the latest purchase of that product).
- Cancelled rows and their payment rows are kept; day 5 reports exclude `status = cancelled`.
- Money-in vs money-out is known from the link: `sale_id` is income, `purchase_id` is spending.
- **Deleting** a category, supplier or product that is used only deactivates it (same as packages); unused ones are deleted.

### 5.2 Inventori (`/inventory`, kasir)

- **Summary:** total products, stock value (Σ stock × avg cost), number low, number empty.
- Search by name, category filter, **Kelola Kategori** pop-up (add/rename/delete).
- **Table:** Nama, Kategori, Stok (+ unit), Min, Harga Jual, Harga Modal (avg), Nilai Stok, Status (`out_of_stock` if 0, `low_stock` if ≤ min, else `in_stock`, existing badges), Edit.
- **Tambah Produk** wizard (Sembako's steps): 1 Nama & Kategori (name, category, unit) → 2 Stok & Harga (initial stock, cost price, sale price, min stock) → 3 Cek Lagi. Initial stock > 0 writes an `initial` movement and sets avg cost to the cost price.
- **Edit:** name, category, unit, sale price, min stock. Stock and avg cost are not editable. Delete (deactivate if used).

### 5.3 Tambah Penjualan (`/sales/new`, kasir)

4 steps (Sembako's wizard): 1 **Info**: invoice number shown as "otomatis", buyer (optional), date, notes → 2 **Barang**: add products by name search (active products with stock shown), qty; unit price is read-only from the product; line totals and total → 3 **Pembayaran**: the existing `payment-rows` (split; must equal the total) → 4 **Cek Lagi** → Simpan. Success shows the invoice number and resets.
The server reloads every price and stock; a changed price returns "Harga sudah berubah, muat ulang halaman." The same product twice in one sale is merged (or blocked) — builder's choice.

### 5.4 Tambah Pembelian (`/purchases/new`, kasir)

4 steps: 1 **Info**: invoice "otomatis", **supplier** (select + **Kelola Supplier** pop-up: name, phone; add/edit/delete), date, notes → 2 **Barang**: products by name, qty, **unit cost** (typed), line totals → 3 **Pembayaran** (split) → 4 **Cek Lagi** → Simpan. Products must already exist (add them in Inventori first).

### 5.5 Riwayat Penjualan / Pembelian (kasir + superadmin)

- Period filter (Sembako `riwayat-filter.tsx` + `lib/date.ts` period options, WIB).
- **Penjualan** also filters by product. Columns: Tanggal, Invoice, Item (count or names), Total, Pembeli, Metode (methods used), Status, Detail.
- **Pembelian** columns per the spec (one row per purchase item): Tanggal, Produk, Kategori, Qty, Harga Satuan, Total, Supplier, Metode, Status, Detail.
- **Detail** dialog: items, payments, status. For the **superadmin**, a **Batalkan** button with a confirm (AlertDialog).
- Sidebar: superadmin gets PENJUALAN → Riwayat Penjualan, PEMBELIAN → Riwayat Pembelian, KEUANGAN → Pengeluaran.

### 5.6 Pengeluaran (`/expenses`)

- **Kasir:** form (date, category select, description, amount, method) + history table with a period filter.
- **Superadmin:** the same history, a **Hapus** button per row (confirm), and **Kelola Kategori** pop-up. Expense categories start with a seed list (Listrik, Air, Gaji, Perawatan Alat, Kebersihan, Lainnya) so the form works before the superadmin edits it.
- No categories active → the form shows "Kategori belum diatur, hubungi superadmin."

### 5.7 Tests (vitest)

Pure functions only, copying Sembako's where they exist:
- moving average (first purchase, existing stock, stock ≤ 0)
- purchase-cancel avg reversal
- stock status (empty / low / ok)
- sale and purchase totals
- Zod schemas: empty items, qty ≤ 0, payments ≠ total, future date, missing supplier/category

## 6. Left to the builder

File and table names; whether Kelola Kategori/Supplier share a component with Kelola Paket; product picker layout; loading/empty states; exact messages. When done: update HANDOFF (sections 4, 5, 9), DATABASE.md, CODEBASE_OVERVIEW, AUTH.md (menus); run `npm run lint`, `npm test`, `npm run build`; test in the browser as kasir and superadmin.

## 7. Calls I made (not discussed with the user)

- **Initial stock** can be entered in Tambah Produk (Sembako's step 2), so existing stock can be loaded at launch without a fake purchase.
- The **sale price** at checkout is read-only from the product (no per-sale discounts), recomputed on the server.
- **Purchase invoice numbers** are generated (`PB-0001`) like Sembako; the supplier's own nota number isn't stored.
- **Expenses** use one payment method, no split (the spec says "Cash/Bank").
- The **superadmin** sees the Pengeluaran history but has no add form ("no daily operations").
- **Expense categories** start with a seed list.
- Purchases only use products that already exist.
- No pagination in histories (period filter limits them), same shortcut as day 3.
- Schema changes go through `npm run db:push`.
- **Which date counts in reports:** a sale, purchase or expense counts on its own `date` (the one the kasir picked), not on `payments.paid_at` (which stays the time it was saved). Day 5 reports join payments to the document and use the document's date.
- **Cancelling** removes the sale/purchase from the reports of its own date (a cancelled row never counted). No refund payment row.
- **Deactivated products** are hidden from Inventori, the pickers and the stock value. A product with stock > 0 can't be deleted ("Stok masih ada").
- **Expense methods** use the same four methods (Cash, QRIS, Transfer, Debit); reports group the non-cash ones as "Bank", as decided on day 2.
- **Invoice numbers** follow the id, so they don't follow backdated dates.
- The superadmin does **not** get Inventori (user, 2026-10-30).
- Day 4 starts from `development` **after day 3 (PR #3) is pulled**: the `payments` check then covers `membership_id`, `visit_id`, `pt_purchase_id`, `sale_id`, `purchase_id`.

# Spec Alignment, Piece 2 — Prices Back to the Kasir: Design

Date: 2026-11-04 · Status: implemented (2026-11-04)

Part 2 of 5 of re-aligning the app with the original client spec "INFORMASI GENERAL APLIKASI GYM" (8 Oct 2026; `/Users/diuta/Downloads/INFORMASI GENERAL APLIKASI GYM.md`, summarised in [HANDOFF.md](../../HANDOFF.md) section 3). Piece 1 (small fixes) is done: [2026-11-04-spec-alignment-1-small-fixes-design.md](./2026-11-04-spec-alignment-1-small-fixes-design.md). Next pieces: (3) Corporate package, (4) navbar on top.

## 1. Why

The user wants the app to follow the client's spec exactly. The spec puts price management at the front desk:

- Daftar Member Baru: *Button "Kelola Paket" berupa pop-up untuk Tambah/Edit/Hapus Paket*; the form has *Status, Dropdown Paket, … Harga*.
- Visit (Harian): *Input Nama, Nomor Telepon, Harga Visit, Metode Pembayaran*.
- Perpanjang Member: data baru *Status, Pilihan Paket, Harga, Metode Pembayaran*.
- Add-On: *Button "Kelola Trainer & Paket Tambahan" berupa pop-up* with *Dropdown 2 (Data Trainer)* and *Dropdown 3 (Program Trainer: 6/12/24/36/Visit dan harganya)*; form *Pilihan paket tambahan, Sesi, Harga, Metode Pembayaran*.

Today only the superadmin manages prices (Pengaturan Harga): a monthly base price per status × package months, a single Visit price, trainers and PT programs. The kasir can't change any price, and the server rejects a price that differs from the list ("Harga sudah berubah, muat ulang halaman.").

**Done when:** the kasir can manage packages (with a price per status) from Daftar Member Baru and trainers/PT programs from Add-On; every Pembayaran form fills its price (and Add-On its sessions) from the chosen item and lets the kasir change it; the superadmin can still manage the same data from Pengaturan Harga; payments must still equal the price exactly.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Packages carry their own price per status (Pelajar / Mahasiswa / Umum).
2. **Kelola Paket** pop-up on Daftar Member Baru (kasir), same dialog as on Pengaturan Harga.
3. **Kelola Trainer & Paket Tambahan** pop-up on Add-On (kasir), with a dropdown switching between **Data Trainer** and **Program Trainer**.
4. Harga on Daftar Member Baru, Perpanjang, Visit and Add-On, and Sesi on Add-On: auto-filled, editable.
5. Pengaturan Harga (superadmin) keeps Kelola Paket, Kelola Trainer, Kelola Program PT and Harga Visit; the per-month base-price form goes away.

**Non-goals**
- The Corporate package and the Corporate dropdown in the Add-On pop-up (piece 3).
- Navbar (piece 4).
- Shop sale prices (Tambah Penjualan keeps its read-only price and server check).
- Discount reasons, approval of price changes, or logging who changed a price.
- Editing a membership/visit/PT purchase after saving.

**Anti-goals (a failure even if it works)**
- A saved document whose payments don't add up to its price.
- A price of Rp0 or below, or above what `decimal(14,2)` holds.
- Old memberships, visits or PT purchases changing their recorded price when a package/program price is edited.
- A kasir-typed price silently replaced by the list price on save.
- Reports (Dashboard, Home, Laporan) changing meaning: they keep reading the charged price from `payments`.

## 3. Constraints

- Same as earlier pieces: no new libraries; `requireRole` first in every action; Indonesian UI text; money `decimal(14,2)`, whole Rupiah in TS; never commit; Sembako-style dialogs (reuse the existing `kelola-*-dialog.tsx`).
- The dev database has no packages, prices, memberships, PT programs or visits (cleaned 2026-11-04), so the schema change needs no data migration. A real database would: see section 5.1.
- Price inputs use `components/ui/currency-input.tsx`.

## 4. What the user decided (2026-11-04)

| Topic | Decision |
|---|---|
| Package prices | **Columns on `packages`**: `price_pelajar`, `price_mahasiswa`, `price_umum`. `category_prices` is dropped |
| Harga on Daftar Member Baru | **Auto-filled from Paket + Status, editable** |
| Pengaturan Harga | **Same pop-ups for both roles**: Kelola Paket, Kelola Trainer, Kelola Program PT. Kasir (from the Pembayaran forms) and superadmin (from Pengaturan Harga) edit the same packages, trainers and PT programs. The page itself stays superadmin-only (it's one of the extras the user keeps). The per-month base prices are removed |
| Sesi on Add-On | **Auto-filled from the program, editable** ("Per Visit" = 1) |
| Perpanjang / Visit / Add-On Harga | User had no preference → **my call: all auto-filled, editable** (the spec gives each form its own Harga field) |
| Approach | Columns on `packages` (approaches in section 6) |

## 5. How it works

### 5.1 Data

- `packages`: add `price_pelajar`, `price_mahasiswa`, `price_umum` — `decimal(14,2) not null`.
- Drop `category_prices` (table, Drizzle export, `getCategoryPrices`, `CategoryPricesSchema`, `saveCategoryPricesAction`, the `CategoryPrices` type, and `membershipPrice` in `features/membership/logic.ts` plus its tests).
- `visit_price` stays (single row): the **standard** visit price that pre-fills the Visit form.
- `pt_programs` unchanged; `pt_purchases.sessions` now stores the sessions actually sold (may differ from the program's).
- `memberships.price`, `visits.price`, `pt_purchases.price` keep storing the charged price (unchanged behaviour).
- Upgrading a database that has data: `db:push` can't add `not null` columns to a non-empty `packages`. Document in DATABASE.md: add the columns with a default of 0 or fill them from the old base price × months, then set `not null` and drop `category_prices`. *(The dev DB is empty, so the builder only documents it.)*

### 5.2 Shared management (both roles)

- Actions for packages, trainers and PT programs use `requireRole("kasir", "superadmin")`. `saveVisitPriceAction` stays `requireRole("superadmin")`: the standard visit price only pre-fills the Visit form, and the kasir types any other amount on the form itself *(my call, resolved after the builder check)*. The pages keep their gates: `/membership/pricing` superadmin, `/membership/payment` kasir. Everything else in those actions is unchanged (deactivate-if-used on delete, name rules).
- `PackageSchema` gains `pricePelajar`, `priceMahasiswa`, `priceUmum`: each a whole number ≥ 1 and ≤ 999 999 999 999 ("Harga pelajar wajib diisi.", etc.).
- **Kelola Paket** dialog: table Nama, Bulan, Pelajar, Mahasiswa, Umum, Edit/Hapus; add/edit form with the three `CurrencyInput` prices.
- **Kelola Trainer & Paket Tambahan** (new wrapper dialog for the Add-On form): a select at the top, "Data Trainer" / "Program Trainer", showing the existing trainer or PT program management inside one pop-up. Pengaturan Harga keeps its two separate buttons (Kelola Trainer, Kelola Program PT) *(my call: the superadmin page already works that way; the spec's single pop-up is for the Add-On form)*.
- After any change in a pop-up, the Pembayaran form behind it sees the new list without a full reload (`revalidatePath` of `/membership/payment` and `/membership/pricing`).

### 5.3 Forms (kasir, `/membership/payment`)

Common rules:
- Choosing an item fills Harga (and Sesi) with the list value; the kasir may type another value. Choosing a different item (or a different Status) refills from the list and overwrites a manual edit *(my call: the new choice is the newer intent)*.
- Editing items in a pop-up never touches the form behind it: if the kasir edits the price of the package (or program) currently selected, Harga keeps whatever it shows; the new list price applies on the next selection. If the selected package/program is deleted or deactivated, the form clears that selection and its Harga (and Sesi) *(my calls, resolved after the builder check, so a typed price is never silently replaced)*.
- When Harga changes and there is exactly one payment row, that row's amount follows Harga (today's behaviour on package change); with several rows they stay as typed and the "Kurang/Lebih" line shows the gap.
- The server accepts the submitted price (≥ 1, ≤ 999 999 999 999) and still requires payments to equal it exactly. It still requires the package / program to exist and be active. **"Harga sudah berubah, muat ulang halaman." and "Harga belum diatur, hubungi superadmin." are removed from these four forms.**

Per form:
- **Daftar Member Baru:** a **Kelola Paket** button on this form (spec). Harga = the package's price for the chosen Status.
- **Perpanjang Member:** Harga = the package's price for the chosen Status. No Kelola button (spec doesn't put one here).
- **Visit (Harian):** Harga Visit pre-filled from the standard visit price; if none is set, the field starts empty and the kasir types it.
- **Add-On (PT):** a **Kelola Trainer & Paket Tambahan** button. Picking a PT program fills Sesi (program sessions, integer 1–200, the same cap as `PtProgramSchema`) and Harga. `PtPurchaseSchema` gains `sessions`; the purchase stores the submitted sessions and price, and still copies the program name.

### 5.4 Pengaturan Harga (superadmin)

Remove the base-price card. Keep: Harga Visit (standard), Kelola Paket, Kelola Trainer, Kelola Program PT.

### 5.5 Tests (vitest)

- `PackageSchema`: missing / 0 / over-max price for each status; valid package.
- `PtPurchaseSchema`: sessions required, ≥ 1, integer; price/payments still checked.
- `RegisterMemberSchema`, `RenewMemberSchema`, `VisitSchema`: a price different from any list price is accepted when payments match; payments ≠ price still rejected.
- A pure helper `packagePrice(pkg, category): number` in `features/membership/logic.ts` (replacing `membershipPrice`) with a test.

## 6. Approaches

1. **Three price columns on `packages` (chosen).** One row per package, matching the pop-up; simplest to read and validate. Adding a fourth status later means a column (statuses are fixed in the spec).
2. **A `package_prices` table** (package × status). Easier to add a status, but a join on every read and a multi-row write on every save — flexibility the spec doesn't need. Rejected.
3. *(Dropped early)* Keep the base price per month and only make Harga editable — contradicts the spec's Kelola Paket at the front desk and the user's decision.

## 7. Left to the builder

File split for the new wrapper dialog; exact layout inside the pop-ups; how "Kurang/Lebih" is worded if it changes; Indonesian messages for the new fields; loading/empty states ("Belum ada paket. Tambah lewat Kelola Paket."). When done: update HANDOFF (sections 4–5: replace the "kasir never types a price" / "Package prices … superadmin" rows), DATABASE.md (packages columns, `category_prices` removed, upgrade note), CODEBASE_OVERVIEW, AUTH.md (who can manage prices); run lint, tests, build; browser-check as kasir and superadmin.

## 8. Calls I made (not discussed with the user)

- Perpanjang, Visit and Add-On Harga are editable (user had no preference).
- Pengaturan Harga keeps two separate buttons for trainers and PT programs; the combined pop-up is only on Add-On.
- A new item choice overwrites a manually edited Harga/Sesi.
- One payment row follows Harga; several rows don't.
- Sessions sold are capped at 200 (same as a program); prices at 999 999 999 999.
- The standard visit price stays superadmin-only; Pengaturan Harga stays superadmin-only.
- Pop-up edits never overwrite the form's current Harga/Sesi; a deleted/deactivated selection is cleared.
- The `db:push` upgrade note is documentation only: the only database is the empty dev one.
- Visit without a standard price: empty field, kasir types it.
- The removed stale-price check is not replaced by any warning.

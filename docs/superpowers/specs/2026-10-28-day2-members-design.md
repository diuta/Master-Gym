# Day 2 — Member Registration: Design

Date: 2026-10-28 · Status: implemented

> **Changed later on 2026-10-28 (pricing):** packages no longer carry prices. Each category has a monthly base price set by the **superadmin** in Membership → Pengaturan Harga (`category_prices` table); price = base × package months, computed on the server. Harga in the wizard is read-only, and Kelola Paket moved to the superadmin page. Sections below that say otherwise are superseded.

Read with [HANDOFF.md](../../HANDOFF.md) (spec summary in section 3, decisions in section 4) and [CODEBASE_OVERVIEW.md](../../CODEBASE_OVERVIEW.md) (conventions, request flow).

## 1. Why

The front desk can't sign up members yet, and everything after it (check-in on day 3, reports on day 5) needs members, packages and payments to exist. Day 2 lets the cashier set up packages, register a member, hand them a QR card on WhatsApp, and find them again.

**Done when:** the cashier can create packages, register a member with a webcam photo and a split payment, download that member's PDF card, and find the member in Data Member with the right status.

## 2. Goals, non-goals, anti-goals

**Goals**
1. Kelola Paket: add, edit and delete packages.
2. Daftar Member Baru: a 4-step wizard that saves the member, their first membership period, and 1..n payment rows in one go.
3. A phone-sized member PDF card with a QR code, downloadable straight after registering and again later.
4. Data Member: search, status filter, Edit, re-download the PDF.

**Non-goals (later days)**
- Check-in, Riwayat Absen, Visit, Perpanjang (renewal), Add-On/PT: **day 3**.
- On Data Member: the "Visitor" filter, the "Total Kunjungan" column and the "Detail" button. Their data only exists from day 3, so they're added then.
- The corporate package (on hold).
- Editing a member's package, price or payment after saving. Only personal details can be edited.

**Anti-goals (would count as a failure even if it works)**
- A QR code that contains the member number, phone number or any personal data. It must be a random token (HANDOFF section 4).
- Member photos readable without logging in (for example from `public/`).
- A member saved without a payment, or payments that don't add up to the price.
- A form the cashier has to fight: tiny text, unclear errors, or losing typed data on a validation error.

## 3. Constraints

- Follow the conventions in CODEBASE_OVERVIEW and HANDOFF section 2: code and DB in English, UI text in Indonesian; pages in `app/` stay thin and logic lives in `features/membership/`; Server Actions run `requireRole("kasir")` → Zod `safeParse` → `db.transaction` → `revalidatePath`; comments only explain *why*; mark known-limit shortcuts with `// shortcut: …`.
- Reference implementation: `~/Uta/sembako-staging` (branch `staging`). Copy rather than rewrite where it already solves the problem (uploads, wizard usage, currency input, combobox, jspdf usage).
- Ponytail: the smallest complete change. No new library except the three approved: `qrcode`, `jspdf`, and `vitest` (dev only, as in Sembako).
- UI rules from [UI.md](../../UI.md) section 4: text ≥ 16px for things read quickly, full Rupiah amounts, 44px click targets, statuses are colour + icon + text, confirm before delete.
- Money columns are `decimal`, plain dates are `date`, moments are `timestamp` ([DATABASE.md](../../DATABASE.md) section 6).
- **"Today" is WIB (Asia/Jakarta)** for start dates, days remaining and status. *(Builder's call, made because the server or container may run in UTC.)*
- **The webcam needs a secure context.** `getUserMedia` works on `http://localhost` but **not** on plain `http://<LAN-IP>`. If the desk PC ever opens the app over the network rather than on the same machine, it needs HTTPS. Note this in DOCKER.md; it's not in scope to set up.
- The user commits manually. Never commit.

## 4. What the user decided

| Topic | Decision |
|---|---|
| Package | Name + length in **months** + **three prices**: Pelajar, Mahasiswa, Umum |
| Price on the form | Auto-filled from package + the member's category, **editable** |
| Member number | `MG-0001`, `MG-0002`, … assigned automatically |
| Phone | **Unique** per member |
| Photo | **Required**, taken with the **desk PC webcam** (live preview, take and retake) |
| Payment methods | Cash, QRIS, Transfer, Debit (reports later group the last three as "Bank") |
| Split payment | One row (method + amount) by default; "+ Tambah metode" adds rows; the total must equal the price before saving |
| Form layout | **Wizard**: Data Diri → Foto → Paket & Bayar → Cek Lagi |
| PDF | **Phone-sized portrait card**: QR, name, member number, phone, expiry date, photo. Downloaded on the desk PC and sent via WhatsApp Web |
| Fixing mistakes | **Edit** in Data Member for name, phone, birth date, gender and photo |
| Tests | Add **vitest** (as in Sembako) with a few tests for the logic below |
| Start date | **Today or earlier** (backdating allowed, e.g. paid yesterday). No future dates |
| Birth date | **Optional** |

## 5. How it works

### 5.1 Data

New tables in `lib/db/schema.ts` (names are a suggestion, final naming is the builder's call):

- **`packages`**: name, `months` (int ≥ 1), `price_pelajar` / `price_mahasiswa` / `price_umum` (decimal), `is_active` (bool, default true), timestamps.
- **`members`**: `member_no` (unique, `MG-0001` format), name, phone (unique), `birth_date` (date, **nullable**), gender (enum `male`/`female`), category (enum `pelajar`/`mahasiswa`/`umum`), `photo_path` (relative upload path), `qr_token` (unique, random), timestamps.
- **`memberships`**: one row per paid period. `member_id`, `package_id`, plus a **copy** of the package name, months, category and price at the time of sale, so later package edits don't rewrite history. `start_date`, `end_date` (date), `created_at`.
- **`payments`**: one row per payment method used. `method` (enum `cash`/`qris`/`transfer`/`debit`), `amount` (decimal > 0), `paid_at` (timestamp), and a link to what it paid for. Day 2 only needs `membership_id`. Day 3 (visits, add-ons) and day 4 (sales, purchases) add their own nullable link columns to the same table, so reports can add up all payments in one place.

Rules:
- **Member number:** taken from a Postgres sequence inside the save transaction, formatted `MG-` + zero-padded to 4 digits (`MG-10000` is fine past 9999). The cashier sees "Otomatis" on the form and the real number after saving. A gap after a failed save is acceptable.
- **QR token:** `crypto.randomBytes` (≥ 16 bytes), base64url. Never derived from member data.
- **Phone:** normalised before validating and saving: strip spaces, dashes and dots; turn a leading `+62`/`62` into `0`; must then be 9–14 digits starting with `0`. Uniqueness is enforced by the DB constraint and shown as a friendly field error ("Nomor HP sudah terdaftar atas nama …").
- **End date:** `start + months − 1 day`, and the end date is the last day the member may train. Add calendar months and clamp to the month's last day (31 Jan + 1 month → 28/29 Feb, so the end date is 27/28 Feb). This matches renewal on day 3: the next period starts the day after `end_date`.
- **Status** (from the member's latest membership, against today in WIB):
  - **Aktif:** more than 7 days left
  - **Habis ≤ 7 Hari:** 0–7 days left (still allowed in)
  - **Sudah Habis:** `end_date` < today
  - "Sisa hari" = `end_date − today` (0 on the last day).
- **Deleting a package** that no membership uses removes it. If memberships use it, set `is_active = false` instead: it disappears from Kelola Paket and the package picker, and history keeps the copied name.

### 5.2 Photos

Copy Sembako's `lib/uploads.ts` (`saveBase64Upload`, `readUpload`, path-traversal check) and its `app/api/uploads/[...path]/route.ts`, minus the toko scoping. The route calls `requireRole("kasir")` itself (the superadmin has no membership pages, see AUTH.md; widen it on day 5 only if a dashboard shows photos) (the proxy skips `/api`), and the files live outside `public/`. Docker: add `UPLOADS_DIR=/app/uploads`, an `uploads_data` volume in both compose files, and a writable `/app/uploads` owned by `nextjs` in the Dockerfile, as Sembako does. Add `uploads/` to `.gitignore`.

Webcam capture uses the browser's `getUserMedia` plus a `<canvas>` snapshot to a JPEG data URL (no library). The step shows a large live preview with **"Ambil Foto"**; after taking one, it shows the still with **"Ulangi"**. If there's no camera or permission is refused, show a clear Indonesian message saying how to allow the camera. Stop the camera stream when leaving the step or closing the dialog.

### 5.3 Pembayaran page (`/membership/payment`)

The page has the form picker the spec describes. On day 2 it holds only **Daftar Member Baru**; day 3 adds the other three. A **"Kelola Paket"** button opens that pop-up.

**Kelola Paket** (dialog): a list of active packages (name, months, the three prices) with Edit/Hapus, plus an add form. Prices use `components/ui/currency-input.tsx`. Hapus asks for confirmation (`alert-dialog`).

**Daftar Member Baru** (wizard, using `components/ui/wizard.tsx`):
1. **Data Diri:** Nomor Member (shows "Otomatis", read-only), Nama, No. HP, Tanggal Lahir (`<input type="date">`, optional), Jenis Kelamin, Status (Pelajar/Mahasiswa/Umum).
2. **Foto:** the webcam step above. Can't go further without a photo.
3. **Paket & Bayar:** Paket (active packages), Tanggal Mulai (default today in WIB; today or earlier, never future, also checked on the server), Masa Berlaku shown as "s/d <end date>", Harga (auto-filled from package + Status, editable; changing package or Status refills it). Payment rows: method + amount, "+ Tambah metode", remove a row, a running "Total dibayar / Kurang" line. Can't go further until the total equals Harga exactly.
4. **Cek Lagi:** a read-only summary of everything including the photo. The **"Daftarkan & Buat QR"** button submits.

The server re-validates everything (Zod) and doesn't trust the client's end date, member number or totals: it recomputes the end date, assigns the number, and checks that the payment sum equals the price. One transaction inserts the member, the membership and the payment rows. The photo is written to disk before the transaction; an orphan file after a failed insert is acceptable (`// shortcut:`). On a field error (for example a duplicate phone), the wizard jumps back to the step with that field and keeps everything that was typed.

**After saving:** a success dialog shows the new member number and name with a big **"Unduh PDF"** button and "Daftar Member Lain" (resets the wizard).

### 5.4 Member PDF card

Generated in the browser with `jspdf` + `qrcode`, so it can be downloaded right after saving and again from Data Member. It's a portrait card around phone-screen proportions (e.g. 90 × 160 mm; exact size and layout are the builder's call). Top to bottom: Master Gym name and colours, photo, name, member number, phone, "Berlaku s/d <date>", then a **large QR** of `qr_token` with clear white margins so the USB scanner reads it from a phone screen. Filename: `<member_no>-<name>.pdf`. The photo is fetched from `/api/uploads/...` and embedded.

### 5.5 Data Member (`/membership/members`)

- Search by name, phone or member number.
- Status filter: **Semua, Aktif, Habis ≤ 7 Hari, Sudah Habis** ("Visitor" comes on day 3).
- Columns: Nomor Member, Nama, No. HP, Paket, Status (badge), Sisa Hari, Aksi (**Edit**, **Unduh PDF**).
- Statuses are added to `components/ui/status-badge.tsx` (colour + icon + text).
- Sorting with `hooks/use-sort.ts` + `components/ui/sortable-th.tsx`.
- The page loads all members on the server and filters in the browser. `// shortcut:` fine for a few thousand members; paginate on the server past that.
- **Edit** (dialog): name, phone, birth date, gender, and the photo with the same webcam control. Same validation and phone-uniqueness rules. Member number, QR token, package, category and payments are not editable.

### 5.6 Tests (vitest)

Add `vitest` as a dev dependency and `"test": "vitest run"` as in Sembako. Small tests for the pure functions only:
- end date from start + months, including the month-end clamp (31 Jan, 29 Feb in leap years, 31 Dec → next year)
- status and days remaining at the 0 / 7 / 8-day edges and after expiry
- phone normalisation
- the payment-rows-sum-equals-price check
- member number formatting

## 6. Left to the builder

Table, column and file names; how the pure logic is split into modules; exact Zod messages (Indonesian, plain); the PDF's exact dimensions and styling within the layout above; whether Kelola Paket uses one dialog with an inline form or a nested dialog; loading and empty states; which Sembako components (combobox, filter bar) to copy versus using a plain `select`. When done, update HANDOFF section 5, DATABASE.md (new tables), CODEBASE_OVERVIEW (new files and routes) and DOCKER.md (uploads volume, HTTPS note for the webcam), then run `npm run lint`, `npm test` and `npm run build`, and test in the browser as `kasir`.

## 7. Calls I made (not discussed with the user)

- Deleting a used package hides it instead of deleting it.
- The end date is inclusive (`start + months − 1 day`) with month-end clamping.
- The status thresholds: "Habis ≤ 7 Hari" is 0–7 days left; the last day still counts as active.
- "Today" means WIB.
- The member number is assigned at save time from a sequence, not shown in advance.
- Day 2's Pembayaran picker shows only Daftar Member Baru; Data Member leaves out Visitor, Total Kunjungan and Detail until day 3.
- Phone normalisation rules (leading `62` → `0`, 9–14 digits).
- All members load at once and are filtered in the browser.
- Price must be > 0.
- Photos (`/api/uploads`) are kasir-only.
- When a photo is replaced in Edit, the old file stays on disk (`// shortcut:`).

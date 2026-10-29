# Day 3 — Check-in, Visit, Renewal, PT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The front desk can scan members in (with PT and locker), sell day visits, renew memberships and sell PT sessions with split payments, and see attendance in Riwayat Absen and Data Member; the superadmin sets the Visit price, trainers and PT programs.

**Architecture:** Builds on day 2's `features/membership/`. New pure rules go in `logic.ts`, new Zod schemas in `validation.ts`, reads in `queries.ts`, Server Actions in `actions.ts` (split into `checkin-actions.ts` only if `actions.ts` passes ~500 lines). One server helper loads a `MemberSummary` (photo, status, PT balance, today's check-in) and is shared by Absen, Perpanjang and Add-On. Every payment-bearing save is one transaction writing its row plus `payments` rows linked by exactly one FK.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions, async `searchParams`), React 19, Drizzle 0.45 (`check`, `.for("update")`) + drizzle-kit 0.31 (`db:push`), Postgres 16, Zod 4, vitest 4, shadcn base-nova in `components/ui/`. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-10-29-day3-checkin-design.md](../specs/2026-10-29-day3-checkin-design.md). Read it, and skim the day 2 spec it builds on, before any task.

## Global Constraints

- **Never `git commit` or `git push`.** The user commits manually. Where a task says "stop", report and stop.
- Before writing Next.js code, check `node_modules/next/dist/docs/` for the API you use (AGENTS.md). Page `searchParams` is a Promise in this version.
- Code, files, routes, DB in English; every UI string Indonesian.
- Pages in `app/` stay thin: `await requireRole(...)`, load data, render a component from `features/membership/`.
- Every Server Action starts with `await requireRole("kasir")` (desk work) or `await requireRole("superadmin")` (Visit price, trainers, PT programs). Never both.
- **The kasir never types a price.** Every price is recomputed on the server from the DB; a client price that differs returns `{ message: "Harga sudah berubah, muat ulang halaman." }`; a missing price returns `{ message: "Harga belum diatur, hubungi superadmin." }`.
- Payment rows must equal the price exactly (`paymentsMatchPrice`), checked in the schema and again on the server.
- Comments only explain *why*. Known-limit shortcuts: `// shortcut: <limit>, <when to upgrade>`.
- Money `decimal(14,2)` in DB, whole Rupiah `number` in TS. Plain dates `date` mode string. Moments `timestamp` (stored UTC).
- "Today" is `todayWib()`. A day's moments are queried with `wibDayRange(date)`. Times shown to users use `formatTimeWib(date)` (HH.mm, Asia/Jakarta).
- Phones are stored normalised (`normalizePhone`).
- UI: text ≥ 16px for things read quickly, 44px targets (`h-11`), full Rupiah via `rupiah.format`, statuses are colour + icon + text (`StatusBadge`), confirm before delete. Only colour tokens from `app/globals.css`.
- Follow existing patterns: Kelola Paket dialog for CRUD dialogs, the day 2 wizard/forms for field + error layout, `PaymentRows` for payments.

## Review Focus

1. **Scanner at the desk.** After Check-In, Close (Esc), or "Member tidak ditemukan.", the scan input is empty and focused; Enter in the pop-up checks in. A phone typed as `+62 812-…` finds the member. Pinned in Task 4 Step 5.
2. **PT balance never below zero.** Ticking "Pakai PT" without a trainer is rejected (schema + server); with balance 0 the server rejects even if the client sends `trainerId`; two quick Check-In clicks make one row. Pinned in Task 1 (`CheckInSchema`) and Task 4 Steps 2 and 5.
3. **Expired member.** The server refuses check-in even if the client is tampered with; the pop-up shows Perpanjang, which opens the renewal form with that member selected. Pinned in Task 4 Step 5 and Task 6 Step 4.
4. **Renewal dates and category.** A still-active member's new period starts the day after their end date; an expired one starts today; the member's category becomes the one chosen and the price follows it. Pinned in Task 1 (`renewalStartDate`) and Task 6 Step 4.
5. **Around midnight WIB.** A check-in at 23:30 WIB belongs to that day; one at 00:10 WIB to the next. Pinned in Task 1 (`wibDayRange`).

---

## File Structure

| File | Responsibility |
|---|---|
| `features/membership/logic.ts` (+ test) | + `renewalStartDate`, `wibDayRange` |
| `lib/format.ts` | + `formatTimeWib` |
| `features/membership/validation.ts` (+ test) | + schemas for check-in, visit, renewal, PT purchase, trainer, PT program, visit price; `MemberSummary`, `AttendanceRow` types |
| `lib/db/schema.ts` | + `visitPrice`, `trainers`, `ptPrograms`, `ptPurchases`, `visits`, `checkIns`; `payments.visitId`, `payments.ptPurchaseId` + check |
| `features/membership/queries.ts` | + `getVisitPrice`, `listActiveTrainers`, `listActivePtPrograms`, `getMemberSummary`, `findMemberSummary`, `searchMembers`, `listAttendance`, `listVisitors`, `getMemberDetail`; `listMembers` gains `totalCheckIns` |
| `features/membership/actions.ts` | + superadmin CRUD, `lookupMemberAction`, `checkInAction`, `createVisitAction`, `searchMembersAction`, `renewMemberAction`, `buyPtAction`, `memberDetailAction` |
| `features/membership/pricing-page.tsx` | + Harga Visit form, Kelola Trainer, Kelola Program PT buttons |
| `features/membership/kelola-trainer-dialog.tsx`, `kelola-program-pt-dialog.tsx` | CRUD dialogs |
| `features/membership/check-in-page.tsx` | Absen: scan input, pop-up, today's list |
| `features/membership/attendance-table.tsx` | Table used by Absen (today) and Riwayat Absen |
| `features/membership/attendance-page.tsx` | Riwayat Absen with date filter |
| `features/membership/payment-page.tsx` | Picker driven by `?form=` |
| `features/membership/member-search.tsx` | Search/scan → pick a member |
| `features/membership/visit-form.tsx`, `renew-member-form.tsx`, `pt-addon-form.tsx` | The three new Pembayaran forms |
| `features/membership/members-page.tsx` | + Total Kehadiran, Detail, Visitor filter |
| `features/membership/member-detail-dialog.tsx` | PT balance + check-in history |
| `app/(app)/membership/check-in/page.tsx`, `attendance/page.tsx`, `payment/page.tsx`, `pricing/page.tsx`, `members/page.tsx` | Thin pages |
| `components/ui/status-badge.tsx` | + `visitor` kind |

---

### Task 1: Pure rules + validation schemas

**Files:**
- Modify: `features/membership/logic.ts`, `logic.test.ts`, `validation.ts`, `validation.test.ts`, `lib/format.ts`

**Interfaces:**
- Consumes: day 2 `todayWib`, `normalizePhone`, `paymentsMatchPrice`, the `price` helper and `phone` field in `validation.ts`.
- Produces:
  - `renewalStartDate(latestEndDate: string | null, today: string): string` — `max(latestEndDate + 1 day, today)`; `null` → today
  - `wibDayRange(date: string): { start: Date; end: Date }` — WIB midnight of `date` and of the next day, as UTC instants (`end` exclusive)
  - `formatTimeWib(d: Date): string` in `lib/format.ts` (e.g. `"07.12"`, `Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })`)
  - Schemas and their `z.input` types: `CheckInSchema {memberId:int, lockerNo:string(trim, max 20, ""→null), useTrainer:boolean, trainerId?:int}` (superRefine: `useTrainer` without `trainerId` → path `["trainerId"]` "Pilih trainer."); `VisitSchema {name, phone, lockerNo, price, payments}`; `RenewMemberSchema {memberId, category, packageId, price, payments}`; `PtPurchaseSchema {memberId, ptProgramId, price, payments}`; `TrainerSchema {name, phone}`; `PtProgramSchema {name, sessions:int 1..200, price}`; `VisitPriceSchema {price}`. The three payment schemas reuse day 2's payments array + "Total pembayaran harus sama dengan harga." refine (extract it as a shared helper rather than copying).
  - Types: `MemberSummary = { id; memberNo; name; phone; birthDate: string|null; gender; category; photoPath; qrToken; packageName; endDate; status: MembershipStatus; daysRemaining; ptBalance: number; checkedInTodayAt: string|null /* "07.12" */ }`; `AttendanceRow = { kind: "member"|"visitor"; at: Date; name: string; memberNo: string|null; lockerNo: string|null; trainerName: string|null }`.

- [ ] **Step 1: Failing tests in `logic.test.ts`**

```ts
describe("renewalStartDate", () => {
  it.each([
    ["2026-11-27", "2026-10-29", "2026-11-28"], // still active: day after end
    ["2026-10-29", "2026-10-29", "2026-10-30"], // ends today
    ["2026-10-28", "2026-10-29", "2026-10-29"], // ended yesterday: today
    ["2026-08-01", "2026-10-29", "2026-10-29"], // long expired: today
    ["2026-12-31", "2026-10-29", "2027-01-01"], // year rollover
    [null, "2026-10-29", "2026-10-29"],
  ])("end %s, today %s → %s", (end, today, start) => {
    expect(renewalStartDate(end, today)).toBe(start);
  });
});

describe("wibDayRange", () => {
  it("is WIB midnight to WIB midnight in UTC", () => {
    const r = wibDayRange("2026-10-29");
    expect(r.start.toISOString()).toBe("2026-10-28T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-29T17:00:00.000Z");
  });
  it("puts 23:30 and 00:10 WIB on the right days", () => {
    const r = wibDayRange("2026-10-29");
    const late = new Date("2026-10-29T16:30:00Z"); // 23:30 WIB on the 29th
    const early = new Date("2026-10-29T17:10:00Z"); // 00:10 WIB on the 30th
    expect(late >= r.start && late < r.end).toBe(true);
    expect(early >= r.start && early < r.end).toBe(false);
  });
});
```

- [ ] **Step 2: Failing tests in `validation.test.ts`** — `CheckInSchema`: `useTrainer: true` without `trainerId` fails on `trainerId`; `useTrainer: false` passes with no trainer; `lockerNo: "  "` parses to `null`. `VisitSchema`: payments short of price fails on `payments`; phone `"+62 812 3456 7890"` parses to `"081234567890"`; empty name fails. `RenewMemberSchema` and `PtPurchaseSchema`: payments mismatch fails on `payments`; missing `packageId`/`ptProgramId` fails. `PtProgramSchema`: `sessions: 0` fails.

- [ ] **Step 3: Run** `npm test` — the new tests FAIL (not defined).

- [ ] **Step 4: Implement** the functions, `formatTimeWib`, schemas and types above.

- [ ] **Step 5: Run** `npm test && npx tsc --noEmit` — all PASS, no type errors. Stop.

---

### Task 2: Database schema

**Files:**
- Modify: `lib/db/schema.ts`

**Interfaces:**
- Produces tables (Drizzle names → SQL names):
  - `visitPrice` → `visit_price`: `id integer PK default 1` with `check(id = 1)`, `price decimal(14,2) not null`, `updatedAt`
  - `trainers`: `id bigserial`, `name varchar(100)`, `phone varchar(20)`, `isActive bool default true`, timestamps
  - `ptPrograms` → `pt_programs`: `id`, `name varchar(100)`, `sessions integer`, `price decimal(14,2)`, `isActive`, timestamps
  - `ptPurchases` → `pt_purchases`: `id`, `memberId` FK, `ptProgramId` FK, copies `programName`, `sessions`, `price`, `createdAt`
  - `visits`: `id`, `name varchar(100)`, `phone varchar(20)`, `price decimal(14,2)`, `lockerNo varchar(20) null`, `createdAt` (= check-in time). Index on `createdAt`.
  - `checkIns` → `check_ins`: `id`, `memberId` FK, `lockerNo varchar(20) null`, `trainerId` FK null, `checkedInAt timestamp default now`. Index on `checkedInAt` and on `memberId`.
  - `payments`: + `visitId` FK null, `ptPurchaseId` FK null, and `check("payments_one_link", sql\`num_nonnulls(membership_id, visit_id, pt_purchase_id) = 1\`)`.

- [ ] **Step 1: Add the tables** above with a one-line *why* comment where day 2 has one (copies-at-sale, single-row price).
- [ ] **Step 2: Push** — `set -a; . ./.env; set +a; npx drizzle-kit push`. Expected: applies without asking to drop anything; existing payments satisfy the check (they all have `membership_id`). If it asks to drop or truncate anything, stop and report.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm run lint`. Stop.

---

### Task 3: Superadmin — Visit price, trainers, PT programs

**Files:**
- Create: `features/membership/kelola-trainer-dialog.tsx`, `features/membership/kelola-program-pt-dialog.tsx`
- Modify: `features/membership/actions.ts`, `queries.ts`, `pricing-page.tsx`, `app/(app)/membership/pricing/page.tsx`

**Interfaces:**
- Consumes: Task 1 `TrainerSchema`, `PtProgramSchema`, `VisitPriceSchema`; Task 2 tables.
- Produces:
  - `getVisitPrice(): Promise<number | null>`
  - `type TrainerOption = { id: number; name: string; phone: string }`, `listActiveTrainers(): Promise<TrainerOption[]>`
  - `type PtProgramOption = { id: number; name: string; sessions: number; price: number }`, `listActivePtPrograms(): Promise<PtProgramOption[]>`
  - Actions (all `requireRole("superadmin")`, all `revalidatePricing()`, which must also revalidate `/membership/check-in`): `saveVisitPriceAction(input)`, `createTrainerAction`, `updateTrainerAction(id, input)`, `deleteTrainerAction(id)`, `createPtProgramAction`, `updatePtProgramAction(id, input)`, `deletePtProgramAction(id)` — each `Promise<ActionResult>`. Delete removes an unused row and deactivates a used one (trainer used = any `check_ins.trainer_id`; program used = any `pt_purchases`), same as `deletePackageAction`.
  - `PricingPage({ packages, prices, visitPrice, trainers, ptPrograms })`

- [ ] **Step 1: Queries and actions** as above. `saveVisitPriceAction` upserts row `id = 1`.
- [ ] **Step 2: Dialogs.** Copy the Kelola Paket dialog's structure (list with Edit/Hapus, inline add/edit form, delete confirmation). Trainer form: Nama*, No. HP*. Program form: Nama Program* (placeholder "contoh: 12 Sesi"), Jumlah Sesi*, Harga* (`CurrencyInput`). List lines: "Budi · 0812…" and "12 Sesi · 12 sesi · Rp 1.200.000".
- [ ] **Step 3: Pricing page.** Header buttons: Kelola Paket, Kelola Trainer, Kelola Program PT. Below the base-price card, a second card "Harga Visit (Harian)" with one `CurrencyInput` and "Simpan Harga Visit" (same success/error pattern as the base-price form).
- [ ] **Step 4: Run** `npm run lint && npx tsc --noEmit`.
- [ ] **Step 5: Browser as superadmin** (`superadmin@mastergym.test`, seed password): set Harga Visit 25.000; add trainers "Rudi" and "Sinta"; add programs "Per Visit" (1 sesi, 100.000) and "12 Sesi" (12, 1.000.000); edit one; delete an unused one (gone). As kasir, `/membership/pricing` redirects to `/dashboard`. Stop.

---

### Task 4: Absen (check-in)

**Files:**
- Create: `features/membership/check-in-page.tsx`, `features/membership/attendance-table.tsx`
- Modify: `features/membership/queries.ts`, `actions.ts`, `app/(app)/membership/check-in/page.tsx`, `components/ui/status-badge.tsx`

**Interfaces:**
- Consumes: Task 1 `CheckInSchema`, `MemberSummary`, `AttendanceRow`, `wibDayRange`, `formatTimeWib`; Task 3 `listActiveTrainers`, `TrainerOption`.
- Produces:
  - `getMemberSummary(memberId: number, executor = db): Promise<MemberSummary | null>` — latest membership (as `listMembers`), `ptBalance` = `sum(pt_purchases.sessions) − count(check_ins where trainer_id is not null)`, `checkedInTodayAt` = earliest check-in in `wibDayRange(todayWib())` formatted with `formatTimeWib`
  - `findMemberSummary(text: string): Promise<MemberSummary | null>` — exact `qr_token` first, else `normalizePhone(text)` → `members.phone`, else `null`
  - `listAttendance(date: string): Promise<AttendanceRow[]>` — check-ins (joined member, trainer) and visits in `wibDayRange(date)`, merged, newest first
  - `lookupMemberAction(text: string): Promise<ActionResult<MemberSummary>>` — not found → `{ message: "Member tidak ditemukan." }`
  - `checkInAction(input: CheckInInput): Promise<ActionResult>` — `requireRole("kasir")` → schema → `db.transaction`: lock the member row (`.for("update")`), reload the summary inside the transaction, reject expired (`{ message: "Membership sudah habis, perpanjang dulu." }`), if `useTrainer`: trainer must be active (`{ errors: { trainerId: ["Trainer tidak tersedia."] } }`) and `ptBalance > 0` (`{ message: "Sesi PT sudah habis." }`); insert the check-in. `revalidatePath("/membership/check-in")`, `/membership/attendance`, `/membership/members`.
  - `AttendanceTable({ rows, showDate }: { rows: AttendanceRow[]; showDate?: boolean })` — columns No, (Tanggal), Jam Masuk, Nama, Status, Loker. Status: `StatusBadge` `member_active` labelled "Member" or new `visitor` kind ("Visitor"), plus "PT · <trainer>" text when `trainerName`.
  - `CheckInPage({ today: AttendanceRow[]; trainers: TrainerOption[] })`

- [ ] **Step 1: Queries** above. `getMemberSummary` takes an optional executor so `checkInAction` can call it with `tx`.
- [ ] **Step 2: Actions** above. The re-check after the lock is what keeps PT from going negative under two fast clicks — keep it inside the transaction.
- [ ] **Step 3: `CheckInPage`.** A form with one large input (`h-14 text-xl`, `autoFocus`, placeholder "Scan QR atau ketik No. HP", `autoComplete="off"`). Enter submits to `lookupMemberAction`; the input clears after every lookup. Not found: inline destructive text under the input. Found: a `Dialog` with:
  - photo (`/api/uploads/<photoPath>`, ~192px), name (text-2xl), member number, package, `StatusBadge` for status, "Sisa N hari"
  - `checkedInTodayAt`: warning `Alert` "Sudah check-in hari ini jam 07.12"
  - expired: Check-In disabled and a "Perpanjang" button linking to `/membership/payment?form=renew&member=<id>`
  - "No. Loker" input
  - when `ptBalance > 0`: checkbox "Pakai PT sesi ini (sisa N sesi)"; ticked → required Trainer `Select`
  - "Check-In" (primary, default action so Enter submits, disabled while pending) and "Close"
  - on any close (button, Esc, success), refocus the scan input (`ref.current?.focus()` in the dialog's close handler).
  Below: "Absen Hari Ini" + `AttendanceTable` of `today`. After success, `router.refresh()`.
- [ ] **Step 4: Page** `check-in/page.tsx`: `requireRole("kasir")`, `listAttendance(todayWib())`, `listActiveTrainers()`.
- [ ] **Step 5: Browser as kasir** (simulate the scanner by typing a member's `qr_token` from the DB + Enter):
  - MG-0001 → pop-up → locker "12" → Enter → listed with time and locker; input empty and focused.
  - Same member again → warning with the first time; Check-In still works.
  - Type `+62 812-3456-7890` (MG-0001's phone) → pop-up opens.
  - `zzz` → "Member tidak ditemukan.", focused.
  - Esc closes the pop-up and the input is focused.
  - MG-0002 (expired) → Check-In disabled; Perpanjang opens `/membership/payment?form=renew&member=<id>` (form arrives in Task 6). The server-side expired refusal is checked in review (Review Focus 3), not by tampering in the browser.
  - PT: after Task 7, buy 1 session for MG-0001, check in with PT + trainer → balance 0; the next pop-up shows no PT checkbox. (Revisit after Task 7.)
  Stop.

---

### Task 5: Pembayaran picker + Visit (Harian)

**Files:**
- Create: `features/membership/visit-form.tsx`
- Modify: `features/membership/payment-page.tsx`, `actions.ts`, `app/(app)/membership/payment/page.tsx`

**Interfaces:**
- Consumes: Task 1 `VisitSchema`; Task 3 `getVisitPrice`; day 2 `PaymentRows`.
- Produces:
  - `type PaymentForm = "new" | "visit" | "renew" | "addon"`
  - `PaymentPage({ form, packages, prices, visitPrice, ptPrograms, member })` — `member: MemberSummary | null` from `?member=`
  - `createVisitAction(input: VisitInput): Promise<ActionResult>` — `requireRole("kasir")` → schema → compare price with `getVisitPrice()` (null / mismatch messages from Global Constraints) → transaction inserting the visit + payments (`visitId`). Revalidate `/membership/check-in`, `/membership/attendance`, `/membership/members`.
  - `VisitForm({ price }: { price: number | null })`

- [ ] **Step 1: Picker.** Items: Daftar Member Baru (`new`), Visit (Harian) (`visit`), Perpanjang Member (`renew`), Add-On (`addon`). Changing it does `router.replace("/membership/payment?form=<value>")` (drops `member`). Unknown or missing `form` → `new`. Render the matching form; `renew`/`addon` render a placeholder until Tasks 6–7.
- [ ] **Step 2: Page.** `searchParams: Promise<{ form?: string; member?: string }>`; load packages, prices, visit price, PT programs, and `getMemberSummary(Number(member))` when `member` is a positive integer.
- [ ] **Step 3: `VisitForm`.** One card, no wizard: Nama*, No. HP*, No. Loker, Harga (read-only, or "Harga belum diatur, hubungi superadmin." and no payment rows when `price` is null), `PaymentRows`, button "Simpan & Check-In". Client validates with `VisitSchema` before submit. Success: green `Alert` "Visit tersimpan, <name> sudah check-in." and the form resets.
- [ ] **Step 4: Run** `npm run lint && npm test`.
- [ ] **Step 5: Browser as kasir:** visit "Joko", 0812…, locker 5, Cash 10.000 + QRIS 15.000 → success; Absen today lists Joko as Visitor with locker 5. With the Visit price deleted from the DB (`delete from visit_price`), the form shows the not-set message; restore it. Stop.

---

### Task 6: Member search + Perpanjang Member

**Files:**
- Create: `features/membership/member-search.tsx`, `features/membership/renew-member-form.tsx`
- Modify: `features/membership/queries.ts`, `actions.ts`, `payment-page.tsx`

**Interfaces:**
- Consumes: Task 1 `RenewMemberSchema`, `renewalStartDate`, `MemberSummary`; Task 4 `getMemberSummary`, `findMemberSummary`; day 2 `membershipEndDate`, `membershipPrice`, `downloadMemberPdf`, `MemberCard`.
- Produces:
  - `searchMembers(q: string): Promise<MemberSummary[]>` — `findMemberSummary(q)` hit first; else `member_no` ILIKE / `name` ILIKE `%q%` / phone contains the digits; max 10, ordered by name
  - `searchMembersAction(q: string): Promise<MemberSummary[]>` (`requireRole("kasir")`; `q.trim().length < 2` → `[]`)
  - `MemberSearch({ value, onChange }: { value: MemberSummary | null; onChange: (m: MemberSummary | null) => void })` — input (Enter or 300 ms pause searches), a result list of buttons (photo thumb, name, number, phone, status), a selected-member card with "Ganti" to clear; a single exact scan/phone hit selects immediately
  - `renewMemberAction(input: RenewMemberInput): Promise<ActionResult<MemberCard>>` — `requireRole("kasir")` → schema → active package → price = `membershipPrice(base, months)` vs input (Global Constraints messages) → transaction: lock member row, latest `end_date`, `start = renewalStartDate(latestEnd, todayWib())`, `end = membershipEndDate(start, months)`, insert membership (copies), payments (`membershipId`), update `members.category` + `updatedAt`. Returns the `MemberCard` with the new end date. Revalidate members, check-in.
  - `RenewMemberForm({ packages, prices, initialMember })`

- [ ] **Step 1: Queries/actions** above.
- [ ] **Step 2: `MemberSearch`.** Results are ≥ 44px rows; keyboard: Enter with one result selects it.
- [ ] **Step 3: `RenewMemberForm`.** `MemberSearch` (seeded from `initialMember`). When selected: photo, number, name, birth date, gender, phone read-only; "Paket sekarang: <name> · berakhir <date> (<status>)". Then Status* (prefilled with the member's category), Paket*, "Periode baru: <start> s/d <end>" (computed client-side with the same functions; server recomputes), Harga read-only (not-set message when the base price is missing), `PaymentRows` (reset to one row when Status or Paket changes, like the wizard), button "Perpanjang". Success: dialog "Membership diperpanjang" with the new end date, "Unduh PDF" (`downloadMemberPdf`) and "Selesai" (reset).
- [ ] **Step 4: Browser as kasir:**
  - Renew MG-0001 (active to 2026-11-27) with 1 Bulan → period 28 Nov 2026 s/d 27 Dec 2026; Data Member shows the new end date.
  - From Absen, scan MG-0002 (expired) → Perpanjang → form opens with MG-0002 selected; renew as Pelajar → period starts today; Data Member shows Pelajar and Aktif; scanning again now allows Check-In.
  - Change the base price in the DB while the form is open → "Harga sudah berubah, muat ulang halaman."; restore.
  Stop.

---

### Task 7: Add-On (PT)

**Files:**
- Create: `features/membership/pt-addon-form.tsx`
- Modify: `features/membership/actions.ts`, `payment-page.tsx`

**Interfaces:**
- Consumes: Task 1 `PtPurchaseSchema`; Task 3 `PtProgramOption`; Task 6 `MemberSearch`.
- Produces:
  - `buyPtAction(input: PtPurchaseInput): Promise<ActionResult<{ ptBalance: number }>>` — `requireRole("kasir")` → schema → active program, price must equal `program.price` → transaction inserting the purchase (copies) + payments (`ptPurchaseId`) → returns the new balance. Allowed for expired members. Revalidate members, check-in.
  - `PtAddonForm({ programs, initialMember })`

- [ ] **Step 1: Action** above.
- [ ] **Step 2: Form.** `MemberSearch`; when selected show name, number and "Sisa sesi PT: N". Program PT* select ("12 Sesi — 12 sesi"), Harga read-only, "+N sesi", `PaymentRows`, button "Simpan Add-On". No programs → "Belum ada program PT, hubungi superadmin." Success `Alert` "PT tersimpan. Sisa sesi sekarang N." and reset.
- [ ] **Step 3: Browser as kasir:** buy "Per Visit" for MG-0001 → balance 1; then finish Task 4 Step 5's PT bullet (check in with PT + Rudi → balance 0 → no checkbox next time; Riwayat shows "PT · Rudi"). Stop.

---

### Task 8: Riwayat Absen

**Files:**
- Create: `features/membership/attendance-page.tsx`
- Modify: `app/(app)/membership/attendance/page.tsx`

**Interfaces:**
- Consumes: Task 4 `listAttendance`, `AttendanceTable`.
- Produces: `AttendancePage({ date, rows }: { date: string; rows: AttendanceRow[] })`

- [ ] **Step 1: Page** reads `searchParams.date`; valid `YYYY-MM-DD` not after today, else `todayWib()`.
- [ ] **Step 2: Component.** Title "Riwayat Absen", `<input type="date" max={todayWib()}>` (h-11) that does `router.replace("?date=…")`, a count line "N orang (M member, V visitor)", `AttendanceTable showDate`. Empty → `EmptyState` "Belum ada absen di tanggal ini."
- [ ] **Step 3: Browser:** today shows the members and visitors from earlier tasks; yesterday is empty. Stop.

---

### Task 9: Data Member — Total Kehadiran, Detail, Visitor filter

**Files:**
- Create: `features/membership/member-detail-dialog.tsx`
- Modify: `features/membership/queries.ts`, `actions.ts`, `members-page.tsx`, `app/(app)/membership/members/page.tsx`

**Interfaces:**
- Consumes: Task 1 `formatTimeWib`; Task 2 tables.
- Produces:
  - `MemberRow` gains `totalCheckIns: number` (count of `check_ins`, visits excluded)
  - `type VisitorRow = { phone: string; name: string; visits: number; lastVisitAt: Date }`, `listVisitors(): Promise<VisitorRow[]>` — grouped by phone, name from the latest visit, newest last visit first
  - `type MemberDetail = { ptBalance: number; checkIns: { at: Date; lockerNo: string | null; trainerName: string | null }[] }`, `memberDetailAction(memberId: number): Promise<ActionResult<MemberDetail>>` (`requireRole("kasir")`; newest first)
  - `MembersPage({ members, visitors })`

- [ ] **Step 1: Queries/action** above. `listMembers` gets the count via a grouped subquery joined on member id (not N+1).
- [ ] **Step 2: Members page.** New column "Total Kehadiran" (sortable). Aksi gains "Detail" (opens `MemberDetailDialog`, loading the detail on open). Filter gains "Visitor": the table switches to Nama, No. HP, Jumlah Kunjungan, Kunjungan Terakhir (date + `formatTimeWib`); search filters name/phone; no Aksi column. Keep the `// shortcut:` note about loading everything.
- [ ] **Step 3: Detail dialog.** Header: name + number; "Sisa sesi PT: N"; a list/table Tanggal, Jam, Loker, PT (trainer or "-"). Empty → "Belum pernah check-in."
- [ ] **Step 4: Browser:** MG-0001 shows its check-in count; Detail lists them with PT/trainer; Visitor filter shows Joko with 1 visit. Stop.

---

### Task 10: Docs and final verification

**Files:**
- Modify: `docs/HANDOFF.md` (section 4: visitor check-in automatic on payment, trainer chosen at check-in, PT never expires, renewal start rule; section 5: day 3 done + gaps; section 8 marked done), `docs/DATABASE.md` (new tables, payments check), `docs/CODEBASE_OVERVIEW.md` (routes, files), `docs/AUTH.md` (if menus changed), `docs/superpowers/specs/2026-10-29-day3-checkin-design.md` (Status: implemented)

- [ ] **Step 1: Update the docs** above.
- [ ] **Step 2: Run** `npm run lint && npm test && npx tsc --noEmit && npm run build`. Expected: clean, all PASS, build has no warnings.
- [ ] **Step 3: Full desk run as kasir** in one sitting: scan 3 members in a row without touching the mouse; one visit; one renewal from an expired scan; one PT purchase and a PT check-in; Riwayat Absen and Data Member reflect all of it. Server log has no errors. Stop.

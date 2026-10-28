# Day 2 — Member Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The cashier can manage packages, register a member (webcam photo, split payment) through a 4-step wizard, download a phone-sized QR card PDF, and find or edit members in Data Member.

**Architecture:** Pure date, phone, money and number rules live in `features/membership/logic.ts` (vitest-tested). Zod schemas in `validation.ts` reuse them and are shared by client steps and Server Actions. One `actions.ts` holds every membership Server Action (`requireRole("kasir")` → Zod → `db.transaction` → `revalidatePath`). Photos go to disk through a copy of Sembako's `lib/uploads.ts` and are served by an auth-checked `/api/uploads` route. The PDF is built in the browser with `jspdf` + `qrcode`.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions, `proxy.ts`), React 19, Drizzle 0.45 + drizzle-kit 0.31 (`db:push`), Postgres 16, Zod 4, shadcn base-nova kit in `components/ui/`, new: `qrcode`, `jspdf`, `vitest` (dev), `@types/qrcode` (dev).

**Spec:** [docs/superpowers/specs/2026-10-28-day2-members-design.md](../specs/2026-10-28-day2-members-design.md). Read it before any task.

## Global Constraints

- **Never `git commit` or `git push`.** The user commits manually. Where a task ends, stop and report; don't commit.
- Before writing Next.js code, check `node_modules/next/dist/docs/` for the API you use (AGENTS.md). Middleware is `proxy.ts`; `/api` is excluded from its matcher, so route handlers check auth themselves.
- Code, files, routes and DB columns are English; every UI string is Indonesian ("Simpan", not "Submit").
- Pages in `app/` stay thin (`requireRole(...)` then render a component from `features/membership/`).
- Every Server Action starts with `await requireRole("kasir")`.
- Comments only explain *why*. Known-limit shortcuts are marked `// shortcut: <limit>, <when to upgrade>`.
- Install new packages with exact versions (`npm install --save-exact`), matching how `package.json` pins everything.
- Money is `decimal(14, 2)` in the DB and whole Rupiah numbers (`number`) in TypeScript. Plain dates are `date` with `mode: "string"` (`"YYYY-MM-DD"`); moments are `timestamp`.
- "Today" is always `todayWib()` (Asia/Jakarta), never `new Date().toISOString()`.
- UI: text ≥ 16px for things read quickly, full Rupiah amounts (`Rp150.000`), 44px click targets, statuses are colour + icon + text, confirm before delete (`alert-dialog`).
- QR content is `members.qr_token` only: `crypto.randomBytes(16).toString("base64url")`.
- Member photos are never put in `public/`.
- Use only the colour tokens from `app/globals.css` (`bg-primary`, `text-muted-foreground`, …), never hex values. The PDF is the exception: jsPDF needs literal RGB values.

## Review Focus

1. **Duplicate phone on register and on edit.** Registering with a phone that's already used shows "Nomor HP sudah terdaftar atas nama <name>." on the Data Diri field. Editing a member and keeping their own phone must **not** show that error. Pinned in Task 6 Step 6 and Task 8 Step 4.
2. **Payment rows that are empty, 0, or don't add up.** A row with an empty or 0 amount, or a total above or below Harga, blocks "Lanjut", and the server refuses it too. Pinned in Task 1 (`paymentsMatchPrice`) and Task 2 (`RegisterMemberSchema`).
3. **Harga changed after the payment rows were filled in.** The "Kurang" or "Lebih" line updates and "Lanjut" is blocked until it's fixed. Pinned in Task 6 Step 6.
4. **No camera, permission refused, or camera busy.** A clear Indonesian message with a "Coba Lagi" button, and the cashier can't go past the Foto step. Pinned in Task 5 Step 3.
5. **Around midnight WIB, and future dates sent from devtools.** At 23:30 UTC on 28 Oct, "today" is 29 Oct WIB. A future `startDate` or `birthDate` is rejected on the server. Pinned in Task 1 (`todayWib`) and Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.mts` | Test runner config, `@` alias, ignores `.next` |
| `features/membership/logic.ts` (+ `.test.ts`) | Pure rules: today WIB, end date, days left, status, phone, payment sum, member number |
| `features/membership/validation.ts` (+ `.test.ts`) | Zod schemas and input/result types for packages, registration, member edit |
| `lib/db/schema.ts` | New enums, sequence and 4 tables |
| `lib/uploads.ts` | Save base64 photos to `UPLOADS_DIR`, read them back safely |
| `app/api/uploads/[...path]/route.ts` | Serve photos to the logged-in kasir |
| `features/membership/queries.ts` | Server-only reads: active packages, member list |
| `features/membership/actions.ts` | All membership Server Actions |
| `features/membership/payment-page.tsx` | Pembayaran page: form picker + Kelola Paket button + wizard |
| `features/membership/kelola-paket-dialog.tsx` | Package CRUD dialog |
| `features/membership/webcam-capture.tsx` | Live preview, Ambil Foto / Ulangi, error state |
| `features/membership/payment-rows.tsx` | Split-payment rows with running total |
| `features/membership/register-member-wizard.tsx` | 4-step wizard + success dialog |
| `features/membership/member-pdf.ts` | `downloadMemberPdf(card)` |
| `features/membership/members-page.tsx` | Data Member table, search, filter, sort |
| `features/membership/edit-member-dialog.tsx` | Edit personal details + photo |
| `components/ui/status-badge.tsx` | + `member_active`, `member_expiring`, `member_expired` |

Shared types (defined in Task 2, used everywhere):

```ts
export type PaymentMethod = "cash" | "qris" | "transfer" | "debit";
export type MemberCategory = "pelajar" | "mahasiswa" | "umum";
export type Gender = "male" | "female";
export type MembershipStatus = "active" | "expiring" | "expired";
export type MemberCard = {           // everything the PDF needs
  memberNo: string; name: string; phone: string;
  endDate: string; photoPath: string; qrToken: string;
};
```

---

### Task 1: Test runner + pure membership rules

**Files:**
- Create: `vitest.config.mts`, `features/membership/logic.ts`, `features/membership/logic.test.ts`
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)

**Interfaces:**
- Produces (from `features/membership/logic.ts`, no imports of server code):
  - `todayWib(now?: Date): string`: `"YYYY-MM-DD"` in Asia/Jakarta (`Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })`)
  - `membershipEndDate(startDate: string, months: number): string`
  - `daysRemaining(endDate: string, today: string): number`
  - `membershipStatus(endDate: string, today: string): MembershipStatus`
  - `normalizePhone(input: string): string | null`
  - `paymentsMatchPrice(payments: { amount: number }[], price: number): boolean`
  - `formatMemberNo(n: number): string`
  - `type MembershipStatus = "active" | "expiring" | "expired"` (re-exported by Task 2)

- [ ] **Step 1: Install vitest and add config**

`npm install --save-exact -D vitest` (Sembako uses ^4.1.x). Add `"test": "vitest run"` to `package.json`. `vitest.config.mts`: `resolve.alias` `"@"` → project root (as in `~/Uta/sembako-staging/vitest.config.mts`), `test.environment: "node"`, `test.exclude: ["**/node_modules/**", "**/.next/**"]`. No server-only mock or DB env: these tests are pure.

- [ ] **Step 2: Write the failing tests in `features/membership/logic.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  daysRemaining, formatMemberNo, membershipEndDate, membershipStatus,
  normalizePhone, paymentsMatchPrice, todayWib,
} from "./logic";

describe("todayWib", () => {
  it("uses Jakarta date, not UTC", () => {
    expect(todayWib(new Date("2026-10-28T16:59:00Z"))).toBe("2026-10-28");
    expect(todayWib(new Date("2026-10-28T17:00:00Z"))).toBe("2026-10-29");
  });
});

describe("membershipEndDate (inclusive last day, month-end clamp)", () => {
  it.each([
    ["2026-10-28", 1, "2026-11-27"],
    ["2026-01-31", 1, "2026-02-27"],
    ["2028-01-31", 1, "2028-02-28"], // leap year: clamp to 29 Feb, minus 1
    ["2026-12-15", 1, "2027-01-14"],
    ["2026-12-31", 12, "2027-12-30"],
    ["2026-03-01", 3, "2026-05-31"],
  ])("%s + %i months → %s", (start, months, end) => {
    expect(membershipEndDate(start, months)).toBe(end);
  });
});

describe("daysRemaining / membershipStatus", () => {
  const today = "2026-10-28";
  it.each([
    ["2026-11-05", 8, "active"],
    ["2026-11-04", 7, "expiring"],
    ["2026-10-28", 0, "expiring"],
    ["2026-10-27", -1, "expired"],
  ])("end %s → %i days, %s", (end, days, status) => {
    expect(daysRemaining(end, today)).toBe(days);
    expect(membershipStatus(end, today)).toBe(status);
  });
  it("counts across a DST-free month boundary exactly", () => {
    expect(daysRemaining("2027-03-01", "2027-02-01")).toBe(28);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["0812-3456-7890", "081234567890"],
    ["+62 812 3456 7890", "081234567890"],
    ["6281234567890", "081234567890"],
    ["0812.3456.789", "08123456789"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(["", "12345", "0812345", "081234567890123", "08123abc456", "812345678"])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("paymentsMatchPrice", () => {
  it("accepts rows summing exactly to the price", () => {
    expect(paymentsMatchPrice([{ amount: 100000 }, { amount: 150000 }], 250000)).toBe(true);
  });
  it.each([
    [[{ amount: 100000 }], 250000],               // short
    [[{ amount: 300000 }], 250000],               // over
    [[{ amount: 250000 }, { amount: 0 }], 250000], // zero row
    [[], 250000],                                  // no rows
    [[{ amount: 250000.5 }], 250000.5],            // not whole Rupiah
  ])("rejects %j for %i", (rows, price) => {
    expect(paymentsMatchPrice(rows, price)).toBe(false);
  });
});

describe("formatMemberNo", () => {
  it.each([[1, "MG-0001"], [42, "MG-0042"], [9999, "MG-9999"], [10000, "MG-10000"]])(
    "%i → %s",
    (n, out) => expect(formatMemberNo(n)).toBe(out),
  );
});
```

- [ ] **Step 3: Run and confirm failure**

Run: `npm test -- features/membership/logic.test.ts`
Expected: FAIL, `Failed to resolve import "./logic"`.

- [ ] **Step 4: Implement `features/membership/logic.ts`**

Do all date maths on UTC `Date`s built from the `"YYYY-MM-DD"` parts (`Date.UTC`), so the server timezone never matters. The end date takes the same day N months later, clamped to that month's length, minus one day. The status is `days < 0 → expired`, `days <= 7 → expiring`, otherwise `active`. Phone: remove spaces, `-` and `.`; then `+62…` or `62…` becomes `0…`; it's valid only if it matches `/^0\d{8,13}$/`. `paymentsMatchPrice` needs at least one row, every amount a positive integer, and the sum equal to the price (also an integer).

- [ ] **Step 5: Run and confirm pass**

Run: `npm test`
Expected: all `logic.test.ts` tests PASS.

---

### Task 2: Database schema + validation schemas

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `features/membership/validation.ts`, `features/membership/validation.test.ts`
- Modify: `docs/DATABASE.md` (tables section)

**Interfaces:**
- Consumes: Task 1 `normalizePhone`, `todayWib`, `paymentsMatchPrice`, `MembershipStatus`.
- Produces in `lib/db/schema.ts`:
  - enums `genderEnum = pgEnum("gender", ["male", "female"])`, `memberCategoryEnum = pgEnum("member_category", ["pelajar", "mahasiswa", "umum"])`, `paymentMethodEnum = pgEnum("payment_method", ["cash", "qris", "transfer", "debit"])`
  - `memberNoSeq = pgSequence("member_no_seq")`
  - `packages`: `id` bigserial(number) PK, `name` varchar(100) not null, `months` integer not null, `pricePelajar` / `priceMahasiswa` / `priceUmum` decimal(14,2) not null, `isActive` boolean not null default true, `createdAt`, `updatedAt`
  - `members`: `id`, `memberNo` varchar(20) not null unique, `name` varchar(100) not null, `phone` varchar(20) not null unique, `birthDate` date(string) **nullable**, `gender` not null, `category` not null, `photoPath` varchar(255) not null, `qrToken` varchar(64) not null unique, `createdAt`, `updatedAt`
  - `memberships`: `id`, `memberId` → members.id not null, `packageId` → packages.id not null, `packageName` varchar(100), `months` integer, `category` member_category, `price` decimal(14,2) (all not null), `startDate` / `endDate` date(string) not null, `createdAt`
  - `payments`: `id`, `membershipId` → memberships.id **nullable** (day 3–4 add more nullable link columns), `method` payment_method not null, `amount` decimal(14,2) not null, `paidAt` timestamp not null default now
- Produces in `features/membership/validation.ts`:
  - types `PaymentMethod`, `MemberCategory`, `Gender`, `MemberCard` (see File Structure), re-export `MembershipStatus`
  - labels `CATEGORY_LABELS: Record<MemberCategory, string>` (`Pelajar`, `Mahasiswa`, `Umum`), `GENDER_LABELS` (`Laki-laki`, `Perempuan`), `PAYMENT_METHOD_LABELS` (`Cash`, `QRIS`, `Transfer`, `Debit`)
  - `PackageSchema`: `{ name: string 1..100 trimmed, months: int 1..60, pricePelajar, priceMahasiswa, priceUmum: int ≥ 1 }` → `type PackageInput`
  - `RegisterMemberFields` (plain `z.object`, so the wizard can `.pick()` one step's fields; Zod 4 refuses `.pick()` on refined objects) and `RegisterMemberSchema = RegisterMemberFields.superRefine(...)` adding the price check. Fields: `{ name 1..100 trimmed, phone (→ normalizePhone, error "Nomor HP tidak valid."), birthDate: "" | "YYYY-MM-DD" ≤ today (""→null), gender, category, photo: string starting "data:image/" (error "Foto wajib diambil."), packageId: int, startDate: "YYYY-MM-DD" ≤ todayWib() (error "Tanggal mulai tidak boleh di masa depan."), price: int ≥ 1, payments: { method, amount: int ≥ 1 }[] min 1 }`. The `superRefine` checks `paymentsMatchPrice(payments, price)` and reports "Total pembayaran harus sama dengan harga." at path `["payments"]` → `type RegisterMemberInput = z.input<typeof RegisterMemberSchema>`
  - `UpdateMemberSchema`: `{ id: int, name, phone, birthDate, gender, photo?: data URL (only when retaken) }` → `type UpdateMemberInput`
  - `type ActionResult<T = undefined> = { success: true; data: T } | { success?: false; errors?: Record<string, string[]>; message?: string }`

- [ ] **Step 1: Write failing tests in `features/membership/validation.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { RegisterMemberSchema } from "./validation";
import { todayWib } from "./logic";

const valid = {
  name: " Budi ", phone: "+62 812 3456 7890", birthDate: "", gender: "male",
  category: "umum", photo: "data:image/jpeg;base64,AAAA", packageId: 1,
  startDate: todayWib(), price: 250000,
  payments: [{ method: "cash", amount: 100000 }, { method: "qris", amount: 150000 }],
};

describe("RegisterMemberSchema", () => {
  it("accepts a valid split payment and normalises fields", () => {
    const r = RegisterMemberSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.name).toBe("Budi");
    expect(r.data?.phone).toBe("081234567890");
    expect(r.data?.birthDate).toBeNull();
  });
  it.each([
    ["future start date", { startDate: "2999-01-01" }, "startDate"],
    ["future birth date", { birthDate: "2999-01-01" }, "birthDate"],
    ["bad phone", { phone: "123" }, "phone"],
    ["no photo", { photo: "" }, "photo"],
    ["payments short", { payments: [{ method: "cash", amount: 100000 }] }, "payments"],
    ["zero row", { payments: [{ method: "cash", amount: 250000 }, { method: "qris", amount: 0 }] }, "payments"],
    ["unknown method", { payments: [{ method: "credit", amount: 250000 }] }, "payments"],
  ])("rejects %s", (_label, patch, field) => {
    const r = RegisterMemberSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(Object.keys(r.error!.flatten().fieldErrors)).toContain(field);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- features/membership/validation.test.ts`
Expected: FAIL, cannot resolve `./validation`.

- [ ] **Step 3: Add the tables and enums to `lib/db/schema.ts`** (names and types as in Interfaces; FK with `.references(() => …id)`).

- [ ] **Step 4: Implement `features/membership/validation.ts`** as in Interfaces. Compute "today" inside the refinement (`todayWib()` at parse time), not at module load, because the server runs for days.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Bring up the dev DB and push the schema**

If `.env` is missing: `cp .env.example .env` and fill `SESSION_SECRET` and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` with `openssl rand -base64 32` each. Then `docker compose up -d postgres` (needs Docker Desktop running; if it isn't, stop and tell the user), `npm run db:push`, and `npm run db:seed` if the users table is empty.
Expected: `db:push` lists the creation of `gender`, `member_category`, `payment_method`, `member_no_seq`, `packages`, `members`, `memberships`, `payments` and nothing dropped. If it proposes dropping anything, stop and ask.

- [ ] **Step 7: Document the tables** in `docs/DATABASE.md` section 2, replacing the matching "Planned tables" items.

---

### Task 3: Photo uploads (storage, serving, Docker)

**Files:**
- Create: `lib/uploads.ts`, `app/api/uploads/[...path]/route.ts`
- Modify: `.gitignore` (`/uploads`), `docker-compose.yml`, `docker-compose.prod.yml`, `Dockerfile`, `docs/DOCKER.md`

**Interfaces:**
- Produces: `saveBase64Upload(dataUrl: string, subfolder: string): Promise<string>` (returns e.g. `"members/<uuid>.jpg"`), `readUpload(relativePath: string): Promise<Buffer>`, `EXT_TO_MIME`, `UPLOADS_DIR`. URL for a stored path: `/api/uploads/${photoPath}`.

- [ ] **Step 1: Copy `~/Uta/sembako-staging/lib/uploads.ts`**, keeping only `image/jpeg`, `image/png` and `image/webp`. Lower `MAX_UPLOAD_BYTES` to 2MB with the message "Ukuran foto maksimal 2MB." (webcam JPEGs are around 100–300KB, under Next's default 1MB Server Action body limit, so `next.config.ts` stays unchanged). Add `import "server-only"`.

- [ ] **Step 2: Create the route** by copying Sembako's `app/api/uploads/[...path]/route.ts` without the toko lookup: `await requireRole("kasir")`, resolve the MIME type from the extension (404 if unknown), `readUpload`, respond with `Cache-Control: private, max-age=86400`, and return 404 on any read error. Check the Next 16 route-handler docs for the `params` shape (it's a Promise in Sembako).

- [ ] **Step 3: Docker and gitignore.** Add `/uploads` to `.gitignore`. In both compose files, add `UPLOADS_DIR: /app/uploads` to the app's environment, an `uploads_data:/app/uploads` volume, and `uploads_data:` under `volumes:`. In the Dockerfile runner stage before `USER nextjs`: `RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads`.

- [ ] **Step 4: Verify serving and auth**

Run `npm run dev`. While logged out, `curl -i http://localhost:3000/api/uploads/members/x.jpg` must not return image bytes (a redirect to `/login` or a 404 is fine). The full round trip is verified in Task 6.

- [ ] **Step 5: Docs.** In `docs/DOCKER.md`, replace the "uploads volume … planned" note with the real setup, and add: "The webcam (`getUserMedia`) only works on `http://localhost` or HTTPS. If the desk PC opens the app via a LAN IP over plain HTTP, the camera is blocked; put HTTPS in front first."

---

### Task 4: Kelola Paket + Pembayaran page shell

**Files:**
- Create: `features/membership/queries.ts`, `features/membership/actions.ts`, `features/membership/payment-page.tsx`, `features/membership/kelola-paket-dialog.tsx`
- Modify: `app/(app)/membership/payment/page.tsx`

**Interfaces:**
- Consumes: Task 2 `packages` table, `PackageSchema`, `PackageInput`, `ActionResult`.
- Produces:
  - `queries.ts` (`import "server-only"`): `type PackageOption = { id: number; name: string; months: number; pricePelajar: number; priceMahasiswa: number; priceUmum: number }`; `listActivePackages(): Promise<PackageOption[]>` (only `isActive`, ordered by `months, name`; decimals converted with `Number()`)
  - `actions.ts` (`"use server"`): `createPackageAction(input: PackageInput): Promise<ActionResult>`, `updatePackageAction(id: number, input: PackageInput): Promise<ActionResult>`, `deletePackageAction(id: number): Promise<ActionResult>`. Each revalidates `/membership/payment`.
  - `payment-page.tsx`: `PaymentPage({ packages }: { packages: PackageOption[] })` (client) renders the picker, the Kelola Paket button and the selected form (Task 6 plugs the wizard in).

- [ ] **Step 1: Implement `queries.ts` and the three actions.** Delete rule: if any `memberships.packageId` = id, set `isActive = false` and `updatedAt`; otherwise delete the row. Don't update an inactive package (return `{ message: "Paket tidak ditemukan." }`).

- [ ] **Step 2: Route file.** `app/(app)/membership/payment/page.tsx`: `await requireRole("kasir")`, `const packages = await listActivePackages()`, `return <PaymentPage packages={packages} />`.

- [ ] **Step 3: `PaymentPage` + `KelolaPaketDialog`.** The page has a heading "Pembayaran", a `select` labelled "Jenis Pembayaran" whose only option is "Daftar Member Baru", and a "Kelola Paket" outline button. The dialog lists each package (name, "N bulan", the three prices formatted `Rp150.000`, Edit and Hapus) plus an add/edit form. The form has Nama Paket, Durasi (bulan), Harga Pelajar, Harga Mahasiswa and Harga Umum, using `CurrencyInput` with `value` + `onChange`. Hapus confirms with `alert-dialog` ("Hapus paket <name>?"). Field errors show under the fields; `pending` disables the buttons. Format Rupiah with `Intl.NumberFormat("id-ID")` prefixed with "Rp". If Sembako's `lib/format.ts` has a helper, copy it to `lib/format.ts` instead.

- [ ] **Step 4: Verify in the browser as `kasir@mastergym.test`.** Add "1 Bulan" (1, 150.000 / 175.000 / 200.000) and "3 Bulan" (3, …). Edit one price, delete a package with no members (the row disappears from the DB in `npm run db:studio`). Superadmin opening `/membership/payment` is redirected to `/dashboard`. Run `npm run lint`.

---

### Task 5: Webcam capture component

**Files:**
- Create: `features/membership/webcam-capture.tsx`

**Interfaces:**
- Produces: `WebcamCapture({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void })`, a client component. `value` is a JPEG data URL.

- [ ] **Step 1: Implement.** With no `value`: start `navigator.mediaDevices.getUserMedia({ video: true, audio: false })` and show a large live `<video autoPlay playsInline muted>` with a primary "Ambil Foto" button (`size="xl"`). On click, draw the frame to a `<canvas>` scaled so the long side is ≤ 960px, then `toDataURL("image/jpeg", 0.85)` → `onChange`. With a `value`: show the still `<img>` and an outline "Ulangi" button (`onChange(null)` restarts the camera). Stop every track when unmounting and when a photo is taken.

- [ ] **Step 2: Error state.** Map the errors to Indonesian. `NotAllowedError`: "Akses kamera ditolak. Klik ikon kamera di address bar browser, pilih Izinkan, lalu Coba Lagi." `NotFoundError`: "Kamera tidak ditemukan. Pastikan webcam terpasang." `NotReadableError`: "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu Coba Lagi." Anything else, including a missing `navigator.mediaDevices` (insecure context): "Kamera tidak bisa dibuka. Buka aplikasi lewat localhost atau HTTPS." Show it in `Alert variant="destructive"` with a "Coba Lagi" button that retries `getUserMedia`.

- [ ] **Step 3: Verify (Review Focus 4)** in Task 6 Step 6, where the component is mounted. Check the happy path (take, retake), permission blocked in the browser's site settings → message + Coba Lagi works after allowing, and leaving the step turns the camera light off.

---

### Task 6: Daftar Member Baru wizard + registration action

**Files:**
- Create: `features/membership/payment-rows.tsx`, `features/membership/register-member-wizard.tsx`
- Modify: `features/membership/actions.ts`, `features/membership/payment-page.tsx`

**Interfaces:**
- Consumes: Task 1 `membershipEndDate`, `todayWib`, `formatMemberNo`, `paymentsMatchPrice`; Task 2 `RegisterMemberSchema`, `RegisterMemberInput`, labels, `MemberCard`, `ActionResult`; Task 3 `saveBase64Upload`; Task 4 `PackageOption`; Task 5 `WebcamCapture`; Task 7 `downloadMemberPdf` (the "Unduh PDF" button is wired in Task 7).
- Produces:
  - `registerMemberAction(input: RegisterMemberInput): Promise<ActionResult<MemberCard>>`
  - `PaymentRows({ price, value, onChange }: { price: number; value: { method: PaymentMethod; amount: number }[]; onChange: (rows) => void })`
  - `RegisterMemberWizard({ packages }: { packages: PackageOption[] })`

- [ ] **Step 1: `registerMemberAction`.** `requireRole("kasir")` → `RegisterMemberSchema.safeParse` (return `fieldErrors`) → load the package by id (missing or inactive: `{ errors: { packageId: ["Paket tidak tersedia, pilih paket lain."] } }`) → phone pre-check: if a member has this phone, return `{ errors: { phone: ["Nomor HP sudah terdaftar atas nama <name>."] } }` → `saveBase64Upload(photo, "members")` (`// shortcut: photo saved before the transaction, a failed insert leaves an orphan file; clean up if disk use matters`) → `db.transaction`: `nextval('member_no_seq')` → `formatMemberNo`, insert the member (with `qrToken` from `crypto.randomBytes(16).toString("base64url")`), insert the membership with the copied `packageName` / `months` / `category` / `price` and `endDate = membershipEndDate(startDate, pkg.months)`, insert one `payments` row per payment with `membershipId`. Catch Postgres unique violation `23505` (check `err.cause?.code ?? err.code`) and return the same phone error, in case two saves race. `revalidatePath("/membership/members")`. Return `{ success: true, data: MemberCard }`.

- [ ] **Step 2: `PaymentRows`.** One row by default (`{ method: "cash", amount: price }`). Each row has a method `select` (labels from `PAYMENT_METHOD_LABELS`), a `CurrencyInput` amount, and a remove button when there's more than one row. "+ Tambah metode" adds `{ method: "qris", amount: remaining }` where `remaining = max(price − sum, 0)`. Below the rows, show "Total dibayar Rp…" and either "Kurang Rp…" (warning), "Lebih Rp…" (destructive) or a success "Pas" line. Text ≥ 16px.

- [ ] **Step 3: `RegisterMemberWizard`.** Steps `[{key:"personal",label:"Data Diri"},{key:"photo",label:"Foto"},{key:"package",label:"Paket & Bayar"},{key:"review",label:"Cek Lagi"}]` with `useWizard`, `WizardStepIndicator`, `WizardStep` and `WizardNav` (`submitLabel="Daftarkan & Buat QR"`).
  - Data Diri: Nomor Member read-only "Otomatis"; Nama*, No. HP* (`inputMode="tel"`), Tanggal Lahir (`type="date"`, `max={todayWib()}`), Jenis Kelamin*, Status* (`CATEGORY_LABELS`).
  - Foto: `WebcamCapture`.
  - Paket & Bayar: Paket* (`select` of `packages`, label "<name> (N bulan)"), Tanggal Mulai* (`type="date"`, default and `max` = `todayWib()`), "Berlaku s/d <d MMMM yyyy id-ID>" from `membershipEndDate`, Harga* `CurrencyInput`. Changing Paket or Status refills Harga from the matching price and resets the payment rows to one row of the new price. Below, `PaymentRows`.
  - Cek Lagi: a read-only summary of every field, the photo thumbnail, the package, the period, Harga and each payment row.
  - "Lanjut" validates the current step's fields with `RegisterMemberFields.pick(...)` (for Paket & Bayar, also `paymentsMatchPrice`) and shows errors under the fields. Enter advances (`onWizardEnterAdvance`). Wrap with `RequiredMark` on the starred labels.
  - On submit: call the action in a transition. On `errors`, jump to the first step that owns an errored field (`name/phone/birthDate/gender/category → personal`, `photo → photo`, `packageId/startDate/price/payments → package`), keeping all state. On `message`, show an `Alert`.
  - On success, open a `Dialog` titled "Member berhasil didaftarkan" showing the member number large, the name, an "Unduh PDF" primary button (Task 7) and "Daftar Member Lain" (reset all state and `wizard.reset()`).
- Plug it into `PaymentPage` under the picker.

- [ ] **Step 4: Lint and test**

Run: `npm run lint && npm test`
Expected: clean, all PASS.

- [ ] **Step 5: Happy-path browser check as kasir.** Register "Budi" with a webcam photo, "1 Bulan", Umum, split Cash 100.000 + QRIS 100.000 at Harga 200.000. The success dialog shows `MG-0001`. In `npm run db:studio`: one member (phone normalised, 22-char `qr_token`), one membership (`end_date` = start + 1 month − 1 day), two payments. `GET /api/uploads/<photo_path>` shows the photo when logged in. The photo file exists under `./uploads/members/`.

- [ ] **Step 6: Review Focus checks in the browser.**
  - Register a second member with Budi's phone typed as `+62 …`: "Lanjut" works, then submit returns to Data Diri with "Nomor HP sudah terdaftar atas nama Budi." and every other field still filled.
  - On Paket & Bayar, fill the rows to match, then change Harga: the "Kurang/Lebih" line updates and "Lanjut" is blocked until the rows are fixed.
  - A row with amount emptied to 0 blocks "Lanjut".
  - Camera checks from Task 5 Step 3.
  - In Kelola Paket, delete the package selected in an open wizard (it's used by Budi, so it gets hidden), then submit: the error is "Paket tidak tersedia, pilih paket lain." on Paket & Bayar.

---

### Task 7: Member PDF card

**Files:**
- Create: `features/membership/member-pdf.ts`
- Modify: `features/membership/register-member-wizard.tsx` (wire "Unduh PDF"), `package.json`

**Interfaces:**
- Consumes: Task 2 `MemberCard`.
- Produces: `downloadMemberPdf(card: MemberCard): Promise<void>` (client-only; dynamic-imports `jspdf` and `qrcode` like Sembako's `use-invoice-print.ts`).

- [ ] **Step 1: Install** `npm install --save-exact jspdf qrcode` and `npm install --save-exact -D @types/qrcode`.

- [ ] **Step 2: Implement `downloadMemberPdf`.**
  - Page: `new jsPDF({ unit: "mm", format: [90, 160], orientation: "portrait" })`.
  - Top band: navy with "MASTER GYM" in orange (placeholder brand colours matching `globals.css`).
  - Photo: fetch `/api/uploads/${photoPath}` → blob → data URL, about 40×40 mm, centred, cropped to a square via a canvas.
  - Text: name (bold, large), member number, phone, "Berlaku s/d <d MMMM yyyy, id-ID>".
  - QR: `QRCode.toDataURL(card.qrToken, { errorCorrectionLevel: "M", margin: 4, width: 800, color: { dark: "#000000", light: "#ffffff" } })`, at least 60×60 mm, on a white panel. Keep the QR black on white even though the band is dark.
  - Save as `${memberNo}-${name}.pdf` with characters outside `[A-Za-z0-9 -]` stripped from the name.

- [ ] **Step 3: Wire the "Unduh PDF" button** in the success dialog, with a pending state ("Membuat PDF...") and an `Alert` on failure ("PDF gagal dibuat, coba lagi.").

- [ ] **Step 4: Verify.** Download Budi's PDF and open it: one portrait page, the photo shows, the expiry date matches the DB `end_date`. Open the PDF on screen and scan its QR with a phone camera: the text shown must equal that member's `qr_token` in `db:studio`, character for character. If the USB scanner is available, scan the PDF on a phone screen. Run `npm run lint && npm run build`.

---

### Task 8: Data Member list + Edit

**Files:**
- Create: `features/membership/members-page.tsx`, `features/membership/edit-member-dialog.tsx`
- Modify: `features/membership/queries.ts`, `features/membership/actions.ts`, `components/ui/status-badge.tsx`, `app/(app)/membership/members/page.tsx`

**Interfaces:**
- Consumes: Task 1 `daysRemaining`, `membershipStatus`, `todayWib`; Task 2 `UpdateMemberSchema`, `MemberCard`, labels; Task 3 `saveBase64Upload`; Task 5 `WebcamCapture`; Task 7 `downloadMemberPdf`.
- Produces:
  - `queries.ts`: `type MemberRow = MemberCard & { id: number; birthDate: string | null; gender: Gender; category: MemberCategory; packageName: string; status: MembershipStatus; daysRemaining: number }`; `listMembers(): Promise<MemberRow[]>` (each member joined to their **latest** membership by `end_date`, e.g. `selectDistinctOn([memberships.memberId])` ordered by `memberId, endDate desc`; status and days computed with `todayWib()` on the server)
  - `updateMemberAction(input: UpdateMemberInput): Promise<ActionResult>`
  - `StatusKind` gains `member_active` ("Aktif", success, `CheckCircle2`), `member_expiring` ("Habis ≤ 7 Hari", warning, `AlertTriangle`), `member_expired` ("Sudah Habis", destructive, `XCircle`)

- [ ] **Step 1: `listMembers` and `updateMemberAction`.** Update: `requireRole("kasir")` → `UpdateMemberSchema.safeParse` → phone pre-check excluding this member's own id (`ne(members.id, id)`), with the same message as registration → if `photo` is given, `saveBase64Upload` and set `photoPath` (`// shortcut: old photo file stays on disk; delete it if disk use matters`) → update name, phone, birthDate, gender and `updatedAt` → catch `23505` as above → `revalidatePath("/membership/members")`.

- [ ] **Step 2: Route + page.** `app/(app)/membership/members/page.tsx`: `requireRole("kasir")`, `listMembers()`, render `<MembersPage members={…} />`. The client `MembersPage` has:
  - a search `Input` ("Cari nama, No. HP, atau nomor member", case-insensitive substring on name / phone / memberNo)
  - a status filter as a button group: Semua / Aktif / Habis ≤ 7 Hari / Sudah Habis
  - a table with `SortableTh` + `useSort` on Nomor Member, Nama, Sisa Hari: Nomor Member, Nama, No. HP, Paket, Status (`StatusBadge`), Sisa Hari ("N hari" or "Lewat N hari"), Aksi (Edit, Unduh PDF)
  - `EmptyState` when nothing matches
  - `// shortcut: all members loaded and filtered in the browser, fine for a few thousand; paginate on the server past that`.

- [ ] **Step 3: `EditMemberDialog`.** Shows the member number (read-only), Nama, No. HP, Tanggal Lahir, Jenis Kelamin, and the current photo with a "Ganti Foto" button that swaps in `WebcamCapture`. Only send `photo` when a new one was taken. Field errors under the fields; close and show the updated row on success.

- [ ] **Step 4: Verify in the browser (Review Focus 1).**
  - Budi shows as Aktif with the right Sisa Hari.
  - In `db:studio`, set one membership `end_date` to today + 3 days → "Habis ≤ 7 Hari"; set it to yesterday → "Sudah Habis", and check each filter.
  - Search by part of the phone number.
  - Edit Budi without changing the phone saves with no error.
  - Changing Budi's phone to the second member's phone shows "Nomor HP sudah terdaftar atas nama …".
  - Retaking the photo updates it in the PDF.
  - Unduh PDF works from the row.
  - Superadmin is redirected away from `/membership/members`.

---

### Task 9: Docs and final verification

**Files:**
- Modify: `docs/HANDOFF.md` (section 5 "Current state": day 2 done, plus any gaps), `docs/CODEBASE_OVERVIEW.md` (routes table, folder map, file reference for `features/membership/*`, `lib/uploads.ts`, the `/api/uploads` route, new scripts `npm test`, the `UPLOADS_DIR` env var), `docs/UI.md` (the new status badges), `.env.example` (`UPLOADS_DIR=` commented out, explaining it defaults to `./uploads`)

- [ ] **Step 1: Update the docs** listed above. Mark the spec's status "implemented".

- [ ] **Step 2: Full check**

Run: `npm run lint && npm test && npm run build`
Expected: no lint errors, all tests PASS, build succeeds.

- [ ] **Step 3: Docker check.** `docker compose up -d --build`, push the schema to port 5434 if not already, register one member at http://localhost:3002, then `docker compose restart app` and confirm the photo still loads (volume works).

- [ ] **Step 4: Report to the user.** Summarise what was built, what was verified and how, any deviation from the spec, and tell them it's ready for them to commit. Don't commit.

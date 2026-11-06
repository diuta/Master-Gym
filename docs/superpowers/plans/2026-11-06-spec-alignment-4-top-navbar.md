# Spec Alignment, Piece 4 — Top Navbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use dev-skills:superpowers-subagent-driven-development (recommended) or dev-skills:superpowers-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the left sidebar with a sticky top navbar (click-to-open group dropdowns, user menu, ☰ slide-out on phone).

**Architecture:** `lib/nav.ts` gains a pure helper that turns the existing role sections into navbar items (plain link or group). A new client component `components/app-navbar.tsx` renders them with the existing `DropdownMenu` (desktop) and `Sheet` (phone), using CSS breakpoints. The logged-in layout swaps the sidebar for the navbar; unused sidebar code is deleted.

**Tech Stack:** Next.js 16.4, React 19, Base UI via shadcn components in `components/ui/`, Tailwind 4, vitest. **No new dependencies.**

**Spec:** [docs/superpowers/specs/2026-11-06-spec-alignment-4-top-navbar-design.md](../specs/2026-11-06-spec-alignment-4-top-navbar-design.md)

## Global Constraints

- **Never `git commit`, `git add`, `git stash` or `git push`.** Never run Prettier. Style ~100 columns, double quotes, semicolons, 2-space indentation. Comments only explain *why*. UI text Indonesian; colour tokens only; icon + text; 44px targets (`h-11`).
- Desktop is `≥ 768px` (`md:`); phone is `< 768px`. Use CSS breakpoints, not a JS hook.
- Kasir bar: Dashboard · Membership ▾ (Absen, Riwayat Absen, Data Member, Pembayaran) · Inventori · Penjualan ▾ (Tambah Penjualan, Riwayat Penjualan) · Pembelian ▾ (Tambah Pembelian, Riwayat Pembelian) · Pengeluaran.
- Superadmin bar: Dashboard ▾ (Home, Laporan) · Pengaturan Harga · Riwayat Penjualan · Riwayat Pembelian · Pengeluaran · Pengaturan Akun.
- Group labels are title case (`MEMBERSHIP` → `Membership`). Single-page groups show the page's own label.
- Active link: `pathname === href`. A group is active when any of its entries is active.
- User menu (right): initials + name + role label (`Kasir` / `Super Admin`). Its dropdown shows the email and **Keluar** (submits `logoutAction`).
- Phone: `[M] Master Gym`, ☰ and the initials. ☰ opens `Sheet` (side left) with the grouped list (headings + icon links); tapping a link closes it.
- The bar is sticky at the top. `<main className="min-w-0 flex-1 overflow-x-hidden p-6">` stays.
- No page may become unreachable. The kasir bar must not wrap or overflow at 1024px wide.
- The Absen scan input keeps focus on load; the navbar must not autofocus anything.

## Review Focus

1. **The kasir bar at 1024px wide.** One line, no horizontal scroll. Pinned in the Task 1 browser check (desktop viewport 1024×768).
2. **A page inside a dropdown is open.** Its group button shows active, and the item inside the dropdown is marked. Pinned in Task 1 Step 1 (`isGroupActive` test) and the browser check.
3. **Phone ☰ → tap a link.** The panel closes and the page navigates. Pinned in the Task 1 browser check (mobile preset).
4. **Keluar from the user menu.** Logs out to `/login`. Pinned in the Task 1 browser check.
5. **Absen on load.** The scan input still has focus. Pinned in the Task 1 browser check.

---

### Task 1: Navbar, layout swap, sidebar removal

**Files:**
- Modify: `lib/nav.ts`, `app/(app)/layout.tsx`.
- Create: `lib/nav.test.ts`, `components/app-navbar.tsx`.
- Delete: `components/app-sidebar.tsx`, `components/ui/sidebar.tsx`, `hooks/use-mobile.ts`.

**Interfaces:**
- Produces, in `lib/nav.ts`:
  - `export type NavEntry` (export the existing type).
  - `export type NavItem = { kind: "link"; entry: NavEntry } | { kind: "group"; label: string; entries: NavEntry[] }`.
  - `export function navItems(sections: NavSection[]): NavItem[]`: a section with one entry becomes `link`; one with several becomes `group`, labelled with the title-cased section label.
  - `export function isGroupActive(entries: NavEntry[], pathname: string): boolean`.
- `AppNavbar({ name, email, role }: { name: string; email: string; role: Role })` in `components/app-navbar.tsx` ("use client").

- [ ] **Step 1: Failing tests** in `lib/nav.test.ts`:
  - `navItems(navForRole("kasir")).map(labelOf)` → `["Dashboard", "Membership", "Inventori", "Penjualan", "Pembelian", "Pengeluaran"]`, with the kinds `["link", "group", "link", "group", "group", "link"]`. Here `labelOf` returns `entry.label` for links and `label` for groups.
  - `navItems(navForRole("superadmin"))` → labels `["Dashboard", "Pengaturan Harga", "Riwayat Penjualan", "Riwayat Pembelian", "Pengeluaran", "Pengaturan Akun"]`, with only the first a group (Home, Laporan).
  - The Membership group's entry hrefs are `["/membership/check-in", "/membership/attendance", "/membership/members", "/membership/payment"]`.
  - `isGroupActive(membershipEntries, "/membership/members")` → true; `isGroupActive(membershipEntries, "/inventory")` → false.
- [ ] **Step 2:** `npx vitest run lib/nav.test.ts` → FAIL. Implement → PASS.
- [ ] **Step 3: `AppNavbar`.** Port the brand badge, initials and role label from `components/app-sidebar.tsx` before deleting it.
  - Desktop: `hidden md:flex` group of items. A link is a `Button` (ghost, `h-11`) wrapping a `next/link`. A group is a `DropdownMenu` whose trigger shows the label + `ChevronDown` and whose items are links with their icons. Active styling uses colour tokens.
  - User menu: a `DropdownMenu` on the right.
  - Phone: `md:hidden` ☰ `Button` (`aria-label="Buka menu"`) + `Sheet`.
  - Wrapper: `sticky top-0 z-40 border-b bg-background`.
- [ ] **Step 4: Layout.** `app/(app)/layout.tsx` drops `SidebarProvider`, `AppSidebar`, `SidebarInset`, `SidebarTrigger`, `Separator` and the `cookies()` / `sidebar_state` read, and renders `<AppNavbar …/>` and then `<main>`. Delete the three files. `grep -rn "sidebar\|use-mobile" app components hooks features lib` must find no imports.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` must be clean. Stop and report. The controller checks the Review Focus items in the browser for both roles, at desktop 1024 and 1366 and on the mobile preset.

### Task 2: Docs

**Files:** `docs/UI.md`, `docs/CODEBASE_OVERVIEW.md`, `docs/HANDOFF.md`, `docs/AUTH.md` (only where it says sidebar), the spec's Status line.

- [ ] **Step 1:**
  - UI.md section 1: a new layout sketch with the top navbar, desktop dropdowns and the phone ☰ panel. Remove the sidebar, Ctrl/Cmd+B and `sidebar_state` text, and the `sidebar.tsx` row in the component kit.
  - CODEBASE_OVERVIEW: `components/app-navbar.tsx` replaces `app-sidebar.tsx`; remove `hooks/use-mobile.ts`; update the layout description.
  - HANDOFF:
    - section 3: the "sidebar is final" note becomes "top navbar (piece 4)";
    - section 4: update the Layout row;
    - section 5: piece 4 done, spec alignment complete; give the test count.
  - AUTH.md: "sidebar" → "navbar" where it describes menus.
- [ ] **Step 2:** Spec status → `implemented (YYYY-MM-DD)`. Then `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` must all be clean. Stop and report.

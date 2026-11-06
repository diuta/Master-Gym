# Spec Alignment, Piece 4 — Top Navbar: Design

Date: 2026-11-06 · Status: implemented (2026-11-06)

Short design (small change). Part 4, the last, of re-aligning the app with the original client spec "INFORMASI GENERAL APLIKASI GYM" (8 Oct 2026). Pieces 1–3 are done.

## Why

The spec says: *"Desain Navbar diletakkan di atas (tidak di kiri) agar lebih menarik."* The app currently uses a Sembako-style left sidebar, which the user chose earlier but now wants replaced so the app follows the spec.

## Goals

- Replace the left sidebar with a **top navbar** on every logged-in page, on desktop and phone.
- **Desktop (≥ 768px):** `[M] Master Gym` · one item per nav group · user menu on the right.
  - A group with one page is a plain link; a group with several pages is a **click-to-open dropdown** (user decision).
  - Kasir: Dashboard · Membership ▾ (Absen, Riwayat Absen, Data Member, Pembayaran) · Inventori · Penjualan ▾ (Tambah Penjualan, Riwayat Penjualan) · Pembelian ▾ (Tambah Pembelian, Riwayat Pembelian) · Pengeluaran.
  - Superadmin: Dashboard ▾ (Home, Laporan) · Pengaturan Harga · Riwayat Penjualan · Riwayat Pembelian · Pengeluaran · Pengaturan Akun.
  - Group buttons use the group name in title case (MEMBERSHIP → "Membership"); single-page groups show the page's own label.
- **Current page:** the active link is highlighted (`pathname === href`); a dropdown group is highlighted when one of its pages is active; the active item inside an open dropdown is marked too.
- **User menu** (right): initials badge + name + role ("Kasir" / "Super Admin"); opens a dropdown with the email and **Keluar** (submits `logoutAction`).
- **Phone (< 768px):** bar shows `[M] Master Gym`, a **☰** button and the user initials. ☰ opens the existing `Sheet` from the left with the same grouped list the sidebar shows today (group headings + links with icons); tapping a link closes it.
- The bar is **sticky** at the top; page content uses the full width (`<main>` keeps `p-6`).
- Menus still come from `lib/nav.ts` (`navForRole`); hiding a link is still not security (pages keep `requireRole`).

## Non-goals

Changing which pages each role sees; renaming pages; hover-to-open menus; a collapsible/remembered menu state; theme or colour changes.

## Anti-goals

- A page reachable from the old sidebar that can't be reached from the navbar (desktop or phone).
- The bar overflowing or wrapping at 1024px wide for the kasir.
- The Absen scan input losing focus because of the navbar on load.
- Text smaller than the UI rules allow or targets under 44px (`h-11`).

## Constraints

No new libraries; reuse `components/ui/dropdown-menu.tsx`, `components/ui/sheet.tsx`, `components/ui/button.tsx`, `lib/nav.ts`, `logoutAction`. UI text Indonesian, colour tokens only, icon + text. Never commit.

## Approaches

1. **A small `components/app-navbar.tsx` built from the existing `DropdownMenu` (chosen).** No new UI parts; click-to-open works the same with mouse, touch and keyboard.
2. **shadcn `NavigationMenu`** (hover menus, arrow keys). Rejected: a new ~200-line UI file and hover is awkward on a touch desk PC.
3. *(Dropped)* Turning the sidebar component horizontal: it's built around a vertical collapsible panel.

## How it works (builder's map)

- New `components/app-navbar.tsx` (client): props `{ name, email, role }`, renders the desktop bar (`hidden md:flex` parts) and the phone bar with ☰ + `Sheet` (`md:hidden`), using CSS breakpoints rather than a JS hook.
- `app/(app)/layout.tsx`: drop `SidebarProvider` / `AppSidebar` / `SidebarInset` / `SidebarTrigger` and the `sidebar_state` cookie read; render `<AppNavbar …/>` then `<main>`.
- Delete `components/app-sidebar.tsx`, `components/ui/sidebar.tsx` and `hooks/use-mobile.ts` (only the sidebar uses them). Keep `sheet.tsx`, `tooltip.tsx` (root `TooltipProvider` stays; harmless).
- Docs: UI.md section 1 (layout sketch, navbar instead of sidebar; Ctrl/Cmd+B gone), CODEBASE_OVERVIEW (files), HANDOFF (sections 3–5: navbar done, spec alignment complete), AUTH.md ("menus" wording if it says sidebar).

## Calls I made

- Click-to-open dropdowns (from the chosen approach); no hover.
- Group button labels in title case; single-page groups show the page label.
- Phone breakpoint stays at 768px (same as the old sidebar); the phone menu reuses the sidebar's grouped list.
  - **Changed during build:** the full bar needs more room than planned (the superadmin bar is ~1260px at full size), so the bar shows from 1024px and the ☰ panel is used below that (tablets too). Below 1280px the superadmin bar is compact (14px text, less padding, user name hidden, initials kept) so it fits at 1024px; the kasir bar keeps 16px text.
- The sidebar's collapse button, Ctrl/Cmd+B shortcut and `sidebar_state` cookie are removed.
- Unused sidebar code and `use-mobile` are deleted.

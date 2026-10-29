# UI: Layout, Theme and Components

[Back to overview](./CODEBASE_OVERVIEW.md)

## 1. Page layout

Every logged-in page uses the shell from `app/(app)/layout.tsx`:

```
┌──────────────┬──────────────────────────────────────────┐
│ [M] Master   │ [☰]  |  Master Gym                         │ ← header (h-12): sidebar toggle
│     Gym      ├──────────────────────────────────────────┤
│     Kasir    │                                            │
│              │   <main> page content (p-6)               │
│ DASHBOARD    │                                            │
│  Dashboard   │                                            │
│ MEMBERSHIP   │                                            │
│  Absen …     │                                            │
│ …            │                                            │
│──────────────│                                            │
│ KA Kasir     │                                            │
│ ⎋ Keluar     │                                            │
└──────────────┴──────────────────────────────────────────┘
```

- **Sidebar** (`components/app-sidebar.tsx` + `components/ui/sidebar.tsx`): labelled groups with flat links, like Sembako. No dropdowns.
  - Desktop (≥ 768px): fixed on the left, 16rem wide. Collapses to a 3rem icon strip with the header's toggle button or **Ctrl/Cmd + B**. The open/closed state is remembered in the `sidebar_state` cookie for 7 days, and the layout reads it so the page renders in the right state.
  - Phone (< 768px, from `hooks/use-mobile.ts`): hidden; the toggle opens it as a slide-out panel (18rem).
  - The current page's link is highlighted (`isActive` when `pathname === href`).
  - Collapsed to icons, each link shows its label as a tooltip.
- **Menus** come from `lib/nav.ts` (see [AUTH.md](./AUTH.md) for which role sees what).
- **Login page** (`features/authentication/login-page.tsx`) has no shell: a centred card.

## 2. Theme

The app is **dark only**. Colours are CSS variables in the `:root` block of `app/globals.css`, and `<html class="dark">` is always set so shadcn components use their dark-mode styling.

| Variable | Role | Current value (placeholder) |
|---|---|---|
| `--background` | Page background | Dark navy `oklch(0.19 0.04 262)` |
| `--card`, `--popover` | Cards, dialogs, menus | Slightly lighter navy |
| `--foreground` | Main text | Near white |
| `--primary` | Main buttons, focus ring, logo badge | **Orange** `oklch(0.72 0.18 50)` |
| `--primary-foreground` | Text on orange | Navy |
| `--secondary`, `--muted`, `--accent` | Secondary buttons, subtle fills, hovers | Navy shades |
| `--muted-foreground` | Secondary text | Light grey-blue |
| `--destructive` | Delete / errors | Red |
| `--success`, `--warning` | Status colours | Green, amber |
| `--border`, `--input` | Lines and input borders | White at 15–20% |
| `--sidebar*` | Sidebar background, active item, borders | Darkest navy; orange for the logo badge |
| `--chart-1..5` | Charts (later) | Orange, blue, green, amber, grey |
| `--radius` | Corner rounding | 0.625rem |

**The colours are placeholders** until the Master Gym logo is supplied. To change them, edit only the `:root` values; every component picks them up. Use the colours by name in Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`), never as hard-coded hex values.

`@theme inline` (top of the file) maps each variable to a Tailwind colour name. If you add a new variable, add its mapping there too.

## 3. Component kit (`components/ui/`)

These are **shadcn/ui** components (`base-nova` style, built on **Base UI**). The source is in the repo, so we can edit them. Add new ones with `npx shadcn add <name>`; they land in this folder. Most were copied from Sembako so both apps look and work the same.

### Standard shadcn components

| File | Use for |
|---|---|
| `button.tsx` | Buttons. Variants: `default` (orange), `outline`, `secondary`, `ghost`, `destructive`, `success`, `link`. Sizes: `xs`, `sm`, `default`, `lg`, `xl`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` |
| `input.tsx`, `textarea.tsx`, `label.tsx`, `checkbox.tsx`, `select.tsx` | Form fields |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`: the standard page section |
| `table.tsx` | `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`, … |
| `dialog.tsx` | Pop-up forms (e.g. Kelola Paket, the check-in member pop-up) |
| `alert-dialog.tsx` | "Are you sure?" confirmations before delete/cancel |
| `alert.tsx` | Inline messages (`variant="destructive"` for errors, as on the login page) |
| `badge.tsx` | Small labels |
| `dropdown-menu.tsx` | Menus that open from a button |
| `sheet.tsx` | Side panels (used by the mobile sidebar) |
| `sidebar.tsx` | The sidebar system (provider, groups, menu buttons, rail, mobile sheet) |
| `tooltip.tsx` | Hover hints. Needs `TooltipProvider`, which the root layout provides |
| `collapsible.tsx`, `separator.tsx`, `skeleton.tsx` | Expand/collapse, divider lines, loading placeholders |

### House components (from Sembako)

| File | What it is |
|---|---|
| `currency-input.tsx` | Rupiah input: shows "Rp" and thousands separators (`150.000`) while you type, and keeps the raw digits (`150000`). Pass `name` to also submit a hidden field with the raw digits in a `<form>`, or use `value` + `onChange(raw)` |
| `wizard.tsx` | Multi-step forms: `useWizard(steps)` (index, `goNext`, `goBack`, `goTo`, `reset`, `isFirst`/`isLast`), `WizardStepIndicator` ("step 2 of 4" with labels), `WizardStep`, `WizardNav` (big Back/Next buttons), `onWizardEnterAdvance` (Enter = next). For the inventory, sales and purchase wizards |
| `empty-state.tsx` | Icon + title + description for "nothing here" (used by `PlaceholderPage`) |
| `status-badge.tsx` | Coloured badge with icon + text for statuses: `success`, `cancelled`, `paid`, `unpaid`, `out_of_stock`, `low_stock`, `in_stock`. Membership: `member_active`, `member_expiring`, `member_expired` (Aktif / Segera Habis / Sudah Habis). Add new statuses here |
| `lib/format.ts` (not in `ui/`) | `rupiah` (an `Intl.NumberFormat` giving "Rp150.000") and `formatDateId("2026-10-28")` (Indonesian date). Use these instead of formatting money or dates by hand |
| `sortable-th.tsx` | A table header cell that sorts on click. Use with `hooks/use-sort.ts` |
| `required-mark.tsx` | The red `*` after a required field's label |
| `floating-dropdown.tsx` | Positions a dropdown under an input via a portal, so it isn't cut off inside scrolling dialogs (used by Sembako's search comboboxes) |

## 4. Design rules (from Sembako's `DESIGN_PRINCIPLES.md`)

The users are front-desk staff, not developers. Follow these when building pages:

- Text ≥ 16px for anything that must be read quickly; money amounts larger and in full ("Rp150.000", never "150k").
- Click targets ≥ 44px; one clear main action per screen.
- Never rely on colour alone: status badges always pair colour with an icon and text.
- Icons always come with a text label.
- Plain Indonesian ("Simpan", not "Submit").
- Long forms become wizards (one topic per step, with a final "Cek Lagi" review step). Short forms (1–2 fields) stay single dialogs.
- Confirm before anything permanent (delete, cancel a transaction).
- Prefer picking from a list over typing from memory.

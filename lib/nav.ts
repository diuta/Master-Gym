import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  History,
  LayoutDashboard,
  Package,
  Tags,
  ReceiptText,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { Role } from "@/lib/auth/session";

export type NavEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  label?: string;
  entries: NavEntry[];
};

const kasirSections: NavSection[] = [
  {
    label: "DASHBOARD",
    entries: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "MEMBERSHIP",
    entries: [
      { label: "Absen", href: "/membership/check-in", icon: CalendarCheck },
      { label: "Riwayat Absen", href: "/membership/attendance", icon: History },
      { label: "Data Member", href: "/membership/members", icon: Users },
      { label: "Pembayaran", href: "/membership/payment", icon: CreditCard },
    ],
  },
  {
    label: "STOK",
    entries: [{ label: "Inventori", href: "/inventory", icon: Package }],
  },
  {
    label: "PENJUALAN",
    entries: [
      { label: "Tambah Penjualan", href: "/sales/new", icon: ReceiptText },
      { label: "Riwayat Penjualan", href: "/sales/history", icon: History },
    ],
  },
  {
    label: "PEMBELIAN",
    entries: [
      { label: "Tambah Pembelian", href: "/purchases/new", icon: ShoppingCart },
      { label: "Riwayat Pembelian", href: "/purchases/history", icon: History },
    ],
  },
  {
    label: "KEUANGAN",
    entries: [{ label: "Pengeluaran", href: "/expenses", icon: Wallet }],
  },
];

const superadminSections: NavSection[] = [
  {
    label: "DASHBOARD",
    entries: [
      { label: "Home", href: "/dashboard", icon: LayoutDashboard },
      { label: "Laporan", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "MEMBERSHIP",
    entries: [{ label: "Pengaturan Harga", href: "/membership/pricing", icon: Tags }],
  },
  {
    label: "PENJUALAN",
    entries: [{ label: "Riwayat Penjualan", href: "/sales/history", icon: History }],
  },
  {
    label: "PEMBELIAN",
    entries: [{ label: "Riwayat Pembelian", href: "/purchases/history", icon: History }],
  },
  {
    label: "KEUANGAN",
    entries: [{ label: "Pengeluaran", href: "/expenses", icon: Wallet }],
  },
  {
    label: "ADMINISTRASI",
    entries: [
      {
        label: "Pengaturan Akun",
        href: "/administration/account-settings",
        icon: UserCog,
      },
    ],
  },
];

export function navForRole(role: Role): NavSection[] {
  return role === "kasir" ? kasirSections : superadminSections;
}

export type NavItem =
  | { kind: "link"; entry: NavEntry }
  | { kind: "group"; label: string; entries: NavEntry[] };

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

// The top navbar has no room for headings: a one-page section is just its link,
// a multi-page section becomes a dropdown named after the section.
export function navItems(sections: NavSection[]): NavItem[] {
  return sections.map((s) =>
    s.entries.length === 1
      ? { kind: "link", entry: s.entries[0] }
      : { kind: "group", label: titleCase(s.label ?? ""), entries: s.entries },
  );
}

export function isGroupActive(entries: NavEntry[], pathname: string): boolean {
  return entries.some((e) => e.href === pathname);
}

// The superadmin's single-page links have long names and overflow at 1024px at full size;
// the kasir bar fits, so it keeps the 16px text the UI rules ask for.
export function isNavCompact(role: Role): boolean {
  return role === "superadmin";
}

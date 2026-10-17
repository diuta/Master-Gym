import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  History,
  LayoutDashboard,
  Tags,
  UserCog,
  Users,
} from "lucide-react";

type NavEntry = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavSection = {
  label?: string;
  entries: NavEntry[];
};

export const navSections: NavSection[] = [
  {
    label: "DASHBOARD",
    entries: [{ label: "Home", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "CHECK-IN",
    entries: [
      { label: "Check-in", href: "/check-in", icon: CalendarCheck },
      { label: "Riwayat Check-in", href: "/check-in/history", icon: History },
    ],
  },
  {
    label: "MEMBER",
    entries: [
      { label: "Daftar Member", href: "/member", icon: Users },
      { label: "Paket Membership", href: "/member/packages", icon: Tags },
    ],
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

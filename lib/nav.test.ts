import { describe, expect, it } from "vitest";
import { isGroupActive, isNavCompact, navForRole, navItems, type NavItem } from "./nav";

const labelOf = (item: NavItem) => (item.kind === "link" ? item.entry.label : item.label);

describe("navItems", () => {
  it("turns the kasir sections into links and dropdown groups", () => {
    const items = navItems(navForRole("kasir"));
    expect(items.map(labelOf)).toEqual([
      "Dashboard",
      "Membership",
      "Inventori",
      "Penjualan",
      "Pembelian",
      "Pengeluaran",
    ]);
    expect(items.map((i) => i.kind)).toEqual(["link", "group", "link", "group", "group", "link"]);
  });

  it("turns the superadmin sections into one group and five links", () => {
    const items = navItems(navForRole("superadmin"));
    expect(items.map(labelOf)).toEqual([
      "Dashboard",
      "Pengaturan Harga",
      "Riwayat Penjualan",
      "Riwayat Pembelian",
      "Pengeluaran",
      "Pengaturan Akun",
    ]);
    expect(items.map((i) => i.kind)).toEqual(["group", "link", "link", "link", "link", "link"]);
    const dashboard = items[0];
    expect(dashboard.kind === "group" && dashboard.entries.map((e) => e.label)).toEqual([
      "Home",
      "Laporan",
    ]);
  });

  it("keeps the membership pages in order inside their group", () => {
    const membership = navItems(navForRole("kasir"))[1];
    expect(membership.kind === "group" && membership.entries.map((e) => e.href)).toEqual([
      "/membership/check-in",
      "/membership/attendance",
      "/membership/members",
      "/membership/payment",
    ]);
  });
});

describe("isGroupActive", () => {
  const membership = navItems(navForRole("kasir"))[1];
  const entries = membership.kind === "group" ? membership.entries : [];

  it("is true when one of the group's pages is open", () => {
    expect(isGroupActive(entries, "/membership/members")).toBe(true);
  });

  it("is false on a page outside the group", () => {
    expect(isGroupActive(entries, "/inventory")).toBe(false);
  });
});

describe("isNavCompact", () => {
  it("keeps the kasir bar at full text size", () => {
    expect(isNavCompact("kasir")).toBe(false);
  });

  it("shrinks only the superadmin bar, whose long links overflow at 1024px", () => {
    expect(isNavCompact("superadmin")).toBe(true);
  });
});

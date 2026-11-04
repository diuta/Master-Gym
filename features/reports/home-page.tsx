import {
  AlertTriangle,
  BadgeDollarSign,
  Banknote,
  BellRing,
  Boxes,
  ClipboardList,
  Clock,
  Landmark,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { PeriodFilter } from "@/components/period-filter";
import { AttendanceTable } from "@/features/membership/attendance-table";
import type { MemberRow } from "@/features/membership/queries";
import type { AttendanceRow } from "@/features/membership/validation";
import type { ProductRow } from "@/features/shop/queries";
import { rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import { DashboardCard } from "./dashboard-card";
import { ExpiringMembersTable } from "./expiring-members-table";
import { LowStockTable } from "./low-stock-table";
import type { Opening, RecentTx } from "./logic";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import { RecentTransactionsTable } from "./recent-transactions-table";
import { StatTile } from "./stat-tile";

export function HomePage({
  period,
  from,
  to,
  opening,
  balances,
  netProfit,
  expenses,
  goodsProfit,
  count,
  totalProducts,
  stockValue,
  activeMembers,
  totalMembers,
  products,
  recent,
  attendance,
  members,
}: {
  period: Period;
  from?: string;
  to?: string;
  opening: Opening;
  balances: { cash: number; bank: number };
  netProfit: number;
  expenses: number;
  goodsProfit: number;
  count: number;
  totalProducts: number;
  stockValue: number;
  activeMembers: number;
  totalMembers: number;
  products: ProductRow[];
  recent: RecentTx[];
  attendance: AttendanceRow[];
  members: MemberRow[];
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Home</h1>
      <PeriodFilter period={period} from={from} to={to} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Keuangan</h2>
          {opening === null && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base text-muted-foreground">Saldo awal belum diisi</span>
              <OpeningBalanceDialog />
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total Laba" value={rupiah.format(netProfit)} icon={TrendingUp} />
          <StatTile
            label="Uang di Bank"
            value={rupiah.format(balances.bank)}
            hint="saldo saat ini"
            icon={Landmark}
          />
          <StatTile
            label="Uang Tunai"
            value={rupiah.format(balances.cash)}
            hint="saldo saat ini"
            icon={Wallet}
          />
          <StatTile label="Total Pengeluaran" value={rupiah.format(expenses)} icon={Banknote} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Rekap</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile label="Total Produk" value={String(totalProducts)} icon={Boxes} />
          <StatTile label="Nilai Stok Saat Ini" value={rupiah.format(stockValue)} icon={Warehouse} />
          <StatTile
            label="Untung Barang Terjual"
            value={rupiah.format(goodsProfit)}
            icon={BadgeDollarSign}
          />
          <StatTile
            label="Member Aktif"
            value={`${activeMembers} dari ${totalMembers} member`}
            icon={Users}
          />
          <StatTile label="Jumlah Transaksi" value={String(count)} icon={ReceiptText} />
        </div>
      </section>

      <DashboardCard title="Stok Menipis / Habis" icon={AlertTriangle}>
        <LowStockTable products={products} />
      </DashboardCard>
      <DashboardCard title="Transaksi Terbaru" icon={Clock}>
        <RecentTransactionsTable rows={recent} />
      </DashboardCard>
      <DashboardCard title="Absensi Hari Ini" icon={ClipboardList}>
        <AttendanceTable rows={attendance} />
      </DashboardCard>
      <DashboardCard title="Reminder Member" icon={BellRing}>
        <ExpiringMembersTable members={members} />
      </DashboardCard>
    </div>
  );
}

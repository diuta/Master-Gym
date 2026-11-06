import { AlertTriangle, Banknote, Clock, ReceiptText } from "lucide-react";
import { PeriodFilter } from "@/components/period-filter";
import type { ProductRow } from "@/features/shop/queries";
import { rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import { DashboardCard } from "./dashboard-card";
import { LowStockTable } from "./low-stock-table";
import type { RecentTx } from "./logic";
import { RecentTransactionsTable } from "./recent-transactions-table";
import { StatTile } from "./stat-tile";

export function KasirDashboardPage({
  period,
  from,
  to,
  count,
  omzet,
  products,
  recent,
}: {
  period: Period;
  from?: string;
  to?: string;
  count: number;
  omzet: number;
  products: ProductRow[];
  recent: RecentTx[];
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <PeriodFilter period={period} from={from} to={to} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile label="Jumlah Transaksi" value={String(count)} icon={ReceiptText} />
        <StatTile label="Total Omzet" value={rupiah.format(omzet)} icon={Banknote} />
      </div>
      <DashboardCard title="Stok Menipis / Habis" icon={AlertTriangle}>
        <LowStockTable products={products} />
      </DashboardCard>
      <DashboardCard title="Transaksi Terbaru" icon={Clock}>
        <RecentTransactionsTable rows={recent} />
      </DashboardCard>
    </div>
  );
}

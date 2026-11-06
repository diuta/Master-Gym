import {
  Banknote,
  BadgeDollarSign,
  Package,
  Percent,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodFilter } from "@/components/period-filter";
import { rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import { DashboardCard } from "./dashboard-card";
import type { IncomeKind, MethodFilter as Method, ProductProfitRow } from "./logic";
import { MethodFilter } from "./method-filter";
import { ProductProfitTable } from "./product-profit-table";
import { SalesDetailTable, type SaleDetailRow } from "./sales-detail-table";
import { StatTile } from "./stat-tile";

const percentFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function ReportsPage({
  period,
  from,
  to,
  method,
  tiles,
  products,
  sales,
}: {
  period: Period;
  from?: string;
  to?: string;
  method: Method;
  tiles: {
    count: number;
    omzet: number;
    byKind: Record<IncomeKind, number>;
    cost: number;
    net: number;
    percent: number | null;
    periodExpenses: number;
    allExpenses: number;
  };
  products: ProductProfitRow[];
  sales: SaleDetailRow[];
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Laporan</h1>
      <PeriodFilter period={period} from={from} to={to}>
        <MethodFilter value={method} />
      </PeriodFilter>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Jumlah Transaksi Penjualan"
          value={String(tiles.count)}
          icon={ReceiptText}
        />
        <Card>
          <CardContent className="space-y-1">
            <div className="flex items-center gap-2 text-base text-muted-foreground">
              <Banknote className="size-5" />
              Total Omzet
            </div>
            <p className="text-3xl font-semibold tracking-tight">{rupiah.format(tiles.omzet)}</p>
            <dl className="space-y-0.5 pt-1 text-base text-muted-foreground">
              {(
                [
                  ["Penjualan", tiles.byKind.sale],
                  ["Membership", tiles.byKind.membership],
                  ["Visit", tiles.byKind.visit],
                  ["PT", tiles.byKind.pt],
                  ["Corporate", tiles.byKind.corporate],
                ] as const
              ).map(([name, v]) => (
                <div key={name} className="flex justify-between gap-2">
                  <dt>{name}</dt>
                  <dd className="text-foreground">{rupiah.format(v)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <StatTile
          label="Total Modal"
          value={rupiah.format(tiles.cost)}
          hint="harga pokok barang terjual"
          icon={Package}
        />
        <StatTile
          label="Pengeluaran Periode Ini"
          value={rupiah.format(tiles.periodExpenses)}
          icon={Wallet}
        />
        <StatTile
          label="Total Pengeluaran (Semua Waktu)"
          value={rupiah.format(tiles.allExpenses)}
          icon={Wallet}
        />
        <StatTile label="Untung Bersih" value={rupiah.format(tiles.net)} icon={TrendingUp} />
        <StatTile
          label="Persentase Untung"
          value={tiles.percent === null ? "–" : `${percentFmt.format(tiles.percent)}%`}
          icon={Percent}
        />
      </div>

      <DashboardCard title="Laba per Produk" icon={BadgeDollarSign}>
        <ProductProfitTable rows={products} />
      </DashboardCard>
      <DashboardCard title="Detail Penjualan" icon={ReceiptText}>
        <SalesDetailTable rows={sales} />
      </DashboardCard>
    </div>
  );
}

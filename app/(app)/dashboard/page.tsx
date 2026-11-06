import { verifySession } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import { listAttendance, listMembers } from "@/features/membership/queries";
import { KasirDashboardPage } from "@/features/reports/kasir-dashboard-page";
import { HomePage } from "@/features/reports/home-page";
import {
  balances,
  expensesTotal,
  goodsProfit,
  inRange,
  netProfit,
  omzet,
  recentTransactions,
  transactionCount,
} from "@/features/reports/logic";
import { getOpeningBalance, listMovements } from "@/features/reports/queries";
import { listProducts } from "@/features/shop/queries";
import { PERIOD_OPTIONS, parsePeriod, periodRange, type Period } from "@/lib/period";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const session = await verifySession();
  const sp = await searchParams;
  const period = PERIOD_OPTIONS.some((o) => o.value === sp.period) ? parsePeriod(sp.period) : "today";
  if (session.role !== "kasir") return <SuperadminHome period={period} sp={sp} />;

  const [movements, products] = await Promise.all([listMovements(), listProducts()]);
  const rows = inRange(movements, periodRange(period, todayWib(), sp));
  return (
    <KasirDashboardPage
      period={period}
      from={sp.from}
      to={sp.to}
      count={transactionCount(rows, "all")}
      omzet={omzet(rows, "all")}
      products={products}
      recent={recentTransactions(rows)}
    />
  );
}

async function SuperadminHome({
  period,
  sp,
}: {
  period: Period;
  sp: { from?: string; to?: string };
}) {
  const today = todayWib();
  const [movements, products, opening, members, attendance] = await Promise.all([
    listMovements(),
    listProducts(),
    getOpeningBalance(),
    listMembers(),
    listAttendance(today),
  ]);
  const rows = inRange(movements, periodRange(period, today, sp));
  return (
    <HomePage
      period={period}
      from={sp.from}
      to={sp.to}
      opening={opening}
      balances={balances(opening, movements)}
      netProfit={netProfit(rows, "all")}
      expenses={expensesTotal(rows, "all")}
      goodsProfit={goodsProfit(rows, "all")}
      count={transactionCount(rows, "all")}
      totalProducts={products.length}
      stockValue={products.reduce((sum, p) => sum + p.stockValue, 0)}
      activeMembers={members.filter((m) => m.status !== "expired").length}
      totalMembers={members.length}
      products={products}
      recent={recentTransactions(rows)}
      attendance={attendance}
      members={members}
    />
  );
}

import { requireRole } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import {
  costOfGoods,
  expensesTotal,
  inRange,
  netProfit,
  omzet,
  omzetByKind,
  parseMethodFilter,
  productProfit,
  salesDetail,
  profitPercent,
  transactionCount,
} from "@/features/reports/logic";
import { listMovements, listSaleLines } from "@/features/reports/queries";
import { ReportsPage } from "@/features/reports/reports-page";
import { parsePeriod, periodRange } from "@/lib/period";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; method?: string }>;
}) {
  await requireRole("superadmin");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const method = parseMethodFilter(sp.method);
  const range = periodRange(period, todayWib(), sp);

  const [all, allLines] = await Promise.all([listMovements(), listSaleLines()]);
  const rows = inRange(all, range);
  const saleRows = rows.filter((r) => r.kind === "sale");
  const lines = inRange(allLines, range);

  return (
    <ReportsPage
      period={period}
      from={sp.from}
      to={sp.to}
      method={method}
      tiles={{
        count: transactionCount(rows, method),
        omzet: omzet(rows, method),
        byKind: omzetByKind(rows, method),
        cost: costOfGoods(rows, method),
        net: netProfit(rows, method),
        percent: profitPercent(rows, method),
        periodExpenses: expensesTotal(rows, method),
        allExpenses: expensesTotal(all, method),
      }}
      products={productProfit(lines, saleRows, method)}
      sales={salesDetail(saleRows, method)}
    />
  );
}

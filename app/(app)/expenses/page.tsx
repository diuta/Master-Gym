import { requireRole } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import { listActiveExpenseCategories, listExpenses } from "@/features/expenses/queries";
import { ExpensesPage } from "@/features/expenses/expenses-page";
import { parsePeriod, periodRange } from "@/lib/period";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { role } = await requireRole("kasir", "superadmin");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const [rows, categories] = await Promise.all([
    listExpenses(periodRange(period, todayWib(), sp)),
    listActiveExpenseCategories(),
  ]);
  return (
    <ExpensesPage
      rows={rows}
      categories={categories}
      period={period}
      from={sp.from}
      to={sp.to}
      role={role}
    />
  );
}

import { requireRole } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import { listAllProductsForFilter, listSales } from "@/features/shop/queries";
import { SalesHistoryPage } from "@/features/shop/sales-history-page";
import { parsePeriod, periodRange } from "@/lib/period";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; product?: string }>;
}) {
  const { role } = await requireRole("kasir", "superadmin");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const range = periodRange(period, todayWib(), sp);
  const pid = Number(sp.product);
  const productId = Number.isInteger(pid) && pid > 0 ? pid : undefined;
  const [rows, products] = await Promise.all([
    listSales(range, productId),
    listAllProductsForFilter(),
  ]);
  return (
    <SalesHistoryPage
      rows={rows}
      products={products}
      period={period}
      from={sp.from}
      to={sp.to}
      productId={productId}
      role={role}
    />
  );
}

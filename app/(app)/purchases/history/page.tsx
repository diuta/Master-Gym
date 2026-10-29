import { requireRole } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import { listPurchaseItems } from "@/features/shop/queries";
import { PurchasesHistoryPage } from "@/features/shop/purchases-history-page";
import { parsePeriod, periodRange } from "@/lib/period";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { role } = await requireRole("kasir", "superadmin");
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const rows = await listPurchaseItems(periodRange(period, todayWib(), sp));
  return (
    <PurchasesHistoryPage rows={rows} period={period} from={sp.from} to={sp.to} role={role} />
  );
}

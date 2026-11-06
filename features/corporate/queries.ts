import "server-only";
import { and, asc, count, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  corporateCheckIns,
  corporatePackages,
  corporatePurchases,
} from "@/lib/db/schema";

export type CorporatePackageOption = {
  id: number;
  companyName: string;
  employeeCount: number;
  visitQuota: number;
  months: number;
  price: number;
};

export async function listActiveCorporatePackages(): Promise<CorporatePackageOption[]> {
  const rows = await db
    .select({
      id: corporatePackages.id,
      companyName: corporatePackages.companyName,
      employeeCount: corporatePackages.employeeCount,
      visitQuota: corporatePackages.visitQuota,
      months: corporatePackages.months,
      price: corporatePackages.price,
    })
    .from(corporatePackages)
    .where(eq(corporatePackages.isActive, true))
    .orderBy(asc(corporatePackages.companyName), asc(corporatePackages.id));
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}

export type CorporateCheckInOption = {
  corporatePackageId: number;
  companyName: string;
  packageQuota: number;
  remaining: number;
  soonestEnd: string;
};

// Deliberately not filtered by isActive: a deactivated package's purchased quota stays usable.
export async function listCorporateCheckInOptions(today: string): Promise<CorporateCheckInOption[]> {
  const rows = await db
    .select({
      id: corporatePurchases.id,
      corporatePackageId: corporatePurchases.corporatePackageId,
      companyName: corporatePackages.companyName,
      packageQuota: corporatePackages.visitQuota,
      visitQuota: corporatePurchases.visitQuota,
      endDate: corporatePurchases.endDate,
      used: count(corporateCheckIns.id),
    })
    .from(corporatePurchases)
    .innerJoin(corporatePackages, eq(corporatePackages.id, corporatePurchases.corporatePackageId))
    .leftJoin(corporateCheckIns, eq(corporateCheckIns.corporatePurchaseId, corporatePurchases.id))
    .where(and(lte(corporatePurchases.startDate, today), gte(corporatePurchases.endDate, today)))
    .groupBy(corporatePurchases.id, corporatePackages.id);

  const byPackage = new Map<number, CorporateCheckInOption>();
  for (const r of rows) {
    const left = r.visitQuota - r.used;
    if (left <= 0) continue;
    const cur = byPackage.get(r.corporatePackageId);
    if (cur) {
      cur.remaining += left;
      if (r.endDate < cur.soonestEnd) cur.soonestEnd = r.endDate;
    } else {
      byPackage.set(r.corporatePackageId, {
        corporatePackageId: r.corporatePackageId,
        companyName: r.companyName,
        packageQuota: r.packageQuota,
        remaining: left,
        soonestEnd: r.endDate,
      });
    }
  }
  return [...byPackage.values()].sort((a, b) => a.companyName.localeCompare(b.companyName));
}

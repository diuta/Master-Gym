"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  corporateCheckIns,
  corporatePackages,
  corporatePurchases,
  payments,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { membershipEndDate, todayWib } from "../membership/logic";
import type { ActionResult } from "../membership/validation";
import { pickCorporatePurchase } from "./logic";
import {
  CorporateCheckInSchema,
  CorporatePackageSchema,
  CorporatePurchaseSchema,
  type CorporateCheckInInput,
  type CorporatePackageInput,
  type CorporatePurchaseInput,
} from "./validation";

const NOT_FOUND = { message: "Paket corporate tidak ditemukan." };

function revalidateCorporate() {
  revalidatePath("/membership/payment");
  revalidatePath("/membership/pricing");
}

export async function createCorporatePackageAction(
  input: CorporatePackageInput,
): Promise<ActionResult> {
  await requireRole("kasir", "superadmin");
  const v = CorporatePackageSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db.insert(corporatePackages).values({ ...v.data, price: String(v.data.price) });
  revalidateCorporate();
  return { success: true, data: undefined };
}

export async function updateCorporatePackageAction(
  id: number,
  input: CorporatePackageInput,
): Promise<ActionResult> {
  await requireRole("kasir", "superadmin");
  const v = CorporatePackageSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const updated = await db
    .update(corporatePackages)
    .set({ ...v.data, price: String(v.data.price), updatedAt: new Date() })
    .where(and(eq(corporatePackages.id, id), eq(corporatePackages.isActive, true)))
    .returning({ id: corporatePackages.id });
  if (updated.length === 0) return NOT_FOUND;

  revalidateCorporate();
  return { success: true, data: undefined };
}

// Packages with purchases are only deactivated so history keeps its FK.
export async function deleteCorporatePackageAction(id: number): Promise<ActionResult> {
  await requireRole("kasir", "superadmin");

  const [used] = await db
    .select({ id: corporatePurchases.id })
    .from(corporatePurchases)
    .where(eq(corporatePurchases.corporatePackageId, id))
    .limit(1);

  const active = and(eq(corporatePackages.id, id), eq(corporatePackages.isActive, true));
  const result = used
    ? await db
        .update(corporatePackages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(active)
        .returning({ id: corporatePackages.id })
    : await db.delete(corporatePackages).where(active).returning({ id: corporatePackages.id });
  if (result.length === 0) return NOT_FOUND;

  revalidateCorporate();
  return { success: true, data: undefined };
}

export async function buyCorporateAction(
  input: CorporatePurchaseInput,
): Promise<ActionResult<{ companyName: string; visitQuota: number; endDate: string }>> {
  await requireRole("kasir");
  const v = CorporatePurchaseSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const [pkg] = await db
    .select()
    .from(corporatePackages)
    .where(and(eq(corporatePackages.id, d.corporatePackageId), eq(corporatePackages.isActive, true)))
    .limit(1);
  if (!pkg) {
    return { errors: { corporatePackageId: ["Paket corporate tidak tersedia, pilih paket lain."] } };
  }

  // Dates come from the server clock, never from the client.
  const startDate = todayWib();
  const endDate = membershipEndDate(startDate, pkg.months);

  await db.transaction(async (tx) => {
    const [purchase] = await tx
      .insert(corporatePurchases)
      .values({
        corporatePackageId: pkg.id,
        companyName: pkg.companyName,
        employeeCount: pkg.employeeCount,
        visitQuota: d.visitQuota,
        price: String(d.price),
        startDate,
        endDate,
      })
      .returning({ id: corporatePurchases.id });
    await tx.insert(payments).values(
      d.payments.map((p) => ({
        corporatePurchaseId: purchase.id,
        method: p.method,
        amount: String(p.amount),
      })),
    );
  });

  revalidatePath("/membership/payment");
  revalidatePath("/membership/check-in");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true, data: { companyName: pkg.companyName, visitQuota: d.visitQuota, endDate } };
}

export async function corporateCheckInAction(
  input: CorporateCheckInInput,
): Promise<ActionResult<{ employeeName: string }>> {
  await requireRole("kasir");
  const v = CorporateCheckInSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const picked = await db.transaction(async (tx) => {
    // Ascending-id lock serialises concurrent check-ins; usage is counted only after the lock.
    const purchases = await tx
      .select()
      .from(corporatePurchases)
      .where(eq(corporatePurchases.corporatePackageId, d.corporatePackageId))
      .orderBy(corporatePurchases.id)
      .for("update");
    if (purchases.length === 0) return null;

    const usedRows = await tx
      .select({ id: corporateCheckIns.corporatePurchaseId, used: count() })
      .from(corporateCheckIns)
      .where(
        inArray(
          corporateCheckIns.corporatePurchaseId,
          purchases.map((p) => p.id),
        ),
      )
      .groupBy(corporateCheckIns.corporatePurchaseId);
    const usedBy = new Map(usedRows.map((r) => [r.id, r.used]));

    const pick = pickCorporatePurchase(
      purchases.map((p) => ({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        visitQuota: p.visitQuota,
        used: usedBy.get(p.id) ?? 0,
      })),
      todayWib(),
    );
    if (!pick) return null;

    await tx.insert(corporateCheckIns).values({
      corporatePurchaseId: pick.id,
      employeeName: d.employeeName,
      phone: d.phone,
      lockerNo: d.lockerNo,
    });
    return pick;
  });
  if (!picked) return { message: "Kuota corporate habis atau sudah berakhir." };

  revalidatePath("/membership/check-in");
  revalidatePath("/membership/attendance");
  revalidatePath("/dashboard");
  return { success: true, data: { employeeName: d.employeeName } };
}

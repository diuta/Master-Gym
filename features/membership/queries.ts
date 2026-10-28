import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categoryPrices, members, memberships, packages } from "@/lib/db/schema";
import { daysRemaining, membershipStatus, todayWib } from "./logic";
import type { CategoryPrices, Gender, MemberCard, MemberCategory, MembershipStatus } from "./validation";

export type PackageOption = {
  id: number;
  name: string;
  months: number;
};

export async function listActivePackages(): Promise<PackageOption[]> {
  return db
    .select({ id: packages.id, name: packages.name, months: packages.months })
    .from(packages)
    .where(eq(packages.isActive, true))
    .orderBy(asc(packages.months), asc(packages.name));
}

export async function getCategoryPrices(): Promise<CategoryPrices> {
  const rows = await db.select().from(categoryPrices);
  return Object.fromEntries(rows.map((r) => [r.category, Number(r.pricePerMonth)]));
}

export type MemberRow = MemberCard & {
  id: number;
  birthDate: string | null;
  gender: Gender;
  category: MemberCategory;
  packageName: string;
  status: MembershipStatus;
  daysRemaining: number;
};

export async function listMembers(): Promise<MemberRow[]> {
  // One row per member: their latest membership by end date.
  const latest = db
    .selectDistinctOn([memberships.memberId])
    .from(memberships)
    .orderBy(memberships.memberId, desc(memberships.endDate), desc(memberships.id))
    .as("latest");

  const rows = await db
    .select({
      id: members.id,
      memberNo: members.memberNo,
      name: members.name,
      phone: members.phone,
      birthDate: members.birthDate,
      gender: members.gender,
      category: members.category,
      photoPath: members.photoPath,
      qrToken: members.qrToken,
      packageName: latest.packageName,
      endDate: latest.endDate,
    })
    .from(members)
    .innerJoin(latest, eq(latest.memberId, members.id))
    .orderBy(asc(members.memberNo));

  const today = todayWib();
  return rows.map((r) => ({
    ...r,
    status: membershipStatus(r.endDate, today),
    daysRemaining: daysRemaining(r.endDate, today),
  }));
}

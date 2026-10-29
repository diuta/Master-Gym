import "server-only";
import { and, asc, count, desc, eq, gte, ilike, lt, max, min, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categoryPrices,
  checkIns,
  members,
  memberships,
  packages,
  ptPrograms,
  ptPurchases,
  trainers,
  visitPrice,
  visits,
} from "@/lib/db/schema";
import { formatTimeWib } from "@/lib/format";
import { daysRemaining, membershipStatus, normalizePhone, todayWib, wibDayRange } from "./logic";
import type {
  AttendanceRow,
  CategoryPrices,
  Gender,
  MemberCard,
  MemberCategory,
  MembershipStatus,
  MemberSummary,
} from "./validation";

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

export async function getVisitPrice(): Promise<number | null> {
  const [row] = await db.select({ price: visitPrice.price }).from(visitPrice).limit(1);
  return row ? Number(row.price) : null;
}

export type TrainerOption = { id: number; name: string; phone: string };

export async function listActiveTrainers(): Promise<TrainerOption[]> {
  return db
    .select({ id: trainers.id, name: trainers.name, phone: trainers.phone })
    .from(trainers)
    .where(eq(trainers.isActive, true))
    .orderBy(asc(trainers.name));
}

export type PtProgramOption = { id: number; name: string; sessions: number; price: number };

export async function listActivePtPrograms(): Promise<PtProgramOption[]> {
  const rows = await db
    .select({
      id: ptPrograms.id,
      name: ptPrograms.name,
      sessions: ptPrograms.sessions,
      price: ptPrograms.price,
    })
    .from(ptPrograms)
    .where(eq(ptPrograms.isActive, true))
    .orderBy(asc(ptPrograms.sessions), asc(ptPrograms.name));
  return rows.map((r) => ({ ...r, price: Number(r.price) }));
}

export type MemberRow = MemberCard & {
  id: number;
  birthDate: string | null;
  gender: Gender;
  category: MemberCategory;
  packageName: string;
  status: MembershipStatus;
  daysRemaining: number;
  totalCheckIns: number;
};

export async function listMembers(): Promise<MemberRow[]> {
  // One row per member: their latest membership by end date.
  const latest = db
    .selectDistinctOn([memberships.memberId])
    .from(memberships)
    .orderBy(memberships.memberId, desc(memberships.endDate), desc(memberships.id))
    .as("latest");

  // Visits are not check-ins, so they are not counted here.
  const counts = db
    .select({ memberId: checkIns.memberId, total: count().as("total") })
    .from(checkIns)
    .groupBy(checkIns.memberId)
    .as("counts");

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
      totalCheckIns: sql<number>`coalesce(${counts.total}, 0)`.mapWith(Number),
    })
    .from(members)
    .innerJoin(latest, eq(latest.memberId, members.id))
    .leftJoin(counts, eq(counts.memberId, members.id))
    .orderBy(asc(members.memberNo));

  const today = todayWib();
  return rows.map((r) => ({
    ...r,
    status: membershipStatus(r.endDate, today),
    daysRemaining: daysRemaining(r.endDate, today),
  }));
}

// Accepts a transaction so checkInAction can re-read the summary under its row lock.
export async function getMemberSummary(
  memberId: number,
  executor: Pick<typeof db, "select"> = db,
): Promise<MemberSummary | null> {
  const [row] = await executor
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
      packageName: memberships.packageName,
      endDate: memberships.endDate,
      ptBalance: sql<number>`(
        coalesce((select sum(${ptPurchases.sessions}) from ${ptPurchases}
          where ${ptPurchases.memberId} = ${members.id}), 0)
        - (select count(*) from ${checkIns}
          where ${checkIns.memberId} = ${members.id} and ${checkIns.trainerId} is not null)
      )::int`.mapWith(Number),
    })
    .from(members)
    .innerJoin(memberships, eq(memberships.memberId, members.id))
    .where(eq(members.id, memberId))
    .orderBy(desc(memberships.endDate), desc(memberships.id))
    .limit(1);
  if (!row) return null;

  const today = todayWib();
  const { start, end } = wibDayRange(today);
  const [first] = await executor
    .select({ at: min(checkIns.checkedInAt) })
    .from(checkIns)
    .where(
      and(
        eq(checkIns.memberId, memberId),
        gte(checkIns.checkedInAt, start),
        lt(checkIns.checkedInAt, end),
      ),
    );

  return {
    ...row,
    status: membershipStatus(row.endDate, today),
    daysRemaining: daysRemaining(row.endDate, today),
    checkedInTodayAt: first?.at ? formatTimeWib(first.at) : null,
  };
}

// The scanner sends the QR token; a cashier may type a phone number instead.
export async function findMemberSummary(text: string): Promise<MemberSummary | null> {
  const q = text.trim();
  if (q === "") return null;
  const [byToken] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.qrToken, q))
    .limit(1);
  if (byToken) return getMemberSummary(byToken.id);

  const phone = normalizePhone(q);
  if (!phone) return null;
  const [byPhone] = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.phone, phone))
    .limit(1);
  return byPhone ? getMemberSummary(byPhone.id) : null;
}

// Scan/phone hit first; otherwise member number, name or phone fragment. Max 10, by name.
export async function searchMembers(text: string): Promise<MemberSummary[]> {
  const q = text.trim();
  if (q === "") return [];
  const exact = await findMemberSummary(q);
  if (exact) return [exact];

  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const digits = q.replace(/\D/g, "");
  // Short digit runs would match nearly every phone, so only use them from 4 digits on.
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(
      or(
        ilike(members.memberNo, like),
        ilike(members.name, like),
        digits.length >= 4 ? ilike(members.phone, `%${digits}%`) : undefined,
      ),
    )
    .orderBy(asc(members.name))
    .limit(10);
  const found = await Promise.all(rows.map((r) => getMemberSummary(r.id)));
  return found.filter((m) => m !== null);
}

export async function listAttendance(date: string): Promise<AttendanceRow[]> {
  const { start, end } = wibDayRange(date);
  const [memberRows, visitRows] = await Promise.all([
    db
      .select({
        at: checkIns.checkedInAt,
        name: members.name,
        memberNo: members.memberNo,
        lockerNo: checkIns.lockerNo,
        trainerName: trainers.name,
      })
      .from(checkIns)
      .innerJoin(members, eq(members.id, checkIns.memberId))
      .leftJoin(trainers, eq(trainers.id, checkIns.trainerId))
      .where(and(gte(checkIns.checkedInAt, start), lt(checkIns.checkedInAt, end))),
    db
      .select({ at: visits.createdAt, name: visits.name, lockerNo: visits.lockerNo })
      .from(visits)
      .where(and(gte(visits.createdAt, start), lt(visits.createdAt, end))),
  ]);

  return [
    ...memberRows.map((r) => ({ kind: "member" as const, ...r })),
    ...visitRows.map((r) => ({ kind: "visitor" as const, ...r, memberNo: null, trainerName: null })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

export type VisitorRow = { phone: string; name: string; visits: number; lastVisitAt: Date };

// Visitors have no ID, so they are grouped by phone; the name is the one from the latest visit.
export async function listVisitors(): Promise<VisitorRow[]> {
  return db
    .select({
      phone: visits.phone,
      name: sql<string>`(array_agg(${visits.name} order by ${visits.createdAt} desc, ${visits.id} desc))[1]`,
      visits: count(),
      lastVisitAt: sql<Date>`max(${visits.createdAt})`.mapWith(visits.createdAt),
    })
    .from(visits)
    .groupBy(visits.phone)
    .orderBy(desc(max(visits.createdAt)));
}

export type MemberDetail = {
  ptBalance: number;
  checkIns: { at: Date; lockerNo: string | null; trainerName: string | null }[];
};

export async function getMemberDetail(memberId: number): Promise<MemberDetail | null> {
  const summary = await getMemberSummary(memberId);
  if (!summary) return null;
  const rows = await db
    .select({ at: checkIns.checkedInAt, lockerNo: checkIns.lockerNo, trainerName: trainers.name })
    .from(checkIns)
    .leftJoin(trainers, eq(trainers.id, checkIns.trainerId))
    .where(eq(checkIns.memberId, memberId))
    .orderBy(desc(checkIns.checkedInAt), desc(checkIns.id));
  return { ptBalance: summary.ptBalance, checkIns: rows };
}

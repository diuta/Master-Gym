"use server";

import { randomBytes } from "crypto";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  categoryPrices,
  checkIns,
  members,
  memberships,
  packages,
  payments,
  ptPrograms,
  ptPurchases,
  trainers,
  visitPrice,
  visits,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { saveBase64Upload } from "@/lib/uploads";
import {
  formatMemberNo,
  membershipEndDate,
  membershipPrice,
  renewalStartDate,
  todayWib,
} from "./logic";
import {
  findMemberSummary,
  getMemberDetail,
  getMemberSummary,
  getVisitPrice,
  searchMembers,
  type MemberDetail,
} from "./queries";
import {
  CategoryPricesSchema,
  CheckInSchema,
  type CheckInInput,
  type MemberSummary,
  type CategoryPricesInput,
  PackageSchema,
  PtProgramSchema,
  type PtProgramInput,
  TrainerSchema,
  type TrainerInput,
  VisitPriceSchema,
  VisitSchema,
  type VisitInput,
  type VisitPriceInput,
  RegisterMemberSchema,
  RenewMemberSchema,
  type RenewMemberInput,
  PtPurchaseSchema,
  type PtPurchaseInput,
  type ActionResult,
  type MemberCard,
  type PackageInput,
  type RegisterMemberInput,
  UpdateMemberSchema,
  type UpdateMemberInput,
} from "./validation";

const NOT_FOUND = { message: "Paket tidak ditemukan." };

function revalidatePricing() {
  revalidatePath("/membership/pricing");
  revalidatePath("/membership/payment");
  revalidatePath("/membership/check-in");
}

export async function saveCategoryPricesAction(input: CategoryPricesInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = CategoryPricesSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db
    .insert(categoryPrices)
    .values(
      Object.entries(v.data).map(([category, price]) => ({
        category: category as keyof typeof v.data,
        pricePerMonth: String(price),
      })),
    )
    .onConflictDoUpdate({
      target: categoryPrices.category,
      set: { pricePerMonth: sql`excluded.price_per_month`, updatedAt: new Date() },
    });
  revalidatePricing();
  return { success: true, data: undefined };
}

export async function createPackageAction(input: PackageInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = PackageSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db.insert(packages).values({ name: v.data.name, months: v.data.months });
  revalidatePricing();
  return { success: true, data: undefined };
}

export async function updatePackageAction(id: number, input: PackageInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = PackageSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const updated = await db
    .update(packages)
    .set({ name: v.data.name, months: v.data.months, updatedAt: new Date() })
    .where(and(eq(packages.id, id), eq(packages.isActive, true)))
    .returning({ id: packages.id });
  if (updated.length === 0) return NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

// Packages with sold memberships are only deactivated so history keeps its FK.
export async function deletePackageAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");

  const [used] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.packageId, id))
    .limit(1);

  const result = used
    ? await db
        .update(packages)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(packages.id, id), eq(packages.isActive, true)))
        .returning({ id: packages.id })
    : await db
        .delete(packages)
        .where(and(eq(packages.id, id), eq(packages.isActive, true)))
        .returning({ id: packages.id });
  if (result.length === 0) return NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

export async function saveVisitPriceAction(input: VisitPriceInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = VisitPriceSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db
    .insert(visitPrice)
    .values({ id: 1, price: String(v.data.price) })
    .onConflictDoUpdate({
      target: visitPrice.id,
      set: { price: String(v.data.price), updatedAt: new Date() },
    });
  revalidatePricing();
  return { success: true, data: undefined };
}

const TRAINER_NOT_FOUND = { message: "Trainer tidak ditemukan." };
const PROGRAM_NOT_FOUND = { message: "Program tidak ditemukan." };

export async function createTrainerAction(input: TrainerInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = TrainerSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db.insert(trainers).values({ name: v.data.name, phone: v.data.phone });
  revalidatePricing();
  return { success: true, data: undefined };
}

export async function updateTrainerAction(id: number, input: TrainerInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = TrainerSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const updated = await db
    .update(trainers)
    .set({ name: v.data.name, phone: v.data.phone, updatedAt: new Date() })
    .where(and(eq(trainers.id, id), eq(trainers.isActive, true)))
    .returning({ id: trainers.id });
  if (updated.length === 0) return TRAINER_NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

// Trainers with check-ins are only deactivated so history keeps its FK.
export async function deleteTrainerAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");

  const [used] = await db
    .select({ id: checkIns.id })
    .from(checkIns)
    .where(eq(checkIns.trainerId, id))
    .limit(1);

  const result = used
    ? await db
        .update(trainers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(trainers.id, id), eq(trainers.isActive, true)))
        .returning({ id: trainers.id })
    : await db
        .delete(trainers)
        .where(and(eq(trainers.id, id), eq(trainers.isActive, true)))
        .returning({ id: trainers.id });
  if (result.length === 0) return TRAINER_NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

export async function createPtProgramAction(input: PtProgramInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = PtProgramSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  await db
    .insert(ptPrograms)
    .values({ name: v.data.name, sessions: v.data.sessions, price: String(v.data.price) });
  revalidatePricing();
  return { success: true, data: undefined };
}

export async function updatePtProgramAction(
  id: number,
  input: PtProgramInput,
): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = PtProgramSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const updated = await db
    .update(ptPrograms)
    .set({
      name: v.data.name,
      sessions: v.data.sessions,
      price: String(v.data.price),
      updatedAt: new Date(),
    })
    .where(and(eq(ptPrograms.id, id), eq(ptPrograms.isActive, true)))
    .returning({ id: ptPrograms.id });
  if (updated.length === 0) return PROGRAM_NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

// Programs with purchases are only deactivated so history keeps its FK.
export async function deletePtProgramAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");

  const [used] = await db
    .select({ id: ptPurchases.id })
    .from(ptPurchases)
    .where(eq(ptPurchases.ptProgramId, id))
    .limit(1);

  const result = used
    ? await db
        .update(ptPrograms)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(ptPrograms.id, id), eq(ptPrograms.isActive, true)))
        .returning({ id: ptPrograms.id })
    : await db
        .delete(ptPrograms)
        .where(and(eq(ptPrograms.id, id), eq(ptPrograms.isActive, true)))
        .returning({ id: ptPrograms.id });
  if (result.length === 0) return PROGRAM_NOT_FOUND;

  revalidatePricing();
  return { success: true, data: undefined };
}

// Returns the field error when another member already has this phone.
async function phoneTaken(phone: string, exceptId?: number) {
  const [owner] = await db
    .select({ name: members.name })
    .from(members)
    .where(
      exceptId === undefined
        ? eq(members.phone, phone)
        : and(eq(members.phone, phone), ne(members.id, exceptId)),
    )
    .limit(1);
  return owner ? { errors: { phone: [`Nomor HP sudah terdaftar atas nama ${owner.name}.`] } } : null;
}

const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return (e.cause?.code ?? e.code) === "23505";
};

export async function registerMemberAction(
  input: RegisterMemberInput,
): Promise<ActionResult<MemberCard>> {
  await requireRole("kasir");
  const v = RegisterMemberSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const [pkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.id, d.packageId), eq(packages.isActive, true)))
    .limit(1);
  if (!pkg) return { errors: { packageId: ["Paket tidak tersedia, pilih paket lain."] } };

  // The price is decided here, never trusted from the browser.
  const [base] = await db
    .select({ pricePerMonth: categoryPrices.pricePerMonth })
    .from(categoryPrices)
    .where(eq(categoryPrices.category, d.category))
    .limit(1);
  const price = membershipPrice(base && Number(base.pricePerMonth), pkg.months);
  if (price === null) return { message: "Harga belum diatur, hubungi superadmin." };
  if (price !== d.price) return { message: "Harga sudah berubah, muat ulang halaman." };

  const taken = await phoneTaken(d.phone);
  if (taken) return taken;

  let photoPath: string;
  try {
    // shortcut: photo saved before the transaction, a failed insert leaves an orphan file; clean up if disk use matters
    photoPath = await saveBase64Upload(d.photo, "members");
  } catch (err) {
    return { errors: { photo: [err instanceof Error ? err.message : "Foto gagal disimpan."] } };
  }

  const qrToken = randomBytes(16).toString("base64url");
  const endDate = membershipEndDate(d.startDate, pkg.months);

  try {
    const memberNo = await db.transaction(async (tx) => {
      const seq = await tx.execute<{ n: string }>(sql`select nextval('member_no_seq') as n`);
      const memberNo = formatMemberNo(Number(seq.rows[0].n));
      const [member] = await tx
        .insert(members)
        .values({
          memberNo,
          name: d.name,
          phone: d.phone,
          birthDate: d.birthDate,
          gender: d.gender,
          category: d.category,
          photoPath,
          qrToken,
        })
        .returning({ id: members.id });
      const [membership] = await tx
        .insert(memberships)
        .values({
          memberId: member.id,
          packageId: pkg.id,
          packageName: pkg.name,
          months: pkg.months,
          category: d.category,
          price: String(d.price),
          startDate: d.startDate,
          endDate,
        })
        .returning({ id: memberships.id });
      await tx.insert(payments).values(
        d.payments.map((p) => ({
          membershipId: membership.id,
          method: p.method,
          amount: String(p.amount),
        })),
      );
      return memberNo;
    });

    revalidatePath("/membership/members");
    return {
      success: true,
      data: { memberNo, name: d.name, phone: d.phone, endDate, photoPath, qrToken },
    };
  } catch (err) {
    // The pre-check above can lose a race against a concurrent save of the same phone.
    if (isUniqueViolation(err)) {
      const taken = await phoneTaken(d.phone);
      if (taken) return taken;
    }
    throw err;
  }
}

export async function updateMemberAction(input: UpdateMemberInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = UpdateMemberSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const taken = await phoneTaken(d.phone, d.id);
  if (taken) return taken;

  let photoPath: string | undefined;
  if (d.photo) {
    try {
      // shortcut: old photo file stays on disk; delete it if disk use matters
      photoPath = await saveBase64Upload(d.photo, "members");
    } catch (err) {
      return { errors: { photo: [err instanceof Error ? err.message : "Foto gagal disimpan."] } };
    }
  }

  try {
    const updated = await db
      .update(members)
      .set({
        name: d.name,
        phone: d.phone,
        birthDate: d.birthDate,
        gender: d.gender,
        ...(photoPath && { photoPath }),
        updatedAt: new Date(),
      })
      .where(eq(members.id, d.id))
      .returning({ id: members.id });
    if (updated.length === 0) return { message: "Member tidak ditemukan." };
  } catch (err) {
    // Same race as registration: another save took the phone after the pre-check.
    if (isUniqueViolation(err)) {
      const raced = await phoneTaken(d.phone, d.id);
      if (raced) return raced;
    }
    throw err;
  }

  revalidatePath("/membership/members");
  return { success: true, data: undefined };
}

export async function lookupMemberAction(text: string): Promise<ActionResult<MemberSummary>> {
  await requireRole("kasir");
  const summary = await findMemberSummary(String(text));
  return summary ? { success: true, data: summary } : { message: "Member tidak ditemukan." };
}

export async function checkInAction(input: CheckInInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = CheckInSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const result = await db.transaction(async (tx): Promise<ActionResult> => {
    // Row lock serialises one member's check-ins, so two fast clicks can't both spend the last
    // PT session; the summary is re-read after the lock for the same reason.
    const [locked] = await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, d.memberId))
      .for("update");
    const summary = locked && (await getMemberSummary(d.memberId, tx));
    if (!summary) return { message: "Member tidak ditemukan." };
    if (summary.status === "expired") return { message: "Membership sudah habis, perpanjang dulu." };

    // A stray trainerId without useTrainer is ignored, never stored.
    let trainerId: number | null = null;
    if (d.useTrainer && d.trainerId !== undefined) {
      const [trainer] = await tx
        .select({ id: trainers.id })
        .from(trainers)
        .where(and(eq(trainers.id, d.trainerId), eq(trainers.isActive, true)));
      if (!trainer) return { errors: { trainerId: ["Trainer tidak tersedia."] } };
      if (summary.ptBalance <= 0) return { message: "Sesi PT sudah habis." };
      trainerId = trainer.id;
    }

    await tx.insert(checkIns).values({ memberId: d.memberId, lockerNo: d.lockerNo, trainerId });
    return { success: true, data: undefined };
  });

  if (result.success) {
    revalidatePath("/membership/check-in");
    revalidatePath("/membership/attendance");
    revalidatePath("/membership/members");
  }
  return result;
}

export async function createVisitAction(input: VisitInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = VisitSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const price = await getVisitPrice();
  if (price === null) return { message: "Harga belum diatur, hubungi superadmin." };
  if (price !== d.price) return { message: "Harga sudah berubah, muat ulang halaman." };

  // A visit row is also the check-in: Absen lists today's visits.
  await db.transaction(async (tx) => {
    const [visit] = await tx
      .insert(visits)
      .values({ name: d.name, phone: d.phone, price: String(price), lockerNo: d.lockerNo })
      .returning({ id: visits.id });
    await tx.insert(payments).values(
      d.payments.map((p) => ({ visitId: visit.id, method: p.method, amount: String(p.amount) })),
    );
  });

  revalidatePath("/membership/check-in");
  revalidatePath("/membership/attendance");
  revalidatePath("/membership/members");
  return { success: true, data: undefined };
}

export async function searchMembersAction(q: string): Promise<MemberSummary[]> {
  await requireRole("kasir");
  const text = String(q).trim();
  return text.length < 2 ? [] : searchMembers(text);
}

export async function renewMemberAction(
  input: RenewMemberInput,
): Promise<ActionResult<MemberCard>> {
  await requireRole("kasir");
  const v = RenewMemberSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const [pkg] = await db
    .select()
    .from(packages)
    .where(and(eq(packages.id, d.packageId), eq(packages.isActive, true)))
    .limit(1);
  if (!pkg) return { errors: { packageId: ["Paket tidak tersedia, pilih paket lain."] } };

  const [base] = await db
    .select({ pricePerMonth: categoryPrices.pricePerMonth })
    .from(categoryPrices)
    .where(eq(categoryPrices.category, d.category))
    .limit(1);
  const price = membershipPrice(base && Number(base.pricePerMonth), pkg.months);
  if (price === null) return { message: "Harga belum diatur, hubungi superadmin." };
  if (price !== d.price) return { message: "Harga sudah berubah, muat ulang halaman." };

  const result = await db.transaction(async (tx): Promise<ActionResult<MemberCard>> => {
    // Lock first so two renewals of one member can't both start from the same end date.
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, d.memberId))
      .for("update");
    if (!member) return { message: "Member tidak ditemukan." };

    const [latest] = await tx
      .select({ endDate: memberships.endDate })
      .from(memberships)
      .where(eq(memberships.memberId, member.id))
      .orderBy(desc(memberships.endDate), desc(memberships.id))
      .limit(1);
    const startDate = renewalStartDate(latest?.endDate ?? null, todayWib());
    const endDate = membershipEndDate(startDate, pkg.months);

    const [membership] = await tx
      .insert(memberships)
      .values({
        memberId: member.id,
        packageId: pkg.id,
        packageName: pkg.name,
        months: pkg.months,
        category: d.category,
        price: String(price),
        startDate,
        endDate,
      })
      .returning({ id: memberships.id });
    await tx.insert(payments).values(
      d.payments.map((p) => ({
        membershipId: membership.id,
        method: p.method,
        amount: String(p.amount),
      })),
    );
    await tx
      .update(members)
      .set({ category: d.category, updatedAt: new Date() })
      .where(eq(members.id, member.id));

    return {
      success: true,
      data: {
        memberNo: member.memberNo,
        name: member.name,
        phone: member.phone,
        endDate,
        photoPath: member.photoPath,
        qrToken: member.qrToken,
      },
    };
  });

  if (result.success) {
    revalidatePath("/membership/members");
    revalidatePath("/membership/check-in");
    revalidatePath("/membership/payment");
  }
  return result;
}

export async function buyPtAction(
  input: PtPurchaseInput,
): Promise<ActionResult<{ ptBalance: number }>> {
  await requireRole("kasir");
  const v = PtPurchaseSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  const [program] = await db
    .select()
    .from(ptPrograms)
    .where(and(eq(ptPrograms.id, d.ptProgramId), eq(ptPrograms.isActive, true)))
    .limit(1);
  if (!program) return { errors: { ptProgramId: ["Program PT tidak tersedia, pilih program lain."] } };
  if (Number(program.price) !== d.price) {
    return { message: "Harga sudah berubah, muat ulang halaman." };
  }

  // Expired members may buy: sessions never expire, so no membership check.
  const result = await db.transaction(
    async (tx): Promise<ActionResult<{ ptBalance: number }>> => {
      const [member] = await tx
        .select({ id: members.id })
        .from(members)
        .where(eq(members.id, d.memberId))
        .for("update");
      if (!member) return { message: "Member tidak ditemukan." };

      const [purchase] = await tx
        .insert(ptPurchases)
        .values({
          memberId: member.id,
          ptProgramId: program.id,
          programName: program.name,
          sessions: program.sessions,
          price: String(d.price),
        })
        .returning({ id: ptPurchases.id });
      await tx.insert(payments).values(
        d.payments.map((p) => ({
          ptPurchaseId: purchase.id,
          method: p.method,
          amount: String(p.amount),
        })),
      );
      const summary = await getMemberSummary(member.id, tx);
      return { success: true, data: { ptBalance: summary?.ptBalance ?? 0 } };
    },
  );

  if (result.success) {
    revalidatePath("/membership/members");
    revalidatePath("/membership/check-in");
    revalidatePath("/membership/payment");
  }
  return result;
}

export async function memberDetailAction(memberId: number): Promise<ActionResult<MemberDetail>> {
  await requireRole("kasir");
  const detail = await getMemberDetail(Number(memberId));
  return detail ? { success: true, data: detail } : { message: "Member tidak ditemukan." };
}

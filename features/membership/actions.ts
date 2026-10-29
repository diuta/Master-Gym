"use server";

import { randomBytes } from "crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categoryPrices, members, memberships, packages, payments } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { saveBase64Upload } from "@/lib/uploads";
import { formatMemberNo, membershipEndDate, membershipPrice } from "./logic";
import {
  CategoryPricesSchema,
  type CategoryPricesInput,
  PackageSchema,
  RegisterMemberSchema,
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

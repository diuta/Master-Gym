"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import type { ActionResult } from "@/features/membership/validation";
import { ChangePasswordSchema, type ChangePasswordInput } from "./validation";

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  const session = await requireRole("superadmin");
  const v = ChangePasswordSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const [me] = await db
    .select({ password: users.password })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!me) return { message: "Akun tidak ditemukan." };

  // Both targets re-prove the superadmin's own password so a left-open session can't reset it.
  if (!(await bcrypt.compare(v.data.currentPassword, me.password))) {
    return { errors: { currentPassword: ["Password saat ini salah."] } };
  }

  let targetId = session.userId;
  if (v.data.target === "kasir") {
    const kasirs = await db.select({ id: users.id }).from(users).where(eq(users.role, "kasir"));
    if (kasirs.length === 0) return { message: "Akun kasir tidak ditemukan." };
    if (kasirs.length > 1) return { message: "Akun kasir lebih dari satu." };
    targetId = kasirs[0].id;
  }

  await db
    .update(users)
    .set({ password: await bcrypt.hash(v.data.newPassword, 10), updatedAt: new Date() })
    .where(eq(users.id, targetId));
  return { success: true, data: undefined };
}

"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, deleteSession } from "@/lib/auth/session";
import { LoginSchema, type LoginState } from "@/features/authentication/validation";

const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

const DUMMY_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8pYNI.gxG9G5.Rz2h5H1u5X8g5r8Gy";

export async function loginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const invalidMessage = { message: "Email atau password salah." };

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return invalidMessage;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000,
    );
    return {
      message: `Akun ini dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`,
    };
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      attempts >= LOGIN_LOCKOUT_THRESHOLD
        ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60000)
        : null;
    await db
      .update(users)
      .set({ failedLoginAttempts: attempts, lockedUntil })
      .where(eq(users.id, user.id));
    return lockedUntil
      ? {
          message: `Akun ini dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${LOGIN_LOCKOUT_MINUTES} menit.`,
        }
      : invalidMessage;
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
  }

  await createSession({ id: user.id });

  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

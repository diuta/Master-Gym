"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, deleteSession } from "@/lib/auth/session";
import { LoginSchema, type LoginState } from "@/features/authentication/validation";

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

  // shortcut: no lockout (shared kasir account would lock out the whole desk), so passwords can be guessed without limit; add rate limiting by IP before going online
  if (!(await bcrypt.compare(password, user.password))) {
    return invalidMessage;
  }

  await createSession({ id: user.id, role: user.role });

  redirect("/dashboard");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

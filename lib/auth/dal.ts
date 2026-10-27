import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession, type Role, type SessionPayload } from "./session";

export const verifySession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }
  return session;
});

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await verifySession();
  if (!roles.includes(session.role)) {
    redirect("/dashboard");
  }
  return session;
}

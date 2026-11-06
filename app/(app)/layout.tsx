import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { verifySession } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AppNavbar } from "@/components/app-navbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();

  const [user] = await db
    .select({ name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <AppNavbar name={user.name} email={user.email} role={user.role} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
    </div>
  );
}

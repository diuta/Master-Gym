import { requireRole } from "@/lib/auth/dal";
import { listMembers, listVisitors } from "@/features/membership/queries";
import { MembersPage } from "@/features/membership/members-page";

export default async function Page() {
  await requireRole("kasir");
  const [members, visitors] = await Promise.all([listMembers(), listVisitors()]);
  return <MembersPage members={members} visitors={visitors} />;
}

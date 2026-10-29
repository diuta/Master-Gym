import { requireRole } from "@/lib/auth/dal";
import { listMembers } from "@/features/membership/queries";
import { MembersPage } from "@/features/membership/members-page";

export default async function Page() {
  await requireRole("kasir");
  const members = await listMembers();
  return <MembersPage members={members} />;
}

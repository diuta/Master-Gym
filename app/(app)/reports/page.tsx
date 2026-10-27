import { requireRole } from "@/lib/auth/dal";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function Page() {
  await requireRole("superadmin");
  return <PlaceholderPage title="Laporan" />;
}

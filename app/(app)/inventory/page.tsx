import { requireRole } from "@/lib/auth/dal";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function Page() {
  await requireRole("kasir");
  return <PlaceholderPage title="Inventori" />;
}

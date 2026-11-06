import { requireRole } from "@/lib/auth/dal";
import { AccountSettingsPage } from "@/features/administration/account-settings-page";

export default async function Page() {
  await requireRole("superadmin");
  return <AccountSettingsPage />;
}

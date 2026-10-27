import { verifySession } from "@/lib/auth/dal";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function Page() {
  const session = await verifySession();
  return (
    <PlaceholderPage title={session.role === "kasir" ? "Dashboard" : "Home"} />
  );
}

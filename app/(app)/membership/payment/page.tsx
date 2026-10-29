import { requireRole } from "@/lib/auth/dal";
import { getCategoryPrices, listActivePackages } from "@/features/membership/queries";
import { PaymentPage } from "@/features/membership/payment-page";

export default async function Page() {
  await requireRole("kasir");
  const [packages, prices] = await Promise.all([listActivePackages(), getCategoryPrices()]);
  return <PaymentPage packages={packages} prices={prices} />;
}

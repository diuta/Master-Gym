import { requireRole } from "@/lib/auth/dal";
import { getCategoryPrices, listActivePackages } from "@/features/membership/queries";
import { PricingPage } from "@/features/membership/pricing-page";

export default async function Page() {
  await requireRole("superadmin");
  const [packages, prices] = await Promise.all([listActivePackages(), getCategoryPrices()]);
  return <PricingPage packages={packages} prices={prices} />;
}

import { requireRole } from "@/lib/auth/dal";
import {
  getCategoryPrices,
  getVisitPrice,
  listActivePackages,
  listActivePtPrograms,
  listActiveTrainers,
} from "@/features/membership/queries";
import { PricingPage } from "@/features/membership/pricing-page";

export default async function Page() {
  await requireRole("superadmin");
  const [packages, prices, visitPrice, trainers, ptPrograms] = await Promise.all([
    listActivePackages(),
    getCategoryPrices(),
    getVisitPrice(),
    listActiveTrainers(),
    listActivePtPrograms(),
  ]);
  return (
    <PricingPage
      packages={packages}
      prices={prices}
      visitPrice={visitPrice}
      trainers={trainers}
      ptPrograms={ptPrograms}
    />
  );
}

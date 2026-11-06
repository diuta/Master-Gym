import { requireRole } from "@/lib/auth/dal";
import {
  getVisitPrice,
  listActivePackages,
  listActivePtPrograms,
  listActiveTrainers,
} from "@/features/membership/queries";
import { listActiveCorporatePackages } from "@/features/corporate/queries";
import { PricingPage } from "@/features/membership/pricing-page";

export default async function Page() {
  await requireRole("superadmin");
  const [packages, visitPrice, trainers, ptPrograms, corporatePackages] = await Promise.all([
    listActivePackages(),
    getVisitPrice(),
    listActiveTrainers(),
    listActivePtPrograms(),
    listActiveCorporatePackages(),
  ]);
  return (
    <PricingPage
      packages={packages}
      visitPrice={visitPrice}
      trainers={trainers}
      ptPrograms={ptPrograms}
      corporatePackages={corporatePackages}
    />
  );
}

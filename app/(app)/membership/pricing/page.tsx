import { requireRole } from "@/lib/auth/dal";
import {
  getVisitPrice,
  listActivePackages,
  listActivePtPrograms,
  listActiveTrainers,
} from "@/features/membership/queries";
import { PricingPage } from "@/features/membership/pricing-page";

export default async function Page() {
  await requireRole("superadmin");
  const [packages, visitPrice, trainers, ptPrograms] = await Promise.all([
    listActivePackages(),
    getVisitPrice(),
    listActiveTrainers(),
    listActivePtPrograms(),
  ]);
  return (
    <PricingPage
      packages={packages}
      visitPrice={visitPrice}
      trainers={trainers}
      ptPrograms={ptPrograms}
    />
  );
}

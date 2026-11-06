import { requireRole } from "@/lib/auth/dal";
import {
  getMemberSummary,
  getVisitPrice,
  listActivePackages,
  listActivePtPrograms,
  listActiveTrainers,
} from "@/features/membership/queries";
import { listActiveCorporatePackages } from "@/features/corporate/queries";
import { PaymentPage, type PaymentForm } from "@/features/membership/payment-page";

const FORMS: PaymentForm[] = ["new", "visit", "renew", "addon"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; member?: string }>;
}) {
  await requireRole("kasir");
  const sp = await searchParams;
  const form = FORMS.find((f) => f === sp.form) ?? "new";
  const memberId = /^[1-9]\d*$/.test(sp.member ?? "") ? Number(sp.member) : null;

  const [packages, visitPrice, ptPrograms, trainers, corporatePackages, member] = await Promise.all([
    listActivePackages(),
    getVisitPrice(),
    listActivePtPrograms(),
    listActiveTrainers(),
    listActiveCorporatePackages(),
    memberId ? getMemberSummary(memberId) : null,
  ]);
  return (
    <PaymentPage
      form={form}
      packages={packages}
      visitPrice={visitPrice}
      ptPrograms={ptPrograms}
      trainers={trainers}
      corporatePackages={corporatePackages}
      member={member}
    />
  );
}

import { requireRole } from "@/lib/auth/dal";
import {
  getCategoryPrices,
  getMemberSummary,
  getVisitPrice,
  listActivePackages,
  listActivePtPrograms,
} from "@/features/membership/queries";
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

  const [packages, prices, visitPrice, ptPrograms, member] = await Promise.all([
    listActivePackages(),
    getCategoryPrices(),
    getVisitPrice(),
    listActivePtPrograms(),
    memberId ? getMemberSummary(memberId) : null,
  ]);
  return (
    <PaymentPage
      form={form}
      packages={packages}
      prices={prices}
      visitPrice={visitPrice}
      ptPrograms={ptPrograms}
      member={member}
    />
  );
}

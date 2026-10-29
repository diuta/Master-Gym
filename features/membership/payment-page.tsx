"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PtAddonForm } from "./pt-addon-form";
import type { PackageOption, PtProgramOption } from "./queries";
import { RegisterMemberWizard } from "./register-member-wizard";
import { RenewMemberForm } from "./renew-member-form";
import type { CategoryPrices, MemberSummary } from "./validation";
import { VisitForm } from "./visit-form";

export type PaymentForm = "new" | "visit" | "renew" | "addon";

const PAYMENT_TYPES: { value: PaymentForm; label: string }[] = [
  { value: "new", label: "Daftar Member Baru" },
  { value: "visit", label: "Visit (Harian)" },
  { value: "renew", label: "Perpanjang Member" },
  { value: "addon", label: "Add-On" },
];

export function PaymentPage({
  form,
  packages,
  prices,
  visitPrice,
  ptPrograms,
  member,
}: {
  form: PaymentForm;
  packages: PackageOption[];
  prices: CategoryPrices;
  visitPrice: number | null;
  ptPrograms: PtProgramOption[];
  member: MemberSummary | null;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pembayaran</h1>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="payment-type">Jenis Pembayaran</Label>
        <Select
          items={PAYMENT_TYPES}
          value={form}
          onValueChange={(v) => v && router.replace(`/membership/payment?form=${v}`)}
        >
          <SelectTrigger id="payment-type" className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form === "new" && <RegisterMemberWizard packages={packages} prices={prices} />}
      {form === "visit" && <VisitForm price={visitPrice} />}
      {form === "renew" && (
        <RenewMemberForm
          key={member?.id ?? "none"}
          packages={packages}
          prices={prices}
          initialMember={member}
        />
      )}
      {form === "addon" && (
        <PtAddonForm key={member?.id ?? "none"} programs={ptPrograms} initialMember={member} />
      )}
    </div>
  );
}

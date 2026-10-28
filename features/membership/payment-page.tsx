"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PackageOption } from "./queries";
import { RegisterMemberWizard } from "./register-member-wizard";
import type { CategoryPrices } from "./validation";

const PAYMENT_TYPES = [{ value: "new-member", label: "Daftar Member Baru" }];

export function PaymentPage({
  packages,
  prices,
}: {
  packages: PackageOption[];
  prices: CategoryPrices;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pembayaran</h1>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="payment-type">Jenis Pembayaran</Label>
        <Select items={PAYMENT_TYPES} defaultValue="new-member">
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

      <RegisterMemberWizard packages={packages} prices={prices} />
    </div>
  );
}

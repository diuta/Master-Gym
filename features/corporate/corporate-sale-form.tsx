"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateId } from "@/lib/format";
import { membershipEndDate, todayWib } from "../membership/logic";
import { PaymentRows, type PaymentRow } from "../membership/payment-rows";
import { buyCorporateAction } from "./actions";
import type { CorporatePackageOption } from "./queries";
import { CorporatePurchaseSchema, type CorporatePurchaseInput } from "./validation";

const CASH: PaymentRow[] = [{ method: "cash", amount: 0 }];

export function CorporateSaleForm({ packages }: { packages: CorporatePackageOption[] }) {
  const [packageId, setPackageId] = useState<number | null>(null);
  const [visitQuota, setVisitQuota] = useState<number | null>(null);
  const [price, setPriceState] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>(CASH);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = packages.map((p) => ({
    value: p.id,
    label: `${p.companyName} — ${p.visitQuota} visit / ${p.months} bulan`,
  }));

  function reset() {
    setPackageId(null);
    setVisitQuota(null);
    setPriceState(null);
    setPayments(CASH);
    setErrors({});
  }

  function pickPackage(id: number | null) {
    setPackageId(id);
    // A different package refills Kuota and Harga, overwriting manual edits.
    const p = packages.find((x) => x.id === id);
    setVisitQuota(p?.visitQuota ?? null);
    setPriceState(p?.price ?? null);
    if (p) setPayments([{ method: "cash", amount: p.price }]);
  }

  // One payment row simply follows Harga; several rows stay as the kasir typed them.
  function setPrice(p: number | null) {
    setPriceState(p);
    if (payments.length === 1) setPayments([{ ...payments[0], amount: p ?? 0 }]);
  }

  // A package deleted in the pop-up must not stay selected.
  if (packageId !== null && !packages.some((p) => p.id === packageId)) {
    reset();
  }

  const selected = packages.find((p) => p.id === packageId);
  const endDate = selected
    ? // Preview only; the server recomputes the real end date.
      membershipEndDate(todayWib(), selected.months)
    : null;

  function submit() {
    if (pending) return;
    setMessage(null);
    setSuccess(null);
    const input = {
      corporatePackageId: packageId ?? undefined,
      visitQuota: visitQuota ?? undefined,
      price: price ?? undefined,
      payments,
    } as CorporatePurchaseInput;
    const r = CorporatePurchaseSchema.safeParse(input);
    if (!r.success) return setErrors(r.error.flatten().fieldErrors);
    setErrors({});
    startTransition(async () => {
      try {
        const result = await buyCorporateAction(input);
        if (result.success) {
          reset();
          const { companyName, visitQuota: quota, endDate: end } = result.data;
          return setSuccess(
            `Paket corporate ${companyName} tersimpan: ${quota} visit s/d ${formatDateId(end)}.`,
          );
        }
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      } catch {
        setMessage("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <div className="space-y-4">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="corp-package">
            Paket Corporate
            <RequiredMark />
          </Label>
          <Select
            items={items}
            value={packageId}
            onValueChange={(v) => pickPackage(v as number | null)}
          >
            <SelectTrigger id="corp-package" className="h-11 w-full text-base">
              <SelectValue placeholder="Pilih paket corporate" />
            </SelectTrigger>
            <SelectContent>
              {items.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("corporatePackageId")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corp-quota">
            Kuota Visit
            <RequiredMark />
          </Label>
          <Input
            id="corp-quota"
            className="h-11 text-base"
            inputMode="numeric"
            value={visitQuota === null ? "" : String(visitQuota)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setVisitQuota(digits === "" ? null : Number(digits));
            }}
          />
          {fieldError("visitQuota")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corp-price">
            Harga
            <RequiredMark />
          </Label>
          <CurrencyInput
            id="corp-price"
            className="h-11 text-base"
            value={price === null ? "" : String(price)}
            onChange={(raw) => setPrice(raw === "" ? null : Number(raw))}
          />
          {fieldError("price")}
        </div>
        {endDate && <p className="text-base">Berlaku s/d {formatDateId(endDate)}</p>}
        {packageId !== null && (
          <div className="space-y-1.5">
            <Label>
              Pembayaran
              <RequiredMark />
            </Label>
            <PaymentRows price={price ?? 0} value={payments} onChange={setPayments} />
            {fieldError("payments")}
          </div>
        )}

        {message && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="text-base">{message}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan Corporate"}
        </Button>
      </form>

      {success && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-base">{success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

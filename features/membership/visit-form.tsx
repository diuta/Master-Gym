"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { createVisitAction } from "./actions";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import { VisitSchema, type VisitInput } from "./validation";

export function VisitForm({ price: standardPrice }: { price: number | null }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lockerNo, setLockerNo] = useState("");
  const [price, setPriceState] = useState<number | null>(standardPrice);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: "cash", amount: standardPrice ?? 0 },
  ]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // One payment row simply follows Harga; several rows stay as the kasir typed them.
  function setPrice(p: number | null) {
    setPriceState(p);
    if (payments.length === 1) setPayments([{ ...payments[0], amount: p ?? 0 }]);
  }

  function submit() {
    if (pending) return;
    setMessage(null);
    setSaved(null);
    const input = { name, phone, lockerNo, price: price ?? undefined, payments } as VisitInput;
    const r = VisitSchema.safeParse(input);
    if (!r.success) return setErrors(r.error.flatten().fieldErrors);
    setErrors({});
    startTransition(async () => {
      try {
        const result = await createVisitAction(input);
        if (result.success) {
          setSaved(r.data.name);
          setName("");
          setPhone("");
          setLockerNo("");
          setPriceState(standardPrice);
          setPayments([{ method: "cash", amount: standardPrice ?? 0 }]);
          return;
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
    <form
      className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="visit-name">
          Nama
          <RequiredMark />
        </Label>
        <Input
          id="visit-name"
          className="h-11 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldError("name")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visit-phone">
          No. HP
          <RequiredMark />
        </Label>
        <Input
          id="visit-phone"
          className="h-11 text-base"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {fieldError("phone")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visit-locker">No. Loker</Label>
        <Input
          id="visit-locker"
          className="h-11 text-base"
          value={lockerNo}
          onChange={(e) => setLockerNo(e.target.value)}
        />
        {fieldError("lockerNo")}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="visit-price">
          Harga Visit
          <RequiredMark />
        </Label>
        <CurrencyInput
          id="visit-price"
          className="h-11 text-base"
          value={price === null ? "" : String(price)}
          onChange={(raw) => setPrice(raw === "" ? null : Number(raw))}
        />
        {fieldError("price")}
      </div>
      <div className="space-y-1.5">
        <Label>
          Pembayaran
          <RequiredMark />
        </Label>
        <PaymentRows price={price ?? 0} value={payments} onChange={setPayments} />
        {fieldError("payments")}
      </div>

      {message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-base">{message}</AlertDescription>
        </Alert>
      )}
      {saved && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-base">
            Visit tersimpan, {saved} sudah check-in.
          </AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="xl" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan & Check-In"}
      </Button>
    </form>
  );
}

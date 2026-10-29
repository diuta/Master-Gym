"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { rupiah } from "@/lib/format";
import { createVisitAction } from "./actions";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import { VisitSchema, type VisitInput } from "./validation";

const PRICE_UNSET = "Harga belum diatur, hubungi superadmin.";

export function VisitForm({ price }: { price: number | null }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lockerNo, setLockerNo] = useState("");
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: "cash", amount: price ?? 0 },
  ]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending || price === null) return;
    setMessage(null);
    setSaved(null);
    const input = { name, phone, lockerNo, price, payments } as VisitInput;
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
          setPayments([{ method: "cash", amount: price }]);
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
        <p className="text-sm font-medium">Harga</p>
        <p className="text-2xl font-semibold">{price === null ? "-" : rupiah.format(price)}</p>
        {price === null && <p className="text-base text-destructive">{PRICE_UNSET}</p>}
      </div>
      {price !== null && (
        <div className="space-y-1.5">
          <Label>
            Pembayaran
            <RequiredMark />
          </Label>
          <PaymentRows price={price} value={payments} onChange={setPayments} />
          {fieldError("payments")}
        </div>
      )}

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

      <Button type="submit" size="xl" disabled={pending || price === null}>
        {pending ? "Menyimpan..." : "Simpan & Check-In"}
      </Button>
    </form>
  );
}
